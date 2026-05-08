# DB テーブル定義 (要件)

## 概要
この文書は Dennokun アプリケーションで使用する主要テーブルとカラムの要件定義を示す。

---

## 共通ルール
- 主キー: `id` はシステム全体で一貫して `bigint`を使用する。
- 作成/更新: `created_at`, `updated_at` を持つ（タイムゾーン付き日時推奨）。
- 論理削除: 必要なら `deleted_at` を持つ。
- インデックス: 外部キー、検索に使うカラム、ユニーク制約に対してインデックスを設定する。

---

## `users`
- id: PK
- name: string (必須)
- email: string (一意、必須)
- password_hash: string (必須)
- permissions: json/text または string (ロール/権限)
- created_at, updated_at, deleted_at

インデックス: `email` にユニークインデックス。

---

## `events`
- id: PK
- name: string (必須)
- start_date: date
- spreadsheet_id: string (外部連携用、nullable)
- bucket_name: string (nullable)
- flash_news_url: string (nullable)
- created_at, updated_at, deleted_at

インデックス: `start_date`、必要に応じて `name` の全文検索インデックス。

---

## `event_sections`
- id: PK
- event_id: FK -> `events.id` (必須)
- name: string (必須)
- order_number: integer
- created_at, updated_at, deleted_at

インデックス: `event_id`, (`event_id`, `order_number`)

---

## `event_schools`
- id: PK
- event_id: FK -> `events.id` (必須)
- name: string (必須)
- name_aliases: text/array (nullable) (表記揺れ吸収用のエイリアス)
- order_number: integer
- note: text (nullable)
- created_at, updated_at, deleted_at

インデックス: `event_id`, (`event_id`, `name`)

---

## `event_team_groups`
- id: PK
- event_id: FK -> `events.id` (必須)
- name: string
- created_at, updated_at, deleted_at

用途: チームのグルーピング（同グループ対戦制約に使用）。

---

## `event_teams`
- id: PK
- event_id: FK -> `events.id` (必須)
- name: string (必須)
- event_section_id: FK -> `event_sections.id` (nullable)
- event_school_id: FK -> `event_schools.id` (nullable)
- team_group_id: FK -> `event_team_groups.id` (nullable)
- is_seed: boolean (デフォルト false)
- order_of_application: integer (nullable)
- note: text (nullable)
- created_at, updated_at, deleted_at

インデックス: `event_id`, (`event_id`, `name`), (`event_id`,`team_group_id`)

---

## `event_rooms`
- id: PK
- event_id: FK -> `events.id` (必須)
- name: string (必須)
- order_number: integer
- note: text (nullable)
- created_at, updated_at, deleted_at

---

## `event_timetable_segments`
- id: PK
- event_id: FK -> `events.id` (必須)
- name: string (必須)
- name_aliases: text/array (nullable)
- start_time: string (例: "10:00")
- end_time: string (例: "10:30")
- order_number: integer
- is_pre_round: boolean (予選フラグ)
- created_at, updated_at, deleted_at

インデックス: (`event_id`,`order_number`)

---

## `event_staffs`
- id: PK
- event_id: FK -> `events.id` (必須)
- name: string (必須)
- can_be_main_judge: boolean
- can_be_sub_judge: boolean
- can_be_timekeeper: boolean
- order_of_application: integer
- note: text (nullable)
- present_timetable_segments_raw_value: text (フロントで選択した原文保管)
- created_at, updated_at, deleted_at

補助テーブル（交差テーブル）:

- `event_staff_present_timetable_segments`
	- `id`: PK
	- `event_timetable_segment_id`: FK -> `event_timetable_segments.id` (必須)
	- `event_staff_id`: FK -> `event_staffs.id` (必須)
	- `created_at`, `updated_at`

- `event_staff_interested_schools`
	- `id`: PK
	- `event_school_id`: FK -> `event_schools.id` (必須)
	- `event_staff_id`: FK -> `event_staffs.id` (必須)
	- `created_at`, `updated_at`

- `event_staff_interested_teams`
	- `id`: PK
	- `event_team_id`: FK -> `event_teams.id` (必須)
	- `event_staff_id`: FK -> `event_staffs.id` (必須)
	- `created_at`, `updated_at`

インデックス: `event_id`, 各多対多テーブルに FK インデックス。

---

## `event_matches`
- id: PK
- event_id: FK -> `events.id` (必須)
- event_timetable_segment_id: FK -> `event_timetable_segments.id` (nullable)
- event_room_id: FK -> `event_rooms.id` (nullable)
- event_section_id: FK -> `event_sections.id` (nullable)
- judges_assignment_count: integer (nullable)
- is_timekeeper_available: boolean (null可)
- main_judge_staff_id: FK -> `event_staffs.id` (null可)
- sub_judge1_staff_id: FK -> `event_staffs.id` (null可)
- sub_judge2_staff_id: FK -> `event_staffs.id` (null可)
- sub_judge3_staff_id: FK -> `event_staffs.id` (null可)
- sub_judge4_staff_id: FK -> `event_staffs.id` (null可)
- timekeeper_staff_id: FK -> `event_staffs.id` (null可)
- aff_team_id: FK -> `event_teams.id` (null可)
- neg_team_id: FK -> `event_teams.id` (null可)
- aff_votes: integer
- neg_votes: integer
- aff_constructive_comm: integer
- aff_question_comm: integer
- aff_answer_comm: integer
- aff_first_rebuttal_comm: integer
- aff_second_rebuttal_comm: integer
- neg_constructive_comm: integer
- neg_question_comm: integer
- neg_answer_comm: integer
- neg_first_rebuttal_comm: integer
- neg_second_rebuttal_comm: integer
- aff_comm_sum: integer
- neg_comm_sum: integer
- aff_manner: integer
- neg_manner: integer
- is_staffs_fixed: boolean
- is_result_confirmed: boolean
- order_number_in_segment: integer
- note: text (nullable)
- aff_won: integer
- neg_won: integer
- name: string (nullable)
- tournament_weight: integer (default: 0)
- is_result_public: boolean
- aff_pre_round_rank: integer
- neg_pre_round_rank: integer
- created_at, updated_at, deleted_at

インデックス: (`event_id`,`event_timetable_segment_id`), (`event_id`,`event_room_id`), (`aff_team_id`), (`neg_team_id`)

運用注意: 同一試合の再生成やマッチング生成時に一時状態を分けるカラムを検討（例: `generation_run_id`）。

---

## `event_match_voting_details`
- id: PK
- event_match_id: FK -> `event_matches.id` (必須)
- judge_index: integer (判定者インデックス)
- aff_won: integer
- neg_won: integer
- aff_constructive_comm: integer
- aff_question_comm: integer
- aff_answer_comm: integer
- aff_first_rebuttal_comm: integer
- aff_second_rebuttal_comm: integer
- neg_constructive_comm: integer
- neg_question_comm: integer
- neg_answer_comm: integer
- neg_first_rebuttal_comm: integer
- neg_second_rebuttal_comm: integer
- aff_comm_sum: integer
- neg_comm_sum: integer
- aff_manner: integer
- neg_manner: integer
- note: text (nullable)
- created_at, updated_at, deleted_at

インデックス: `event_match_id`, (`judge_index`)

---

## 運用・パフォーマンスの補足
- マッチング生成では大量の読み取り/一時生成が発生するため、`event_matches` の大量挿入用にバルクAPIやトランザクションを用意する。
- 再戦チェックや既存マッチ検査のために、`event_matches` の参照用キャッシュ（メモリ内 Set または Redis）を用いると生成が高速化する。
- よく検索される組合せ（チーム対）に対しては複合インデックスの検討。

---

## マイグレーション/互換性ヒント
- 既存 Ruby 実装から移行する場合は、UUID vs bigint の選択に注意。外部API連携や既存データサイズに応じて決定する。
- カラム追加は非破壊で行い、必要であればバックフィル処理を行う。

