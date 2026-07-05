"""
judge_assigner.py — ジャッジ割当ロジック
==========================================
"""

from __future__ import annotations
import random

def assign_judges(
    matches: list[dict],
    staffs: list[dict],
    teams: list[dict],
    judges_per_match: int | dict[int, int] = 3,
    allow_reversed_past: bool = False,
) -> tuple[list[dict], str | None]:
    """
    試合リストにジャッジ（主審・副審）および司会タイマーを割り当てる。
    制約:
      0. 橙: 出席可能時間枠以外へのアサイン禁止（present_segment_ids が空の場合は全枠出席可能）
      1. 赤: 同一時間枠内での同一スタッフの重複割り当て禁止
      2. 黄: 利害関係校の試合へのアサイン禁止
      3. 青: 同一部門（セクション）において、過去に担当したことのある学校の試合へのアサイン禁止
    """
    # チームID → 学校IDのマップ
    team_school_map: dict[int, int | None] = {
        t["id"]: t.get("event_school_id") for t in teams
    }

    # スタッフIDごとの出席可能セグメントIDセット（空=全枠出席可能）
    staff_present_segs: dict[int, set[int]] = {}
    for s in staffs:
        present = s.get("present_segment_ids")
        if present:
            staff_present_segs[s["id"]] = set(present)
        else:
            staff_present_segs[s["id"]] = set()  # 空=全枠出席可能

    # Group matches by segment
    seg_matches = {}
    for m in matches:
        seg_id = m.get("event_timetable_segment_id")
        if seg_id not in seg_matches:
            seg_matches[seg_id] = []
        seg_matches[seg_id].append(m)

    # Sort segments by segment_order, then id
    def get_seg_sort_key(sid):
      m_list = seg_matches[sid]
      first_m = m_list[0] if m_list else {}
      order = first_m.get("segment_order")
      if order is None:
          order = 999999
      return (order, sid)

    sorted_seg_ids = sorted(seg_matches.keys(), key=get_seg_sort_key)

    def try_assignment(ignore_blue=False) -> list[dict] | None:
        judge_assignment_count = {s["id"]: 0 for s in staffs}
        past_sides_by_staff_school: dict[tuple[int, int, int], set[str]] = {}

        assigned_matches = []

        for seg_id in sorted_seg_ids:
            segment_used = set()
            segment_matches = seg_matches[seg_id]

            # 確定済み試合と未確定試合を分ける
            confirmed_in_seg = [m for m in segment_matches if m.get("is_staffs_fixed")]
            unconfirmed_in_seg = [m for m in segment_matches if not m.get("is_staffs_fixed")]

            # 確定済み試合のスタッフ・学校割当を先に反映・ロック
            for match in confirmed_in_seg:
                assigned_matches.append(match)

                aff_team_id = match.get("aff_team_id")
                neg_team_id = match.get("neg_team_id")
                aff_school_id = team_school_map.get(aff_team_id) if aff_team_id else None
                neg_school_id = team_school_map.get(neg_team_id) if neg_team_id else None

                assigned_staff_ids = []
                for role in ["main_judge_staff_id", "sub_judge1_staff_id", "sub_judge2_staff_id", "timekeeper_staff_id"]:
                    s_id = match.get(role)
                    if s_id:
                        assigned_staff_ids.append(s_id)
                        segment_used.add(s_id)
                        if s_id in judge_assignment_count:
                            judge_assignment_count[s_id] += 1

                section_id = match.get("event_section_id")
                if section_id is not None:
                    for s_id in assigned_staff_ids:
                        if aff_school_id:
                            k = (s_id, section_id, aff_school_id)
                            if k not in past_sides_by_staff_school:
                                past_sides_by_staff_school[k] = set()
                            past_sides_by_staff_school[k].add("aff")
                        if neg_school_id:
                            k = (s_id, section_id, neg_school_id)
                            if k not in past_sides_by_staff_school:
                                past_sides_by_staff_school[k] = set()
                            past_sides_by_staff_school[k].add("neg")

            # 未確定試合をコピーして初期化
            shuffled_matches = [dict(m) for m in unconfirmed_in_seg]
            for m in shuffled_matches:
                m["main_judge_staff_id"] = None
                m["sub_judge1_staff_id"] = None
                m["sub_judge2_staff_id"] = None
                m["timekeeper_staff_id"] = None
                m["judges_assignment_count"] = 0

            # 選択順序をランダム化
            random.shuffle(shuffled_matches)

            for match in shuffled_matches:
                j_count = 3
                if isinstance(judges_per_match, dict):
                    j_count = judges_per_match.get(seg_id, 3)
                else:
                    j_count = judges_per_match

                aff_team_id = match.get("aff_team_id")
                neg_team_id = match.get("neg_team_id")
                aff_school_id = team_school_map.get(aff_team_id) if aff_team_id else None
                neg_school_id = team_school_map.get(neg_team_id) if neg_team_id else None
                involved_school_ids = {aff_school_id, neg_school_id} - {None}
                section_id = match.get("event_section_id")

                def get_candidates(role_flag):
                    candidates = []
                    for s in staffs:
                        if not s.get(role_flag):
                            continue
                        if s["id"] in segment_used:
                            continue

                        # 制約0 (橙): 出席可能時間枠チェック
                        # present_segs が空の場合は全時間枠出席可能とみなす
                        present_segs = staff_present_segs.get(s["id"], set())
                        if present_segs and seg_id not in present_segs:
                            continue

                        # 制約2 (黄): 利害関係校チェック
                        interested = s.get("interested_school_ids") or []
                        if any(sid in involved_school_ids for sid in interested):
                            continue

                        # 制約3 (青): 過去担当校チェック
                        if not ignore_blue and section_id is not None:
                            if allow_reversed_past:
                                conflict_aff = False
                                if aff_school_id:
                                    past_sides = past_sides_by_staff_school.get((s["id"], section_id, aff_school_id), set())
                                    if "aff" in past_sides:
                                        conflict_aff = True
                                conflict_neg = False
                                if neg_school_id:
                                    past_sides = past_sides_by_staff_school.get((s["id"], section_id, neg_school_id), set())
                                    if "neg" in past_sides:
                                        conflict_neg = True
                                if conflict_aff or conflict_neg:
                                    continue
                            else:
                                conflict = False
                                for school_id in involved_school_ids:
                                    past_sides = past_sides_by_staff_school.get((s["id"], section_id, school_id), set())
                                    if past_sides:
                                        conflict = True
                                        break
                                if conflict:
                                    continue
                        candidates.append(s)
                    return candidates

                # 1. Main Judge
                main_judge = None
                if j_count >= 1:
                    candidates = get_candidates("can_be_main_judge")
                    if not candidates:
                        return None
                    min_count = min(judge_assignment_count[c["id"]] for c in candidates)
                    best_candidates = [c for c in candidates if judge_assignment_count[c["id"]] == min_count]
                    main_judge = random.choice(best_candidates)
                    
                    match["main_judge_staff_id"] = main_judge["id"]
                    segment_used.add(main_judge["id"])
                    judge_assignment_count[main_judge["id"]] += 1
                else:
                    match["main_judge_staff_id"] = None

                # 2. Sub Judges
                sub_judges_to_pick = max(0, j_count - 1)
                sub_judge_ids = []
                for _ in range(sub_judges_to_pick):
                    candidates = get_candidates("can_be_sub_judge")
                    if not candidates:
                        return None
                    min_count = min(judge_assignment_count[c["id"]] for c in candidates)
                    best_candidates = [c for c in candidates if judge_assignment_count[c["id"]] == min_count]
                    picked = random.choice(best_candidates)
                    
                    sub_judge_ids.append(picked["id"])
                    segment_used.add(picked["id"])
                    judge_assignment_count[picked["id"]] += 1

                match["sub_judge1_staff_id"] = sub_judge_ids[0] if len(sub_judge_ids) > 0 else None
                match["sub_judge2_staff_id"] = sub_judge_ids[1] if len(sub_judge_ids) > 1 else None

                # 3. Timekeeper
                candidates = get_candidates("can_be_timekeeper")
                if not candidates:
                    return None
                min_count = min(judge_assignment_count[c["id"]] for c in candidates)
                best_candidates = [c for c in candidates if judge_assignment_count[c["id"]] == min_count]
                timekeeper = random.choice(best_candidates)
                
                match["timekeeper_staff_id"] = timekeeper["id"]
                segment_used.add(timekeeper["id"])
                judge_assignment_count[timekeeper["id"]] += 1

                match["judges_assignment_count"] = (1 if main_judge else 0) + len(sub_judge_ids) + 1

                # Update seen schools for all assigned staff in this match
                assigned_ids_for_match = [match["timekeeper_staff_id"]]
                if main_judge:
                    assigned_ids_for_match.append(match["main_judge_staff_id"])
                assigned_ids_for_match.extend(sub_judge_ids)

                if section_id is not None:
                    for sid in assigned_ids_for_match:
                        if aff_school_id:
                            k = (sid, section_id, aff_school_id)
                            if k not in past_sides_by_staff_school:
                                past_sides_by_staff_school[k] = set()
                            past_sides_by_staff_school[k].add("aff")
                        if neg_school_id:
                            k = (sid, section_id, neg_school_id)
                            if k not in past_sides_by_staff_school:
                                past_sides_by_staff_school[k] = set()
                            past_sides_by_staff_school[k].add("neg")

                assigned_matches.append(match)

        return assigned_matches

    # Try assignment with strict constraints first (Red, Yellow, Blue, Orange)
    max_strict_attempts = 1500
    for _ in range(max_strict_attempts):
        res = try_assignment(ignore_blue=False)
        if res is not None:
            # Map back to original list format to preserve match order
            match_dict = {m["id"]: m for m in res}
            ordered_matches = [match_dict.get(orig_m["id"], orig_m) for orig_m in matches]
            return ordered_matches, None

    # Try assignment with ignore_blue = True
    max_loose_attempts = 1500
    for _ in range(max_loose_attempts):
        res = try_assignment(ignore_blue=True)
        if res is not None:
            match_dict = {m["id"]: m for m in res}
            ordered_matches = [match_dict.get(orig_m["id"], orig_m) for orig_m in matches]
            warning = "制約（赤・黄・青）をすべて満たす割り当てが見つかりませんでした。過去担当校の再審判禁止（青）の制約を緩和したパターンを表示しています。"
            return ordered_matches, warning

    # Fallback to no-assignment or partial assignment if completely impossible
    warning = "スタッフ数または担当可能時間の不足により、制約を満たす審判アサインメントを生成できませんでした。"
    return matches, warning
