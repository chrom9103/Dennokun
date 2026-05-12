"""Database connection and facade re-exports for handlers."""
import asyncpg

from .config import DATABASE_URL


async def get_db_connection() -> asyncpg.Connection:
    """Get a database connection."""
    conn = await asyncpg.connect(DATABASE_URL)
    return conn


# Import handler implementations (defined in handle_db package)
from .handle_db.events import (
    get_all_events,
    get_event_by_id,
    create_event,
    update_event,
    delete_event,
)

from .handle_db.users import (
    get_user_by_name,
    get_user_by_id,
)
