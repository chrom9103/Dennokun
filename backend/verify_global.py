"""
動的ノード数制限による超高速段階的緩和CSP検証スクリプト
"""
import asyncio
import sys
import time

sys.path.insert(0, "/app")

def assign_judges_csp_min_violations_fast(
    matches: list[dict],
    staffs: list[dict],
    teams: list[dict],
    judges_per_match: int | dict[int, int] = 3,
    allow_reversed_past: bool = False,
) -> tuple[list[dict], int, float]:
    # チームID → 学校ID
    team_school_map: dict[int, int | None] = {
        t["id"]: t.get("event_school_id") for t in teams
    }

    # スタッフマップ
    staffs_map = {s["id"]: s for s in staffs}

    # スタッフ出席セグメント
    staff_present_segs: dict[int, set[int]] = {}
    for s in staffs:
        present = s.get("present_segment_ids")
        staff_present_segs[s["id"]] = set(present) if present else set()

    # スタッフ利害関係校
    staff_interested: dict[int, set[int]] = {
        s["id"]: set(s.get("interested_school_ids") or []) for s in staffs
    }

    # 各試合の役割数を取得
    def get_j_count(m: dict) -> int:
        seg_id = m.get("event_timetable_segment_id")
        if isinstance(judges_per_match, dict):
            return judges_per_match.get(seg_id, 3)
        return judges_per_match

    # 各試合に必要な役割のリストを定義
    def get_roles_for_match(m: dict) -> list[tuple[str, str]]:
        j = get_j_count(m)
        roles = []
        if j >= 1:
            roles.append(("main_judge_staff_id", "can_be_main_judge"))
        for i in range(max(0, j - 1)):
            field = "sub_judge1_staff_id" if i == 0 else "sub_judge2_staff_id"
            roles.append((field, "can_be_sub_judge"))
        roles.append(("timekeeper_staff_id", "can_be_timekeeper"))
        return roles

    # 試合のコピーと分類（セグメント順にソート）
    work_matches = []
    variables = [] # (match_index, role_field, role_flag)

    seg_matches = {}
    for m in matches:
        seg_id = m.get("event_timetable_segment_id")
        seg_matches.setdefault(seg_id, []).append(m)

    def get_seg_sort_key(sid: int) -> tuple:
        first = seg_matches[sid][0] if seg_matches[sid] else {}
        order = first.get("segment_order")
        return (order if order is not None else 999999, sid)

    sorted_seg_ids = sorted(seg_matches.keys(), key=get_seg_sort_key)

    sorted_matches_temp = []
    for seg_id in sorted_seg_ids:
        sorted_matches_temp.extend(seg_matches[seg_id])

    for idx, orig_m in enumerate(sorted_matches_temp):
        m = dict(orig_m)
        if m.get("is_staffs_fixed"):
            work_matches.append(m)
        else:
            m["main_judge_staff_id"] = None
            m["sub_judge1_staff_id"] = None
            m["sub_judge2_staff_id"] = None
            m["timekeeper_staff_id"] = None
            m["judges_assignment_count"] = 0
            work_matches.append(m)
            
            roles = get_roles_for_match(m)
            for field, flag in roles:
                variables.append((idx, field, flag))

    # --- アサイン状態テーブルの初期化 ---
    count_map = {s["id"]: 0 for s in staffs}
    assigned_segs = {s["id"]: set() for s in staffs}
    assigned_schools = {s["id"]: {} for s in staffs}

    for idx, m in enumerate(work_matches):
        if m.get("is_staffs_fixed"):
            seg_id = m.get("event_timetable_segment_id")
            section_id = m.get("event_section_id")
            aff_school_id = team_school_map.get(m.get("aff_team_id")) if m.get("aff_team_id") else None
            neg_school_id = team_school_map.get(m.get("neg_team_id")) if m.get("neg_team_id") else None

            for role in ["main_judge_staff_id", "sub_judge1_staff_id", "sub_judge2_staff_id", "timekeeper_staff_id"]:
                sid = m.get(role)
                if sid and sid in count_map:
                    count_map[sid] += 1
                    assigned_segs[sid].add(seg_id)
                    if section_id is not None:
                        if aff_school_id:
                            if allow_reversed_past:
                                assigned_schools[sid].setdefault(section_id, set()).add((aff_school_id, "aff"))
                            else:
                                assigned_schools[sid].setdefault(section_id, set()).add(aff_school_id)
                        if neg_school_id:
                            if allow_reversed_past:
                                assigned_schools[sid].setdefault(section_id, set()).add((neg_school_id, "neg"))
                            else:
                                assigned_schools[sid].setdefault(section_id, set()).add(neg_school_id)

    # 高速アサインチェック
    def check_assignable_with_violation(staff_id: int, match_idx: int, role_flag: str) -> tuple[bool, int]:
        staff = staffs_map[staff_id]
        if not staff.get(role_flag):
            return False, 0

        match = work_matches[match_idx]
        seg_id = match.get("event_timetable_segment_id")

        # 1. 橙制約: 出席可能時間枠
        present = staff_present_segs.get(staff_id, set())
        if present and seg_id not in present:
            return False, 0

        # 2. 赤制約: 同一時間枠での重複不可
        if seg_id in assigned_segs[staff_id]:
            return False, 0

        # 3. 黄制約: 利害関係校
        aff_team_id = match.get("aff_team_id")
        neg_team_id = match.get("neg_team_id")
        aff_school_id = team_school_map.get(aff_team_id) if aff_team_id else None
        neg_school_id = team_school_map.get(neg_team_id) if neg_team_id else None
        involved_schools = {aff_school_id, neg_school_id} - {None}

        if staff_interested.get(staff_id, set()) & involved_schools:
            return False, 0

        # 4. 青制約違反の計算
        violation_count = 0
        if involved_schools:
            section_id = match.get("event_section_id")
            if section_id is not None:
                past_set = assigned_schools[staff_id].get(section_id, set())
                for sch in involved_schools:
                    if allow_reversed_past:
                        if sch == aff_school_id and (sch, "aff") in past_set:
                            violation_count += 1
                        if sch == neg_school_id and (sch, "neg") in past_set:
                            violation_count += 1
                    else:
                        if sch in past_set:
                            violation_count += 1
                            
        return True, violation_count

    def assign(staff_id: int, match_idx: int, field: str):
        match = work_matches[match_idx]
        seg_id = match.get("event_timetable_segment_id")
        section_id = match.get("event_section_id")
        aff_school_id = team_school_map.get(match.get("aff_team_id")) if match.get("aff_team_id") else None
        neg_school_id = team_school_map.get(match.get("neg_team_id")) if match.get("neg_team_id") else None

        match[field] = staff_id
        count_map[staff_id] += 1
        assigned_segs[staff_id].add(seg_id)
        
        if section_id is not None:
            if aff_school_id:
                if allow_reversed_past:
                    assigned_schools[staff_id].setdefault(section_id, set()).add((aff_school_id, "aff"))
                else:
                    assigned_schools[staff_id].setdefault(section_id, set()).add(aff_school_id)
            if neg_school_id:
                if allow_reversed_past:
                    assigned_schools[staff_id].setdefault(section_id, set()).add((neg_school_id, "neg"))
                else:
                    assigned_schools[staff_id].setdefault(section_id, set()).add(neg_school_id)

    def unassign(staff_id: int, match_idx: int, field: str):
        match = work_matches[match_idx]
        seg_id = match.get("event_timetable_segment_id")
        section_id = match.get("event_section_id")
        aff_school_id = team_school_map.get(match.get("aff_team_id")) if match.get("aff_team_id") else None
        neg_school_id = team_school_map.get(match.get("neg_team_id")) if match.get("neg_team_id") else None

        match[field] = None
        count_map[staff_id] -= 1
        assigned_segs[staff_id].discard(seg_id)
        
        if section_id is not None:
            if aff_school_id:
                if allow_reversed_past:
                    assigned_schools[staff_id].setdefault(section_id, set()).discard((aff_school_id, "aff"))
                else:
                    assigned_schools[staff_id].setdefault(section_id, set()).discard(aff_school_id)
            if neg_school_id:
                if allow_reversed_past:
                    assigned_schools[staff_id].setdefault(section_id, set()).discard((neg_school_id, "neg"))
                else:
                    assigned_schools[staff_id].setdefault(section_id, set()).discard(neg_school_id)

    def get_candidates(match_idx: int, role_flag: str) -> list[tuple[int, int]]:
        candidates = []
        for s in staffs:
            ok, v_cnt = check_assignable_with_violation(s["id"], match_idx, role_flag)
            if ok:
                candidates.append((s["id"], v_cnt))
        candidates.sort(key=lambda item: count_map[item[0]])
        return candidates

    def run_search(max_violations: int, node_limit: int) -> bool:
        nodes_visited = [0]
        current_violations = [0]

        def backtrack(var_idx: int) -> bool:
            nodes_visited[0] += 1
            if nodes_visited[0] > node_limit:
                return False

            if var_idx == len(variables):
                return True

            m_idx, field, flag = variables[var_idx]
            
            candidates = get_candidates(m_idx, flag)
            if not candidates:
                return False

            for sid, v_cnt in candidates:
                if current_violations[0] + v_cnt > max_violations:
                    continue

                assign(sid, m_idx, field)
                current_violations[0] += v_cnt
                
                if backtrack(var_idx + 1):
                    return True
                
                unassign(sid, m_idx, field)
                current_violations[0] -= v_cnt

            return False

        return backtrack(0)

    # 高速に段階的探索を行う
    # 最初の探索パスはノード制限を 5,000 と非常に小さくする
    # 見つからなかった場合のフォールバックとして制限を 100,000 にして再試行する
    start_time = time.time()
    for node_lim in [10000, 100000]:
        for max_v in range(0, 100):
            success = run_search(max_v, node_lim)
            if success:
                elapsed = time.time() - start_time
                match_dict = {m["id"]: m for m in work_matches}
                ordered = [match_dict.get(orig["id"], orig) for orig in matches]
                for m in ordered:
                    if not m.get("is_staffs_fixed"):
                        c = 0
                        for r in ["main_judge_staff_id", "sub_judge1_staff_id", "sub_judge2_staff_id", "timekeeper_staff_id"]:
                            if m.get(r):
                                c += 1
                        m["judges_assignment_count"] = c
                return ordered, max_v, elapsed

    return matches, -1, time.time() - start_time


async def main():
    from app.core.handle_db.matches import get_all_matches
    from app.core.handle_db.teams import get_all_teams
    from app.core.handle_db.staffs import get_all_staffs

    EVENT_ID = 63449476

    matches = await get_all_matches(EVENT_ID)
    teams = await get_all_teams(EVENT_ID)
    staffs = await get_all_staffs(EVENT_ID)
    judge_staffs = [s for s in staffs if s.get("can_be_main_judge") or s.get("can_be_sub_judge") or s.get("can_be_timekeeper")]

    seg_ids = list({m.get("event_timetable_segment_id") for m in matches if m.get("event_timetable_segment_id")})
    segment_judge_counts = {seg_id: 2 for seg_id in seg_ids}

    print("--- 動的制限 段階的緩和 CSP ---")
    assigned, min_violations, elapsed = assign_judges_csp_min_violations_fast(
        matches=matches, staffs=judge_staffs, teams=teams,
        judges_per_match=segment_judge_counts, allow_reversed_past=False
    )
    print(f"結果:")
    print(f"  最小青制約違反数: {min_violations} 件")
    print(f"  所要時間: {elapsed:.4f} 秒")

if __name__ == "__main__":
    asyncio.run(main())
