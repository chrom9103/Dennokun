"""
一貫性テスト: 同じ入力に対して常に同じ結果になるか確認
"""
import asyncio
import sys

sys.path.insert(0, "/app")

async def main():
    from app.core.handle_db.matches import get_all_matches
    from app.core.handle_db.teams import get_all_teams
    from app.core.handle_db.staffs import get_all_staffs
    from app.algorithm.judge_assigner import assign_judges

    EVENT_ID = 63449476

    matches = await get_all_matches(EVENT_ID)
    teams = await get_all_teams(EVENT_ID)
    staffs = await get_all_staffs(EVENT_ID)
    judge_staffs = [s for s in staffs if s.get("can_be_main_judge") or s.get("can_be_sub_judge") or s.get("can_be_timekeeper")]

    seg_ids = list({m.get("event_timetable_segment_id") for m in matches if m.get("event_timetable_segment_id")})
    segment_judge_counts = {seg_id: 2 for seg_id in seg_ids}

    # 制約違反チェック関数
    staff_present_segs = {}
    for s in staffs:
        present = s.get("present_segment_ids")
        staff_present_segs[s["id"]] = set(present) if present else set()

    def check_violations(assigned, label=""):
        violations = []
        for m in assigned:
            seg_id = m.get("event_timetable_segment_id")
            # セグメント内重複チェック (赤)
            used_in_match = []
            for role in ["main_judge_staff_id", "sub_judge1_staff_id", "sub_judge2_staff_id", "timekeeper_staff_id"]:
                s_id = m.get(role)
                if s_id:
                    if s_id in used_in_match:
                        violations.append(f"[赤] 試合{m['id']}: 同一試合内重複 staff_id={s_id}")
                    used_in_match.append(s_id)
            # 出席可能枠チェック (橙)
            for role in ["main_judge_staff_id", "sub_judge1_staff_id", "sub_judge2_staff_id", "timekeeper_staff_id"]:
                s_id = m.get(role)
                if s_id:
                    present = staff_present_segs.get(s_id, set())
                    if present and seg_id not in present:
                        violations.append(f"[橙] 試合{m['id']} seg={seg_id}: staff_id={s_id} 出席可能={sorted(present)}")
        return violations

    # 5回実行して結果を比較
    print("=== 5回実行テスト ===")
    results = []
    for i in range(5):
        assigned, warning = assign_judges(
            matches=matches, staffs=judge_staffs, teams=teams,
            judges_per_match=segment_judge_counts, allow_reversed_past=False,
        )
        # 各試合のアサイン結果をキーとしてハッシュ化
        key = tuple(
            (m["id"], m.get("main_judge_staff_id"), m.get("sub_judge1_staff_id"),
             m.get("timekeeper_staff_id"))
            for m in sorted(assigned, key=lambda x: x["id"])
        )
        violations = check_violations(assigned)
        results.append((key, violations, warning))
        print(f"実行{i+1}: 違反={len(violations)}件, 警告={'あり' if warning else 'なし'}")

    # 全て同一結果か確認
    all_same = all(r[0] == results[0][0] for r in results)
    print(f"\n結果の一貫性: {'✅ 全回同一' if all_same else '⚠️ 結果が異なる回あり'}")

    # 最初の結果の詳細
    assigned0, warning0, _ = results[0][0], results[0][2], results[0][1]
    print(f"\n制約違反 (1回目): {len(results[0][1])}件")
    for v in results[0][1]:
        print(f"  {v}")

    # 担当回数の均等性チェック
    print("\n=== 担当回数の均等性 ===")
    count = {}
    assigned_check, _w = assign_judges(
        matches=matches, staffs=judge_staffs, teams=teams,
        judges_per_match=segment_judge_counts, allow_reversed_past=False,
    )
    for m in assigned_check:
        for role in ["main_judge_staff_id", "sub_judge1_staff_id", "sub_judge2_staff_id", "timekeeper_staff_id"]:
            s_id = m.get(role)
            if s_id:
                count[s_id] = count.get(s_id, 0) + 1

    staff_name_map = {s["id"]: s["name"] for s in staffs}
    for sid, cnt in sorted(count.items(), key=lambda x: -x[1]):
        print(f"  {staff_name_map.get(sid, sid)}: {cnt}回")

if __name__ == "__main__":
    asyncio.run(main())
