# マスター / 共通 要件

## 概要
- 部門、会場、時間枠などイベント共通のマスタ情報を管理する画面。

## 必要項目
- 部門（`name`, `orderNumber`）
- 会場（`name`, `orderNumber`, `note`）
- 時間枠（`name`, `nameAliases`, `timeDisplay`, `orderNumber`, `isPreRound`）

## 操作
- マスタの一覧表示、追加、編集、削除
- 時間枠の順序変更、予選フラグ設定（`isPreRound`）

## バリデーション
- 名前は必須、表示順は数値でユニークに近い順序付けを検証

## 関連DB
- `event_sections`, `event_rooms`, `event_timetable_segments`

## 備考
- `nameAliases` は外部 TSV インポート時の同定に使用される。

