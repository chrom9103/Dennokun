"""
judge_assigner.py — ジャッジ割当ロジック
==========================================

アルゴリズム概要:
  セグメント内バックトラッキング + 動的MRVヒューリスティック

  1. 各セグメント内で「候補スタッフが最も少ない試合」から動的に選択 (MRV)
  2. ランダムリトライではなく体系的なバックトラッキングで確実に解を探索
  3. 候補スタッフは担当回数の少ない順に試行（均等化）
  4. 解が存在しないことを確定的に判断し、青制約緩和版へ移行

制約:
  0. 橙: 出席可能時間枠（present_segment_ids）以外へのアサイン禁止
         ※ present_segment_ids が空の場合は全枠出席可能とみなす
  1. 赤: 同一時間枠内での同一スタッフの重複割り当て禁止
  2. 黄: 利害関係校の試合へのアサイン禁止
  3. 青: 同一部門において、過去に担当したことのある学校の試合へのアサイン禁止
"""

from __future__ import annotations


def assign_judges(
    matches: list[dict],
    staffs: list[dict],
    teams: list[dict],
    judges_per_match: int | dict[int, int] = 3,
    allow_reversed_past: bool = False,
) -> tuple[list[dict], str | None]:
    """
    試合リストにジャッジ（主審・副審）および司会タイマーを割り当てる。

    Returns:
        (assigned_matches, warning_message_or_None)
    """
    # ---- 前処理: ルックアップテーブルの構築 ----
    team_school_map: dict[int, int | None] = {
        t["id"]: t.get("event_school_id") for t in teams
    }

    # スタッフIDごとの出席可能セグメントIDセット (空 = 全枠出席可能)
    staff_present_segs: dict[int, set[int]] = {}
    for s in staffs:
        present = s.get("present_segment_ids")
        staff_present_segs[s["id"]] = set(present) if present else set()

    # スタッフIDごとの利害関係校IDセット
    staff_interested: dict[int, set[int]] = {
        s["id"]: set(s.get("interested_school_ids") or []) for s in staffs
    }

    # セグメントごとの試合グループ
    seg_matches: dict[int, list[dict]] = {}
    for m in matches:
        seg_id = m.get("event_timetable_segment_id")
        seg_matches.setdefault(seg_id, []).append(m)

    # セグメントを segment_order 順にソート
    def get_seg_sort_key(sid: int) -> tuple:
        first = seg_matches[sid][0] if seg_matches[sid] else {}
        order = first.get("segment_order")
        return (order if order is not None else 999999, sid)

    sorted_seg_ids = sorted(seg_matches.keys(), key=get_seg_sort_key)

    # ---- 候補スタッフ判定 ----
    def is_candidate(
        staff: dict,
        role_flag: str,
        seg_id: int,
        segment_used: set[int],
        match: dict,
        past_sides: dict[tuple, set],
        ignore_blue: bool,
    ) -> bool:
        """スタッフが特定の試合・役割の候補として有効か判定する。"""
        if not staff.get(role_flag):
            return False
        if staff["id"] in segment_used:
            return False

        # 制約0 (橙): 出席可能時間枠チェック
        present = staff_present_segs.get(staff["id"], set())
        if present and seg_id not in present:
            return False

        aff_team_id = match.get("aff_team_id")
        neg_team_id = match.get("neg_team_id")
        aff_school_id = team_school_map.get(aff_team_id) if aff_team_id else None
        neg_school_id = team_school_map.get(neg_team_id) if neg_team_id else None
        involved_school_ids = {aff_school_id, neg_school_id} - {None}

        # 制約2 (黄): 利害関係校チェック
        if staff_interested.get(staff["id"], set()) & involved_school_ids:
            return False

        # 制約3 (青): 過去担当校チェック
        if not ignore_blue and involved_school_ids:
            section_id = match.get("event_section_id")
            if section_id is not None:
                for school_id in involved_school_ids:
                    past = past_sides.get((staff["id"], section_id, school_id), set())
                    if allow_reversed_past:
                        # 逆サイドはOK: 同一サイド再担当のみ禁止
                        if aff_school_id == school_id and "aff" in past:
                            return False
                        if neg_school_id == school_id and "neg" in past:
                            return False
                    else:
                        if past:
                            return False

        return True

    def get_candidates(
        role_flag: str,
        seg_id: int,
        segment_used: set[int],
        match: dict,
        past_sides: dict,
        ignore_blue: bool,
        count_map: dict[int, int],
    ) -> list[dict]:
        """
        役割に対する有効候補リストを返す。
        担当回数が少ない順（均等化）にソート済み。
        """
        candidates = [
            s for s in staffs
            if is_candidate(s, role_flag, seg_id, segment_used, match, past_sides, ignore_blue)
        ]
        candidates.sort(key=lambda s: count_map[s["id"]])
        return candidates

    # ---- past_sides のデルタ管理 ----
    def apply_past_sides(
        past_sides: dict,
        staff_ids: list[int],
        match: dict,
    ) -> list[tuple]:
        """
        割り当てスタッフの担当校をpast_sidesに追記する。
        追加したエントリのデルタ（undo用）を返す。
        """
        section_id = match.get("event_section_id")
        if section_id is None:
            return []

        aff_school_id = team_school_map.get(match.get("aff_team_id")) if match.get("aff_team_id") else None
        neg_school_id = team_school_map.get(match.get("neg_team_id")) if match.get("neg_team_id") else None

        delta: list[tuple] = []
        for sid in staff_ids:
            for school_id, side in [(aff_school_id, "aff"), (neg_school_id, "neg")]:
                if school_id is None:
                    continue
                k = (sid, section_id, school_id)
                past_sides.setdefault(k, set())
                if side not in past_sides[k]:
                    past_sides[k].add(side)
                    delta.append((k, side))
        return delta

    def undo_past_sides(past_sides: dict, delta: list[tuple]) -> None:
        """apply_past_sides のデルタを使ってpast_sidesを元に戻す。"""
        for k, side in delta:
            past_sides[k].discard(side)
            if not past_sides[k]:
                del past_sides[k]

    # ---- セグメント内バックトラッキング ----
    def solve_segment(
        unconfirmed_matches: list[dict],
        seg_id: int,
        segment_used: set[int],
        count_map: dict[int, int],
        past_sides: dict,
        ignore_blue: bool,
    ) -> bool:
        """
        バックトラッキングで1セグメントの未確定試合の割り当てを解く。

        - MRV（最小残余値）ヒューリスティック: 候補が最も少ない試合から動的に選択
        - 担当回数均等化: 候補は割当回数の少ない順にトライ
        - バックトラッキング: 行き詰まったら前の選択に戻り別の候補を試みる

        成功: True を返し、matches を変更済み状態にする
        失敗: False を返し、matches を変更前状態に戻す（undo保証）
        """
        def get_j_count(match: dict) -> int:
            if isinstance(judges_per_match, dict):
                return judges_per_match.get(seg_id, 3)
            return judges_per_match

        def build_role_list(match: dict) -> list[tuple[str, str]]:
            """試合の役割リストを構築する: [(field_name, role_flag), ...]"""
            j = get_j_count(match)
            roles: list[tuple[str, str]] = []
            if j >= 1:
                roles.append(("main_judge_staff_id", "can_be_main_judge"))
            for i in range(max(0, j - 1)):
                field = "sub_judge1_staff_id" if i == 0 else "sub_judge2_staff_id"
                roles.append((field, "can_be_sub_judge"))
            roles.append(("timekeeper_staff_id", "can_be_timekeeper"))
            return roles

        def min_role_candidates(match: dict) -> int:
            """
            MRVヒューリスティック用スコア: 最も候補が少ない役割の候補数。
            0なら割り当て不可能。
            """
            roles = build_role_list(match)
            min_c = float("inf")
            for _, role_flag in roles:
                c = len(get_candidates(
                    role_flag, seg_id, segment_used, match,
                    past_sides, ignore_blue, count_map,
                ))
                if c < min_c:
                    min_c = c
            return int(min_c) if min_c != float("inf") else 0

        def backtrack(unprocessed: list[dict]) -> bool:
            """
            未割り当て試合リストを再帰的に割り当てる。
            毎回MRVで最も制約が厳しい試合を動的に選択する。
            """
            if not unprocessed:
                return True  # 全試合の割り当て完了

            # --- 動的MRV: 候補が最も少ない試合を選択 ---
            difficulties = [min_role_candidates(m) for m in unprocessed]
            chosen_idx = min(range(len(unprocessed)), key=lambda i: difficulties[i])

            if difficulties[chosen_idx] == 0:
                return False  # 候補なし = 解なし

            match = unprocessed[chosen_idx]
            remaining = unprocessed[:chosen_idx] + unprocessed[chosen_idx + 1:]

            roles = build_role_list(match)

            # 試合フィールドを初期化
            for field, _ in roles:
                match[field] = None
            match["judges_assignment_count"] = 0

            def assign_roles(role_idx: int, assigned_ids: list[int]) -> bool:
                """
                1試合内の役割を1つずつ割り当てる内部バックトラッキング。
                全役割の割り当てが完了したら次の試合へ進む。
                """
                if role_idx == len(roles):
                    # 全役割割り当て完了 → past_sidesを更新して次の試合へ
                    delta = apply_past_sides(past_sides, assigned_ids, match)
                    match["judges_assignment_count"] = len(assigned_ids)

                    if backtrack(remaining):
                        return True

                    # 次の試合で失敗 → この試合の担当校記録をundo
                    undo_past_sides(past_sides, delta)
                    match["judges_assignment_count"] = 0
                    return False

                field, role_flag = roles[role_idx]
                candidates = get_candidates(
                    role_flag, seg_id, segment_used, match,
                    past_sides, ignore_blue, count_map,
                )

                if not candidates:
                    return False  # この役割に候補なし

                for staff in candidates:
                    sid = staff["id"]

                    # 状態を更新してバックトラッキング
                    segment_used.add(sid)
                    count_map[sid] += 1
                    match[field] = sid
                    assigned_ids.append(sid)

                    if assign_roles(role_idx + 1, assigned_ids):
                        return True

                    # 失敗 → undo して次の候補を試みる
                    assigned_ids.pop()
                    match[field] = None
                    count_map[sid] -= 1
                    segment_used.discard(sid)

                return False  # 全候補を試したが解なし

            return assign_roles(0, [])

        return backtrack(list(unconfirmed_matches))

    # ---- メイン割当処理 ----
    def run_assignment(ignore_blue: bool) -> list[dict] | None:
        """
        全セグメントの割り当てを試みる。
        いずれかのセグメントで解なしと確定した場合はNoneを返す。
        """
        count_map: dict[int, int] = {s["id"]: 0 for s in staffs}
        past_sides: dict[tuple, set] = {}
        assigned_matches: list[dict] = []

        for seg_id in sorted_seg_ids:
            segment_matches = seg_matches[seg_id]
            segment_used: set[int] = set()

            confirmed = [m for m in segment_matches if m.get("is_staffs_fixed")]
            unconfirmed = [m for m in segment_matches if not m.get("is_staffs_fixed")]

            # 確定済み試合の状態を先に反映
            for match in confirmed:
                assigned_matches.append(match)

                aff_school_id = team_school_map.get(match.get("aff_team_id")) if match.get("aff_team_id") else None
                neg_school_id = team_school_map.get(match.get("neg_team_id")) if match.get("neg_team_id") else None
                section_id = match.get("event_section_id")

                for role in [
                    "main_judge_staff_id", "sub_judge1_staff_id",
                    "sub_judge2_staff_id", "timekeeper_staff_id"
                ]:
                    s_id = match.get(role)
                    if not s_id:
                        continue
                    segment_used.add(s_id)
                    if s_id in count_map:
                        count_map[s_id] += 1
                    if section_id is not None:
                        if aff_school_id:
                            past_sides.setdefault((s_id, section_id, aff_school_id), set()).add("aff")
                        if neg_school_id:
                            past_sides.setdefault((s_id, section_id, neg_school_id), set()).add("neg")

            # 未確定試合のコピーを作成して初期化
            work_matches = [dict(m) for m in unconfirmed]
            for m in work_matches:
                m["main_judge_staff_id"] = None
                m["sub_judge1_staff_id"] = None
                m["sub_judge2_staff_id"] = None
                m["timekeeper_staff_id"] = None
                m["judges_assignment_count"] = 0

            # バックトラッキングで割り当て解を探索
            if not solve_segment(
                work_matches, seg_id, segment_used,
                count_map, past_sides, ignore_blue,
            ):
                return None  # このセグメントで解なし → 全体失敗

            assigned_matches.extend(work_matches)

        return assigned_matches

    # 1. 全制約（橙・赤・黄・青）で試行
    result = run_assignment(ignore_blue=False)
    if result is not None:
        match_dict = {m["id"]: m for m in result}
        ordered = [match_dict.get(orig["id"], orig) for orig in matches]
        return ordered, None

    # 2. 青制約を緩和して再試行
    result = run_assignment(ignore_blue=True)
    if result is not None:
        match_dict = {m["id"]: m for m in result}
        ordered = [match_dict.get(orig["id"], orig) for orig in matches]
        warning = (
            "制約（赤・黄・青）をすべて満たす割り当てが見つかりませんでした。"
            "過去担当校の再審判禁止（青）の制約を緩和したパターンを表示しています。"
        )
        return ordered, warning

    # 3. 緩和後も解なし
    warning = (
        "スタッフ数または担当可能時間の不足により、"
        "制約を満たす審判アサインメントを生成できませんでした。"
    )
    return matches, warning
