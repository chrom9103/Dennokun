"""
match_generator.py — スロットベース対戦カード生成ロジック
=========================================================

【現在の実装】
  各部門の各時間枠における「並行試合数」パラメータ設定に応じて、
  登録されたチームから均等に対戦ペアを組んで会場スロットに割り当てる。

【将来の最適化について】
  このファイルだけ差し替えれば、より高度な最適化（遺伝的アルゴリズム、
  線形計画法など）に移行できるよう設計している。
  generate_matches_by_slots() の入出力インターフェースを維持すること。

【入力】
  teams: list[dict]    — event_teams テーブルの行（id, event_section_id, event_school_id 必須）
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

    # チームごとの累計対戦数カウンター
    team_match_count: dict[int, int] = {t["id"]: 0 for t in teams}
    # これまでに対戦したペア履歴
    played_pairs: set[tuple[int, int]] = set()

    # 既に確定している試合の対戦情報を履歴・カウントに反映
    for m in confirmed_matches:
        aff_id = m.get("aff_team_id")
        neg_id = m.get("neg_team_id")
        if aff_id in team_match_count:
            team_match_count[aff_id] += 1
        if neg_id in team_match_count:
            team_match_count[neg_id] += 1
        if aff_id and neg_id:
            played_pairs.add((aff_id, neg_id))
            played_pairs.add((neg_id, aff_id))

    # ソートされた時間枠と会場
    sorted_segments = sorted(segments, key=lambda s: s.get("order_number") or 0)
    sorted_rooms = sorted(rooms, key=lambda r: r.get("order_number") or r["id"])

    # 部門ごとにチームを分類（対戦は同じ部門同士）
    section_teams: dict[int, list[dict]] = {}
    for team in teams:
        sec_id = team.get("event_section_id")
        if sec_id is not None:
            section_teams.setdefault(sec_id, []).append(team)

    # 試合ごとのAff/Neg平準化用のカウンタ
    flip_flag = False

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
            
            # この部門・この時間枠の確定済み試合数
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
            # 部屋が足りない場合は使用可能な部屋数までで打ち切る
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
                best_pair = _find_best_pair_for_section(
                    sec_id=sec_id,
                    available_teams=seg_available_teams.get(sec_id, []),
                    team_match_count=team_match_count,
                    played_pairs=played_pairs,
                )

                if not best_pair:
                    # ペアが組めない場合
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

                # 肯定・否定の公平化（交互に入れ替え）
                if flip_flag:
                    aff, neg = team_b, team_a
                else:
                    aff, neg = team_a, team_b
                flip_flag = not flip_flag

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

    return generated_matches, warnings


def _find_best_pair_for_section(
    sec_id: int,
    available_teams: list[dict],
    team_match_count: dict[int, int],
    played_pairs: set[tuple[int, int]],
) -> tuple[dict, dict] | None:
    """指定された部門内で最も適切な対戦ペアを1組探し、(team_a, team_b) で返す。"""
    if len(available_teams) < 2:
        return None

    best_pair: tuple[dict, dict] | None = None
    min_combined_matches = float("inf")

    # チームを累計対戦数でソート (少ない順)
    sorted_avail = sorted(available_teams, key=lambda t: team_match_count[t["id"]])

    for i, t_a in enumerate(sorted_avail):
        for t_b in sorted_avail[i + 1:]:
            # 同一校対戦は可能な限り避ける
            is_same_school = (
                t_a.get("event_school_id") is not None
                and t_a.get("event_school_id") == t_b.get("event_school_id")
            )

            # 過去の対戦履歴があるか
            has_played = (t_a["id"], t_b["id"]) in played_pairs

            # ペア選定スコア (累計対戦数の合計)
            score = team_match_count[t_a["id"]] + team_match_count[t_b["id"]]

            # 同一校かつ過去対戦ありは最悪のスコア
            if is_same_school:
                score += 1000
            if has_played:
                score += 100

            if score < min_combined_matches:
                min_combined_matches = score
                best_pair = (t_a, t_b)

    return best_pair
