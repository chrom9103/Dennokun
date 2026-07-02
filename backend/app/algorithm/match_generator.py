"""
match_generator.py — スロットベース対戦カード生成ロジック
=========================================================

【現在の実装】
  時間枠ごとに設定された「並行試合数」に応じて、
  登録されたチームから均等に対戦ペアを組んで会場スロットに割り当てる。

【将来の最適化について】
  このファイルだけ差し替えれば、より高度な最適化（遺伝的アルゴリズム、
  線形計画法など）に移行できるよう設計している。
  generate_matches_by_slots() の入出力インターフェースを維持すること。

【入力】
  teams: list[dict]    — event_teams テーブルの行（id, event_section_id, event_school_id 必須）
  segments: list[dict] — event_timetable_segments テーブルの行（id, order_number 必須）
  rooms: list[dict]    — event_rooms テーブルの行（id, order_number 必須）
  parallel_matches_map: dict[int, int] — 時間枠ID -> 並行試合数

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
    parallel_matches_map: dict[int, int],
) -> tuple[list[dict], list[str]]:
    """
    時間枠の並行試合数に基づいて、チームを対戦ペアに割り振り、会場スロットを割り当てる。

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

    # チームごとの累計対戦数カウンター
    team_match_count: dict[int, int] = {t["id"]: 0 for t in teams}
    # これまでに対戦したペア履歴
    played_pairs: set[tuple[int, int]] = set()

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
        parallel_count = parallel_matches_map.get(seg_id, 0)
        if parallel_count <= 0:
            continue

        # 会場数が足りない場合
        if len(sorted_rooms) < parallel_count:
            warnings.append(
                f"時間枠「{seg['name']}」の並行試合数 {parallel_count} に対して、"
                f"登録されている会場数 ({len(sorted_rooms)}) が不足しています。"
                f"割り当て可能な {len(sorted_rooms)} 試合のみ生成します。"
            )
            parallel_count = len(sorted_rooms)

        # この時間枠で対戦に使用する会場
        used_rooms = sorted_rooms[:parallel_count]

        # 部門ごとの利用可能チーム
        seg_available_teams: dict[int, list[dict]] = {
            sec_id: [t for t in sec_teams]
            for sec_id, sec_teams in section_teams.items()
        }

        # この時間枠での対戦カードを生成
        matches_in_seg = 0
        order_in_seg = 1

        # 会場スロット分だけ試合を組む
        for room in used_rooms:
            # 対戦可能ペアを探す
            # 優先度:
            # 1. 累計対戦数が最も少ない部門
            # 2. その部門内で、累計対戦数が最も少ないチーム
            best_pair = _find_best_pair(
                seg_available_teams=seg_available_teams,
                team_match_count=team_match_count,
                played_pairs=played_pairs,
            )

            if not best_pair:
                # ペアが組めない場合（その時間枠で対戦できる部門のチームが残っていない）
                break

            team_a, team_b, sec_id = best_pair

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
            matches_in_seg += 1
            order_in_seg += 1

        if matches_in_seg < parallel_count:
            warnings.append(
                f"時間枠「{seg['name']}」において、同じ部門内で対戦相手を組めるチームが不足したため、"
                f"並行試合数 {parallel_count} に対し {matches_in_seg} 試合のみ生成されました。"
            )

    return generated_matches, warnings


def _find_best_pair(
    seg_available_teams: dict[int, list[dict]],
    team_match_count: dict[int, int],
    played_pairs: set[tuple[int, int]],
) -> tuple[dict, dict, int] | None:
    """最も適切な対戦ペアを1組探し、(team_a, team_b, section_id) で返す。"""
    # 候補ペアを探索
    best_pair: tuple[dict, dict, int] | None = None
    min_combined_matches = float("inf")

    # 部門ごとに探索
    for sec_id, available in seg_available_teams.items():
        if len(available) < 2:
            continue

        # チームを累計対戦数でソート (少ない順)
        sorted_avail = sorted(available, key=lambda t: team_match_count[t["id"]])

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
                    best_pair = (t_a, t_b, sec_id)

    return best_pair
