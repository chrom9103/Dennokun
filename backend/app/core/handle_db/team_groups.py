"""TeamGroup (チームグループ) DB handlers."""
from typing import Optional, List


async def get_all_team_groups(event_id: int) -> List[dict]:
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            """SELECT id, event_id, name, created_at, updated_at, deleted_at
               FROM event_team_groups
               WHERE event_id = $1 AND deleted_at IS NULL
               ORDER BY id ASC""",
            event_id,
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()


async def get_team_group_by_id(group_id: int) -> Optional[dict]:
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            "SELECT id, event_id, name, created_at, updated_at, deleted_at FROM event_team_groups WHERE id = $1 AND deleted_at IS NULL",
            group_id,
        )
        return dict(row) if row else None
    finally:
        await conn.close()


async def create_team_group(event_id: int, name: str) -> dict:
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            """INSERT INTO event_team_groups (event_id, name)
               VALUES ($1, $2)
               RETURNING id, event_id, name, created_at, updated_at, deleted_at""",
            event_id, name,
        )
        return dict(row)
    finally:
        await conn.close()


async def update_team_group(group_id: int, name: str) -> Optional[dict]:
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            """UPDATE event_team_groups SET name = $1, updated_at = NOW()
               WHERE id = $2 AND deleted_at IS NULL
               RETURNING id, event_id, name, created_at, updated_at, deleted_at""",
            name, group_id,
        )
        return dict(row) if row else None
    finally:
        await conn.close()


async def delete_team_group(group_id: int) -> bool:
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        result = await conn.execute(
            "UPDATE event_team_groups SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
            group_id,
        )
        return result == "UPDATE 1"
    finally:
        await conn.close()
