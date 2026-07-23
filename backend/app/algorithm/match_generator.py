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

【満たすべき条件と優先順位 (0 -> 1 -> 2 -> 3 -> 4)】
  ⓪ 再対戦の禁止     : 同一対戦校同士の2回目以降の対戦を厳格に禁止（最優先）。
  ① 試合数均等       : 各チームの累計試合数の最大差が 1 以内。超過時は警告。
  ② Aff/Neg バランス : 各チームの Aff 回数 − Neg 回数 が常に ±1 以内。
  ③ シード対戦タイプ数バランス:
       各シードチームにおいて「シード同士の対戦数」と
       「シード vs 非シードの対戦数」の差が 1 以内。
  ④ シード対戦タイプ別 Aff/Neg バランス:
       シード同士の対戦・シード vs 非シードの対戦それぞれにおいて、
       各シードチームの Aff/Neg の差が 1 以内。

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
    """Phase 1 で使うロールごとのペア数カウンター（①③用）"""
    match_count: int = 0
    svs_count: int = 0   # シード同士の対戦数（③）
    svn_count: int = 0   # シード vs 非シードの対戦数（③）


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
    この段階では Aff/Neg を決めず、試合数均等（①）とシード配置バランス（③）のみ最適化する。
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
        )

    result: list[_SkeletonPair] = []

    for seg_id, count in seg_new_counts:
        used_in_seg: set[str] = set()
        for entry in confirmed_role_entries:
            if entry.seg_id == seg_id:
                used_in_seg.add(entry.aff_role)
                used_in_seg.add(entry.neg_role)
        for pair in result:
            if pair.seg_id == seg_id:
                used_in_seg.add(pair.role_x)
                used_in_seg.add(pair.role_y)

        for _ in range(count):
            avail = [r for r in all_roles if r not in used_in_seg]
            if len(avail) < 2:
                seg_name = seg_name_map.get(seg_id, str(seg_id))
                warnings.append(
                    f"時間枠「{seg_name}」の部門ID「{sec_id}」において、"
                    f"対戦可能なペアを組めるロールが不足したため、試合が生成できませんでした。"
                )
                break

            pair_roles = _find_best_role_pair(
                avail_roles=avail,
                role_counters=role_counters,
                played_role_pairs=played_role_pairs,
            )
            if not pair_roles:
                seg_name = seg_name_map.get(seg_id, str(seg_id))
                warnings.append(
                    f"時間枠「{seg_name}」の部門ID「{sec_id}」において、"
                    f"対戦可能なペアを組めるロールが不足したため、試合が生成できませんでした。"
                )
                break

            role_x, role_y = pair_roles
            _update_pair_counters(
                role_x=role_x,
                role_y=role_y,
                role_counters=role_counters,
                played_role_pairs=played_role_pairs,
            )
            used_in_seg.add(role_x)
            used_in_seg.add(role_y)
            result.append(_SkeletonPair(seg_id=seg_id, role_x=role_x, role_y=role_y))

    return result


def _update_pair_counters(
    role_x: str,
    role_y: str,
    role_counters: dict[str, _PairCounters],
    played_role_pairs: set[tuple[str, str]],
) -> None:
    """Phase 1 用: ペア確定時のカウンター更新（Aff/Neg なし）"""
    if role_x not in role_counters or role_y not in role_counters:
        return
    role_counters[role_x].match_count += 1
    role_counters[role_y].match_count += 1
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


def _find_best_role_pair(
    avail_roles: list[str],
    role_counters: dict[str, _PairCounters],
    played_role_pairs: set[tuple[str, str]],
) -> tuple[str, str] | None:
    """
    利用可能なロールの中から、条件①③を最もよく満たすペアを貪欲に選択する。
    スコアが最小のペアを決定論的に返す（同スコアの場合は先頭ペアを採用）。
    """
    if len(avail_roles) < 2:
        return None

    min_count = min(role_counters[r].match_count for r in avail_roles)

    best_pair: tuple[str, str] | None = None
    best_score = float("inf")

    for i, r_a in enumerate(avail_roles):
        for r_b in avail_roles[i + 1:]:
            score = _compute_pair_score(
                r_a=r_a,
                r_b=r_b,
                role_counters=role_counters,
                played_role_pairs=played_role_pairs,
                min_count=min_count,
            )
            if score < best_score:
                best_score = score
                best_pair = (r_a, r_b)

    return best_pair


def _compute_pair_score(
    r_a: str,
    r_b: str,
    role_counters: dict[str, _PairCounters],
    played_role_pairs: set[tuple[str, str]],
    min_count: int,
) -> float:
    """
    ロールペアのスコアを計算する（低いほど良い）。

    優先順位:
      ⓪ 再対戦禁止（最優先・100,000,000 ペナルティ）
      ① 試合数平準化（次点最優先・1,000,000 倍ペナルティ）
      ③ シード配置バランス（1,000 倍ペナルティ）
    """
    score = 0.0

    # ⓪ 再対戦禁止（最優先）
    if (r_a, r_b) in played_role_pairs:
        score += 100000000.0

    ca = role_counters[r_a]
    cb = role_counters[r_b]

    # ① 試合数平準化
    score += float((ca.match_count - min_count + cb.match_count - min_count) * 1000000.0)

    # ③ シード配置バランス
    a_seed = r_a.startswith("S")
    b_seed = r_b.startswith("S")

    if a_seed and b_seed:
        for rc in (ca, cb):
            diff_after = (rc.svs_count + 1) - rc.svn_count
            if diff_after > 1:
                score += 1000.0 * diff_after
    elif a_seed:
        diff_after = (ca.svn_count + 1) - ca.svs_count
        if diff_after > 1:
            score += 1000.0 * diff_after
    elif b_seed:
        diff_after = (cb.svn_count + 1) - cb.svs_count
        if diff_after > 1:
            score += 1000.0 * diff_after

    return score


# ===========================================================================
# Phase 2: Aff/Neg 一括割り当て（②④）— 貪欲法で決定論的に割り当て
# ===========================================================================


def _assign_aff_neg_best(
    pairs: list[_SkeletonPair],
    confirmed_role_entries: list[_SkeletonEntry],
) -> list[_SkeletonEntry]:
    """
    貪欲法で Aff/Neg を割り当てる。
    割り当て結果が条件②④を全て満たす（違反数 0）場合は即時返却する。
    貪欲法は決定論的であるため、ランダム試行による不安定さを排除する。
    """
    result = _try_assign_aff_neg(pairs, confirmed_role_entries)
    violations = _count_aff_neg_violations(result, confirmed_role_entries)
    if violations == 0:
        return result

    # 貪欲法で条件を満たせない場合は最良結果をそのまま返す
    return result


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
