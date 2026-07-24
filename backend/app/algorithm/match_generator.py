"""
match_generator.py — スロットベース対戦カード生成ロジック（改良版 v2）
=========================================================

【アルゴリズム概要: 雛形（スケルトン）ベース 3 フェーズ方式】

  ■ Phase 1 — ペア構成フェーズ（Pairing Phase）
    各部門において、具体的なチームを決めず抽象ロール ID
    （S0, S1, … / N0, N1, …）を用いて全セグメントの対戦ペアを決定する。
    この段階では Aff/Neg を決めず、試合数均等（①）とシード配置バランス（③）を最適化する。
    確定済み試合がある場合は、ロールカウンターに反映した上で継続する。

  ■ Phase 2 — Aff/Neg 一括割り当てフェーズ（Aff/Neg Assignment Phase）
    全セグメントのペアが確定した後、「残り試合数ベースの強制割り当て」により
    条件②④を最大限満たすよう Aff/Neg を決定する。
    処理順序をランダムに変えて複数回試行し、最も条件を満たす結果を採用する。

  ■ Phase 3 — 具体化フェーズ（Materialization Phase）
    雛形完成後、各ロールに実際のチームをランダムにシャッフルして割り当て、
    会場スロットと組み合わせて最終出力を生成する。

【満たすべき条件と優先順位 (0 -> 1 -> 2 -> 3 -> 4 -> 5)】
  ⓪ 再対戦の禁止     : 同一対戦校同士の2回目以降の対戦を厳格に禁止（最優先）。
  ① 試合数均等       : 各チームの累計試合数の最大差が 1 以内。超過時は警告。
  ② Aff/Neg バランス : 各チームの Aff 回数 − Neg 回数 が常に ±1 以内。
  ③ シード対戦タイプ数バランス:
       各シードチームにおいて「シード同士の対戦数」と
       「シード vs 非シードの対戦数」の差が 1 以内。
  ④ シード対戦タイプ別 Aff/Neg バランス:
       シード同士の対戦・シード vs 非シードの対戦それぞれにおいて、
       各シードチームの Aff/Neg の差が 1 以内。
  ⑤ シード・非シード校のセグメント分散バランス:
       同じ試合数の範囲内で、各セグメントにシード校と非シード校が均等に分散するように配置する。

【注意事項】
  - 1 チームは同一時間枠（セグメント）に最大 1 試合のみ出場可能。
  - 同一学校の複数チーム（Aチーム・Bチームなど）は同一セグメントに割り当て可能。
  - 部門（セクション）ごとに独立してバランスを管理する。

【入力】
  teams                           : list[dict]  — event_teams 行（id, event_section_id,
                                                  event_school_id, is_seed 必須）
  segments                        : list[dict]  — event_timetable_segments 行（id, order_number,
                                                  name 必須）
  rooms                           : list[dict]  — event_rooms 行（id, order_number 必須）
  section_segment_parallel_matches: dict[str, int]  — キー "{section_id}_{segment_id}", 値: 並行試合数
  confirmed_matches               : list[dict]  — 既に確定済みの試合（省略可）
  as_skeleton                     : bool        — True の場合、チームIDなしの空スロットを返す
                                                  （本戦など後から編集する枠の雛型生成用）

【出力】
  (list[dict], list[str]) のタプル
  dict のキー:
    event_timetable_segment_id : int       — 時間枠 ID
    event_room_id              : int       — 会場 ID
    event_section_id           : int       — 部門 ID
    aff_team_id                : int|None  — 肯定側チーム ID
    neg_team_id                : int|None  — 否定側チーム ID
    order_number_in_segment    : int       — セグメント内順序（1 始まり）
"""

from __future__ import annotations
import random
from dataclasses import dataclass
from collections import defaultdict


# ===========================================================================
# 内部データクラス
# ===========================================================================

@dataclass
class _SkeletonPair:
    """Phase 1 で生成するペア（Aff/Neg 未決定）"""
    seg_id: int
    role_x: str
    role_y: str


@dataclass
class _SkeletonEntry:
    """Phase 2 で Aff/Neg が確定した 1 試合"""
    seg_id: int
    aff_role: str
    neg_role: str


@dataclass
class _PairCounters:
    """Phase 1 で使うロールごとのペア数カウンター（①③および放置防止用）"""
    match_count: int = 0
    svs_count: int = 0   # シード同士の対戦数（③）
    svn_count: int = 0   # シード vs 非シードの対戦数（③）
    last_seg_idx: int = -1  # 最後に試合を行ったセグメントのインデックス（放置防止用）


# ===========================================================================
# メイン公開関数
# ===========================================================================

def generate_matches_by_slots(
    teams: list[dict],
    segments: list[dict],
    rooms: list[dict],
    section_segment_parallel_matches: dict[str, int],
    confirmed_matches: list[dict] = None,
    as_skeleton: bool = False,
) -> tuple[list[dict], list[str]]:
    """
    各部門の各時間枠の並行試合数設定に基づいて、チームを対戦ペアに割り振り、
    会場スロットを割り当てる。

    as_skeleton=True の場合はチームIDを持たない空スロットを返す
    （本戦など後から手動でチームを設定するための雛型生成）。

    Returns: (generated_matches, warnings)
    """
    warnings: list[str] = []

    if not teams:
        return [], ["チームが登録されていません。"]
    if not segments:
        return [], ["時間枠が登録されていません。"]
    if not rooms:
        return [], ["会場が登録されていません。"]

    if confirmed_matches is None:
        confirmed_matches = []

    sorted_segments = sorted(segments, key=lambda s: s.get("order_number") or 0)
    sorted_rooms = sorted(rooms, key=lambda r: r.get("order_number") or r["id"])

    # 部門ごとにチームを分類
    section_teams: dict[int, list[dict]] = {}
    for team in teams:
        sec_id = team.get("event_section_id")
        if sec_id is not None:
            section_teams.setdefault(sec_id, []).append(team)

    # ------------------------------------------------------------------
    # as_skeleton モード: チームIDなしの空スロットを生成して終了
    # ------------------------------------------------------------------
    if as_skeleton:
        return _generate_empty_slots(
            sorted_segments=sorted_segments,
            sorted_rooms=sorted_rooms,
            section_teams=section_teams,
            section_segment_parallel_matches=section_segment_parallel_matches,
            confirmed_matches=confirmed_matches,
            warnings=warnings,
        ), warnings

    # ------------------------------------------------------------------
    # Phase 1 + Phase 2: 部門ごとにスケルトンを構築
    # ------------------------------------------------------------------
    seg_name_map: dict[int, str] = {
        s["id"]: s.get("name", str(s["id"])) for s in sorted_segments
    }

    section_skeleton: dict[int, list[_SkeletonEntry]] = {}
    section_role_to_team: dict[int, dict[str, int]] = {}

    for sec_id, sec_teams in section_teams.items():
        seed_teams = [t for t in sec_teams if t.get("is_seed")]
        non_seed_teams = [t for t in sec_teams if not t.get("is_seed")]

        # ロール ID をランダムに割り振る（Phase 3 でのランダム性を確保）
        shuffled_seeds = seed_teams[:]
        random.shuffle(shuffled_seeds)
        shuffled_non_seeds = non_seed_teams[:]
        random.shuffle(shuffled_non_seeds)

        role_to_team: dict[str, int] = {}
        team_to_role: dict[int, str] = {}

        for i, t in enumerate(shuffled_seeds):
            rid = f"S{i}"
            role_to_team[rid] = t["id"]
            team_to_role[t["id"]] = rid

        for i, t in enumerate(shuffled_non_seeds):
            rid = f"N{i}"
            role_to_team[rid] = t["id"]
            team_to_role[t["id"]] = rid

        section_role_to_team[sec_id] = role_to_team

        # 確定済み試合をロール形式に変換
        confirmed_role_entries: list[_SkeletonEntry] = []
        for m in confirmed_matches:
            if m.get("event_section_id") != sec_id:
                continue
            aff_id = m.get("aff_team_id")
            neg_id = m.get("neg_team_id")
            if not aff_id or not neg_id:
                continue
            aff_role = team_to_role.get(aff_id)
            neg_role = team_to_role.get(neg_id)
            if aff_role and neg_role:
                confirmed_role_entries.append(_SkeletonEntry(
                    seg_id=m["event_timetable_segment_id"],
                    aff_role=aff_role,
                    neg_role=neg_role,
                ))

        # セグメントごとの新規試合数を算出
        seg_new_counts: list[tuple[int, int]] = []
        for seg in sorted_segments:
            param_key = f"{sec_id}_{seg['id']}"
            total_scheduled = section_segment_parallel_matches.get(param_key, 0)
            already_confirmed = sum(
                1 for m in confirmed_matches
                if m.get("event_timetable_segment_id") == seg["id"]
                and m.get("event_section_id") == sec_id
            )
            needed = max(0, total_scheduled - already_confirmed)
            if needed > 0:
                seg_new_counts.append((seg["id"], needed))

        # Phase 1: ペア構成
        pairs = _build_pairs(
            n_seed=len(seed_teams),
            n_non=len(non_seed_teams),
            seg_new_counts=seg_new_counts,
            confirmed_role_entries=confirmed_role_entries,
            warnings=warnings,
            sec_id=sec_id,
            seg_name_map=seg_name_map,
        )

        # Phase 2: Aff/Neg 一括割り当て（複数試行で最良を採用）
        entries = _assign_aff_neg_best(
            pairs=pairs,
            confirmed_role_entries=confirmed_role_entries,
        )
        section_skeleton[sec_id] = entries

    # ------------------------------------------------------------------
    # Phase 3: 会場割り当て + 具体化
    # ------------------------------------------------------------------
    team_match_count: dict[int, int] = {t["id"]: 0 for t in teams}
    for m in confirmed_matches:
        aid = m.get("aff_team_id")
        nid = m.get("neg_team_id")
        if aid in team_match_count:
            team_match_count[aid] += 1
        if nid in team_match_count:
            team_match_count[nid] += 1

    for sec_id, entries in section_skeleton.items():
        r2t = section_role_to_team[sec_id]
        for entry in entries:
            aid = r2t.get(entry.aff_role)
            nid = r2t.get(entry.neg_role)
            if aid and aid in team_match_count:
                team_match_count[aid] += 1
            if nid and nid in team_match_count:
                team_match_count[nid] += 1

    generated_matches: list[dict] = []

    for seg in sorted_segments:
        seg_id = seg["id"]
        seg_confirmed = [
            m for m in confirmed_matches
            if m.get("event_timetable_segment_id") == seg_id
        ]
        confirmed_room_ids = {
            m["event_room_id"] for m in seg_confirmed
            if m.get("event_room_id") is not None
        }

        seg_entries_by_sec: dict[int, list[_SkeletonEntry]] = {}
        for sec_id, entries in section_skeleton.items():
            se = [e for e in entries if e.seg_id == seg_id]
            if se:
                seg_entries_by_sec[sec_id] = se

        if not seg_entries_by_sec:
            continue

        total_new = sum(len(v) for v in seg_entries_by_sec.values())
        available_rooms = [r for r in sorted_rooms if r["id"] not in confirmed_room_ids]

        if len(available_rooms) < total_new:
            warnings.append(
                f"時間枠「{seg.get('name', seg_id)}」の新規生成必要数 {total_new} に対して、"
                f"使用可能な空き会場数 ({len(available_rooms)}) が不足しています。"
                f"割り当て可能な {len(available_rooms)} 試合のみ生成します。"
            )

        used_rooms = available_rooms[:total_new]
        room_idx = 0
        order_in_seg = len(seg_confirmed) + 1

        for sec_id, entries in sorted(seg_entries_by_sec.items()):
            r2t = section_role_to_team[sec_id]
            for entry in entries:
                if room_idx >= len(used_rooms):
                    break
                room = used_rooms[room_idx]
                generated_matches.append({
                    "event_timetable_segment_id": seg_id,
                    "event_room_id": room["id"],
                    "event_section_id": sec_id,
                    "aff_team_id": r2t.get(entry.aff_role),
                    "neg_team_id": r2t.get(entry.neg_role),
                    "order_number_in_segment": order_in_seg,
                })
                room_idx += 1
                order_in_seg += 1

    # ① 試合数の平準化チェックと警告
    _check_match_count_balance(
        teams=teams,
        team_match_count=team_match_count,
        warnings=warnings,
    )

    # 再対戦チェックと警告
    _check_rematch_warnings(
        teams=teams,
        all_matches=confirmed_matches + generated_matches,
        warnings=warnings,
    )

    # 自動検証（バリデーション）の実行
    is_valid, val_report, _ = validate_match_schedule(
        matches=confirmed_matches + generated_matches,
        teams=teams,
        segments=segments,
        rooms=rooms,
    )
    for msg in val_report:
        if "❌" in msg or "⚠️" in msg:
            warnings.append(msg)

    return generated_matches, warnings


# ===========================================================================
# as_skeleton モード: チームIDなしの空スロット生成
# ===========================================================================

def _generate_empty_slots(
    sorted_segments: list[dict],
    sorted_rooms: list[dict],
    section_teams: dict[int, list[dict]],
    section_segment_parallel_matches: dict[str, int],
    confirmed_matches: list[dict],
    warnings: list[str],
) -> list[dict]:
    """
    as_skeleton=True の場合、チームIDを持たない空の試合スロットを返す。
    本戦など、後から手動でチームを設定するための雛型生成に使用する。
    既存の as_skeleton 挙動を完全に維持する。
    """
    result: list[dict] = []

    for seg in sorted_segments:
        seg_id = seg["id"]
        seg_confirmed = [
            m for m in confirmed_matches
            if m.get("event_timetable_segment_id") == seg_id
        ]
        confirmed_room_ids = {
            m["event_room_id"] for m in seg_confirmed
            if m.get("event_room_id") is not None
        }

        sec_needed: dict[int, int] = {}
        total_needed = 0
        for sec_id in section_teams:
            param_key = f"{sec_id}_{seg_id}"
            scheduled = section_segment_parallel_matches.get(param_key, 0)
            confirmed_cnt = sum(
                1 for m in seg_confirmed if m.get("event_section_id") == sec_id
            )
            needed = max(0, scheduled - confirmed_cnt)
            if needed > 0:
                sec_needed[sec_id] = needed
                total_needed += needed

        if total_needed <= 0:
            continue

        available_rooms = [r for r in sorted_rooms if r["id"] not in confirmed_room_ids]
        if len(available_rooms) < total_needed:
            warnings.append(
                f"時間枠「{seg.get('name', seg_id)}」の新規生成必要数 {total_needed} に対して、"
                f"使用可能な空き会場数 ({len(available_rooms)}) が不足しています。"
                f"割り当て可能な {len(available_rooms)} 試合のみ生成します。"
            )

        used_rooms = available_rooms[:total_needed]
        room_idx = 0
        order_in_seg = len(seg_confirmed) + 1

        for sec_id, needed in sorted(sec_needed.items()):
            for _ in range(needed):
                if room_idx >= len(used_rooms):
                    break
                room = used_rooms[room_idx]
                result.append({
                    "event_timetable_segment_id": seg_id,
                    "event_room_id": room["id"],
                    "event_section_id": sec_id,
                    "aff_team_id": None,
                    "neg_team_id": None,
                    "order_number_in_segment": order_in_seg,
                })
                room_idx += 1
                order_in_seg += 1

    return result


# ===========================================================================
# Phase 1: ペア構成（①③の最適化）
# ===========================================================================

def _generate_perfect_matchings(roles: list[str]):
    """ロールのリストからすべての完全マッチング（ペアの組み合わせ）を生成するジェネレータ"""
    if not roles:
        yield []
        return
    first = roles[0]
    rest = roles[1:]
    for i, partner in enumerate(rest):
        pair = (first, partner)
        rem = rest[:i] + rest[i + 1:]
        for sub in _generate_perfect_matchings(rem):
            yield [pair] + sub


def _evaluate_matching(
    matching: list[tuple[str, str]],
    role_counters: dict[str, _PairCounters],
    played_role_pairs: set[tuple[str, str]],
    n_seed: int = 0,
    n_non: int = 0,
) -> float:
    """
    1セグメント内のペアリング（完全マッチング）全体のスコアを計算する（低いほど良い）。

    優先順位:
      ⓪ 再対戦禁止（最優先・100,000,000 ペナルティ）
      ③ シード配置バランス（次点・1,000 ペナルティ）
      ⑤ シード・非シード校のセグメント分散バランス（0.1 ペナルティ）
    """
    score = 0.0

    # ⓪ 再対戦チェック
    for r_a, r_b in matching:
        if (r_a, r_b) in played_role_pairs:
            score += 100000000.0

    # ③ シード配置バランスの仮更新後の計算
    svs_inc: dict[str, int] = defaultdict(int)
    svn_inc: dict[str, int] = defaultdict(int)

    for r_a, r_b in matching:
        a_seed = r_a.startswith("S")
        b_seed = r_b.startswith("S")
        if a_seed and b_seed:
            svs_inc[r_a] += 1
            svs_inc[r_b] += 1
        elif a_seed:
            svn_inc[r_a] += 1
        elif b_seed:
            svn_inc[r_b] += 1

    for r, rc in role_counters.items():
        if not r.startswith("S"):
            continue
        new_svs = rc.svs_count + svs_inc[r]
        new_svn = rc.svn_count + svn_inc[r]
        diff = abs(new_svs - new_svn)
        if diff > 1:
            score += 1000.0 * diff
        else:
            score += 10.0 * diff

    # ⑤ シード・非シード校のセグメント分散バランス（優先順位5）
    total_teams = n_seed + n_non
    if total_teams > 0 and n_seed > 0:
        total_participants = len(matching) * 2
        ideal_seeds = round(total_participants * (n_seed / total_teams))
        actual_seeds = sum(
            (1 if r_a.startswith("S") else 0) + (1 if r_b.startswith("S") else 0)
            for r_a, r_b in matching
        )
        score += 0.1 * abs(actual_seeds - ideal_seeds)

    return score


def _select_candidates_balanced(
    avail_roles: list[str],
    role_counters: dict[str, _PairCounters],
    needed_count: int,
    n_seed: int,
    n_non: int,
    seg_id: int,
    seg_idx: int = 0,
) -> list[str]:
    """
    出場試合数均等（条件①）を最優先にしつつ、同じ試合数の範囲内で
    シード校と非シード校が各セグメントに均等に分散し、
    かつ連続空きコマ（放置）を防止するように候補を選出する（条件③⑤）。
    """
    total_teams = n_seed + n_non
    seed_ratio = (n_seed / total_teams) if total_teams > 0 else 0.0

    groups: dict[int, list[str]] = defaultdict(list)
    for r in avail_roles:
        mc = role_counters[r].match_count
        groups[mc].append(r)

    selected: list[str] = []

    for mc in sorted(groups.keys()):
        if len(selected) >= needed_count:
            break
        group_roles = groups[mc]
        needed_rem = needed_count - len(selected)

        if len(group_roles) <= needed_rem:
            selected.extend(group_roles)
        else:
            g_seeds = [r for r in group_roles if r.startswith("S")]
            g_non_seeds = [r for r in group_roles if not r.startswith("S")]

            # 放置防止: 最後の試合から時間が経っている（last_seg_idx が小さい）順に優先ソート
            g_seeds.sort(key=lambda r: (role_counters[r].last_seg_idx, hash((seg_id, r))))
            g_non_seeds.sort(key=lambda r: (role_counters[r].last_seg_idx, hash((seg_id, r))))

            target_seed = round(needed_rem * seed_ratio)
            take_seed = min(len(g_seeds), max(0, target_seed))
            take_non = needed_rem - take_seed

            if take_non > len(g_non_seeds):
                take_non = len(g_non_seeds)
                take_seed = needed_rem - take_non

            if take_seed > len(g_seeds):
                take_seed = len(g_seeds)
                take_non = needed_rem - take_seed

            selected.extend(g_seeds[:take_seed])
            selected.extend(g_non_seeds[:take_non])

    return selected


def _build_pairs(
    n_seed: int,
    n_non: int,
    seg_new_counts: list[tuple[int, int]],
    confirmed_role_entries: list[_SkeletonEntry],
    warnings: list[str],
    sec_id: int,
    seg_name_map: dict[int, str],
) -> list[_SkeletonPair]:
    """
    抽象ロール ID（S0…, N0…）を用いて、全セグメントの対戦ペアを決定する。

    【2段階アルゴリズム】:
      1. 各セグメントにおいて、出場試合数が最も少ないチームを優先選出する（条件①試合数均等を構造的に保証）。
         同試合数内ではシード校と非シード校をセグメントに均等分散し、かつ放置を防止する（条件③⑤）。
      2. 選出されたチーム群の中で全完全マッチングを列挙し、
         再対戦禁止（条件⓪）およびシード配置バランス（条件③）が最も優れるペアリングを採用する。
      3. もし選出チーム間で再対戦を回避できない場合、条件⓪ > ① に従い、次点チームとの入れ替えを試行する。
    """
    seed_roles = [f"S{i}" for i in range(n_seed)]
    non_seed_roles = [f"N{i}" for i in range(n_non)]
    all_roles = seed_roles + non_seed_roles

    role_counters: dict[str, _PairCounters] = {r: _PairCounters() for r in all_roles}
    played_role_pairs: set[tuple[str, str]] = set()

    # 確定済み試合の実績を反映
    for entry in confirmed_role_entries:
        _update_pair_counters(
            role_x=entry.aff_role,
            role_y=entry.neg_role,
            role_counters=role_counters,
            played_role_pairs=played_role_pairs,
            seg_idx=0,
        )

    result: list[_SkeletonPair] = []

    for seg_idx, (seg_id, count) in enumerate(seg_new_counts):
        # すでにこのセグメントで使用されているロール（確定試合＋生成済み試合）
        seg_used_roles: set[str] = set()
        for entry in confirmed_role_entries:
            if entry.seg_id == seg_id:
                seg_used_roles.add(entry.aff_role)
                seg_used_roles.add(entry.neg_role)
        for pair in result:
            if pair.seg_id == seg_id:
                seg_used_roles.add(pair.role_x)
                seg_used_roles.add(pair.role_y)

        avail_roles = [r for r in all_roles if r not in seg_used_roles]
        needed_roles_count = count * 2

        if len(avail_roles) < needed_roles_count:
            seg_name = seg_name_map.get(seg_id, str(seg_id))
            warnings.append(
                f"時間枠「{seg_name}」の部門ID「{sec_id}」において、"
                f"対戦可能なペアを組めるロールが不足したため、試合が生成できませんでした。"
            )
            continue

        # Step 1: 出場試合数が少ない順にソート（①の保証）、
        # 同試合数内ではシード校と非シード校を各セグメントに均等分散選出かつ放置防止（③⑤の保証）
        candidates = _select_candidates_balanced(
            avail_roles=avail_roles,
            role_counters=role_counters,
            needed_count=needed_roles_count,
            n_seed=n_seed,
            n_non=n_non,
            seg_id=seg_id,
            seg_idx=seg_idx,
        )

        avail_roles_sorted = sorted(
            avail_roles,
            key=lambda r: (role_counters[r].match_count, r)
        )

        # 最適なマッチングと選出メンバーを探す
        best_matching: list[tuple[str, str]] | None = None
        best_score = float("inf")

        # 候補者内での完全マッチング列挙
        if count <= 8:
            for matching in _generate_perfect_matchings(candidates):
                score = _evaluate_matching(
                    matching, role_counters, played_role_pairs, n_seed, n_non
                )
                if score < best_score:
                    best_score = score
                    best_matching = matching
        else:
            # count > 8 の場合の貪欲フォールバック
            best_matching = _greedy_pairing(candidates, role_counters, played_role_pairs)
            best_score = _evaluate_matching(
                best_matching, role_counters, played_role_pairs, n_seed, n_non
            )

        # Step 3: もし選出メンバー内で再対戦ペナルティ(>= 100,000,000)が発生した場合、
        # 次点のメンバーと入れ替えて再対戦のない組み合わせがあるか試行 (⓪ > ① の尊重)
        if best_score >= 100000000.0 and len(avail_roles_sorted) > needed_roles_count:
            min_candidate_count = role_counters[candidates[0]].match_count
            extended_avail = [
                r for r in avail_roles_sorted
                if role_counters[r].match_count <= min_candidate_count + 1
            ]

            if len(extended_avail) >= needed_roles_count:
                import itertools
                for sub_cand in itertools.combinations(extended_avail, needed_roles_count):
                    sub_cand_list = list(sub_cand)
                    if sub_cand_list == candidates:
                        continue
                    if count <= 6:
                        for matching in _generate_perfect_matchings(sub_cand_list):
                            score = _evaluate_matching(
                                matching, role_counters, played_role_pairs, n_seed, n_non
                            )
                            extra_match_penalty = sum(
                                (role_counters[r].match_count - min_candidate_count) * 10000.0
                                for r in sub_cand_list
                            )
                            total_score = score + extra_match_penalty
                            if total_score < best_score:
                                best_score = total_score
                                best_matching = matching
                                if best_score < 100000000.0:
                                    break
                    if best_score < 100000000.0:
                        break

        if not best_matching:
            seg_name = seg_name_map.get(seg_id, str(seg_id))
            warnings.append(
                f"時間枠「{seg_name}」の部門ID「{sec_id}」において、"
                f"対戦可能なペアを組めるロールが不足したため、試合が生成できませんでした。"
            )
            continue

        # ペアリングを確定しカウンターを更新
        for r_x, r_y in best_matching:
            _update_pair_counters(
                role_x=r_x,
                role_y=r_y,
                role_counters=role_counters,
                played_role_pairs=played_role_pairs,
                seg_idx=seg_idx,
            )
            result.append(_SkeletonPair(seg_id=seg_id, role_x=r_x, role_y=r_y))

    return result


def _greedy_pairing(
    roles: list[str],
    role_counters: dict[str, _PairCounters],
    played_role_pairs: set[tuple[str, str]],
) -> list[tuple[str, str]]:
    """count > 8 の場合の貪欲ペアリングフォールバック"""
    avail = list(roles)
    matching = []
    while len(avail) >= 2:
        r_a = avail.pop(0)
        best_b = None
        best_s = float("inf")
        for r_b in avail:
            s = 0.0
            if (r_a, r_b) in played_role_pairs:
                s += 100000000.0
            if s < best_s:
                best_s = s
                best_b = r_b
        if best_b:
            avail.remove(best_b)
            matching.append((r_a, best_b))
        else:
            break
    return matching


def _update_pair_counters(
    role_x: str,
    role_y: str,
    role_counters: dict[str, _PairCounters],
    played_role_pairs: set[tuple[str, str]],
    seg_idx: int = 0,
) -> None:
    """Phase 1 用: ペア確定時のカウンター更新（Aff/Neg なし）"""
    if role_x not in role_counters or role_y not in role_counters:
        return
    role_counters[role_x].match_count += 1
    role_counters[role_y].match_count += 1
    role_counters[role_x].last_seg_idx = seg_idx
    role_counters[role_y].last_seg_idx = seg_idx
    played_role_pairs.add((role_x, role_y))
    played_role_pairs.add((role_y, role_x))

    x_seed = role_x.startswith("S")
    y_seed = role_y.startswith("S")
    if x_seed and y_seed:
        role_counters[role_x].svs_count += 1
        role_counters[role_y].svs_count += 1
    elif x_seed:
        role_counters[role_x].svn_count += 1
    elif y_seed:
        role_counters[role_y].svn_count += 1


# ===========================================================================
# Phase 2: Aff/Neg 一括割り当て（②④）— 貪欲法で決定論的に割り当て
# ===========================================================================


def _assign_aff_neg_best(
    pairs: list[_SkeletonPair],
    confirmed_role_entries: list[_SkeletonEntry],
) -> list[_SkeletonEntry]:
    """
    バックトラック探索（DFS）を用いて、全チームの Aff/Neg バランスが完全均等（ハード制約）を
    満たす割り当てを探索して決定する。

    偶数試合数: aff_count == neg_count (例: 4試合なら 2:2)
    奇数試合数: abs(aff_count - neg_count) <= 1
    """
    if not pairs:
        return []

    # 1. 各ロールの出場予定回数をカウント
    role_totals: dict[str, int] = defaultdict(int)
    conf_aff: dict[str, int] = defaultdict(int)
    conf_neg: dict[str, int] = defaultdict(int)

    for e in confirmed_role_entries:
        conf_aff[e.aff_role] += 1
        conf_neg[e.neg_role] += 1
        role_totals[e.aff_role] += 1
        role_totals[e.neg_role] += 1

    for p in pairs:
        role_totals[p.role_x] += 1
        role_totals[p.role_y] += 1

    # 各ロールの Aff / Neg それぞれの上限値 (偶数は半々、奇数は ceil)
    max_aff: dict[str, int] = {}
    max_neg: dict[str, int] = {}
    for r, tot in role_totals.items():
        half = tot // 2
        extra = tot % 2
        max_aff[r] = half + extra
        max_neg[r] = half + extra

    # DFS バックトラック
    best_solution: list[_SkeletonEntry] | None = None
    best_violations = float("inf")

    curr_aff: dict[str, int] = defaultdict(int)
    curr_neg: dict[str, int] = defaultdict(int)
    current_assignment: list[_SkeletonEntry] = []

    def dfs(idx: int) -> bool:
        nonlocal best_solution, best_violations
        if idx == len(pairs):
            sol = list(current_assignment)
            viol = _count_aff_neg_violations(sol, confirmed_role_entries)
            if viol < best_violations:
                best_violations = viol
                best_solution = sol
            return viol == 0  # 違反数0（完全均等）なら完了

        p = pairs[idx]
        rx, ry = p.role_x, p.role_y

        # パターン1: rx = Aff, ry = Neg
        can_p1 = (
            (conf_aff[rx] + curr_aff[rx] + 1 <= max_aff[rx]) and
            (conf_neg[ry] + curr_neg[ry] + 1 <= max_neg[ry])
        )

        # パターン2: rx = Neg, ry = Aff
        can_p2 = (
            (conf_neg[rx] + curr_neg[rx] + 1 <= max_neg[rx]) and
            (conf_aff[ry] + curr_aff[ry] + 1 <= max_aff[ry])
        )

        need_aff_x = max_aff[rx] - (conf_aff[rx] + curr_aff[rx])
        need_aff_y = max_aff[ry] - (conf_aff[ry] + curr_aff[ry])

        options = []
        if can_p1 and can_p2:
            if need_aff_x >= need_aff_y:
                options = [(rx, ry), (ry, rx)]
            else:
                options = [(ry, rx), (rx, ry)]
        elif can_p1:
            options = [(rx, ry)]
        elif can_p2:
            options = [(ry, rx)]
        else:
            options = [(rx, ry), (ry, rx)]

        for aff_r, neg_r in options:
            curr_aff[aff_r] += 1
            curr_neg[neg_r] += 1
            current_assignment.append(_SkeletonEntry(seg_id=p.seg_id, aff_role=aff_r, neg_role=neg_r))

            if dfs(idx + 1):
                return True

            current_assignment.pop()
            curr_aff[aff_r] -= 1
            curr_neg[neg_r] -= 1

        return False

    dfs(0)

    if best_solution is not None:
        return best_solution

    # フォールバック
    return _try_assign_aff_neg(pairs, confirmed_role_entries)


def _count_aff_neg_violations(
    result: list[_SkeletonEntry],
    confirmed: list[_SkeletonEntry],
) -> int:
    """
    ②④の違反スコア（加重値）を数える。
    優先順位: ② Aff/Neg バランス (重み 1000) > ④ シード対戦タイプ別 Aff/Neg バランス (重み 1)
    """
    aff_c: dict[str, int] = defaultdict(int)
    neg_c: dict[str, int] = defaultdict(int)
    svs_aff: dict[str, int] = defaultdict(int)
    svs_neg: dict[str, int] = defaultdict(int)
    svn_aff: dict[str, int] = defaultdict(int)
    svn_neg: dict[str, int] = defaultdict(int)

    for e in list(confirmed) + list(result):
        a, n = e.aff_role, e.neg_role
        aff_c[a] += 1
        neg_c[n] += 1
        a_s = a.startswith("S")
        n_s = n.startswith("S")
        if a_s and n_s:
            svs_aff[a] += 1
            svs_neg[n] += 1
        elif a_s:
            svn_aff[a] += 1
        elif n_s:
            svn_neg[n] += 1

    violations_score = 0
    # ② Aff/Neg バランス (優先度高)
    for role in set(aff_c) | set(neg_c):
        if abs(aff_c[role] - neg_c[role]) > 1:
            violations_score += 1000

    # ④ シード対戦タイプ別 Aff/Neg バランス (優先度低)
    for role in set(aff_c) | set(neg_c):
        if role.startswith("S"):
            if abs(svs_aff[role] - svs_neg[role]) > 1:
                violations_score += 1
            if abs(svn_aff[role] - svn_neg[role]) > 1:
                violations_score += 1
    return violations_score


def _try_assign_aff_neg(
    pairs: list[_SkeletonPair],
    confirmed: list[_SkeletonEntry],
) -> list[_SkeletonEntry]:
    """
    貪欲法で Aff/Neg を決定論的に割り当てる。

    アルゴリズム（残り試合数ベースの強制割り当て）:
      1. 各ロールの総試合数から「目標 Aff 回数」を計算する。
         （偶数試合 → total/2、奇数試合 → ceil を優先）
      2. ペアを「need_aff の差の絶対値が大きい順（強制度が高い順）」で
         ソートして処理し、各ロールの残り試合数と
         残り必要 Aff/Neg 回数から強制割り当てを行う:
         - X の残り試合が全て Aff 必要 → X=Aff 強制
         - X の残り試合が全て Neg 必要 → X=Neg 強制（Y=Aff 強制）
         - 強制なし → ④ バランスでタイブレーク → X を Aff に固定（決定論的）
      3. カウンターを更新して次のペアへ。
    """
    # 各ロールの総出場試合数を計算（confirmed + pairs）
    role_total: dict[str, int] = defaultdict(int)
    for e in confirmed:
        role_total[e.aff_role] += 1
        role_total[e.neg_role] += 1
    for p in pairs:
        role_total[p.role_x] += 1
        role_total[p.role_y] += 1

    # confirmed の実績
    conf_aff: dict[str, int] = defaultdict(int)
    conf_neg: dict[str, int] = defaultdict(int)
    svs_aff: dict[str, int] = defaultdict(int)
    svs_neg: dict[str, int] = defaultdict(int)
    svn_aff: dict[str, int] = defaultdict(int)
    svn_neg: dict[str, int] = defaultdict(int)

    for e in confirmed:
        a, n = e.aff_role, e.neg_role
        conf_aff[a] += 1
        conf_neg[n] += 1
        a_s = a.startswith("S")
        n_s = n.startswith("S")
        if a_s and n_s:
            svs_aff[a] += 1
            svs_neg[n] += 1
        elif a_s:
            svn_aff[a] += 1
        elif n_s:
            svn_neg[n] += 1

    # 各ロールの新規試合での Aff/Neg 目標を設定
    need_aff: dict[str, int] = {}
    need_neg: dict[str, int] = {}
    remaining: dict[str, int] = defaultdict(int)

    for p in pairs:
        remaining[p.role_x] += 1
        remaining[p.role_y] += 1

    for role in list(remaining.keys()):
        total = role_total[role]
        ca = conf_aff[role]
        cn = conf_neg[role]
        half = total // 2
        # 奇数の場合は ceil（Aff を多め）を優先して決定論的に設定
        target_aff = half + (total % 2)
        need_aff[role] = max(0, target_aff - ca)
        need_neg[role] = max(0, (total - target_aff) - cn)

    def g(d: dict, k: str) -> int:
        return d.get(k, 0)

    # 「need_aff の差の絶対値が大きい順」でソート（強制割り当てが必要なペアを先に処理）
    def _pair_priority(idx: int) -> int:
        p = pairs[idx]
        return -abs(g(need_aff, p.role_x) - g(need_aff, p.role_y))

    order = sorted(range(len(pairs)), key=_pair_priority)
    result: list[_SkeletonEntry | None] = [None] * len(pairs)

    for idx in order:
        pair = pairs[idx]
        rx, ry = pair.role_x, pair.role_y
        x_seed = rx.startswith("S")
        y_seed = ry.startswith("S")

        xna = g(need_aff, rx)
        xnn = g(need_neg, rx)
        yna = g(need_aff, ry)
        ynn = g(need_neg, ry)
        rem_x = g(remaining, rx)
        rem_y = g(remaining, ry)

        # 強制条件: 残り試合のうち全て同一立場が必要な場合
        x_must_aff = rem_x > 0 and xna >= rem_x and xnn < rem_x
        x_must_neg = rem_x > 0 and xnn >= rem_x and xna < rem_x
        y_must_aff = rem_y > 0 and yna >= rem_y and ynn < rem_y
        y_must_neg = rem_y > 0 and ynn >= rem_y and yna < rem_y

        if x_must_aff or y_must_neg:
            aff_role, neg_role = rx, ry
        elif x_must_neg or y_must_aff:
            aff_role, neg_role = ry, rx
        elif xna > yna:
            aff_role, neg_role = rx, ry
        elif yna > xna:
            aff_role, neg_role = ry, rx
        else:
            # ④ バランスでタイブレーク（決定論的: ランダム排除）
            if x_seed and y_seed:
                xt = g(svs_aff, rx) - g(svs_neg, rx)
                yt = g(svs_aff, ry) - g(svs_neg, ry)
                aff_role, neg_role = (rx, ry) if xt <= yt else (ry, rx)
            elif x_seed:
                xt = g(svn_aff, rx) - g(svn_neg, rx)
                aff_role, neg_role = (rx, ry) if xt <= 0 else (ry, rx)
            elif y_seed:
                yt = g(svn_aff, ry) - g(svn_neg, ry)
                aff_role, neg_role = (ry, rx) if yt <= 0 else (rx, ry)
            else:
                # 非シード同士は need_aff が多い方を Aff に（同数なら rx を Aff に固定）
                aff_role, neg_role = (rx, ry) if g(need_aff, rx) >= g(need_aff, ry) else (ry, rx)

        # カウンター更新
        need_aff[aff_role] = max(0, g(need_aff, aff_role) - 1)
        need_neg[neg_role] = max(0, g(need_neg, neg_role) - 1)
        remaining[rx] = max(0, g(remaining, rx) - 1)
        remaining[ry] = max(0, g(remaining, ry) - 1)

        a_s = aff_role.startswith("S")
        n_s = neg_role.startswith("S")
        if a_s and n_s:
            svs_aff[aff_role] = g(svs_aff, aff_role) + 1
            svs_neg[neg_role] = g(svs_neg, neg_role) + 1
        elif a_s:
            svn_aff[aff_role] = g(svn_aff, aff_role) + 1
        elif n_s:
            svn_neg[neg_role] = g(svn_neg, neg_role) + 1

        result[idx] = _SkeletonEntry(
            seg_id=pair.seg_id,
            aff_role=aff_role,
            neg_role=neg_role,
        )

    return result  # type: ignore[return-value]


# ===========================================================================
# 試合数の平準化チェック（条件①）
# ===========================================================================

def _check_match_count_balance(
    teams: list[dict],
    team_match_count: dict[int, int],
    warnings: list[str],
) -> None:
    """
    条件①の事後検証。
    試合に参加したチームのうち最大と最小の試合数の差が 2 以上の場合に警告を出す。
    試合数ゼロのチームは除外する（未参加チームが混在する場合を考慮）。
    """
    active_teams = [t for t in teams if team_match_count.get(t["id"], 0) > 0]
    if not active_teams:
        return

    counts = [team_match_count[t["id"]] for t in active_teams]
    min_count = min(counts)
    max_count = max(counts)

    if max_count - min_count >= 2:
        max_teams = [
            t.get("name", str(t["id"])) for t in active_teams
            if team_match_count[t["id"]] == max_count
        ]
        min_teams = [
            t.get("name", str(t["id"])) for t in active_teams
            if team_match_count[t["id"]] == min_count
        ]
        warnings.append(
            f"⚠️ 試合数の不均等があります: 最大 {max_count} 試合"
            f" ({', '.join(max_teams[:3])}{'...' if len(max_teams) > 3 else ''}) /"
            f" 最小 {min_count} 試合"
            f" ({', '.join(min_teams[:3])}{'...' if len(min_teams) > 3 else ''})。"
            f"「最小試合数と最大試合数の差は {max_count - min_count} 試合」です。"
            f"可能であれば並行試合数の設定を見直してください。"
        )
    elif max_count - min_count == 1:
        warnings.append(
            f"ℹ️ 試合数が1試合差のチームがあります"
            f"（最小 {min_count} 試合 / 最大 {max_count} 試合）。"
            f"これはチーム数・枠数の関係上やむを得ない場合があります。"
        )


def _check_rematch_warnings(
    teams: list[dict],
    all_matches: list[dict],
    warnings: list[str],
) -> None:
    """
    確定済み試合および生成された試合全体において、同一チーム間の再対戦が発生しているかチェックし、
    発生している場合は warnings に警告を追加する。
    """
    team_name_map = {t["id"]: t.get("name", str(t["id"])) for t in teams}
    played_pairs: dict[tuple[int, int], int] = defaultdict(int)

    for m in all_matches:
        aid = m.get("aff_team_id")
        nid = m.get("neg_team_id")
        if aid and nid:
            pair = (aid, nid) if aid < nid else (nid, aid)
            played_pairs[pair] += 1

    rematch_messages = []
    for (t1, t2), count in played_pairs.items():
        if count > 1:
            name1 = team_name_map.get(t1, str(t1))
            name2 = team_name_map.get(t2, str(t2))
            rematch_messages.append(f"「{name1}」 vs 「{name2}」（{count}回対戦）")

    if rematch_messages:
        warnings.append(
            f"⚠️ やむを得ず再対戦が組み込まれた対戦があります: "
            f"{', '.join(rematch_messages)}。"
            f"試合数の均等化を優先した結果発生したものです。"
        )


# ===========================================================================
# スケジュール自動検証（バリデーション）
# ===========================================================================

def validate_match_schedule(
    matches: list[dict],
    teams: list[dict],
    segments: list[dict],
    rooms: list[dict],
) -> tuple[bool, list[str], dict]:
    """
    生成された対戦スケジュールに対して自動検証（バリデーション）を行う。

    検証項目:
      1. Aff/Neg バランス（4試合などの偶数試合数では 2:2 の完全均等化、奇数は差1以内）[ハード制約]
      2. 連戦数および連続空きコマ数（3コマ以上の連続放置がないか）[ソフト制約]
      3. 会場利用回数の分布および偏り

    Returns:
      (is_valid, report_messages, statistics_dict)
    """
    report: list[str] = []
    is_valid = True
    stats: dict = {}

    team_map = {t["id"]: t.get("name", str(t["id"])) for t in teams}
    sorted_segs = sorted(segments, key=lambda s: s.get("order_number") or s["id"])
    seg_order_map = {s["id"]: i + 1 for i, s in enumerate(sorted_segs)}
    room_name_map = {r["id"]: r.get("name", str(r["id"])) for r in rooms}

    # 1. Aff/Neg バランス検証 [ハード制約]
    aff_counts: dict[int, int] = defaultdict(int)
    neg_counts: dict[int, int] = defaultdict(int)
    team_matches: dict[int, list[dict]] = defaultdict(list)

    for m in matches:
        aid = m.get("aff_team_id")
        nid = m.get("neg_team_id")
        if aid:
            aff_counts[aid] += 1
            team_matches[aid].append(m)
        if nid:
            neg_counts[nid] += 1
            team_matches[nid].append(m)

    aff_neg_violations = []
    for t in teams:
        tid = t["id"]
        a = aff_counts[tid]
        n = neg_counts[tid]
        total = a + n
        if total == 0:
            continue
        diff = abs(a - n)
        expected_diff = 0 if total % 2 == 0 else 1
        if diff > expected_diff:
            is_valid = False
            aff_neg_violations.append(
                f"チーム「{team_map[tid]}」: Aff {a}回 / Neg {n}回 (総試合数 {total}, 差 {diff})"
            )

    if aff_neg_violations:
        report.append(
            f"❌ 【ハード制約違反】 Aff/Negの不均衡が検出されました:\n  " + "\n  ".join(aff_neg_violations)
        )
    else:
        report.append("✅ 【Aff/Neg検証】 全チームの Aff/Neg バランスは正常（完全均等）です。")

    # 2. 連戦数および連続空きコマ数（放置）検証
    idle_warnings = []
    for t in teams:
        tid = t["id"]
        t_segs = sorted([
            seg_order_map[m["event_timetable_segment_id"]]
            for m in team_matches[tid]
            if m.get("event_timetable_segment_id") in seg_order_map
        ])
        if not t_segs:
            continue

        max_idle = 0
        for i in range(len(t_segs) - 1):
            idle = t_segs[i + 1] - t_segs[i] - 1
            if idle > max_idle:
                max_idle = idle

        if max_idle >= 3:
            idle_warnings.append(f"チーム「{team_map[tid]}」: 最大 {max_idle} コマ連続空き（放置）")

    if idle_warnings:
        report.append(
            f"⚠️ 【放置警告】 3コマ以上の連続休憩が発生しているチームがあります:\n  " + "\n  ".join(idle_warnings)
        )
    else:
        report.append("✅ 【放置検証】 3コマ以上の長時間放置（連続空きコマ）は発生していません。")

    # 3. 会場利用分布検証
    room_usage: dict[int, int] = defaultdict(int)

    for m in matches:
        rid = m.get("event_room_id")
        if rid:
            room_usage[rid] += 1

    room_counts = [room_usage[r["id"]] for r in rooms]
    min_room_used = min(room_counts) if room_counts else 0
    max_room_used = max(room_counts) if room_counts else 0
    report.append(
        f"ℹ️ 【会場利用分布】 会場使用回数: 最小 {min_room_used} 試合 / 最大 {max_room_used} 試合"
    )

    stats["aff_counts"] = dict(aff_counts)
    stats["neg_counts"] = dict(neg_counts)
    stats["room_usage"] = dict(room_usage)
    stats["is_valid"] = is_valid

    return is_valid, report, stats
