"""Master data router: sections, rooms, timetable segments, schools, team-groups, teams, staffs."""
from fastapi import APIRouter, HTTPException
from typing import List

from app.models.master import (
    Section, SectionCreate, SectionUpdate,
    Room, RoomCreate, RoomUpdate,
    TimetableSegment, TimetableSegmentCreate, TimetableSegmentUpdate,
    School, SchoolCreate, SchoolUpdate,
    TeamGroup, TeamGroupCreate, TeamGroupUpdate,
    Team, TeamCreate, TeamUpdate,
    Staff, StaffCreate, StaffUpdate,
)
from app.core.db import (
    get_all_sections, get_section_by_id, create_section, update_section, delete_section,
    get_all_rooms, get_room_by_id, create_room, update_room, delete_room,
    get_all_timetable_segments, get_timetable_segment_by_id, create_timetable_segment,
    update_timetable_segment, delete_timetable_segment,
    get_all_schools, get_school_by_id, create_school, update_school, delete_school,
    get_all_team_groups, get_team_group_by_id, create_team_group, update_team_group, delete_team_group,
    get_all_teams, get_team_by_id, create_team, update_team, delete_team,
    get_all_staffs, get_staff_by_id, create_staff, update_staff, delete_staff,
)

router = APIRouter(prefix="/api/events/{event_id}", tags=["master"])


# ── Sections (部門) ──────────────────────────────────────────────────────────

@router.get("/sections", response_model=List[Section])
async def list_sections(event_id: int):
    """大会の部門一覧を取得する。"""
    try:
        return await get_all_sections(event_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sections/{section_id}", response_model=Section)
async def get_section(event_id: int, section_id: int):
    try:
        section = await get_section_by_id(section_id)
        if not section or section["event_id"] != event_id:
            raise HTTPException(status_code=404, detail="Section not found")
        return section
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sections", response_model=Section, status_code=201)
async def create_new_section(event_id: int, data: SectionCreate):
    try:
        return await create_section(event_id=event_id, **data.dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/sections/{section_id}", response_model=Section)
async def update_section_endpoint(event_id: int, section_id: int, data: SectionUpdate):
    try:
        section = await update_section(section_id, **data.dict(exclude_unset=True))
        if not section or section["event_id"] != event_id:
            raise HTTPException(status_code=404, detail="Section not found")
        return section
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sections/{section_id}")
async def delete_section_endpoint(event_id: int, section_id: int):
    try:
        success = await delete_section(section_id)
        if not success:
            raise HTTPException(status_code=404, detail="Section not found")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Rooms (会場) ─────────────────────────────────────────────────────────────

@router.get("/rooms", response_model=List[Room])
async def list_rooms(event_id: int):
    """大会の会場一覧を取得する。"""
    try:
        return await get_all_rooms(event_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rooms/{room_id}", response_model=Room)
async def get_room(event_id: int, room_id: int):
    try:
        room = await get_room_by_id(room_id)
        if not room or room["event_id"] != event_id:
            raise HTTPException(status_code=404, detail="Room not found")
        return room
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rooms", response_model=Room, status_code=201)
async def create_new_room(event_id: int, data: RoomCreate):
    try:
        return await create_room(event_id=event_id, **data.dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/rooms/{room_id}", response_model=Room)
async def update_room_endpoint(event_id: int, room_id: int, data: RoomUpdate):
    try:
        room = await update_room(room_id, **data.dict(exclude_unset=True))
        if not room or room["event_id"] != event_id:
            raise HTTPException(status_code=404, detail="Room not found")
        return room
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/rooms/{room_id}")
async def delete_room_endpoint(event_id: int, room_id: int):
    try:
        success = await delete_room(room_id)
        if not success:
            raise HTTPException(status_code=404, detail="Room not found")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Timetable Segments (時間枠) ───────────────────────────────────────────────

@router.get("/timetable-segments", response_model=List[TimetableSegment])
async def list_timetable_segments(event_id: int):
    """大会の時間枠一覧を取得する。"""
    try:
        return await get_all_timetable_segments(event_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/timetable-segments/{segment_id}", response_model=TimetableSegment)
async def get_timetable_segment(event_id: int, segment_id: int):
    try:
        seg = await get_timetable_segment_by_id(segment_id)
        if not seg or seg["event_id"] != event_id:
            raise HTTPException(status_code=404, detail="Timetable segment not found")
        return seg
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/timetable-segments", response_model=TimetableSegment, status_code=201)
async def create_new_timetable_segment(event_id: int, data: TimetableSegmentCreate):
    try:
        return await create_timetable_segment(event_id=event_id, **data.dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/timetable-segments/{segment_id}", response_model=TimetableSegment)
async def update_timetable_segment_endpoint(event_id: int, segment_id: int, data: TimetableSegmentUpdate):
    try:
        seg = await update_timetable_segment(segment_id, **data.dict(exclude_unset=True))
        if not seg or seg["event_id"] != event_id:
            raise HTTPException(status_code=404, detail="Timetable segment not found")
        return seg
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/timetable-segments/{segment_id}")
async def delete_timetable_segment_endpoint(event_id: int, segment_id: int):
    try:
        success = await delete_timetable_segment(segment_id)
        if not success:
            raise HTTPException(status_code=404, detail="Timetable segment not found")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Schools (参加校) ─────────────────────────────────────────────────────────

@router.get("/schools", response_model=List[School])
async def list_schools(event_id: int):
    """大会の参加校一覧を取得する。"""
    try:
        return await get_all_schools(event_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/schools/{school_id}", response_model=School)
async def get_school(event_id: int, school_id: int):
    try:
        school = await get_school_by_id(school_id)
        if not school or school["event_id"] != event_id:
            raise HTTPException(status_code=404, detail="School not found")
        return school
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/schools", response_model=School, status_code=201)
async def create_new_school(event_id: int, data: SchoolCreate):
    try:
        return await create_school(event_id=event_id, **data.dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/schools/{school_id}", response_model=School)
async def update_school_endpoint(event_id: int, school_id: int, data: SchoolUpdate):
    try:
        school = await update_school(school_id, **data.dict(exclude_unset=True))
        if not school or school["event_id"] != event_id:
            raise HTTPException(status_code=404, detail="School not found")
        return school
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/schools/{school_id}")
async def delete_school_endpoint(event_id: int, school_id: int):
    try:
        success = await delete_school(school_id)
        if not success:
            raise HTTPException(status_code=404, detail="School not found")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Team Groups (チームグループ) ───────────────────────────────────────────────

@router.get("/team-groups", response_model=List[TeamGroup])
async def list_team_groups(event_id: int):
    try:
        return await get_all_team_groups(event_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/team-groups", response_model=TeamGroup, status_code=201)
async def create_new_team_group(event_id: int, data: TeamGroupCreate):
    try:
        return await create_team_group(event_id=event_id, name=data.name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/team-groups/{group_id}", response_model=TeamGroup)
async def update_team_group_endpoint(event_id: int, group_id: int, data: TeamGroupUpdate):
    try:
        group = await update_team_group(group_id, name=data.name)
        if not group or group["event_id"] != event_id:
            raise HTTPException(status_code=404, detail="Team group not found")
        return group
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/team-groups/{group_id}")
async def delete_team_group_endpoint(event_id: int, group_id: int):
    try:
        success = await delete_team_group(group_id)
        if not success:
            raise HTTPException(status_code=404, detail="Team group not found")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Teams (チーム) ────────────────────────────────────────────────────────────

@router.get("/teams", response_model=List[Team])
async def list_teams(event_id: int):
    try:
        return await get_all_teams(event_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/teams", response_model=Team, status_code=201)
async def create_new_team(event_id: int, data: TeamCreate):
    try:
        return await create_team(event_id=event_id, **data.dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/teams/{team_id}", response_model=Team)
async def update_team_endpoint(event_id: int, team_id: int, data: TeamUpdate):
    try:
        team = await update_team(team_id, **data.dict(exclude_unset=True))
        if not team or team["event_id"] != event_id:
            raise HTTPException(status_code=404, detail="Team not found")
        return team
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/teams/{team_id}")
async def delete_team_endpoint(event_id: int, team_id: int):
    try:
        success = await delete_team(team_id)
        if not success:
            raise HTTPException(status_code=404, detail="Team not found")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Staffs (スタッフ) ─────────────────────────────────────────────────────────

@router.get("/staffs", response_model=List[Staff])
async def list_staffs(event_id: int):
    try:
        return await get_all_staffs(event_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/staffs", response_model=Staff, status_code=201)
async def create_new_staff(event_id: int, data: StaffCreate):
    try:
        d = data.dict()
        interested = d.pop("interested_school_ids", None)
        segments = d.pop("present_segment_ids", None)
        return await create_staff(
            event_id=event_id,
            interested_school_ids=interested,
            present_segment_ids=segments,
            **d,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/staffs/{staff_id}", response_model=Staff)
async def update_staff_endpoint(event_id: int, staff_id: int, data: StaffUpdate):
    try:
        d = data.dict(exclude_unset=True)
        interested = d.pop("interested_school_ids", None)
        segments = d.pop("present_segment_ids", None)
        staff = await update_staff(
            staff_id,
            interested_school_ids=interested,
            present_segment_ids=segments,
            **d,
        )
        if not staff or staff["event_id"] != event_id:
            raise HTTPException(status_code=404, detail="Staff not found")
        return staff
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/staffs/{staff_id}")
async def delete_staff_endpoint(event_id: int, staff_id: int):
    try:
        success = await delete_staff(staff_id)
        if not success:
            raise HTTPException(status_code=404, detail="Staff not found")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
