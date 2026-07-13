"""User-related DB handlers."""
import json
from typing import Optional


async def get_user_by_name(username: str) -> Optional[dict]:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        user = await conn.fetchrow("SELECT id, name, email, password_hash, permissions FROM users WHERE name = $1", username)
        if not user:
            return None
        user_dict = dict(user)
        if isinstance(user_dict.get("permissions"), str):
            user_dict["permissions"] = json.loads(user_dict["permissions"])
        return user_dict
    finally:
        await conn.close()


async def get_user_by_id(user_id: int) -> Optional[dict]:
    from app.core.db import get_db_connection

    conn = await get_db_connection()
    try:
        user = await conn.fetchrow("SELECT id, name, email, password_hash, permissions FROM users WHERE id = $1", user_id)
        if not user:
            return None
        user_dict = dict(user)
        if isinstance(user_dict.get("permissions"), str):
            user_dict["permissions"] = json.loads(user_dict["permissions"])
        return user_dict
    finally:
        await conn.close()

