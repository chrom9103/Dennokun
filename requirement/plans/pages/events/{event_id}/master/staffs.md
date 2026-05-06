# マスター / スタッフ 要件

## 概要
- スタッフ（判定者・運営等）を管理する画面。役割や利害関係、参加可能時間帯を扱う。

## 必要項目
- スタッフ名（必須）
- 役割フラグ（主審/副審/タイムキーパー 等）
- 関係校（多対多）
- 関係チーム（多対多）
- 参加可能時間帯（`presentTimetableSegmentsRawValue`）
- エントリー順、備考

## 操作
- 追加/編集/削除
- 関係校・関係チームの紐付け管理

## 関連DB
- `event_staffs`, `event_staff_interested_schools`, `event_staff_interested_teams`, `event_staff_present_timetable_segments`, `event_schools`, `event_teams`, `event_timetable_segments`

## 備考
- 判定者マッチングで利害関係・参加時間帯を利用するため、多対多関連を正確に保つこと。

