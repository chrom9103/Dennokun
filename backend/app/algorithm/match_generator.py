"""
match_generator.py — スロットベース対戦カード生成ロジック（改良版）
=========================================================

【改良内容】
  ① 試合数の平準化
     各チームの累計試合数が均等（最大差1試合以内）になるようペア選択を制御する。
     均等にできない場合は警告を出力する。

  ② 肯定（Affirmative）/ 否定（Negative）のバランス制御
     各チームのAff/Neg回数の差が1以内に収まるよう、立場の割り当てを制御する。
     例: 4試合ならAff2・Neg2、5試合ならAff2・Neg3 or Aff3・Neg2。

  ③ シード校配置バランス
     各シードチームにおいて「シード同士の対戦数」と「シード vs 非シードの対戦数」の
     差が1以内に収まるよう、ペア選択スコアに重みを付ける。

【入力】
  teams: list[dict]    — event_teams テーブルの行（id, event_section_id, event_school_id, is_seed 必須）
  segments: list[dict] — event_timetable_segments テーブルの行（id, order_number 必須）
  rooms: list[dict]    — event_rooms テーブルの行（id, order_number 必須）
  section_segment_parallel_matches: dict[str, int] — キー: "{section_id}_{segment_id}", 値: 並行試合数

【出力】
  list[dict] with keys:
    event_timetable_segment_id  : int — 時間枠ID
    event_room_id               : int — 会場ID
    event_section_id            : int — 部門ID
    aff_team_id                 : int — 肯定側チームID
    neg_team_id                 : int — 否定側チームID
    order_number_in_segment     : int — セグメント内順序 (1始まり)
"""

from __future__ import annotations
import random


def generate_matches_by_slots(
    teams: list[dict],
    segments: list[dict],
    rooms: list[dict],
    section_segment_parallel_matches: dict[str, int],
    confirmed_matches: list[dict] = None,
) -> tuple[list[dict], list[str]]:
    """
    各部門の各時間枠の並行試合数設定に基づいて、チームを対戦ペアに割り振り、会場スロットを割り当てる。

    Returns: (generated_matches, warnings)
    """
    warnings: list[str] = []
    generated_matches: list[dict] = []

    if not teams:
        return [], ["チームが登録されていません。"]
    if not segments:
        return [], ["時間枠が登録されていません。"]
    if not rooms:
        return [], ["会場が登録されていません。"]

    if confirmed_matches is None:
        confirmed_matches = []

    # チームごとの累計試合数カウンター
    team_match_count: dict[int, int] = {t["id"]: 0 for t in teams}
    # チームごとの Aff/Neg 累計カウンター
    team_aff_count: dict[int, int] = {t["id"]: 0 for t in teams}
    team_neg_count: dict[int, int] = {t["id"]: 0 for t in teams}
    # これまでに対戦したペア履歴
    played_pairs: set[tuple[int, int]] = set()
    # シードチームの対戦相手種別カウンター（シード同士 vs シード vs 非シード）
    seed_vs_seed_count: dict[int, int] = {t["id"]: 0 for t in teams if t.get("is_seed")}
    seed_vs_non_count: dict[int, int] = {t["id"]: 0 for t in teams if t.get("is_seed")}

    # 既に確定している試合の対戦情報を履歴・カウントに反映
    team_is_seed: dict[int, bool] = {t["id"]: bool(t.get("is_seed")) for t in teams}

    for m in confirmed_matches:
        aff_id = m.get("aff_team_id")
        neg_id = m.get("neg_team_id")
        if aff_id in team_match_count:
            team_match_count[aff_id] += 1
            team_aff_count[aff_id] = team_aff_count.get(aff_id, 0) + 1
        if neg_id in team_match_count:
            team_match_count[neg_id] += 1
            team_neg_count[neg_id] = team_neg_count.get(neg_id, 0) + 1
        if aff_id and neg_id:
            played_pairs.add((aff_id, neg_id))
            played_pairs.add((neg_id, aff_id))
            # シードカウント更新
            aff_seed = team_is_seed.get(aff_id, False)
            neg_seed = team_is_seed.get(neg_id, False)
            if aff_seed:
                if neg_seed:
                    seed_vs_seed_count[aff_id] = seed_vs_seed_count.get(aff_id, 0) + 1
                else:
                    seed_vs_non_count[aff_id] = seed_vs_non_count.get(aff_id, 0) + 1
            if neg_seed:
                if aff_seed:
                    seed_vs_seed_count[neg_id] = seed_vs_seed_count.get(neg_id, 0) + 1
                else:
                    seed_vs_non_count[neg_id] = seed_vs_non_count.get(neg_id, 0) + 1

    # ソートされた時間枠と会場
    sorted_segments = sorted(segments, key=lambda s: s.get("order_number") or 0)
    sorted_rooms = sorted(rooms, key=lambda r: r.get("order_number") or r["id"])

    # 部門ごとにチームを分類（対戦は同じ部門同士）
    section_teams: dict[int, list[dict]] = {}
    for team in teams:
        sec_id = team.get("event_section_id")
        if sec_id is not None:
            section_teams.setdefault(sec_id, []).append(team)

    for seg in sorted_segments:
        seg_id = seg["id"]

        # このセグメント全体の確定済み（既定）の部屋IDとチームIDを収集
        seg_confirmed = [m for m in confirmed_matches if m.get("event_timetable_segment_id") == seg_id]
        confirmed_room_ids = {m.get("event_room_id") for m in seg_confirmed if m.get("event_room_id") is not None}
        confirmed_team_ids = {m.get("aff_team_id") for m in seg_confirmed if m.get("aff_team_id") is not None} | \
                             {m.get("neg_team_id") for m in seg_confirmed if m.get("neg_team_id") is not None}

        # 部門ごとにこのセグメントで生成すべき新規試合数を算出
        sec_needed_counts: dict[int, int] = {}
        total_needed_new = 0
        for sec_id in section_teams.keys():
            param_key = f"{sec_id}_{seg_id}"
            param_count = section_segment_parallel_matches.get(param_key, 0)
            sec_confirmed_count = sum(1 for m in seg_confirmed if m.get("event_section_id") == sec_id)
            needed = max(0, param_count - sec_confirmed_count)
            if needed > 0:
                sec_needed_counts[sec_id] = needed
                total_needed_new += needed

        if total_needed_new <= 0:
            continue

        # 空いている部屋を選択（確定済みの部屋以外から、順序が上のものを選択）
        available_rooms = [r for r in sorted_rooms if r["id"] not in confirmed_room_ids]
        if len(available_rooms) < total_needed_new:
            warnings.append(
                f"時間枠「{seg['name']}」の新規生成必要数 {total_needed_new} に対して、"
                f"使用可能な空き会場数 ({len(available_rooms)}) が不足しています。"
                f"割り当て可能な {len(available_rooms)} 試合のみ生成します。"
            )
            total_needed_new = len(available_rooms)

        # この時間枠で対戦に使用する会場
        used_rooms = available_rooms[:total_needed_new]

        # 部門ごとの利用可能チーム (確定済みのチームを除く)
        seg_available_teams: dict[int, list[dict]] = {}
        for sec_id, sec_teams in section_teams.items():
            seg_available_teams[sec_id] = [
                t for t in sec_teams if t["id"] not in confirmed_team_ids
            ]

        room_idx = 0
        order_in_seg = len(seg_confirmed) + 1  # 確定済み試合の後ろから開始

        # 部門ごとに必要な試合数だけペアを生成し、部屋に割り当てる
        for sec_id, needed_count in sorted(sec_needed_counts.items()):
            for _ in range(needed_count):
                if room_idx >= len(used_rooms):
                    break

                room = used_rooms[room_idx]

                # この部門内で最も適切なペアを探索
                best_pair = _find_best_pair(
                    sec_id=sec_id,
                    available_teams=seg_available_teams.get(sec_id, []),
                    team_match_count=team_match_count,
                    team_aff_count=team_aff_count,
                    team_neg_count=team_neg_count,
                    played_pairs=played_pairs,
                    seed_vs_seed_count=seed_vs_seed_count,
                    seed_vs_non_count=seed_vs_non_count,
                    team_is_seed=team_is_seed,
                )

                if not best_pair:
                    warnings.append(
                        f"時間枠「{seg['name']}」の部門ID「{sec_id}」において、"
                        f"対戦可能なペアを組めるチームが不足したため、試合が生成できませんでした。"
                    )
                    continue

                team_a, team_b = best_pair

                # 使用したチームをこの時間枠の利用可能リストから除外
                seg_available_teams[sec_id].remove(team_a)
                seg_available_teams[sec_id].remove(team_b)

                # 対戦カウント更新と履歴登録
                team_match_count[team_a["id"]] += 1
                team_match_count[team_b["id"]] += 1
                played_pairs.add((team_a["id"], team_b["id"]))
                played_pairs.add((team_b["id"], team_a["id"]))

                # シードカウント更新
                a_seed = team_is_seed.get(team_a["id"], False)
                b_seed = team_is_seed.get(team_b["id"], False)
                if a_seed:
                    if b_seed:
                        seed_vs_seed_count[team_a["id"]] = seed_vs_seed_count.get(team_a["id"], 0) + 1
                    else:
                        seed_vs_non_count[team_a["id"]] = seed_vs_non_count.get(team_a["id"], 0) + 1
                if b_seed:
                    if a_seed:
                        seed_vs_seed_count[team_b["id"]] = seed_vs_seed_count.get(team_b["id"], 0) + 1
                    else:
                        seed_vs_non_count[team_b["id"]] = seed_vs_non_count.get(team_b["id"], 0) + 1

                # ② Aff/Neg バランスを考慮して立場を決定
                aff, neg = _assign_aff_neg(
                    team_a, team_b, team_aff_count, team_neg_count
                )

                # Aff/Neg カウント更新
                team_aff_count[aff["id"]] = team_aff_count.get(aff["id"], 0) + 1
                team_neg_count[neg["id"]] = team_neg_count.get(neg["id"], 0) + 1

                generated_matches.append({
                    "event_timetable_segment_id": seg_id,
                    "event_room_id": room["id"],
                    "event_section_id": sec_id,
                    "aff_team_id": aff["id"],
                    "neg_team_id": neg["id"],
                    "order_number_in_segment": order_in_seg,
                })
                room_idx += 1
                order_in_seg += 1

    # ① 試合数の平準化チェックと警告
    _check_match_count_balance(
        teams=teams,
        team_match_count=team_match_count,
        confirmed_matches=confirmed_matches,
        generated_matches=generated_matches,
        warnings=warnings,
    )

    return generated_matches, warnings


def _assign_aff_neg(
    team_a: dict,
    team_b: dict,
    team_aff_count: dict[int, int],
    team_neg_count: dict[int, int],
) -> tuple[dict, dict]:
    """
    ② Aff/Neg バランスを考慮して、team_a と team_b どちらが肯定側かを決める。
    Aff回数 - Neg回数 が小さい方を肯定側に割り当てる（バランス優先）。
    同じ場合はランダムに決める。
    """
    a_bias = team_aff_count.get(team_a["id"], 0) - team_neg_count.get(team_a["id"], 0)
    b_bias = team_aff_count.get(team_b["id"], 0) - team_neg_count.get(team_b["id"], 0)

    if a_bias < b_bias:
        # team_a の方が Aff が少ない → team_a を Aff に
        return team_a, team_b
    elif b_bias < a_bias:
        # team_b の方が Aff が少ない → team_b を Aff に
        return team_b, team_a
    else:
        # 同等 → ランダム
        if random.random() < 0.5:
            return team_a, team_b
        return team_b, team_a


def _find_best_pair(
    sec_id: int,
    available_teams: list[dict],
    team_match_count: dict[int, int],
    team_aff_count: dict[int, int],
    team_neg_count: dict[int, int],
    played_pairs: set[tuple[int, int]],
    seed_vs_seed_count: dict[int, int],
    seed_vs_non_count: dict[int, int],
    team_is_seed: dict[int, bool],
) -> tuple[dict, dict] | None:
    """
    指定された部門内で最も適切な対戦ペアを1組探し、(team_a, team_b) で返す。

    スコアリング基準（低いほど良い）:
      - 試合数が多いチームは避ける（① 平準化）
      - 同一校対戦は避ける
      - 過去の対戦履歴がある対戦は避ける
      - ③ シード同士の偏りを避ける（seed_vs_seed と seed_vs_non の差が大きいペアは避ける）
    """
    if len(available_teams) < 2:
        return None

    best_pair: tuple[dict, dict] | None = None
    best_score = float("inf")

    # チームを累計対戦数でソート（少ない順）して探索
    sorted_avail = sorted(available_teams, key=lambda t: team_match_count[t["id"]])

    for i, t_a in enumerate(sorted_avail):
        for t_b in sorted_avail[i + 1:]:
            score = _compute_pair_score(
                t_a, t_b,
                team_match_count=team_match_count,
                played_pairs=played_pairs,
                seed_vs_seed_count=seed_vs_seed_count,
                seed_vs_non_count=seed_vs_non_count,
                team_is_seed=team_is_seed,
            )

            if score < best_score:
                best_score = score
                best_pair = (t_a, t_b)

    return best_pair


def _compute_pair_score(
    t_a: dict,
    t_b: dict,
    team_match_count: dict[int, int],
    played_pairs: set[tuple[int, int]],
    seed_vs_seed_count: dict[int, int],
    seed_vs_non_count: dict[int, int],
    team_is_seed: dict[int, bool],
) -> float:
    """ペアのスコアを計算する（低いほど良い）。"""
    score = float(team_match_count[t_a["id"]] + team_match_count[t_b["id"]])

    # 同一校対戦は最悪
    is_same_school = (
        t_a.get("event_school_id") is not None
        and t_a.get("event_school_id") == t_b.get("event_school_id")
    )
    if is_same_school:
        score += 10000

    # 過去対戦済みは大きなペナルティ
    if (t_a["id"], t_b["id"]) in played_pairs:
        score += 1000

    # ③ シード校配置バランス
    a_seed = team_is_seed.get(t_a["id"], False)
    b_seed = team_is_seed.get(t_b["id"], False)

    if a_seed and b_seed:
        # 両方シード: このペアを組むと「シード同士」カウントが増える
        # t_a の seed_vs_seed と seed_vs_non の差を評価
        for seed_id in [t_a["id"], t_b["id"]]:
            svs = seed_vs_seed_count.get(seed_id, 0)
            svn = seed_vs_non_count.get(seed_id, 0)
            # 既にシード同士が多い場合はペナルティ
            diff_after = (svs + 1) - svn
            if diff_after > 1:
                score += 500 * diff_after

    elif a_seed and not b_seed:
        # t_a はシード、t_b は非シード
        svs = seed_vs_seed_count.get(t_a["id"], 0)
        svn = seed_vs_non_count.get(t_a["id"], 0)
        # 既にシード vs 非シードが多い場合はペナルティ
        diff_after = (svn + 1) - svs
        if diff_after > 1:
            score += 300 * diff_after

    elif not a_seed and b_seed:
        # t_b はシード、t_a は非シード
        svs = seed_vs_seed_count.get(t_b["id"], 0)
        svn = seed_vs_non_count.get(t_b["id"], 0)
        diff_after = (svn + 1) - svs
        if diff_after > 1:
            score += 300 * diff_after

    return score


def _check_match_count_balance(
    teams: list[dict],
    team_match_count: dict[int, int],
    confirmed_matches: list[dict],
    generated_matches: list[dict],
    warnings: list[str],
) -> None:
    """
    ① 試合数の平準化チェック: 最大と最小の差が2以上ある場合に警告を出す。
    ゼロ試合のチームは除外する（未参加チームが混在する場合を考慮）。
    """
    active_teams = [t for t in teams if team_match_count.get(t["id"], 0) > 0]
    if not active_teams:
        return

    counts = [team_match_count[t["id"]] for t in active_teams]
    min_count = min(counts)
    max_count = max(counts)

    if max_count - min_count >= 2:
        imbalanced = [
            t for t in active_teams
            if team_match_count[t["id"]] != min_count and team_match_count[t["id"]] != max_count
        ]
        # 最大試合数のチームと最小試合数のチームを列挙
        max_teams = [t["name"] for t in active_teams if team_match_count[t["id"]] == max_count]
        min_teams = [t["name"] for t in active_teams if team_match_count[t["id"]] == min_count]
        warnings.append(
            f"⚠️ 試合数の不均等があります: 最大 {max_count} 試合 ({', '.join(max_teams[:3])}{'...' if len(max_teams) > 3 else ''}) / "
            f"最小 {min_count} 試合 ({', '.join(min_teams[:3])}{'...' if len(min_teams) > 3 else ''})。"
            f"「最小試合数と最大試合数の差は {max_count - min_count} 試合」です。"
            f"可能であれば並行試合数の設定を見直してください。"
        )
    elif max_count - min_count == 1:
        warnings.append(
            f"ℹ️ 試合数が1試合差のチームがあります（最小 {min_count} 試合 / 最大 {max_count} 試合）。"
            f"これはチーム数・枠数の関係上やむを得ない場合があります。"
        )
