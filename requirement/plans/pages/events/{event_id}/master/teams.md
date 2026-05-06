# マスター / チーム 要件

## 概要
- イベントに参加するチーム情報を管理する画面。

## 必要項目
- チーム名（必須）
- 所属セクション（`event_section_id`）
- 所属学校（`event_school_id`）
- 所属グループ（`teamGroupId`）
- シード区分（`isSeed`）
- エントリー順（`orderOfApplication`）
- 備考（note）

## 操作
- チームの追加/編集/削除
- グループ割当の管理（マッチング制約に影響するため注意）

## 関連DB
- `event_teams`, `event_sections`, `event_schools`, `event_team_groups`

## 備考
- シードは試合生成ロジックに直接影響するため、誤設定時に警告を出す。

