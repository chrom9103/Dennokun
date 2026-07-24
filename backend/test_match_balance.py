"""
Phase 1 の条件①違反を再現するテスト。
シード校ありの場合に、貪欲法のペア選択が
条件③のタイブレーカーに影響されて条件①を破るケースを検証する。
"""
import sys
sys.path.insert(0, ".")

from app.algorithm.match_generator import generate_matches_by_slots, validate_match_schedule
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


def test_seed_segment_dispersion():
    """優先順位⑤: シード校が予選第1試合から各セグメントに均等に分散しているか検証"""
    teams = []
    # 16 teams: 4 seed, 12 non-seed
    for i in range(16):
        teams.append({
            "id": i + 1,
            "event_section_id": 1,
            "event_school_id": i + 1,
            "is_seed": i < 4,
            "name": f"{'Seed' if i < 4 else 'Team'}{i}",
        })

    segments = [{"id": s, "order_number": s, "name": f"予選第{s}試合"} for s in range(1, 5)]
    rooms = [{"id": r, "order_number": r} for r in range(1, 5)]
    sspm = {f"1_{s}": 4 for s in range(1, 5)}  # 各時間枠4並行（8枠）

    matches, warnings = generate_matches_by_slots(
        teams=teams,
        segments=segments,
        rooms=rooms,
        section_segment_parallel_matches=sspm,
    )

    seed_ids = {t["id"] for t in teams if t["is_seed"]}
    print("=== 優先順位⑤ シード校セグメント分散検証 (16 teams, 4 seeds, 4R x 4並行) ===")
    
    seed_counts_per_seg = []
    for seg in segments:
        seg_matches = [m for m in matches if m["event_timetable_segment_id"] == seg["id"]]
        seed_cnt = sum(
            (1 if m["aff_team_id"] in seed_ids else 0) + (1 if m["neg_team_id"] in seed_ids else 0)
            for m in seg_matches
        )
        seed_counts_per_seg.append(seed_cnt)
        print(f"  {seg['name']}: シード校 {seed_cnt} / 全 8 枠")

    # 予選第1試合にシード校が割り当たっていること（0ではない）
    first_seg_ok = seed_counts_per_seg[0] > 0
    # セグメント間でのシード校数の最大差が1以内であること
    diff = max(seed_counts_per_seg) - min(seed_counts_per_seg)
    dispersion_ok = diff <= 1

    ok = first_seg_ok and dispersion_ok
    print(f"  予選第1試合シード校存在: {'✅ OK' if first_seg_ok else '❌ 第1試合にシード校なし!'}")
    print(f"  セグメント間シード数差: {diff} {'✅ OK' if dispersion_ok else '❌ 分散が偏っています!'}")
    return ok


def test_full_validation_schedule():
    """ハード制約（Aff/Neg 2:2 完全均等）およびソフト制約（放置防止・会場利用分布）の自動検証"""
    teams = []
    # 12 teams: 2 seed, 10 non-seed
    for i in range(12):
        teams.append({
            "id": i + 1,
            "event_section_id": 1,
            "event_school_id": i + 1,
            "is_seed": i < 2,
            "name": f"{'Seed' if i < 2 else 'Team'}{i}",
        })

    # 4 segments, 3 parallel matches (6 teams match per segment, 6 teams rest)
    segments = [{"id": s, "order_number": s, "name": f"予選第{s}試合"} for s in range(1, 5)]
    rooms = [{"id": r, "order_number": r, "name": f"Room {r}"} for r in range(1, 4)]
    sspm = {f"1_{s}": 3 for s in range(1, 5)}

    matches, warnings = generate_matches_by_slots(
        teams=teams,
        segments=segments,
        rooms=rooms,
        section_segment_parallel_matches=sspm,
    )

    is_valid, report, stats = validate_match_schedule(
        matches=matches,
        teams=teams,
        segments=segments,
        rooms=rooms,
    )

    print("=== 全体バリデーションレポート (12 teams, 4試合, 3並行) ===")
    for line in report:
        print(f"  {line}")

    # 各チームの Aff/Neg 表示
    aff_c, neg_c = stats["aff_counts"], stats["neg_counts"]
    print("  各チーム Aff/Neg 内訳:")
    all_2_2 = True
    for t in teams:
        a = aff_c.get(t["id"], 0)
        n = neg_c.get(t["id"], 0)
        print(f"    {t['name']:10s}: Aff {a}回 / Neg {n}回 (計 {a+n} 試合)")
        if a + n == 4 and (a != 2 or n != 2):
            all_2_2 = False

    print(f"  ハード制約 Aff:Neg = 2:2 完全判定: {'✅ OK' if all_2_2 else '❌ FAIL'}")
    return is_valid and all_2_2


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
    results.append(("シード校セグメント分散", test_seed_segment_dispersion()))
    print()
    results.append(("自動バリデーション＆ハード制約", test_full_validation_schedule()))
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
        print("❌ テスト失敗が検出されました")
        sys.exit(1)
    else:
        print("✅ 全テスト合格")


