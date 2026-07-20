"""
judge_assigner.py — ジャッジ割当ロジック
==========================================

アルゴリズム概要:
  静的順序高速CSP（制約充足問題）+ 段階的制約緩和 (Gradual Relaxation)

  1. 探索はセグメント（時間枠）および役割の順序で固定された変数リストに対して行う。
     これにより、バックトラック時の時系列の整合性と枝刈り効率を最大化する。
  2. 橙制約（出席可能枠）、赤制約（重複不可）、黄制約（利害関係）は「必須制約」として常に守る。
  3. 青制約（過去担当校）は「ソフト制約」として扱い、段階的に許容する違反数を 0 から増やしていく。
     これにより、数学的に青制約を100%守ることが不可能な状況であっても、
     「青制約違反（重複担当）が最小となる組み合わせ」を確定的に探索して出力する。
  4. 探索状態はインクリメンタルなマルチセットカウンタ（辞書）で管理され、
     バックトラック中のアサイン・アンアサイン状態を正確に追跡する。
  5. allow_same_group_diff_team フラグが有効な場合、青制約（過去担当校）の重複判定を
     学校（グループ）単位ではなく、チーム単位でチェックする。
"""

from __future__ import annotations
import time

def assign_judges(
    matches: list[dict],
    staffs: list[dict],
    teams: list[dict],
    judges_per_match: int | dict[int, int] = 3,
    allow_reversed_past: bool = False,
    allow_same_group_diff_team: bool = False,
    allow_diff_day: bool = False,
) -> tuple[list[dict], str | None]:
    """
    試合リストにジャッジ（主審・副審）および司会タイマーを割り当てる。
    
    Returns:
        (assigned_matches, warning_message_or_None)
    """
    # チームID → 学校IDのマップ
    team_school_map: dict[int, int | None] = {
        t["id"]: t.get("event_school_id") for t in teams
    }

    # スタッフID → スタッフ辞書のマップ
    staffs_map = {s["id"]: s for s in staffs}

    # スタッフ出席セグメントIDセット (空の場合は全セグメント出席可能)
    staff_present_segs: dict[int, set[int]] = {}
    for s in staffs:
        present = s.get("present_segment_ids")
        staff_present_segs[s["id"]] = set(present) if present else set()

    # スタッフ利害関係校IDセット
    staff_interested: dict[int, set[int]] = {
        s["id"]: set(s.get("interested_school_ids") or []) for s in staffs
    }

    # セグメントの日付グループ(day_index)を計算する
    seg_day_map: dict[int, int] = {}  # seg_id -> day_index
    if allow_diff_day:
        seg_info: dict[int, tuple[int, str | None]] = {}
        for m in matches:
            sid = m.get("event_timetable_segment_id")
            if sid is not None and sid not in seg_info:
                seg_info[sid] = (
                    m.get("segment_order") if m.get("segment_order") is not None else 999999,
                    m.get("segment_start_time"),
                )
        sorted_sids = sorted(seg_info.keys(), key=lambda s: (seg_info[s][0], s))
        day_index = 0
        prev_time: str | None = None
        for sid in sorted_sids:
            _, start_time = seg_info[sid]
            if start_time and prev_time and start_time < prev_time:
                day_index += 1
            seg_day_map[sid] = day_index
            if start_time:
                prev_time = start_time

    # キー作成ヘルパー関数
    def make_key(entity_id: int, side: str | None, seg_id: int | None):
        if allow_diff_day:
            day_idx = seg_day_map.get(seg_id, 0) if seg_id is not None else 0
            return (entity_id, side, day_idx) if allow_reversed_past and side else (entity_id, day_idx)
        else:
            return (entity_id, side) if allow_reversed_past and side else entity_id

    # 各試合の役割数を取得するヘルパー
    def get_j_count(m: dict) -> int:
        seg_id = m.get("event_timetable_segment_id")
        if isinstance(judges_per_match, dict):
            return judges_per_match.get(seg_id, 3)
        return judges_per_match

    # 各試合の役割変数を取得するヘルパー
    def get_roles_for_match(m: dict) -> list[tuple[str, str]]:
        j = get_j_count(m)
        roles = []
        if j >= 1:
            roles.append(("main_judge_staff_id", "can_be_main_judge"))
        for i in range(max(0, j - 1)):
            field = f"sub_judge{i+1}_staff_id"
            roles.append((field, "can_be_sub_judge"))
        roles.append(("timekeeper_staff_id", "can_be_timekeeper"))
        return roles

    # 1. セグメントの順序に従って試合をソートする（変数順序の最適化）
    seg_matches: dict[int, list[dict]] = {}
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

    # 2. 変数とコピーの作成
    work_matches = []
    variables = [] # (match_index, role_field, role_flag)

    for idx, orig_m in enumerate(sorted_matches_temp):
        m = dict(orig_m)
        pairing_decided = (m.get("aff_team_id") is not None) and (m.get("neg_team_id") is not None)
        if m.get("is_staffs_fixed") or not pairing_decided:
            work_matches.append(m)
        else:
            m["main_judge_staff_id"] = None
            m["sub_judge1_staff_id"] = None
            m["sub_judge2_staff_id"] = None
            m["sub_judge3_staff_id"] = None
            m["sub_judge4_staff_id"] = None
            m["timekeeper_staff_id"] = None
            m["judges_assignment_count"] = 0
            work_matches.append(m)
            
            roles = get_roles_for_match(m)
            for field, flag in roles:
                variables.append((idx, field, flag))

    # --- アサイン状態テーブルの初期化 (マルチセットカウンタとして動作) ---
    count_map = {s["id"]: 0 for s in staffs}
    assigned_segs = {s["id"]: set() for s in staffs}
    assigned_schools = {s["id"]: {} for s in staffs}
    assigned_teams = {s["id"]: {} for s in staffs}

    # 確定済みの試合をアサイン状態テーブルに事前反映
    for idx, m in enumerate(work_matches):
        pairing_decided = (m.get("aff_team_id") is not None) and (m.get("neg_team_id") is not None)
        if m.get("is_staffs_fixed") or not pairing_decided:
            seg_id = m.get("event_timetable_segment_id")
            section_id = m.get("event_section_id")
            aff_team_id = m.get("aff_team_id")
            neg_team_id = m.get("neg_team_id")
            aff_school_id = team_school_map.get(aff_team_id) if aff_team_id else None
            neg_school_id = team_school_map.get(neg_team_id) if neg_team_id else None

            for role in ["main_judge_staff_id", "sub_judge1_staff_id", "sub_judge2_staff_id", "sub_judge3_staff_id", "sub_judge4_staff_id", "timekeeper_staff_id"]:
                sid = m.get(role)
                if sid and sid in count_map:
                    count_map[sid] += 1
                    assigned_segs[sid].add(seg_id)
                    if section_id is not None:
                        # 学校
                        d_sch = assigned_schools[sid].setdefault(section_id, {})
                        if aff_school_id:
                            k = make_key(aff_school_id, "aff", seg_id)
                            d_sch[k] = d_sch.get(k, 0) + 1
                        if neg_school_id:
                            k = make_key(neg_school_id, "neg", seg_id)
                            d_sch[k] = d_sch.get(k, 0) + 1
                        # チーム
                        d_team = assigned_teams[sid].setdefault(section_id, {})
                        if aff_team_id:
                            k = make_key(aff_team_id, "aff", seg_id)
                            d_team[k] = d_team.get(k, 0) + 1
                        if neg_team_id:
                            k = make_key(neg_team_id, "neg", seg_id)
                            d_team[k] = d_team.get(k, 0) + 1

    # 3. 制約判定および違反計算
    def check_assignable_with_violation(staff_id: int, match_idx: int, role_flag: str) -> tuple[bool, int]:
        staff = staffs_map.get(staff_id)
        if not staff or not staff.get(role_flag):
            return False, 0

        match = work_matches[match_idx]
        seg_id = match.get("event_timetable_segment_id")

        # [橙制約] 出席可能時間枠チェック
        present = staff_present_segs.get(staff_id, set())
        if present and seg_id not in present:
            return False, 0

        # [赤制約] 同一時間枠での重複不可
        if seg_id in assigned_segs[staff_id]:
            return False, 0

        # [黄制約] 利害関係校チェック
        aff_team_id = match.get("aff_team_id")
        neg_team_id = match.get("neg_team_id")
        aff_school_id = team_school_map.get(aff_team_id) if aff_team_id else None
        neg_school_id = team_school_map.get(neg_team_id) if neg_team_id else None
        involved_schools = {aff_school_id, neg_school_id} - {None}

        if staff_interested.get(staff_id, set()) & involved_schools:
            return False, 0

        # [青制約] 過去担当校の重複（違反）カウント
        violation_count = 0
        if involved_schools:
            section_id = match.get("event_section_id")
            if section_id is not None:
                if allow_same_group_diff_team:
                    # チーム単位で重複チェック
                    past_team_dict = assigned_teams[staff_id].get(section_id, {})
                    if aff_team_id and past_team_dict.get(make_key(aff_team_id, "aff", seg_id), 0) > 0:
                        violation_count += 1
                    if neg_team_id and past_team_dict.get(make_key(neg_team_id, "neg", seg_id), 0) > 0:
                        violation_count += 1
                else:
                    # 従来通り、学校（グループ）単位で重複チェック
                    past_dict = assigned_schools[staff_id].get(section_id, {})
                    if aff_school_id and past_dict.get(make_key(aff_school_id, "aff", seg_id), 0) > 0:
                        violation_count += 1
                    if neg_school_id and past_dict.get(make_key(neg_school_id, "neg", seg_id), 0) > 0:
                        violation_count += 1
                            
        return True, violation_count

    # 4. アサインおよびアンアサイン処理 (マルチセットカウンタの更新)
    def assign(staff_id: int, match_idx: int, field: str):
        match = work_matches[match_idx]
        seg_id = match.get("event_timetable_segment_id")
        section_id = match.get("event_section_id")
        aff_team_id = match.get("aff_team_id")
        neg_team_id = match.get("neg_team_id")
        aff_school_id = team_school_map.get(aff_team_id) if aff_team_id else None
        neg_school_id = team_school_map.get(neg_team_id) if neg_team_id else None

        match[field] = staff_id
        count_map[staff_id] += 1
        assigned_segs[staff_id].add(seg_id)
        
        if section_id is not None:
            # 学校
            d_sch = assigned_schools[staff_id].setdefault(section_id, {})
            if aff_school_id:
                k = make_key(aff_school_id, "aff", seg_id)
                d_sch[k] = d_sch.get(k, 0) + 1
            if neg_school_id:
                k = make_key(neg_school_id, "neg", seg_id)
                d_sch[k] = d_sch.get(k, 0) + 1
            # チーム
            d_team = assigned_teams[staff_id].setdefault(section_id, {})
            if aff_team_id:
                k = make_key(aff_team_id, "aff", seg_id)
                d_team[k] = d_team.get(k, 0) + 1
            if neg_team_id:
                k = make_key(neg_team_id, "neg", seg_id)
                d_team[k] = d_team.get(k, 0) + 1

    def unassign(staff_id: int, match_idx: int, field: str):
        match = work_matches[match_idx]
        seg_id = match.get("event_timetable_segment_id")
        section_id = match.get("event_section_id")
        aff_team_id = match.get("aff_team_id")
        neg_team_id = match.get("neg_team_id")
        aff_school_id = team_school_map.get(aff_team_id) if aff_team_id else None
        neg_school_id = team_school_map.get(neg_team_id) if neg_team_id else None

        match[field] = None
        count_map[staff_id] -= 1
        assigned_segs[staff_id].discard(seg_id)
        
        if section_id is not None:
            # 学校
            d_sch = assigned_schools[staff_id].setdefault(section_id, {})
            if aff_school_id:
                k = make_key(aff_school_id, "aff", seg_id)
                if k in d_sch:
                    d_sch[k] -= 1
                    if d_sch[k] <= 0:
                        del d_sch[k]
            if neg_school_id:
                k = make_key(neg_school_id, "neg", seg_id)
                if k in d_sch:
                    d_sch[k] -= 1
                    if d_sch[k] <= 0:
                        del d_sch[k]
            # チーム
            d_team = assigned_teams[staff_id].setdefault(section_id, {})
            if aff_team_id:
                k = make_key(aff_team_id, "aff", seg_id)
                if k in d_team:
                    d_team[k] -= 1
                    if d_team[k] <= 0:
                        del d_team[k]
            if neg_team_id:
                k = make_key(neg_team_id, "neg", seg_id)
                if k in d_team:
                    d_team[k] -= 1
                    if d_team[k] <= 0:
                        del d_team[k]

    # 5. 候補取得
    def get_candidates(match_idx: int, role_flag: str) -> list[tuple[int, int]]:
        candidates = []
        for s in staffs:
            ok, v_cnt = check_assignable_with_violation(s["id"], match_idx, role_flag)
            if ok:
                candidates.append((s["id"], v_cnt))
        candidates.sort(key=lambda item: count_map[item[0]])
        return candidates

    # 6. 探索の実行
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

    # 7. 段階的緩和 (違反しきい値を 0 から増やしながら高速探索)
    for node_lim in [10000, 100000]:
        for max_v in range(0, 100):
            success = run_search(max_v, node_lim)
            if success:
                # 成功した場合は元の matches リストの順序で返す
                match_dict = {m["id"]: m for m in work_matches}
                ordered = [match_dict.get(orig["id"], orig) for orig in matches]
                
                # アサイン人数の設定
                for m in ordered:
                    pairing_decided = (m.get("aff_team_id") is not None) and (m.get("neg_team_id") is not None)
                    if not m.get("is_staffs_fixed") and pairing_decided:
                        c = 0
                        for r in ["main_judge_staff_id", "sub_judge1_staff_id", "sub_judge2_staff_id", "sub_judge3_staff_id", "sub_judge4_staff_id"]:
                            if m.get(r):
                                c += 1
                        m["judges_assignment_count"] = c
                
                # 警告メッセージの設定
                if max_v == 0:
                    warning_msg = None
                else:
                    warning_msg = (
                        "制約（赤・黄・青）をすべて満たす割り当てが見つかりませんでした。"
                        f"過去担当校の重複が最小限（合計 {max_v} 回）になるよう最適化した割り当てを表示しています。"
                    )
                return ordered, warning_msg

    # 最終的なフォールバック
    warning_msg = "スタッフ数または担当可能時間の不足により、制約を満たす審判アサインメントを生成できませんでした。"
    return matches, warning_msg
