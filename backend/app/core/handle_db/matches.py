"""Match DB handlers: list, detail, result update."""
from typing import Optional, List


async def get_all_matches(event_id: int) -> List[dict]:
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            """SELECT m.id, m.event_id, m.event_timetable_segment_id, m.event_room_id,
                      m.event_section_id, m.aff_team_id, m.neg_team_id,
                      m.aff_votes, m.neg_votes,
                      m.aff_comm_sum, m.neg_comm_sum,
                      m.aff_manner, m.neg_manner,
                      m.aff_won, m.neg_won,
                      m.is_result_confirmed, m.is_result_public, m.is_staffs_fixed,
                      m.order_number_in_segment, m.note, m.name,
                      m.main_judge_staff_id, m.sub_judge1_staff_id, m.sub_judge2_staff_id,
                      m.sub_judge3_staff_id, m.sub_judge4_staff_id,
                      m.timekeeper_staff_id, m.judges_assignment_count,
                      m.created_at, m.updated_at,
                      ts.name AS timetable_segment_name,
                      ts.order_number AS segment_order,
                      r.name AS room_name,
                      sec.name AS section_name,
                      at.name AS aff_team_name,
                      nt.name AS neg_team_name,
                      tk.name AS timekeeper_name
               FROM event_matches m
               LEFT JOIN event_timetable_segments ts ON ts.id = m.event_timetable_segment_id AND ts.deleted_at IS NULL
               LEFT JOIN event_rooms r ON r.id = m.event_room_id AND r.deleted_at IS NULL
               LEFT JOIN event_sections sec ON sec.id = m.event_section_id AND sec.deleted_at IS NULL
               LEFT JOIN event_teams at ON at.id = m.aff_team_id AND at.deleted_at IS NULL
               LEFT JOIN event_teams nt ON nt.id = m.neg_team_id AND nt.deleted_at IS NULL
               LEFT JOIN event_staffs tk ON tk.id = m.timekeeper_staff_id AND tk.deleted_at IS NULL
               WHERE m.event_id = $1 AND m.deleted_at IS NULL
               ORDER BY ts.order_number ASC NULLS LAST, r.order_number ASC NULLS LAST, m.order_number_in_segment ASC NULLS LAST, m.id ASC""",
            event_id,
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()


async def get_match_by_id(match_id: int) -> Optional[dict]:
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            """SELECT m.id, m.event_id, m.event_timetable_segment_id, m.event_room_id,
                      m.event_section_id, m.aff_team_id, m.neg_team_id,
                      m.aff_votes, m.neg_votes,
                      m.aff_constructive_comm, m.aff_question_comm, m.aff_answer_comm,
                      m.aff_first_rebuttal_comm, m.aff_second_rebuttal_comm,
                      m.neg_constructive_comm, m.neg_question_comm, m.neg_answer_comm,
                      m.neg_first_rebuttal_comm, m.neg_second_rebuttal_comm,
                      m.aff_comm_sum, m.neg_comm_sum,
                      m.aff_manner, m.neg_manner,
                      m.aff_won, m.neg_won,
                      m.is_result_confirmed, m.is_result_public, m.is_staffs_fixed,
                      m.judges_assignment_count, m.order_number_in_segment, m.note, m.name,
                      m.main_judge_staff_id, m.sub_judge1_staff_id, m.sub_judge2_staff_id,
                      m.sub_judge3_staff_id, m.sub_judge4_staff_id,
                      m.timekeeper_staff_id, m.created_at, m.updated_at,
                      ts.name AS timetable_segment_name,
                      ts.start_time, ts.end_time,
                      r.name AS room_name,
                      sec.name AS section_name,
                      at.name AS aff_team_name,
                      nt.name AS neg_team_name,
                      mj.name AS main_judge_name,
                      sj1.name AS sub_judge1_name,
                      sj2.name AS sub_judge2_name,
                      sj3.name AS sub_judge3_name,
                      sj4.name AS sub_judge4_name,
                      tk.name AS timekeeper_name
               FROM event_matches m
               LEFT JOIN event_timetable_segments ts ON ts.id = m.event_timetable_segment_id AND ts.deleted_at IS NULL
               LEFT JOIN event_rooms r ON r.id = m.event_room_id AND r.deleted_at IS NULL
               LEFT JOIN event_sections sec ON sec.id = m.event_section_id AND sec.deleted_at IS NULL
               LEFT JOIN event_teams at ON at.id = m.aff_team_id AND at.deleted_at IS NULL
               LEFT JOIN event_teams nt ON nt.id = m.neg_team_id AND nt.deleted_at IS NULL
               LEFT JOIN event_staffs mj ON mj.id = m.main_judge_staff_id AND mj.deleted_at IS NULL
               LEFT JOIN event_staffs sj1 ON sj1.id = m.sub_judge1_staff_id AND sj1.deleted_at IS NULL
               LEFT JOIN event_staffs sj2 ON sj2.id = m.sub_judge2_staff_id AND sj2.deleted_at IS NULL
               LEFT JOIN event_staffs sj3 ON sj3.id = m.sub_judge3_staff_id AND sj3.deleted_at IS NULL
               LEFT JOIN event_staffs sj4 ON sj4.id = m.sub_judge4_staff_id AND sj4.deleted_at IS NULL
               LEFT JOIN event_staffs tk ON tk.id = m.timekeeper_staff_id AND tk.deleted_at IS NULL
               WHERE m.id = $1 AND m.deleted_at IS NULL""",
            match_id,
        )
        if not row:
            return None
        d = dict(row)
        # Also fetch voting details
        voting_rows = await get_match_voting_details(match_id)
        d["voting_details"] = voting_rows
        return d
    finally:
        await conn.close()


async def get_match_voting_details(match_id: int) -> List[dict]:
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            """SELECT id, event_match_id, judge_index, aff_won, neg_won,
                      aff_constructive_comm, aff_question_comm, aff_answer_comm,
                      aff_first_rebuttal_comm, aff_second_rebuttal_comm,
                      neg_constructive_comm, neg_question_comm, neg_answer_comm,
                      neg_first_rebuttal_comm, neg_second_rebuttal_comm,
                      aff_comm_sum, neg_comm_sum, aff_manner, neg_manner, note
               FROM event_match_voting_details
               WHERE event_match_id = $1 AND deleted_at IS NULL
               ORDER BY judge_index ASC""",
            match_id,
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()


async def save_match_result(
    match_id: int,
    aff_votes: int,
    neg_votes: int,
    aff_comm_sum: int,
    neg_comm_sum: int,
    aff_manner: int,
    neg_manner: int,
    is_result_confirmed: bool = False,
    voting_details: Optional[List[dict]] = None,
) -> Optional[dict]:
    """Save match result scores and voting details."""
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        aff_won = 1 if aff_votes > neg_votes else 0
        neg_won = 1 if neg_votes > aff_votes else 0

        async with conn.transaction():
            await conn.execute(
                """UPDATE event_matches SET
                       aff_votes = $1, neg_votes = $2,
                       aff_comm_sum = $3, neg_comm_sum = $4,
                       aff_manner = $5, neg_manner = $6,
                       aff_won = $7, neg_won = $8,
                       is_result_confirmed = $9,
                       updated_at = NOW()
                   WHERE id = $10 AND deleted_at IS NULL""",
                aff_votes, neg_votes, aff_comm_sum, neg_comm_sum,
                aff_manner, neg_manner, aff_won, neg_won,
                is_result_confirmed, match_id,
            )

            if voting_details is not None:
                # Delete existing and re-insert
                await conn.execute(
                    "UPDATE event_match_voting_details SET deleted_at = NOW() WHERE event_match_id = $1",
                    match_id,
                )
                for vd in voting_details:
                    await conn.execute(
                        """INSERT INTO event_match_voting_details
                               (event_match_id, judge_index, aff_won, neg_won,
                                aff_constructive_comm, aff_question_comm, aff_answer_comm,
                                aff_first_rebuttal_comm, aff_second_rebuttal_comm,
                                neg_constructive_comm, neg_question_comm, neg_answer_comm,
                                neg_first_rebuttal_comm, neg_second_rebuttal_comm,
                                aff_comm_sum, neg_comm_sum, aff_manner, neg_manner, note)
                           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)""",
                        match_id,
                        vd.get("judge_index", 0),
                        vd.get("aff_won", 0),
                        vd.get("neg_won", 0),
                        vd.get("aff_constructive_comm", 0),
                        vd.get("aff_question_comm", 0),
                        vd.get("aff_answer_comm", 0),
                        vd.get("aff_first_rebuttal_comm", 0),
                        vd.get("aff_second_rebuttal_comm", 0),
                        vd.get("neg_constructive_comm", 0),
                        vd.get("neg_question_comm", 0),
                        vd.get("neg_answer_comm", 0),
                        vd.get("neg_first_rebuttal_comm", 0),
                        vd.get("neg_second_rebuttal_comm", 0),
                        vd.get("aff_comm_sum", 0),
                        vd.get("neg_comm_sum", 0),
                        vd.get("aff_manner", 0),
                        vd.get("neg_manner", 0),
                        vd.get("note", None),
                    )

        return await get_match_by_id(match_id)
    finally:
        await conn.close()
