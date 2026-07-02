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



## ナレッジ（2026-07-02）
- 直近コミット 85ff3c4 で、イベントマスタ（学校・会場・時間枠）の CRUD と API エンドポイントが実装された。
- 直近コミット 5aed0ca で、スタッフ・チーム・試合結果に関するバックエンドハンドラーとフロント管理画面が実装された。
- 今回の修正で backend/app/core/init_db.py に起動時のスキーマ互換処理を追加し、event_timetable_segments に start_time/end_time が無い既存 DB でも列追加と time_display からの補完を行うようにした。
- 背景として、backend/db/init/001_schema.sql は既存ボリュームには再適用されないため、初期化済み環境では実 DB スキーマが要件定義と乖離しうる。

