"""Pydantic schemas for match generation and assignment update."""
from typing import Optional
from pydantic import BaseModel


# ── Generation request ─────────────────────────────────────────────────────────

class GenerateMatchesRequest(BaseModel):
    """試合生成リクエスト。"""
    rounds: int = 1
    judges_per_match: int = 3
    use_groups: bool = True        # チームグループを使用するか（Falseなら部門単位）
    assign_judges: bool = True     # ジャッジ自動割当を行うか
    assign_slots: bool = True      # 時間枠・会場自動割当を行うか
    overwrite: bool = False        # 既存試合を削除してから生成するか


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
    event_section_id: Optional[int] = None
    order_number_in_segment: Optional[int] = None


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
