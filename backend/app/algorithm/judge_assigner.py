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

    各ジャッジの担当回数を追跡し、最少担当優先で割り当てる。
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

        # この試合に関係する学校IDを収集
        involved_school_ids: set[int] = set()
        for tid in [match.get("aff_team_id"), match.get("neg_team_id")]:
            if tid:
                school_id = team_school_map.get(tid)
                if school_id:
                    involved_school_ids.add(school_id)

        # 利用可能ジャッジを絞り込む
        available = _filter_available_judges(
            staffs=staffs,
            involved_school_ids=involved_school_ids,
            segment_used=segment_judge_used.get(seg_id, set()),
            assignment_count=judge_assignment_count,
        )

        assigned = _pick_judges(available, judges_per_match, judge_assignment_count)

        # 担当数を更新し、時間枠の使用済みセットに追加
        for s in assigned:
            judge_assignment_count[s["id"]] = judge_assignment_count.get(s["id"], 0) + 1
            segment_judge_used[seg_id].add(s["id"])

        # 割当結果をマッチに書き込む
        match["judges_assignment_count"] = len(assigned)
        match["main_judge_staff_id"] = assigned[0]["id"] if len(assigned) > 0 else None
        match["sub_judge1_staff_id"] = assigned[1]["id"] if len(assigned) > 1 else None
        match["sub_judge2_staff_id"] = assigned[2]["id"] if len(assigned) > 2 else None

    return matches


# ─── Private helpers ──────────────────────────────────────────────────────────

def _filter_available_judges(
    staffs: list[dict],
    involved_school_ids: set[int],
    segment_used: set[int],
    assignment_count: dict[int, int],  # noqa: ARG001 (used by caller)
) -> list[dict]:
    """利害関係・時間枠重複を除いた利用可能ジャッジを返す。"""
    available = []
    for s in staffs:
        # 同一時間枠ですでに割当済み
        if s["id"] in segment_used:
            continue
        # 利害関係のある学校が試合に含まれる
        interested: list[int] = s.get("interested_school_ids") or []
        if any(sid in involved_school_ids for sid in interested):
            continue
        # ジャッジとして担当可能（主審か副審）
        if not (s.get("can_be_main_judge") or s.get("can_be_sub_judge")):
            continue
        available.append(s)
    return available


def _pick_judges(
    available: list[dict],
    count: int,
    assignment_count: dict[int, int],
) -> list[dict]:
    """
    担当回数が最も少ないジャッジを優先して count 人を選ぶ。
    担当回数が同じ場合はランダムにシャッフル（公平化）。
    """
    if not available:
        return []

    # 担当数昇順でソートし、同数内はシャッフル
    random.shuffle(available)
    sorted_available = sorted(available, key=lambda s: assignment_count.get(s["id"], 0))

    # can_be_main_judge のスタッフを主審に優先
    main_candidates = [s for s in sorted_available if s.get("can_be_main_judge")]
    sub_candidates = [s for s in sorted_available if not s.get("can_be_main_judge")]

    picked: list[dict] = []
    if main_candidates:
        picked.append(main_candidates[0])
        remaining = main_candidates[1:] + sub_candidates
    else:
        remaining = sorted_available

    for s in remaining:
        if len(picked) >= count:
            break
        if s not in picked:
            picked.append(s)

    return picked[:count]
