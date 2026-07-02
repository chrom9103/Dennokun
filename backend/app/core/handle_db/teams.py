"""Team (チーム) DB handlers."""
from typing import Optional, List


async def get_all_teams(event_id: int) -> List[dict]:
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            """SELECT t.id, t.event_id, t.name, t.event_section_id, t.event_school_id,
                      t.team_group_id, t.is_seed, t.order_of_application, t.note,
                      t.created_at, t.updated_at, t.deleted_at,
                      s.name AS section_name,
                      sc.name AS school_name,
                      tg.name AS group_name
               FROM event_teams t
               LEFT JOIN event_sections s ON s.id = t.event_section_id AND s.deleted_at IS NULL
               LEFT JOIN event_schools sc ON sc.id = t.event_school_id AND sc.deleted_at IS NULL
               LEFT JOIN event_team_groups tg ON tg.id = t.team_group_id AND tg.deleted_at IS NULL
               WHERE t.event_id = $1 AND t.deleted_at IS NULL
               ORDER BY t.order_of_application ASC NULLS LAST, t.id ASC""",
            event_id,
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()


async def get_team_by_id(team_id: int) -> Optional[dict]:
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            """SELECT t.id, t.event_id, t.name, t.event_section_id, t.event_school_id,
                      t.team_group_id, t.is_seed, t.order_of_application, t.note,
                      t.created_at, t.updated_at, t.deleted_at,
                      s.name AS section_name,
                      sc.name AS school_name,
                      tg.name AS group_name
               FROM event_teams t
               LEFT JOIN event_sections s ON s.id = t.event_section_id AND s.deleted_at IS NULL
               LEFT JOIN event_schools sc ON sc.id = t.event_school_id AND sc.deleted_at IS NULL
               LEFT JOIN event_team_groups tg ON tg.id = t.team_group_id AND tg.deleted_at IS NULL
               WHERE t.id = $1 AND t.deleted_at IS NULL""",
            team_id,
        )
        return dict(row) if row else None
    finally:
        await conn.close()


async def create_team(
    event_id: int,
    name: str,
    event_section_id: Optional[int] = None,
    event_school_id: Optional[int] = None,
    team_group_id: Optional[int] = None,
    is_seed: bool = False,
    order_of_application: Optional[int] = None,
    note: Optional[str] = None,
) -> dict:
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            """INSERT INTO event_teams
                   (event_id, name, event_section_id, event_school_id, team_group_id,
                    is_seed, order_of_application, note)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               RETURNING id, event_id, name, event_section_id, event_school_id,
                         team_group_id, is_seed, order_of_application, note,
                         created_at, updated_at, deleted_at""",
            event_id, name, event_section_id, event_school_id, team_group_id,
            is_seed, order_of_application, note,
        )
        d = dict(row)
        d["section_name"] = None
        d["school_name"] = None
        d["group_name"] = None
        return d
    finally:
        await conn.close()


async def update_team(team_id: int, **kwargs) -> Optional[dict]:
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        allowed = {"name", "event_section_id", "event_school_id", "team_group_id",
                   "is_seed", "order_of_application", "note"}
        fields = {k: v for k, v in kwargs.items() if k in allowed}

        if not fields:
            return await get_team_by_id(team_id)

        set_clause = ", ".join([f"{k} = ${i+1}" for i, k in enumerate(fields.keys())])
        values = list(fields.values()) + [team_id]

        await conn.execute(
            f"UPDATE event_teams SET {set_clause}, updated_at = NOW() WHERE id = ${len(values)} AND deleted_at IS NULL",
            *values,
        )
        return await get_team_by_id(team_id)
    finally:
        await conn.close()


async def delete_team(team_id: int) -> bool:
    from app.core.db import get_db_connection
    conn = await get_db_connection()
    try:
        result = await conn.execute(
            "UPDATE event_teams SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
            team_id,
        )
        return result == "UPDATE 1"
    finally:
        await conn.close()
