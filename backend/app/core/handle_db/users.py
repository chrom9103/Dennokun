"""User-related DB handlers."""
from typing import Optional

 

async def get_user_by_name(username: str) -> Optional[dict]:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        user = await conn.fetchrow("SELECT id, name, email, password_hash, permissions FROM users WHERE name = $1", username)
        return dict(user) if user else None
    finally:
        await conn.close()


async def get_user_by_id(user_id: int) -> Optional[dict]:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        user = await conn.fetchrow("SELECT id, name, email, password_hash, permissions FROM users WHERE id = $1", user_id)
        return dict(user) if user else None
    finally:
        await conn.close()
