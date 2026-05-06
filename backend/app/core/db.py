"""Database connection and utilities."""
import asyncpg
from typing import Optional

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
