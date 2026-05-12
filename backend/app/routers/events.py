"""Events router."""
from fastapi import APIRouter, HTTPException
from datetime import date
from typing import Optional, List

from app.models.events import Event, EventCreate, EventUpdate
from app.core.db import (
    get_all_events,
    get_event_by_id,
    create_event,
    update_event,
    delete_event,
)

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=List[Event])
async def list_events():
    """Get all events ordered by start_date (DESC)."""
    try:
        events = await get_all_events()
        return events
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{event_id}", response_model=Event)
async def get_event(event_id: int):
    """Get a specific event by ID."""
    try:
        event = await get_event_by_id(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        return event
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=Event)
async def create_new_event(event_data: EventCreate):
    """Create a new event."""
    try:
        event = await create_event(
            name=event_data.name,
            start_date=event_data.start_date,
            spreadsheet_id=event_data.spreadsheet_id,
            bucket_name=event_data.bucket_name,
            flash_news_url=event_data.flash_news_url,
        )
        return event
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{event_id}", response_model=Event)
async def update_event_endpoint(event_id: int, event_data: EventUpdate):
    """Update an event."""
    try:
        event = await update_event(event_id, **event_data.dict(exclude_unset=True))
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        return event
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{event_id}")
async def delete_event_endpoint(event_id: int):
    """Delete (soft delete) an event."""
    try:
        success = await delete_event(event_id)
        if not success:
            raise HTTPException(status_code=404, detail="Event not found")
        return {"status": "ok", "message": "Event deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
