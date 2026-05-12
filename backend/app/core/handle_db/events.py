"""Event-related DB handlers."""
from typing import Optional, List
import random
from datetime import date

async def get_all_events() -> List[dict]:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        events = await conn.fetch(
            "SELECT id, name, start_date, spreadsheet_id, bucket_name, flash_news_url, created_at, updated_at, deleted_at FROM events WHERE deleted_at IS NULL ORDER BY start_date DESC NULLS LAST"
        )
        return [dict(event) for event in events]
    finally:
        await conn.close()


async def get_event_by_id(event_id: int) -> Optional[dict]:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        event = await conn.fetchrow(
            "SELECT id, name, start_date, spreadsheet_id, bucket_name, flash_news_url, created_at, updated_at, deleted_at FROM events WHERE id = $1 AND deleted_at IS NULL",
            event_id,
        )
        return dict(event) if event else None
    finally:
        await conn.close()


async def create_event(name: str, start_date: Optional[date] = None, spreadsheet_id: Optional[str] = None, bucket_name: Optional[str] = None, flash_news_url: Optional[str] = None) -> dict:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        max_attempts = 10
        for attempt in range(max_attempts):
            generated_id = random.randint(10_000_000, 99_999_999)
            row = await conn.fetchrow(
                """INSERT INTO events (id, name, start_date, spreadsheet_id, bucket_name, flash_news_url)
                   VALUES ($1, $2, $3, $4, $5, $6)
                   ON CONFLICT (id) DO NOTHING
                   RETURNING id, name, start_date, spreadsheet_id, bucket_name, flash_news_url, created_at, updated_at, deleted_at""",
                generated_id, name, start_date, spreadsheet_id, bucket_name, flash_news_url,
            )

            if row:
                return dict(row)

        raise RuntimeError("Failed to generate unique 8-digit event ID after multiple attempts")
    finally:
        await conn.close()


async def update_event(event_id: int, **kwargs) -> Optional[dict]:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        allowed_fields = {"name", "start_date", "spreadsheet_id", "bucket_name", "flash_news_url"}
        update_fields = {k: v for k, v in kwargs.items() if k in allowed_fields and v is not None}

        if not update_fields:
            return await get_event_by_id(event_id)

        set_clause = ", ".join([f"{k} = ${i+1}" for i, k in enumerate(update_fields.keys())])
        values = list(update_fields.values()) + [event_id]

        event = await conn.fetchrow(
            f"""UPDATE events SET {set_clause}, updated_at = NOW()
               WHERE id = ${len(values)} AND deleted_at IS NULL
               RETURNING id, name, start_date, spreadsheet_id, bucket_name, flash_news_url, created_at, updated_at, deleted_at""",
            *values,
        )
        return dict(event) if event else None
    finally:
        await conn.close()


async def delete_event(event_id: int) -> bool:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        result = await conn.execute(
            "UPDATE events SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
            event_id,
        )
        return result == "UPDATE 1"
    finally:
        await conn.close()
