"""Pydantic schemas for master data (sections, rooms, timetable segments, schools)."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


# --- Section (部門) ---

class SectionBase(BaseModel):
    name: str
    order_number: Optional[int] = None


class SectionCreate(SectionBase):
    pass


class SectionUpdate(BaseModel):
    name: Optional[str] = None
    order_number: Optional[int] = None


class Section(SectionBase):
    id: int
    event_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Room (会場) ---

class RoomBase(BaseModel):
    name: str
    order_number: Optional[int] = None
    note: Optional[str] = None


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    order_number: Optional[int] = None
    note: Optional[str] = None


class Room(RoomBase):
    id: int
    event_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- TimetableSegment (時間枠) ---

class TimetableSegmentBase(BaseModel):
    name: str
    order_number: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_pre_round: bool = False
    name_aliases: Optional[List[str]] = None


class TimetableSegmentCreate(TimetableSegmentBase):
    pass


class TimetableSegmentUpdate(BaseModel):
    name: Optional[str] = None
    order_number: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_pre_round: Optional[bool] = None
    name_aliases: Optional[List[str]] = None


class TimetableSegment(TimetableSegmentBase):
    id: int
    event_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- School (参加校) ---

class SchoolBase(BaseModel):
    name: str
    order_number: Optional[int] = None
    note: Optional[str] = None
    name_aliases: Optional[List[str]] = None


class SchoolCreate(SchoolBase):
    pass


class SchoolUpdate(BaseModel):
    name: Optional[str] = None
    order_number: Optional[int] = None
    note: Optional[str] = None
    name_aliases: Optional[List[str]] = None


class School(SchoolBase):
    id: int
    event_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
