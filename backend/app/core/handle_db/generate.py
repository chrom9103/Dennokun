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
                           judges_assignment_count,
                           order_number_in_segment
                       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                       RETURNING id, event_id, event_timetable_segment_id, event_room_id,
                                 event_section_id, aff_team_id, neg_team_id,
                                 main_judge_staff_id, sub_judge1_staff_id, sub_judge2_staff_id,
                                 judges_assignment_count, order_number_in_segment,
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


async def update_match_assignment(
    match_id: int,
    event_timetable_segment_id: Optional[int] = None,
    event_room_id: Optional[int] = None,
    aff_team_id: Optional[int] = None,
    neg_team_id: Optional[int] = None,
    main_judge_staff_id: Optional[int] = None,
    sub_judge1_staff_id: Optional[int] = None,
    sub_judge2_staff_id: Optional[int] = None,
    event_section_id: Optional[int] = None,
    order_number_in_segment: Optional[int] = None,
) -> Optional[dict]:
    """試合の割当情報（チーム・会場・時間枠・ジャッジ）を更新する。"""
    from app.core.db import get_db_connection
    from app.core.handle_db.matches import get_match_by_id
    conn = await get_db_connection()
    try:
        fields = {}
        if event_timetable_segment_id is not None:
            fields["event_timetable_segment_id"] = event_timetable_segment_id
        if event_room_id is not None:
            fields["event_room_id"] = event_room_id
        if aff_team_id is not None:
            fields["aff_team_id"] = aff_team_id
        if neg_team_id is not None:
            fields["neg_team_id"] = neg_team_id
        if main_judge_staff_id is not None:
            fields["main_judge_staff_id"] = main_judge_staff_id
        if sub_judge1_staff_id is not None:
            fields["sub_judge1_staff_id"] = sub_judge1_staff_id
        if sub_judge2_staff_id is not None:
            fields["sub_judge2_staff_id"] = sub_judge2_staff_id
        if event_section_id is not None:
            fields["event_section_id"] = event_section_id
        if order_number_in_segment is not None:
            fields["order_number_in_segment"] = order_number_in_segment

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
