"""
judge_assigner.py — ジャッジ割当ロジック
==========================================

【現在の実装】
  試合ごとに利用可能なジャッジを割り当てる。
  制約:
    1. can_be_main_judge/can_be_sub_judge/can_be_timekeeper フラグ
    2. 同一試合の両チームに対して interested_school_ids に含まれるジャッジは除外
    3. 同一時間枠での重複割当は避ける
    4. 担当数の均等化（最少担当のジャッジを優先）

【将来の最適化について】
  assign_judges() の入出力インターフェースを維持したまま、
  制約充足ソルバー（OR-Tools 等）への置き換えが可能。

【入力】
  matches: list[dict]  — スロット割当済みの対戦ペア（aff_team_id, neg_team_id 等）
  staffs: list[dict]   — event_staffs テーブルの行（+ interested_school_ids, present_segment_ids）
  teams: list[dict]    — event_teams テーブルの行（event_school_id が必要）
  judges_per_match: int — 1試合あたりのジャッジ数（通常3）

【出力】
  matches に main_judge_staff_id, sub_judge1_staff_id, sub_judge2_staff_id,
  judges_assignment_count を追加したもの。
"""

from __future__ import annotations
import random


def assign_judges(
    matches: list[dict],
    staffs: list[dict],
    teams: list[dict],
    judges_per_match: int = 3,
) -> list[dict]:
    """
    試合リストにジャッジを割り当てる。

    主審・副審をそれぞれの役割条件で選出し、各ジャッジの担当回数を追跡して最少担当優先で割り当てる。
    """
    # チームID → 学校IDのマップ
    team_school_map: dict[int, int | None] = {
        t["id"]: t.get("event_school_id") for t in teams
    }

    # ジャッジの担当カウント
    judge_assignment_count: dict[int, int] = {s["id"]: 0 for s in staffs}

    # 時間枠ごとの割当済みジャッジID（同一時間枠での重複防止）
    segment_judge_used: dict[int | None, set[int]] = {}

    for match in matches:
        seg_id = match.get("event_timetable_segment_id")
        if seg_id not in segment_judge_used:
            segment_judge_used[seg_id] = set()

        # Determine judges count for this segment dynamically
        j_count = 3
        if isinstance(judges_per_match, dict):
            if seg_id is not None:
                j_count = judges_per_match.get(seg_id, 3)
        else:
            j_count = judges_per_match

        # この試合に関係する学校IDを収集
        involved_school_ids: set[int] = set()
        for tid in [match.get("aff_team_id"), match.get("neg_team_id")]:
            if tid:
                school_id = team_school_map.get(tid)
                if school_id:
                    involved_school_ids.add(school_id)

        assigned_ids = []

        # 1. 主審の選出
        main_judge = _pick_main_judge(
            staffs=staffs,
            involved_school_ids=involved_school_ids,
            segment_used=segment_judge_used.get(seg_id, set()),
            assignment_count=judge_assignment_count,
        )

        if main_judge:
            assigned_ids.append(main_judge["id"])
            judge_assignment_count[main_judge["id"]] += 1
            segment_judge_used[seg_id].add(main_judge["id"])
            match["main_judge_staff_id"] = main_judge["id"]
        else:
            match["main_judge_staff_id"] = None

        # 2. 副審の選出 (j_count - 1 人)
        sub_judges_to_pick = max(0, j_count - 1)
        sub_judges = _pick_sub_judges(
            staffs=staffs,
            count=sub_judges_to_pick,
            involved_school_ids=involved_school_ids,
            segment_used=segment_judge_used.get(seg_id, set()),
            assignment_count=judge_assignment_count,
        )

        for i, sj in enumerate(sub_judges):
            assigned_ids.append(sj["id"])
            judge_assignment_count[sj["id"]] += 1
            segment_judge_used[seg_id].add(sj["id"])
            if i == 0:
                match["sub_judge1_staff_id"] = sj["id"]
            elif i == 1:
                match["sub_judge2_staff_id"] = sj["id"]

        if len(sub_judges) < 1:
            match["sub_judge1_staff_id"] = None
        if len(sub_judges) < 2:
            match["sub_judge2_staff_id"] = None

        match["judges_assignment_count"] = len(assigned_ids)

    return matches


# ─── Private helpers ──────────────────────────────────────────────────────────

def _pick_main_judge(
    staffs: list[dict],
    involved_school_ids: set[int],
    segment_used: set[int],
    assignment_count: dict[int, int],
) -> dict | None:
    """条件を満たす主審可能なスタッフから、担当回数の最も少ない者を1名選出する。"""
    candidates = []
    for s in staffs:
        if s["id"] in segment_used:
            continue
        if not s.get("can_be_main_judge"):
            continue
        interested = s.get("interested_school_ids") or []
        if any(sid in involved_school_ids for sid in interested):
            continue
        candidates.append(s)

    if not candidates:
        return None

    random.shuffle(candidates)
    candidates.sort(key=lambda s: assignment_count.get(s["id"], 0))
    return candidates[0]


def _pick_sub_judges(
    staffs: list[dict],
    count: int,
    involved_school_ids: set[int],
    segment_used: set[int],
    assignment_count: dict[int, int],
) -> list[dict]:
    """条件を満たす副審可能なスタッフから、担当回数の最も少ない者を優先して count 人選出する。"""
    candidates = []
    for s in staffs:
        if s["id"] in segment_used:
            continue
        if not s.get("can_be_sub_judge"):
            continue
        interested = s.get("interested_school_ids") or []
        if any(sid in involved_school_ids for sid in interested):
            continue
        candidates.append(s)

    if not candidates:
        return []

    random.shuffle(candidates)
    candidates.sort(key=lambda s: assignment_count.get(s["id"], 0))
    return candidates[:count]

