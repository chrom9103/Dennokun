"""
generate.py — 生成結果のDB保存・削除ハンドラ
"""
from typing import List, Optional


async def bulk_insert_matches(event_id: int, match_dicts: List[dict]) -> List[dict]:
    """生成済み対戦リストを event_matches テーブルに一括挿入する。"""
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    inserted = []
    try:
        async with conn.transaction():
            for m in match_dicts:
                row = await conn.fetchrow(
                    """INSERT INTO event_matches (
                           event_id,
                           event_timetable_segment_id,
                           event_room_id,
                           event_section_id,
                           aff_team_id,
                           neg_team_id,
                           main_judge_staff_id,
                           sub_judge1_staff_id,
                           sub_judge2_staff_id,
                           sub_judge3_staff_id,
                           sub_judge4_staff_id,
                           timekeeper_staff_id,
                           judges_assignment_count,
                           order_number_in_segment
                       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                       RETURNING id, event_id, event_timetable_segment_id, event_room_id,
                                 event_section_id, aff_team_id, neg_team_id,
                                 main_judge_staff_id, sub_judge1_staff_id, sub_judge2_staff_id,
                                 sub_judge3_staff_id, sub_judge4_staff_id,
                                 timekeeper_staff_id, judges_assignment_count, order_number_in_segment,
                                 is_result_confirmed, created_at, updated_at""",
                    event_id,
                    m.get("event_timetable_segment_id"),
                    m.get("event_room_id"),
                    m.get("event_section_id"),
                    m.get("aff_team_id"),
                    m.get("neg_team_id"),
                    m.get("main_judge_staff_id"),
                    m.get("sub_judge1_staff_id"),
                    m.get("sub_judge2_staff_id"),
                    m.get("sub_judge3_staff_id"),
                    m.get("sub_judge4_staff_id"),
                    m.get("timekeeper_staff_id"),
                    m.get("judges_assignment_count", 0),
                    m.get("order_number_in_segment"),
                )
                inserted.append(dict(row))
        return inserted
    finally:
        await conn.close()


async def delete_all_matches(event_id: int) -> int:
    """大会の全試合を論理削除する。削除件数を返す。"""
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        result = await conn.execute(
            """UPDATE event_matches
               SET deleted_at = NOW(), updated_at = NOW()
               WHERE event_id = $1 AND deleted_at IS NULL""",
            event_id,
        )
        # result は "UPDATE N" 形式の文字列
        try:
            return int(result.split()[-1])
        except (ValueError, IndexError):
            return 0
    finally:
        await conn.close()



# 「引数未渡し」と「明示的な null」を区別するセンチネル
_UNSET = object()


async def update_match_assignment(
    match_id: int,
    event_timetable_segment_id=_UNSET,
    event_room_id=_UNSET,
    aff_team_id=_UNSET,
    neg_team_id=_UNSET,
    main_judge_staff_id=_UNSET,
    sub_judge1_staff_id=_UNSET,
    sub_judge2_staff_id=_UNSET,
    sub_judge3_staff_id=_UNSET,
    sub_judge4_staff_id=_UNSET,
    timekeeper_staff_id=_UNSET,
    event_section_id=_UNSET,
    order_number_in_segment=_UNSET,
    is_staffs_fixed=_UNSET,
) -> Optional[dict]:
    """試合の割当情報（チーム・会場・時間枠・ジャッジ・司会タイマー）を更新する。
    _UNSET（デフォルト）は「変更しない」を意味する。
    None を明示的に渡した場合は「未割り当て（NULL）」としてDBに書き込む。
    """
    from app.core.db import get_db_connection
    from app.core.handle_db.matches import get_match_by_id
    conn = await get_db_connection()
    try:
        fields = {}
        local_vars = {
            "event_timetable_segment_id": event_timetable_segment_id,
            "event_room_id": event_room_id,
            "aff_team_id": aff_team_id,
            "neg_team_id": neg_team_id,
            "main_judge_staff_id": main_judge_staff_id,
            "sub_judge1_staff_id": sub_judge1_staff_id,
            "sub_judge2_staff_id": sub_judge2_staff_id,
            "sub_judge3_staff_id": sub_judge3_staff_id,
            "sub_judge4_staff_id": sub_judge4_staff_id,
            "timekeeper_staff_id": timekeeper_staff_id,
            "event_section_id": event_section_id,
            "order_number_in_segment": order_number_in_segment,
            "is_staffs_fixed": is_staffs_fixed,
        }
        for col, val in local_vars.items():
            if val is not _UNSET:
                fields[col] = val

        if not fields:
            return await get_match_by_id(match_id)

        set_clause = ", ".join([f"{k} = ${i+1}" for i, k in enumerate(fields.keys())])
        values = list(fields.values()) + [match_id]
        await conn.execute(
            f"UPDATE event_matches SET {set_clause}, updated_at = NOW() WHERE id = ${len(values)} AND deleted_at IS NULL",
            *values,
        )
        return await get_match_by_id(match_id)
    finally:
        await conn.close()




async def bulk_update_match_judges(match_dicts: List[dict]) -> None:
    """試合のジャッジ・司会タイマー割り当て情報を一括更新する。"""
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        async with conn.transaction():
            for m in match_dicts:
                await conn.execute(
                    """UPDATE event_matches SET
                           main_judge_staff_id = $1,
                           sub_judge1_staff_id = $2,
                           sub_judge2_staff_id = $3,
                           sub_judge3_staff_id = $4,
                           sub_judge4_staff_id = $5,
                           timekeeper_staff_id = $6,
                           judges_assignment_count = $7,
                           updated_at = NOW()
                       WHERE id = $8 AND deleted_at IS NULL""",
                    m.get("main_judge_staff_id"),
                    m.get("sub_judge1_staff_id"),
                    m.get("sub_judge2_staff_id"),
                    m.get("sub_judge3_staff_id"),
                    m.get("sub_judge4_staff_id"),
                    m.get("timekeeper_staff_id"),
                    m.get("judges_assignment_count", 0),
                    m["id"],
                )
    finally:
        await conn.close()


async def lock_segment_staffs(event_id: int, segment_id: int, is_fixed: bool) -> int:
    """指定された時間枠の全試合の is_staffs_fixed カラムを一括更新する。"""
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        result = await conn.execute(
            """UPDATE event_matches
               SET is_staffs_fixed = $1, updated_at = NOW()
               WHERE event_id = $2 AND event_timetable_segment_id = $3 AND deleted_at IS NULL""",
            is_fixed,
            event_id,
            segment_id,
        )
        try:
            return int(result.split()[-1])
        except (ValueError, IndexError):
            return 0
    finally:
        await conn.close()


async def delete_unconfirmed_pre_round_matches(event_id: int) -> int:
    """大会の確定していない予選試合（is_staffs_fixed = False かつ 予選セグメント）を論理削除する。"""
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        result = await conn.execute(
            """UPDATE event_matches
               SET deleted_at = NOW(), updated_at = NOW()
               FROM event_timetable_segments ets
               WHERE event_matches.event_timetable_segment_id = ets.id
                 AND event_matches.event_id = $1
                 AND event_matches.is_staffs_fixed = FALSE
                 AND ets.is_pre_round = TRUE
                 AND event_matches.deleted_at IS NULL""",
            event_id,
        )
        try:
            return int(result.split()[-1])
        except (ValueError, IndexError):
            return 0
    finally:
        await conn.close()
