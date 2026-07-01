"""School (参加校) DB handlers."""
from typing import Optional, List


async def get_all_schools(event_id: int) -> List[dict]:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            """SELECT id, event_id, name, name_aliases, order_number, note,
                      created_at, updated_at, deleted_at
               FROM event_schools
               WHERE event_id = $1 AND deleted_at IS NULL
               ORDER BY order_number ASC NULLS LAST, id ASC""",
            event_id,
        )
        result = []
        for r in rows:
            d = dict(r)
            if d.get("name_aliases") is None:
                d["name_aliases"] = []
            result.append(d)
        return result
    finally:
        await conn.close()


async def get_school_by_id(school_id: int) -> Optional[dict]:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            """SELECT id, event_id, name, name_aliases, order_number, note,
                      created_at, updated_at, deleted_at
               FROM event_schools WHERE id = $1 AND deleted_at IS NULL""",
            school_id,
        )
        if not row:
            return None
        d = dict(row)
        if d.get("name_aliases") is None:
            d["name_aliases"] = []
        return d
    finally:
        await conn.close()


async def create_school(
    event_id: int,
    name: str,
    order_number: Optional[int] = None,
    note: Optional[str] = None,
    name_aliases: Optional[List[str]] = None,
) -> dict:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            """INSERT INTO event_schools (event_id, name, order_number, note, name_aliases)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING id, event_id, name, name_aliases, order_number, note,
                         created_at, updated_at, deleted_at""",
            event_id, name, order_number, note, name_aliases or [],
        )
        d = dict(row)
        if d.get("name_aliases") is None:
            d["name_aliases"] = []
        return d
    finally:
        await conn.close()


async def update_school(school_id: int, **kwargs) -> Optional[dict]:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        allowed = {"name", "order_number", "note", "name_aliases"}
        fields = {k: v for k, v in kwargs.items() if k in allowed}

        if not fields:
            return await get_school_by_id(school_id)

        set_clause = ", ".join([f"{k} = ${i+1}" for i, k in enumerate(fields.keys())])
        values = list(fields.values()) + [school_id]

        row = await conn.fetchrow(
            f"""UPDATE event_schools SET {set_clause}, updated_at = NOW()
               WHERE id = ${len(values)} AND deleted_at IS NULL
               RETURNING id, event_id, name, name_aliases, order_number, note,
                         created_at, updated_at, deleted_at""",
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


async def delete_school(school_id: int) -> bool:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        result = await conn.execute(
            "UPDATE event_schools SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
            school_id,
        )
        return result == "UPDATE 1"
    finally:
        await conn.close()
