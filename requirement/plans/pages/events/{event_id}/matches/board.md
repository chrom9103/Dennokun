# 試合一覧（Board） 要件

## 概要
- 時間枠・会場ごとに割り当てられた試合を一覧表示し、進行状態や担当者を確認する画面。

## 表示項目
- 時間枠ごとの試合一覧（時間順）
- 会場別表示
- チーム名、担当判定者、進行状態（結果入力済/未）、公開状態

## 操作
- 試合詳細編集画面への遷移（`/events/{event_id}/matches/{match_id}/edit`）
- フィルタ（時間枠、会場、チーム）

## データ参照
- `event_matches`, `event_rooms`, `event_timetable_segments`, `event_teams`, `event_staffs`, `event_match_voting_details`

## 表示要件
- マトリクス（時間枠 × 会場）での表示を基本とする。
- 公開状態に基づき、非公開試合は管理者のみ閲覧可能とする。

