"""Room (会場) DB handlers."""
from typing import Optional, List


async def get_all_rooms(event_id: int) -> List[dict]:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            """SELECT id, event_id, name, order_number, note, created_at, updated_at, deleted_at
               FROM event_rooms
               WHERE event_id = $1 AND deleted_at IS NULL
               ORDER BY order_number ASC NULLS LAST, id ASC""",
            event_id,
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()


async def get_room_by_id(room_id: int) -> Optional[dict]:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            """SELECT id, event_id, name, order_number, note, created_at, updated_at, deleted_at
               FROM event_rooms WHERE id = $1 AND deleted_at IS NULL""",
            room_id,
        )
        return dict(row) if row else None
    finally:
        await conn.close()


async def create_room(event_id: int, name: str, order_number: Optional[int] = None, note: Optional[str] = None) -> dict:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            """INSERT INTO event_rooms (event_id, name, order_number, note)
               VALUES ($1, $2, $3, $4)
               RETURNING id, event_id, name, order_number, note, created_at, updated_at, deleted_at""",
            event_id, name, order_number, note,
        )
        return dict(row)
    finally:
        await conn.close()


async def update_room(room_id: int, **kwargs) -> Optional[dict]:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        allowed = {"name", "order_number", "note"}
        # note can be explicitly set to None/empty, so handle separately
        fields = {}
        for k, v in kwargs.items():
            if k in allowed:
                fields[k] = v

        if not fields:
            return await get_room_by_id(room_id)

        set_clause = ", ".join([f"{k} = ${i+1}" for i, k in enumerate(fields.keys())])
        values = list(fields.values()) + [room_id]

        row = await conn.fetchrow(
            f"""UPDATE event_rooms SET {set_clause}, updated_at = NOW()
               WHERE id = ${len(values)} AND deleted_at IS NULL
               RETURNING id, event_id, name, order_number, note, created_at, updated_at, deleted_at""",
            *values,
        )
        return dict(row) if row else None
    finally:
        await conn.close()


async def delete_room(room_id: int) -> bool:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        result = await conn.execute(
            "UPDATE event_rooms SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
            room_id,
        )
        return result == "UPDATE 1"
    finally:
        await conn.close()
