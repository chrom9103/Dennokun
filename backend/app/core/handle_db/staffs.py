"""Staff (スタッフ) DB handlers."""
from typing import Optional, List


async def get_all_staffs(event_id: int) -> List[dict]:
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            """SELECT s.id, s.event_id, s.name, s.can_be_main_judge, s.can_be_sub_judge,
                      s.can_be_timekeeper, s.order_of_application, s.note,
                      s.present_timetable_segments_raw_value,
                      s.created_at, s.updated_at, s.deleted_at,
                      COALESCE(
                          array_agg(DISTINCT sis.event_school_id) FILTER (WHERE sis.event_school_id IS NOT NULL),
                          '{}'
                      ) AS interested_school_ids,
                      COALESCE(
                          array_agg(DISTINCT sc.name) FILTER (WHERE sc.name IS NOT NULL),
                          '{}'
                      ) AS interested_school_names,
                      COALESCE(
                          array_agg(DISTINCT pts.event_timetable_segment_id) FILTER (WHERE pts.event_timetable_segment_id IS NOT NULL),
                          '{}'
                      ) AS present_segment_ids
               FROM event_staffs s
               LEFT JOIN event_staff_interested_schools sis ON sis.event_staff_id = s.id
               LEFT JOIN event_schools sc ON sc.id = sis.event_school_id AND sc.deleted_at IS NULL
               LEFT JOIN event_staff_present_timetable_segments pts ON pts.event_staff_id = s.id
               WHERE s.event_id = $1 AND s.deleted_at IS NULL
               GROUP BY s.id
               ORDER BY s.order_of_application ASC NULLS LAST, s.id ASC""",
            event_id,
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()


async def get_staff_by_id(staff_id: int) -> Optional[dict]:
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            """SELECT s.id, s.event_id, s.name, s.can_be_main_judge, s.can_be_sub_judge,
                      s.can_be_timekeeper, s.order_of_application, s.note,
                      s.present_timetable_segments_raw_value,
                      s.created_at, s.updated_at, s.deleted_at,
                      COALESCE(
                          array_agg(DISTINCT sis.event_school_id) FILTER (WHERE sis.event_school_id IS NOT NULL),
                          '{}'
                      ) AS interested_school_ids,
                      COALESCE(
                          array_agg(DISTINCT sc.name) FILTER (WHERE sc.name IS NOT NULL),
                          '{}'
                      ) AS interested_school_names,
                      COALESCE(
                          array_agg(DISTINCT pts.event_timetable_segment_id) FILTER (WHERE pts.event_timetable_segment_id IS NOT NULL),
                          '{}'
                      ) AS present_segment_ids
               FROM event_staffs s
               LEFT JOIN event_staff_interested_schools sis ON sis.event_staff_id = s.id
               LEFT JOIN event_schools sc ON sc.id = sis.event_school_id AND sc.deleted_at IS NULL
               LEFT JOIN event_staff_present_timetable_segments pts ON pts.event_staff_id = s.id
               WHERE s.id = $1 AND s.deleted_at IS NULL
               GROUP BY s.id""",
            staff_id,
        )
        return dict(row) if row else None
    finally:
        await conn.close()


async def create_staff(
    event_id: int,
    name: str,
    can_be_main_judge: bool = False,
    can_be_sub_judge: bool = False,
    can_be_timekeeper: bool = False,
    order_of_application: Optional[int] = None,
    note: Optional[str] = None,
    interested_school_ids: Optional[List[int]] = None,
    present_segment_ids: Optional[List[int]] = None,
) -> dict:
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        async with conn.transaction():
            row = await conn.fetchrow(
                """INSERT INTO event_staffs
                       (event_id, name, can_be_main_judge, can_be_sub_judge, can_be_timekeeper,
                        order_of_application, note)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   RETURNING id""",
                event_id, name, can_be_main_judge, can_be_sub_judge, can_be_timekeeper,
                order_of_application, note,
            )
            staff_id = row["id"]

            # Insert interested schools
            if interested_school_ids:
                for school_id in interested_school_ids:
                    await conn.execute(
                        """INSERT INTO event_staff_interested_schools (event_school_id, event_staff_id)
                           VALUES ($1, $2) ON CONFLICT DO NOTHING""",
                        school_id, staff_id,
                    )

            # Insert present timetable segments
            if present_segment_ids:
                for seg_id in present_segment_ids:
                    await conn.execute(
                        """INSERT INTO event_staff_present_timetable_segments (event_timetable_segment_id, event_staff_id)
                           VALUES ($1, $2) ON CONFLICT DO NOTHING""",
                        seg_id, staff_id,
                    )

        return await get_staff_by_id(staff_id)
    finally:
        await conn.close()


async def update_staff(
    staff_id: int,
    interested_school_ids: Optional[List[int]] = None,
    present_segment_ids: Optional[List[int]] = None,
    **kwargs,
) -> Optional[dict]:
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        allowed = {"name", "can_be_main_judge", "can_be_sub_judge", "can_be_timekeeper",
                   "order_of_application", "note"}
        fields = {k: v for k, v in kwargs.items() if k in allowed}

        async with conn.transaction():
            if fields:
                set_clause = ", ".join([f"{k} = ${i+1}" for i, k in enumerate(fields.keys())])
                values = list(fields.values()) + [staff_id]
                await conn.execute(
                    f"UPDATE event_staffs SET {set_clause}, updated_at = NOW() WHERE id = ${len(values)} AND deleted_at IS NULL",
                    *values,
                )

            # Replace interested schools if provided
            if interested_school_ids is not None:
                await conn.execute(
                    "DELETE FROM event_staff_interested_schools WHERE event_staff_id = $1",
                    staff_id,
                )
                for school_id in interested_school_ids:
                    await conn.execute(
                        """INSERT INTO event_staff_interested_schools (event_school_id, event_staff_id)
                           VALUES ($1, $2) ON CONFLICT DO NOTHING""",
                        school_id, staff_id,
                    )

            # Replace present segments if provided
            if present_segment_ids is not None:
                await conn.execute(
                    "DELETE FROM event_staff_present_timetable_segments WHERE event_staff_id = $1",
                    staff_id,
                )
                for seg_id in present_segment_ids:
                    await conn.execute(
                        """INSERT INTO event_staff_present_timetable_segments (event_timetable_segment_id, event_staff_id)
                           VALUES ($1, $2) ON CONFLICT DO NOTHING""",
                        seg_id, staff_id,
                    )

        return await get_staff_by_id(staff_id)
    finally:
        await conn.close()


async def delete_staff(staff_id: int) -> bool:
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        result = await conn.execute(
            "UPDATE event_staffs SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
            staff_id,
        )
        return result == "UPDATE 1"
    finally:
        await conn.close()
