"""
slot_assigner.py — 時間枠・会場割当ロジック
=============================================

【現在の実装】
  対戦ペアリストを時間枠と会場に均等に割り当てる。
  1つのスロット（時間枠 × 会場）に1試合。

【将来の最適化について】
  assign_slots() の入出力インターフェースを維持しながら、
  同一校の試合が重複しない制約などをここに追加できる。

【入力】
  pairs: list[dict]    — match_generator が生成した対戦ペア
  segments: list[dict] — event_timetable_segments テーブルの行
  rooms: list[dict]    — event_rooms テーブルの行

【出力】
  list[dict] に event_timetable_segment_id, event_room_id,
  order_number_in_segment を追加したもの。
  割り当てられなかったペアは None を埋める。
"""

from __future__ import annotations


def assign_slots(
    pairs: list[dict],
    segments: list[dict],
    rooms: list[dict],
) -> list[dict]:
    """
    対戦ペアを時間枠・会場スロットに割り当てる。

    スロットを順番に埋めていく単純なビン詰め方式。
    試合数がスロット数を超えた場合は segment_id = None のままにする。
    """
    if not segments or not rooms:
        # スロット情報がない場合は割り当てなし
        for pair in pairs:
            pair["event_timetable_segment_id"] = None
            pair["event_room_id"] = None
            pair["order_number_in_segment"] = None
        return pairs

    # スロット一覧を作成（segment × room の直積）
    # segment の order_number でソート済み想定
    sorted_segments = sorted(segments, key=lambda s: s.get("order_number") or 0)
    sorted_rooms = sorted(rooms, key=lambda r: r.get("order_number") or r["id"])

    slots: list[dict] = []
    for seg in sorted_segments:
        for order_in_seg, room in enumerate(sorted_rooms, start=1):
            slots.append({
                "event_timetable_segment_id": seg["id"],
                "event_room_id": room["id"],
                "order_number_in_segment": order_in_seg,
            })

    # ペアにスロットを割り当てる
    for i, pair in enumerate(pairs):
        if i < len(slots):
            pair.update(slots[i])
        else:
            # スロット不足 — 未割当のまま
            pair["event_timetable_segment_id"] = None
            pair["event_room_id"] = None
            pair["order_number_in_segment"] = None

    return pairs
