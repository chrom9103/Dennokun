"""
Phase 1 の条件①違反を再現するテスト。
シード校ありの場合に、貪欲法のペア選択が
条件③のタイブレーカーに影響されて条件①を破るケースを検証する。
"""
import sys
sys.path.insert(0, ".")

from app.algorithm.match_generator import generate_matches_by_slots
from collections import defaultdict


def test_with_seeds():
    """シード校あり: 10チーム (2シード + 8非シード), 5ラウンド, 4並行"""
    teams = []
    for i in range(10):
        teams.append({
            "id": i + 1,
            "event_section_id": 1,
            "event_school_id": i + 1,  # 各チーム別学校
            "is_seed": i < 2,
            "name": f"{'Seed' if i < 2 else 'Team'}{i}",
        })

    segments = [{"id": s, "order_number": s, "name": f"R{s}"} for s in range(1, 6)]
    rooms = [{"id": r, "order_number": r} for r in range(1, 5)]

    sspm = {}
    for seg in segments:
        sspm[f"1_{seg['id']}"] = 4  # 各ラウンド4並行

    matches, warnings = generate_matches_by_slots(
        teams=teams,
        segments=segments,
        rooms=rooms,
        section_segment_parallel_matches=sspm,
    )

    # 試合数カウント
    counts = defaultdict(int)
    for m in matches:
        counts[m["aff_team_id"]] += 1
        counts[m["neg_team_id"]] += 1

    print("=== シード校あり (2 seed + 8 non-seed, 5R x 4並行) ===")
    for t in teams:
        c = counts.get(t["id"], 0)
        print(f"  {t['name']:10s}: {c} 試合 {'(SEED)' if t['is_seed'] else ''}")

    vals = list(counts.values())
    diff = max(vals) - min(vals) if vals else 0
    print(f"  最大差: {diff} {'✅ OK' if diff <= 1 else '❌ 条件①違反!'}")
    if warnings:
        print(f"  Warnings: {warnings}")
    return diff <= 1


def test_without_seeds():
    """シード校なし: 10チーム, 5ラウンド, 4並行"""
    teams = []
    for i in range(10):
        teams.append({
            "id": i + 1,
            "event_section_id": 1,
            "event_school_id": i + 1,
            "is_seed": False,
            "name": f"Team{i}",
        })

    segments = [{"id": s, "order_number": s, "name": f"R{s}"} for s in range(1, 6)]
    rooms = [{"id": r, "order_number": r} for r in range(1, 5)]

    sspm = {}
    for seg in segments:
        sspm[f"1_{seg['id']}"] = 4

    matches, warnings = generate_matches_by_slots(
        teams=teams,
        segments=segments,
        rooms=rooms,
        section_segment_parallel_matches=sspm,
    )

    counts = defaultdict(int)
    for m in matches:
        counts[m["aff_team_id"]] += 1
        counts[m["neg_team_id"]] += 1

    print("=== シード校なし (10 teams, 5R x 4並行) ===")
    for t in teams:
        c = counts.get(t["id"], 0)
        print(f"  {t['name']:10s}: {c} 試合")

    vals = list(counts.values())
    diff = max(vals) - min(vals) if vals else 0
    print(f"  最大差: {diff} {'✅ OK' if diff <= 1 else '❌ 条件①違反!'}")
    if warnings:
        print(f"  Warnings: {warnings}")
    return diff <= 1


def test_many_seeds():
    """シード校多数: 8チーム (4シード + 4非シード), 5ラウンド, 3並行"""
    teams = []
    for i in range(8):
        teams.append({
            "id": i + 1,
            "event_section_id": 1,
            "event_school_id": i + 1,
            "is_seed": i < 4,
            "name": f"{'Seed' if i < 4 else 'Team'}{i}",
        })

    segments = [{"id": s, "order_number": s, "name": f"R{s}"} for s in range(1, 6)]
    rooms = [{"id": r, "order_number": r} for r in range(1, 4)]

    sspm = {}
    for seg in segments:
        sspm[f"1_{seg['id']}"] = 3

    matches, warnings = generate_matches_by_slots(
        teams=teams,
        segments=segments,
        rooms=rooms,
        section_segment_parallel_matches=sspm,
    )

    counts = defaultdict(int)
    for m in matches:
        counts[m["aff_team_id"]] += 1
        counts[m["neg_team_id"]] += 1

    print("=== シード校多数 (4 seed + 4 non-seed, 5R x 3並行) ===")
    for t in teams:
        c = counts.get(t["id"], 0)
        print(f"  {t['name']:10s}: {c} 試合 {'(SEED)' if t['is_seed'] else ''}")

    vals = list(counts.values())
    diff = max(vals) - min(vals) if vals else 0
    print(f"  最大差: {diff} {'✅ OK' if diff <= 1 else '❌ 条件①違反!'}")
    if warnings:
        print(f"  Warnings: {warnings}")
    return diff <= 1


def test_small_tournament():
    """小規模: 6チーム (2シード + 4非シード), 4ラウンド, 2並行"""
    teams = []
    for i in range(6):
        teams.append({
            "id": i + 1,
            "event_section_id": 1,
            "event_school_id": i + 1,
            "is_seed": i < 2,
            "name": f"{'Seed' if i < 2 else 'Team'}{i}",
        })

    segments = [{"id": s, "order_number": s, "name": f"R{s}"} for s in range(1, 5)]
    rooms = [{"id": r, "order_number": r} for r in range(1, 3)]

    sspm = {}
    for seg in segments:
        sspm[f"1_{seg['id']}"] = 2

    matches, warnings = generate_matches_by_slots(
        teams=teams,
        segments=segments,
        rooms=rooms,
        section_segment_parallel_matches=sspm,
    )

    counts = defaultdict(int)
    for m in matches:
        counts[m["aff_team_id"]] += 1
        counts[m["neg_team_id"]] += 1

    print("=== 小規模 (2 seed + 4 non-seed, 4R x 2並行) ===")
    for t in teams:
        c = counts.get(t["id"], 0)
        print(f"  {t['name']:10s}: {c} 試合 {'(SEED)' if t['is_seed'] else ''}")

    vals = list(counts.values())
    diff = max(vals) - min(vals) if vals else 0
    print(f"  最大差: {diff} {'✅ OK' if diff <= 1 else '❌ 条件①違反!'}")
    if warnings:
        print(f"  Warnings: {warnings}")
    return diff <= 1


if __name__ == "__main__":
    results = []
    print()
    results.append(("シード校なし", test_without_seeds()))
    print()
    results.append(("シード校あり", test_with_seeds()))
    print()
    results.append(("シード校多数", test_many_seeds()))
    print()
    results.append(("小規模", test_small_tournament()))
    print()
    print("=" * 50)
    all_pass = True
    for name, ok in results:
        status = "✅ PASS" if ok else "❌ FAIL"
        print(f"  {name}: {status}")
        if not ok:
            all_pass = False
    print("=" * 50)
    if not all_pass:
        print("❌ 条件①違反が検出されました")
        sys.exit(1)
    else:
        print("✅ 全テスト合格")
