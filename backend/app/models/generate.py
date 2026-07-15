"""Pydantic schemas for match generation and assignment update."""
from typing import Optional
from pydantic import BaseModel


# ── Generation request ─────────────────────────────────────────────────────────

class GenerateMatchesRequest(BaseModel):
    """試合生成リクエスト。"""
    # key: "{section_id}_{segment_id}", value: 並行試合数
    section_segment_parallel_matches: dict[str, int]
    overwrite: bool = False                    # 既存試合を削除してから生成するか
    as_skeleton: bool = False                  # 空の枠組み（スケルトン）として生成するか


# ── Generation response ────────────────────────────────────────────────────────

class GenerateMatchesResponse(BaseModel):
    """試合生成レスポンス。"""
    generated_count: int
    deleted_count: int
    warnings: list[str] = []

    class Config:
        from_attributes = True


# ── Match assignment update ────────────────────────────────────────────────────

class MatchAssignmentUpdate(BaseModel):
    """試合の割当情報（チーム・会場・時間枠・ジャッジ）更新リクエスト。"""
    event_timetable_segment_id: Optional[int] = None
    event_room_id: Optional[int] = None
    aff_team_id: Optional[int] = None
    neg_team_id: Optional[int] = None
    main_judge_staff_id: Optional[int] = None
    sub_judge1_staff_id: Optional[int] = None
    sub_judge2_staff_id: Optional[int] = None
    sub_judge3_staff_id: Optional[int] = None
    sub_judge4_staff_id: Optional[int] = None
    timekeeper_staff_id: Optional[int] = None
    event_section_id: Optional[int] = None
    order_number_in_segment: Optional[int] = None
    is_staffs_fixed: Optional[bool] = None


class LockSegmentStaffsRequest(BaseModel):
    """時間枠の試合の配置・割当を確定（または解除）するリクエスト。"""
    is_fixed: bool


# ── Dashboard summary ──────────────────────────────────────────────────────────

class DashboardSummary(BaseModel):
    """大会ダッシュボード用の集計サマリー。"""
    total_matches: int
    confirmed_matches: int
    pending_matches: int
    total_teams: int
    total_staffs: int
    total_schools: int
    total_sections: int


class AssignJudgesRequest(BaseModel):
    """審判割り当てリクエスト。"""
    segment_judge_counts: dict[int, int]  # key: segment_id, value: 各枠の1試合あたりのジャッジ数
    allow_reversed_past: bool = False     # 肯否逆であれば過去に見た学校であっても割り当てを許可するか
    allow_same_group_diff_team: bool = False # 同じグループ（学校）に属していても別チームであれば割り当てを許可するか
    allow_pre_main_diff: bool = False     # 予選と本戦が異なっていれば過去担当済みであっても割り当てを許可するか

