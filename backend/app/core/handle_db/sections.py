"""Section (部門) DB handlers."""
from typing import Optional, List


async def get_all_sections(event_id: int) -> List[dict]:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            """SELECT id, event_id, name, order_number, created_at, updated_at, deleted_at
               FROM event_sections
               WHERE event_id = $1 AND deleted_at IS NULL
               ORDER BY order_number ASC NULLS LAST, id ASC""",
            event_id,
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()


async def get_section_by_id(section_id: int) -> Optional[dict]:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            """SELECT id, event_id, name, order_number, created_at, updated_at, deleted_at
               FROM event_sections WHERE id = $1 AND deleted_at IS NULL""",
            section_id,
        )
        return dict(row) if row else None
    finally:
        await conn.close()


async def create_section(event_id: int, name: str, order_number: Optional[int] = None) -> dict:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            """INSERT INTO event_sections (event_id, name, order_number)
               VALUES ($1, $2, $3)
               RETURNING id, event_id, name, order_number, created_at, updated_at, deleted_at""",
            event_id, name, order_number,
        )
        return dict(row)
    finally:
        await conn.close()


async def update_section(section_id: int, **kwargs) -> Optional[dict]:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        allowed = {"name", "order_number"}
        fields = {k: v for k, v in kwargs.items() if k in allowed and v is not None}

        if not fields:
            return await get_section_by_id(section_id)

        set_clause = ", ".join([f"{k} = ${i+1}" for i, k in enumerate(fields.keys())])
        values = list(fields.values()) + [section_id]

        row = await conn.fetchrow(
            f"""UPDATE event_sections SET {set_clause}, updated_at = NOW()
               WHERE id = ${len(values)} AND deleted_at IS NULL
               RETURNING id, event_id, name, order_number, created_at, updated_at, deleted_at""",
            *values,
        )
        return dict(row) if row else None
    finally:
        await conn.close()


async def delete_section(section_id: int) -> bool:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        result = await conn.execute(
            "UPDATE event_sections SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
            section_id,
        )
        return result == "UPDATE 1"
    finally:
        await conn.close()
