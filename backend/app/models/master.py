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


# --- TeamGroup (チームグループ) ---

class TeamGroupBase(BaseModel):
    name: str


class TeamGroupCreate(TeamGroupBase):
    pass


class TeamGroupUpdate(BaseModel):
    name: str


class TeamGroup(TeamGroupBase):
    id: int
    event_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Team (チーム) ---

class TeamBase(BaseModel):
    name: str
    event_section_id: Optional[int] = None
    event_school_id: Optional[int] = None
    team_group_id: Optional[int] = None
    is_seed: bool = False
    order_of_application: Optional[int] = None
    note: Optional[str] = None


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    event_section_id: Optional[int] = None
    event_school_id: Optional[int] = None
    team_group_id: Optional[int] = None
    is_seed: Optional[bool] = None
    order_of_application: Optional[int] = None
    note: Optional[str] = None


class Team(TeamBase):
    id: int
    event_id: int
    section_name: Optional[str] = None
    school_name: Optional[str] = None
    group_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Staff (スタッフ) ---

class StaffBase(BaseModel):
    name: str
    can_be_main_judge: bool = False
    can_be_sub_judge: bool = False
    can_be_timekeeper: bool = False
    order_of_application: Optional[int] = None
    note: Optional[str] = None
    interested_school_ids: Optional[List[int]] = None
    present_segment_ids: Optional[List[int]] = None


class StaffCreate(StaffBase):
    pass


class StaffUpdate(BaseModel):
    name: Optional[str] = None
    can_be_main_judge: Optional[bool] = None
    can_be_sub_judge: Optional[bool] = None
    can_be_timekeeper: Optional[bool] = None
    order_of_application: Optional[int] = None
    note: Optional[str] = None
    interested_school_ids: Optional[List[int]] = None
    present_segment_ids: Optional[List[int]] = None


class Staff(StaffBase):
    id: int
    event_id: int
    interested_school_names: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True

