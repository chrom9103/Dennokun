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

from .handle_db.sections import (
    get_all_sections,
    get_section_by_id,
    create_section,
    update_section,
    delete_section,
)

from .handle_db.rooms import (
    get_all_rooms,
    get_room_by_id,
    create_room,
    update_room,
    delete_room,
)

from .handle_db.timetable_segments import (
    get_all_timetable_segments,
    get_timetable_segment_by_id,
    create_timetable_segment,
    update_timetable_segment,
    delete_timetable_segment,
)

from .handle_db.schools import (
    get_all_schools,
    get_school_by_id,
    create_school,
    update_school,
    delete_school,
)
