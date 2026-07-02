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
    AssignJudgesRequest,
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
    時間枠の並行試合数設定に基づいて、対戦・スロット（時間枠・会場）を自動生成し、DBに保存する。

    overwrite=True の場合は既存試合を論理削除してから生成する。
    """
    try:
        from app.core.handle_db.teams import get_all_teams
        from app.core.handle_db.timetable_segments import get_all_timetable_segments
        from app.core.handle_db.rooms import get_all_rooms
        from app.core.handle_db.generate import (
            bulk_insert_matches,
            delete_all_matches,
        )
        from app.algorithm.match_generator import generate_matches_by_slots

        # 1. マスタデータ取得
        teams = await get_all_teams(event_id)
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

        # 3. 対戦・スロット割当の同時生成
        pairs, warnings = generate_matches_by_slots(
            teams=teams,
            segments=segments,
            rooms=rooms,
            parallel_matches_map=req.segment_parallel_matches,
        )

        if not pairs:
            return GenerateMatchesResponse(
                generated_count=0,
                deleted_count=deleted_count,
                warnings=warnings or ["生成された試合がありません。並行試合数を1以上に設定してください。"],
            )

        # 4. DB保存
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


@router.post("/assign-judges")
async def assign_judges_endpoint(event_id: int, req: AssignJudgesRequest):
    """既存の全試合に対して、スタッフ情報・利害関係・担当可能枠からジャッジを自動割り当て・更新する。"""
    try:
        from app.core.handle_db.matches import get_all_matches
        from app.core.handle_db.teams import get_all_teams
        from app.core.handle_db.staffs import get_all_staffs
        from app.core.handle_db.generate import bulk_update_match_judges
        from app.algorithm.judge_assigner import assign_judges

        matches = await get_all_matches(event_id)
        if not matches:
            raise HTTPException(
                status_code=422,
                detail="試合が登録されていません。先に試合（対戦カード）を生成してください。"
            )

        teams = await get_all_teams(event_id)
        staffs = await get_all_staffs(event_id)

        if not staffs:
            raise HTTPException(
                status_code=422,
                detail="スタッフが登録されていません。先にスタッフを登録してください。"
            )

        judge_staffs = [s for s in staffs if s.get("can_be_main_judge") or s.get("can_be_sub_judge")]
        if not judge_staffs:
            raise HTTPException(
                status_code=422,
                detail="ジャッジ担当可能なスタッフ（主審・副審の資格持ち）が登録されていません。"
            )

        # 既存の試合データを基にジャッジを割り当てる
        assigned_matches = assign_judges(
            matches=matches,
            staffs=judge_staffs,
            teams=teams,
            judges_per_match=req.segment_judge_counts,
        )

        # 更新を保存
        await bulk_update_match_judges(assigned_matches)

        return {"status": "ok", "updated_count": len(assigned_matches)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

