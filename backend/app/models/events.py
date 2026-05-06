"""Event models for SQLAlchemy and Pydantic."""
from datetime import date, datetime
from pydantic import BaseModel
from typing import Optional


# Pydantic schemas
class EventBase(BaseModel):
    name: str
    start_date: Optional[date] = None
    spreadsheet_id: Optional[str] = None
    bucket_name: Optional[str] = None
    flash_news_url: Optional[str] = None


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    spreadsheet_id: Optional[str] = None
    bucket_name: Optional[str] = None
    flash_news_url: Optional[str] = None


class Event(EventBase):
    id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
