"""Pydantic schemas for matches and standings."""
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel


# --- Voting detail ---

class VotingDetailIn(BaseModel):
    judge_index: int
    aff_won: int = 0
    neg_won: int = 0
    aff_constructive_comm: int = 0
    aff_question_comm: int = 0
    aff_answer_comm: int = 0
    aff_first_rebuttal_comm: int = 0
    aff_second_rebuttal_comm: int = 0
    neg_constructive_comm: int = 0
    neg_question_comm: int = 0
    neg_answer_comm: int = 0
    neg_first_rebuttal_comm: int = 0
    neg_second_rebuttal_comm: int = 0
    aff_comm_sum: int = 0
    neg_comm_sum: int = 0
    aff_manner: int = 0
    neg_manner: int = 0
    note: Optional[str] = None


class VotingDetail(VotingDetailIn):
    id: int
    event_match_id: int

    class Config:
        from_attributes = True


# --- Match list item ---

class MatchListItem(BaseModel):
    id: int
    event_id: int
    event_timetable_segment_id: Optional[int] = None
    event_room_id: Optional[int] = None
    event_section_id: Optional[int] = None
    aff_team_id: Optional[int] = None
    neg_team_id: Optional[int] = None
    aff_votes: Optional[int] = None
    neg_votes: Optional[int] = None
    aff_comm_sum: Optional[int] = None
    neg_comm_sum: Optional[int] = None
    aff_manner: Optional[int] = None
    neg_manner: Optional[int] = None
    aff_won: Optional[int] = None
    neg_won: Optional[int] = None
    is_result_confirmed: bool = False
    main_judge_staff_id: Optional[int] = None
    sub_judge1_staff_id: Optional[int] = None
    sub_judge2_staff_id: Optional[int] = None
    timekeeper_staff_id: Optional[int] = None
    judges_assignment_count: Optional[int] = None
    order_number_in_segment: Optional[int] = None
    note: Optional[str] = None
    name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # joined fields
    timetable_segment_name: Optional[str] = None
    segment_order: Optional[int] = None
    room_name: Optional[str] = None
    section_name: Optional[str] = None
    aff_team_name: Optional[str] = None
    neg_team_name: Optional[str] = None
    timekeeper_name: Optional[str] = None

    class Config:
        from_attributes = True


# --- Match detail ---

class MatchDetail(MatchListItem):
    aff_constructive_comm: Optional[int] = None
    aff_question_comm: Optional[int] = None
    aff_answer_comm: Optional[int] = None
    aff_first_rebuttal_comm: Optional[int] = None
    aff_second_rebuttal_comm: Optional[int] = None
    neg_constructive_comm: Optional[int] = None
    neg_question_comm: Optional[int] = None
    neg_answer_comm: Optional[int] = None
    neg_first_rebuttal_comm: Optional[int] = None
    neg_second_rebuttal_comm: Optional[int] = None
    is_result_public: bool = False
    is_staffs_fixed: bool = False
    main_judge_staff_id: Optional[int] = None
    main_judge_name: Optional[str] = None
    sub_judge1_name: Optional[str] = None
    sub_judge2_name: Optional[str] = None
    timekeeper_name: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    voting_details: List[Any] = []

    class Config:
        from_attributes = True


# --- Result save request ---

class MatchResultSave(BaseModel):
    aff_votes: int = 0
    neg_votes: int = 0
    aff_comm_sum: int = 0
    neg_comm_sum: int = 0
    aff_manner: int = 0
    neg_manner: int = 0
    is_result_confirmed: bool = False
    voting_details: Optional[List[VotingDetailIn]] = None


# --- Standings ---

class StandingsEntry(BaseModel):
    event_section_id: Optional[int] = None
    section_name: Optional[str] = None
    team_id: int
    team_name: str
    school_name: Optional[str] = None
    wins: int
    losses: int
    matches_played: int
    total_comm: int
    total_manner: int
    rank: int

    class Config:
        from_attributes = True


class MatchSummary(BaseModel):
    total: int
    confirmed: int
    scheduled: int
