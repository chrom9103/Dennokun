"""TimetableSegment (時間枠) DB handlers."""
from typing import Optional, List


async def get_all_timetable_segments(event_id: int) -> List[dict]:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            """SELECT id, event_id, name, name_aliases, start_time, end_time,
                      order_number, is_pre_round, created_at, updated_at, deleted_at
               FROM event_timetable_segments
               WHERE event_id = $1 AND deleted_at IS NULL
               ORDER BY order_number ASC NULLS LAST, id ASC""",
            event_id,
        )
        result = []
        for r in rows:
            d = dict(r)
            # name_aliases is TEXT[] in postgres, comes as list or None
            if d.get("name_aliases") is None:
                d["name_aliases"] = []
            result.append(d)
        return result
    finally:
        await conn.close()


async def get_timetable_segment_by_id(segment_id: int) -> Optional[dict]:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            """SELECT id, event_id, name, name_aliases, start_time, end_time,
                      order_number, is_pre_round, created_at, updated_at, deleted_at
               FROM event_timetable_segments WHERE id = $1 AND deleted_at IS NULL""",
            segment_id,
        )
        if not row:
            return None
        d = dict(row)
        if d.get("name_aliases") is None:
            d["name_aliases"] = []
        return d
    finally:
        await conn.close()


async def create_timetable_segment(
    event_id: int,
    name: str,
    order_number: Optional[int] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    is_pre_round: bool = False,
    name_aliases: Optional[List[str]] = None,
) -> dict:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            """INSERT INTO event_timetable_segments
                   (event_id, name, order_number, start_time, end_time, is_pre_round, name_aliases)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id, event_id, name, name_aliases, start_time, end_time,
                         order_number, is_pre_round, created_at, updated_at, deleted_at""",
            event_id, name, order_number, start_time, end_time, is_pre_round,
            name_aliases or [],
        )
        d = dict(row)
        if d.get("name_aliases") is None:
            d["name_aliases"] = []
        return d
    finally:
        await conn.close()


async def update_timetable_segment(segment_id: int, **kwargs) -> Optional[dict]:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        allowed = {"name", "order_number", "start_time", "end_time", "is_pre_round", "name_aliases"}
        fields = {k: v for k, v in kwargs.items() if k in allowed}

        if not fields:
            return await get_timetable_segment_by_id(segment_id)

        set_clause = ", ".join([f"{k} = ${i+1}" for i, k in enumerate(fields.keys())])
        values = list(fields.values()) + [segment_id]

        row = await conn.fetchrow(
            f"""UPDATE event_timetable_segments SET {set_clause}, updated_at = NOW()
               WHERE id = ${len(values)} AND deleted_at IS NULL
               RETURNING id, event_id, name, name_aliases, start_time, end_time,
                         order_number, is_pre_round, created_at, updated_at, deleted_at""",
            *values,
        )
        if not row:
            return None
        d = dict(row)
        if d.get("name_aliases") is None:
            d["name_aliases"] = []
        return d
    finally:
        await conn.close()


async def delete_timetable_segment(segment_id: int) -> bool:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        result = await conn.execute(
            "UPDATE event_timetable_segments SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
            segment_id,
        )
        return result == "UPDATE 1"
    finally:
        await conn.close()
