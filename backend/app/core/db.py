"""Database connection and utilities."""
import asyncpg
import random
from typing import Optional, List
from datetime import date

from .config import DATABASE_URL


async def get_db_connection() -> asyncpg.Connection:
    """Get a database connection."""
    conn = await asyncpg.connect(DATABASE_URL)
    return conn


async def get_user_by_name(username: str) -> Optional[dict]:
    """Get a user by username."""
    conn = await get_db_connection()
    try:
        user = await conn.fetchrow("SELECT id, name, email, password_hash, permissions FROM users WHERE name = $1", username)
        return dict(user) if user else None
    finally:
        await conn.close()


async def get_user_by_id(user_id: int) -> Optional[dict]:
    """Get a user by id."""
    conn = await get_db_connection()
    try:
        user = await conn.fetchrow("SELECT id, name, email, password_hash, permissions FROM users WHERE id = $1", user_id)
        return dict(user) if user else None
    finally:
        await conn.close()


# Event-related functions
async def get_all_events() -> List[dict]:
    """Get all events ordered by start_date (DESC)."""
    conn = await get_db_connection()
    try:
        events = await conn.fetch(
            "SELECT id, name, start_date, spreadsheet_id, bucket_name, flash_news_url, created_at, updated_at, deleted_at FROM events WHERE deleted_at IS NULL ORDER BY start_date DESC NULLS LAST"
        )
        return [dict(event) for event in events]
    finally:
        await conn.close()


async def get_event_by_id(event_id: int) -> Optional[dict]:
    """Get an event by id."""
    conn = await get_db_connection()
    try:
        event = await conn.fetchrow(
            "SELECT id, name, start_date, spreadsheet_id, bucket_name, flash_news_url, created_at, updated_at, deleted_at FROM events WHERE id = $1 AND deleted_at IS NULL",
            event_id
        )
        return dict(event) if event else None
    finally:
        await conn.close()


async def create_event(name: str, start_date: Optional[date] = None, spreadsheet_id: Optional[str] = None, bucket_name: Optional[str] = None, flash_news_url: Optional[str] = None) -> dict:
    """Create a new event."""
    conn = await get_db_connection()
    try:
        # Generate an 8-digit decimal id (10000000 - 99999999) and retry on collision.
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

        # If we reach here, we failed to insert after retries — raise an error.
        raise RuntimeError("Failed to generate unique 8-digit event ID after multiple attempts")
    finally:
        await conn.close()


async def update_event(event_id: int, **kwargs) -> Optional[dict]:
    """Update an event."""
    conn = await get_db_connection()
    try:
        # Build the update query dynamically
        allowed_fields = {'name', 'start_date', 'spreadsheet_id', 'bucket_name', 'flash_news_url'}
        update_fields = {k: v for k, v in kwargs.items() if k in allowed_fields and v is not None}
        
        if not update_fields:
            return await get_event_by_id(event_id)
        
        set_clause = ", ".join([f"{k} = ${i+1}" for i, k in enumerate(update_fields.keys())])
        values = list(update_fields.values()) + [event_id]
        
        event = await conn.fetchrow(
            f"""UPDATE events SET {set_clause}, updated_at = NOW()
               WHERE id = ${len(values)} AND deleted_at IS NULL
               RETURNING id, name, start_date, spreadsheet_id, bucket_name, flash_news_url, created_at, updated_at, deleted_at""",
            *values
        )
        return dict(event) if event else None
    finally:
        await conn.close()


async def delete_event(event_id: int) -> bool:
    """Soft delete an event (sets deleted_at)."""
    conn = await get_db_connection()
    try:
        result = await conn.execute(
            "UPDATE events SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
            event_id
        )
        return result == "UPDATE 1"
    finally:
        await conn.close()
