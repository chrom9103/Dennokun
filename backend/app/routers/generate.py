"""
Generate router: match auto-generation, reset, assignment update, dashboard summary.
"""
from fastapi import APIRouter, HTTPException
from typing import List

from app.models.generate import (
    GenerateMatchesRequest,
    GenerateMatchesResponse,
    MatchAssignmentUpdate,
    DashboardSummary,
)
from app.models.matches import MatchDetail

router = APIRouter(prefix="/api/events/{event_id}", tags=["generate"])


@router.get("/dashboard-summary", response_model=DashboardSummary)
async def get_dashboard_summary(event_id: int):
    """大会ダッシュボード用の集計サマリーを返す。"""
    try:
        from app.core.db import get_db_connection
        conn = await get_db_connection()
        try:
            row = await conn.fetchrow(
                """SELECT
                     (SELECT COUNT(*) FROM event_matches  WHERE event_id=$1 AND deleted_at IS NULL) AS total_matches,
                     (SELECT COUNT(*) FROM event_matches  WHERE event_id=$1 AND deleted_at IS NULL AND is_result_confirmed=TRUE) AS confirmed_matches,
                     (SELECT COUNT(*) FROM event_teams    WHERE event_id=$1 AND deleted_at IS NULL) AS total_teams,
                     (SELECT COUNT(*) FROM event_staffs   WHERE event_id=$1 AND deleted_at IS NULL) AS total_staffs,
                     (SELECT COUNT(*) FROM event_schools  WHERE event_id=$1 AND deleted_at IS NULL) AS total_schools,
                     (SELECT COUNT(*) FROM event_sections WHERE event_id=$1 AND deleted_at IS NULL) AS total_sections
                """,
                event_id,
            )
        finally:
            await conn.close()

        if not row:
            raise HTTPException(status_code=404, detail="Event not found")

        d = dict(row)
        d["total_matches"] = d["total_matches"] or 0
        d["confirmed_matches"] = d["confirmed_matches"] or 0
        d["pending_matches"] = d["total_matches"] - d["confirmed_matches"]
        d["total_teams"] = d["total_teams"] or 0
        d["total_staffs"] = d["total_staffs"] or 0
        d["total_schools"] = d["total_schools"] or 0
        d["total_sections"] = d["total_sections"] or 0
        return d
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-matches", response_model=GenerateMatchesResponse)
async def generate_matches(event_id: int, req: GenerateMatchesRequest):
    """
    試合・ジャッジ・スロットを自動生成してDBに保存する。

    overwrite=True の場合は既存試合を削除してから生成する。
    """
    try:
        from app.core.handle_db.teams import get_all_teams
        from app.core.handle_db.staffs import get_all_staffs
        from app.core.handle_db.timetable_segments import get_all_timetable_segments
        from app.core.handle_db.rooms import get_all_rooms
        from app.core.handle_db.generate import (
            bulk_insert_matches,
            delete_all_matches,
        )
        from app.algorithm.match_generator import generate_match_pairs
        from app.algorithm.slot_assigner import assign_slots
        from app.algorithm.judge_assigner import assign_judges

        warnings: List[str] = []

        # 1. マスタデータ取得
        teams = await get_all_teams(event_id)
        staffs = await get_all_staffs(event_id)
        segments = await get_all_timetable_segments(event_id)
        rooms = await get_all_rooms(event_id)

        if not teams:
            raise HTTPException(
                status_code=422,
                detail="チームが登録されていません。先にチームを登録してください。"
            )

        # 2. 既存試合の削除（overwrite モード）
        deleted_count = 0
        if req.overwrite:
            deleted_count = await delete_all_matches(event_id)

        # 3. 対戦ペア生成
        pairs = generate_match_pairs(
            teams=teams,
            rounds=req.rounds,
        )

        if not pairs:
            return GenerateMatchesResponse(
                generated_count=0,
                deleted_count=deleted_count,
                warnings=["チームが1チームのみのため対戦ペアを生成できませんでした。"],
            )

        # 4. スロット割当
        if req.assign_slots:
            if not segments:
                warnings.append("時間枠が登録されていないため、スロット割当をスキップしました。")
            if not rooms:
                warnings.append("会場が登録されていないため、スロット割当をスキップしました。")
            if segments and rooms:
                pairs = assign_slots(pairs, segments, rooms)
                # スロット不足警告
                unassigned = sum(1 for p in pairs if p.get("event_timetable_segment_id") is None)
                if unassigned > 0:
                    warnings.append(
                        f"{unassigned}件の試合がスロット不足で割り当てられませんでした。"
                        "時間枠・会場を増やしてください。"
                    )

        # 5. ジャッジ割当
        if req.assign_judges:
            if not staffs:
                warnings.append("スタッフが登録されていないため、ジャッジ割当をスキップしました。")
            else:
                judge_staffs = [s for s in staffs if s.get("can_be_main_judge") or s.get("can_be_sub_judge")]
                if not judge_staffs:
                    warnings.append("ジャッジ担当可能なスタッフがいないため、ジャッジ割当をスキップしました。")
                else:
                    pairs = assign_judges(
                        matches=pairs,
                        staffs=judge_staffs,
                        teams=teams,
                        judges_per_match=req.judges_per_match,
                    )

        # 6. DB保存
        inserted = await bulk_insert_matches(event_id, pairs)

        return GenerateMatchesResponse(
            generated_count=len(inserted),
            deleted_count=deleted_count,
            warnings=warnings,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/matches")
async def delete_all_matches_endpoint(event_id: int):
    """大会の全試合を削除する（再生成用）。"""
    try:
        from app.core.handle_db.generate import delete_all_matches
        count = await delete_all_matches(event_id)
        return {"deleted_count": count, "status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/matches/{match_id}/assignment", response_model=MatchDetail)
async def update_match_assignment(event_id: int, match_id: int, data: MatchAssignmentUpdate):
    """試合のチーム・会場・時間枠・ジャッジを個別に変更する（微調整）。"""
    try:
        from app.core.handle_db.generate import update_match_assignment as _update
        match = await _update(match_id=match_id, **data.dict(exclude_none=True))
        if not match or match["event_id"] != event_id:
            raise HTTPException(status_code=404, detail="Match not found")
        return match
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
