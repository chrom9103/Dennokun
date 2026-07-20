"""
検証スクリプト: judge_assigner の present_segment_ids 修正を実データで確認する
"""
import asyncio
import sys
import os

sys.path.insert(0, "/app")

async def main():
    from app.core.handle_db.matches import get_all_matches
    from app.core.handle_db.teams import get_all_teams
    from app.core.handle_db.staffs import get_all_staffs
    from app.algorithm.judge_assigner import assign_judges

    EVENT_ID = 63449476  # (実データ)2026年度春大会

    matches = await get_all_matches(EVENT_ID)
    teams = await get_all_teams(EVENT_ID)
    staffs = await get_all_staffs(EVENT_ID)

    judge_staffs = [s for s in staffs if s.get("can_be_main_judge") or s.get("can_be_sub_judge") or s.get("can_be_timekeeper")]

    print(f"試合数: {len(matches)}, スタッフ数: {len(judge_staffs)}")
    print()

    # スタッフの出席可能セグメント一覧を表示
    print("=== スタッフ出席可能セグメント ===")
    for s in judge_staffs:
        segs = s.get("present_segment_ids") or []
        if segs:
            print(f"  {s['name']} (ID={s['id']}): segs={sorted(segs)}")
    print()

    # segment_judge_counts の形式：全セグメントに対して2審判（主審1+副審1）
    seg_ids = list({m.get("event_timetable_segment_id") for m in matches if m.get("event_timetable_segment_id")})
    segment_judge_counts = {seg_id: 2 for seg_id in seg_ids}

    # 割り当て実行
    assigned, warning = assign_judges(
        matches=matches,
        staffs=judge_staffs,
        teams=teams,
        judges_per_match=segment_judge_counts,
        allow_reversed_past=False,
        allow_diff_day=True,
    )

    if warning:
        print(f"警告: {warning}")
    else:
        print("✅ 全制約を満たす割り当てに成功しました")
    print()

    # 制約違反チェック
    print("=== 割り当て結果の制約違反チェック ===")
    violations = []

    # スタッフ出席可能セグメントのマップ
    staff_present_segs = {}
    for s in staffs:
        present = s.get("present_segment_ids")
        staff_present_segs[s["id"]] = set(present) if present else set()

    staff_name_map = {s["id"]: s["name"] for s in staffs}

    for m in assigned:
        seg_id = m.get("event_timetable_segment_id")
        match_id = m.get("id")

        for role in ["main_judge_staff_id", "sub_judge1_staff_id", "sub_judge2_staff_id", "timekeeper_staff_id"]:
            s_id = m.get(role)
            if not s_id:
                continue
            present_segs = staff_present_segs.get(s_id, set())
            if present_segs and seg_id not in present_segs:
                violations.append(
                    f"  ❌ 制約違反(橙): 試合ID={match_id} セグID={seg_id}, "
                    f"役割={role}, スタッフ={staff_name_map.get(s_id)}(ID={s_id}), "
                    f"出席可能segs={sorted(present_segs)}"
                )

    if violations:
        print(f"制約違反 {len(violations)} 件:")
        for v in violations:
            print(v)
    else:
        print("✅ 出席可能時間枠の違反はありません")

    print()
    print("=== サマリー ===")
    print(f"割り当て成功: {len([m for m in assigned if m.get('main_judge_staff_id')])} 試合")
    print(f"警告: {warning}")


if __name__ == "__main__":
    asyncio.run(main())
