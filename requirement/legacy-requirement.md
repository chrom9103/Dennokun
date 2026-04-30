# 電脳くん (dennokun-spring) システム要件定義書

本ドキュメントは、ディベート大会等における大会運営・対戦組み合わせ管理システム「電脳くん (dennokun-spring)」の要件定義書です。

## 1. システム概要
本システムは、ディベート大会における運営業務を総合的に支援するためのWebアプリケーションです。
大会の基本情報、参加校、チーム、スタッフ、タイムテーブル、試合の組み合わせ（マッチング）生成から、試合結果の入力・集計、およびその結果の外部公開（HTML生成によるGCSへのアップロード、Googleスプレッドシート連携）までを一貫して行います。

## 2. システム構成
- **フロントエンド:** Angular (TypeScript)
- **バックエンド:** Kotlin / Spring Boot
- **データベース:** MySQL または PostgreSQL (Phinxによるマイグレーション管理)
- **外部API・連携:**
  - Google Cloud Storage (GCS) (静的HTMLの公開用)
  - Google Sheets API (スプレッドシートとのインポート/エクスポート連携用)
  - PDF変換機能 (外部ツールやライブラリ連携)

## 3. 主要機能一覧

### 3.1. 大会基本設定・マスタデータ管理 (Init / Master Data)
大会ごとのマスタデータを管理します。
- **大会 (Events):** 大会名、開催日、公開用GCSバケット名、連携スプレッドシートID、速報(Flash News)用URL・QRコード画像の登録。
- **部門 (Sections):** 「中学の部」「高校の部」など、大会内の部門の定義。
- **参加校 (Schools):** 参加学校の登録。表記揺れ吸収のためのエイリアス(name_aliases)の設定。
- **チームグループ (Team Groups):** 地域やブロックなど、チームをまとめるグループの定義。
- **チーム (Teams):** チーム名の登録。部門、所属学校、グループとの紐付け、およびシード(is_seed)の設定。
- **部屋 (Rooms):** 試合を行う教室や会場の登録。
- **タイムテーブル (Timetable Segments):** 試合枠（第1試合、第2試合など）の定義。予選(is_pre_round)・本選の区分。
- **スタッフ (Staffs):** ジャッジやタイムキーパーの登録。
  - 主審(Main Judge)、副審(Sub Judge)、タイムキーパー(Timekeeper)の担当可否フラグ。
  - 参加可能な時間帯(Timetable Segments)の紐付け。
  - **利害関係設定:** 特定のチーム(`interested_teams`)や学校(`interested_schools`)に対する利害関係を登録し、マッチング時の衝突を回避。

### 3.2. 試合・対戦組み合わせ生成 (Match Generation & Judge Matching)
- **試合枠の作成:** 手動作成、またはTSV/CSVインポートによる試合枠の一括登録。
- **対戦チームの組み合わせアルゴリズム:**
  - 予選・本選に応じたチーム同士のマッチング。（※Rubyスクリプト等を用いた制約充足ロジックも存在: 同じチームとの再戦禁止、同グループ内対戦禁止、肯定側/否定側のバランス調整など）
- **ジャッジ・部屋・時間帯の自動/手動割り当て:**
  - スタッフの参加可能時間帯と利害関係（所属・関係校）を考慮したジャッジの自動割り当て。
  - 試合順の設定、トーナメント上のウェイト付け、予選順位に基づく配置。
  - 肯定側/否定側のチーム反転設定。

### 3.3. 試合結果の入力と集計 (Match Result Management)
- **結果入力インターフェース:** 管理者画面からの試合ごとの勝敗およびスコア入力。
- **ジャッジ投票詳細 (Voting Details):**
  - 複数のジャッジそれぞれにおける肯定側/否定側への投票。
  - コミュニケーション点（立論、質疑、応答、第一反駁、第二反駁）およびマナー点の入力。
- **集計機能:** 予選結果（Pre-round results）および本選結果（Tournament results）の集計、順位の算出。

### 3.4. 結果公開・パブリケーション (Publications)
- **公開用HTMLの自動生成:** タイムテーブルや試合結果を反映した静的HTMLを生成。
- **クラウドへのパブリッシュ:** 生成したHTMLをGoogle Cloud Storage (GCS) バケットにアップロードし、大会結果を一般公開。
- **スプレッドシート連携:** 大会データや結果をGoogleスプレッドシートに出力（または入力）。
- **公開状態の管理:** 試合結果の公開可否(is_result_public)の制御。

## 4. データモデル・テーブル定義

DBには要件を満たすために必要なテーブル・カラムがすべて過不足なく定義されています。マイグレーション履歴に基づき、各テーブルに含まれる全カラムを以下に記載します（Phinxによって自動生成される主キー `id` は省略しています）。

### `users`
管理画面にログインするユーザー。
- `name` (string): ユーザー名
- `password_hash` (string): パスワードのハッシュ値
- `email` (string, null可): メールアドレス
- `permissions` (string): 権限（デフォルト `""`）

### `events`
大会の基本情報。
- `name` (string): 大会名
- `start_date` (date): 開催日
- `spreadsheet_id` (string, null可): スプレッドシートID
- `bucket_name` (string, null可): 公開用GCSバケット名
- `flash_news_url` (text, null可): 速報用URL
- `flash_news_qr_image_url` (text, null可): 速報用QRコード画像URL

### `event_sections`
大会の部門（中学・高校など）。
- `event_id` (integer): 大会IDへの外部キー
- `name` (string): 部門名
- `order_number` (integer): 順番

### `event_schools`
参加学校。
- `event_id` (integer): 大会IDへの外部キー
- `order_number` (integer): 順番
- `name` (string): 学校名
- `note` (string, null可): 備考
- `name_aliases` (string, null可): 表記揺れ吸収用のエイリアス

### `event_team_groups`
チームのグループ・ブロック。
- `event_id` (integer): 大会IDへの外部キー
- `name` (string): グループ名
- `note` (string, null可): 備考
- `order_number` (integer): 順番

### `event_teams`
出場チーム。
- `event_section_id` (integer): 部門IDへの外部キー
- `event_school_id` (integer, null可): 学校IDへの外部キー
- `name` (string): チーム名
- `order_of_application` (integer): 申込順
- `is_seed` (boolean): シードフラグ
- `note` (string, null可): 備考
- `event_team_group_id` (integer, null可): チームグループIDへの外部キー

### `event_rooms`
試合会場。
- `event_id` (integer): 大会IDへの外部キー
- `name` (string): 部屋名
- `order_number` (integer): 順番
- `note` (string, null可): 備考

### `event_timetable_segments`
大会の時間枠。
- `event_id` (integer): 大会IDへの外部キー
- `name` (string): 時間枠名
- `order_number` (integer): 順番
- `time_display` (string, null可): 表示用時間
- `note` (string, null可): 備考
- `is_pre_round` (integer): 予選フラグ（デフォルト `0`）
- `name_aliases` (string, null可): 表記揺れ吸収用のエイリアス

### `event_staffs`
運営スタッフ。
- `event_id` (integer): 大会IDへの外部キー
- `name` (string): スタッフ名
- `can_be_main_judge` (boolean): 主審担当可否
- `can_be_sub_judge` (boolean): 副審担当可否
- `can_be_timekeeper` (boolean): タイムキーパー担当可否
- `order_of_application` (integer): 申込順
- `note` (string, null可): 備考
- `present_timetable_segments_raw_value` (string): 参加可能時間枠のRawデータ

### `event_staff_present_timetable_segments`
スタッフと参加可能なタイムテーブル枠の紐付け（交差テーブル）。
- `event_timetable_segment_id` (integer): タイムテーブル枠IDへの外部キー
- `event_staff_id` (integer): スタッフIDへの外部キー

### `event_staff_interested_schools`
スタッフと学校の利害関係（交差テーブル）。
- `event_school_id` (integer): 学校IDへの外部キー
- `event_staff_id` (integer): スタッフIDへの外部キー

### `event_staff_interested_teams`
スタッフとチームの利害関係（交差テーブル）。
- `event_team_id` (integer): チームIDへの外部キー
- `event_staff_id` (integer): スタッフIDへの外部キー

### `event_matches`
個別の試合。
- `event_id` (integer): 大会IDへの外部キー
- `event_timetable_segment_id` (integer, null可): 時間枠IDへの外部キー
- `event_room_id` (integer, null可): 部屋IDへの外部キー
- `event_section_id` (integer, null可): 部門IDへの外部キー
- `judges_assignment_count` (integer, null可): 割り当てジャッジ数
- `is_timekeeper_available` (boolean, null可): タイムキーパー有無
- `main_judge_staff_id` (integer, null可): 主審スタッフIDへの外部キー
- `sub_judge1_staff_id` (integer, null可): 副審1スタッフIDへの外部キー
- `sub_judge2_staff_id` (integer, null可): 副審2スタッフIDへの外部キー
- `sub_judge3_staff_id` (integer, null可): 副審3スタッフIDへの外部キー
- `sub_judge4_staff_id` (integer, null可): 副審4スタッフIDへの外部キー
- `timekeeper_staff_id` (integer, null可): タイムキーパースタッフIDへの外部キー
- `aff_team_id` (integer, null可): 肯定側チームIDへの外部キー
- `neg_team_id` (integer, null可): 否定側チームIDへの外部キー
- `aff_votes` (integer): 肯定側獲得票数
- `neg_votes` (integer): 否定側獲得票数
- `aff_constructive_comm` (integer): 肯定側 立論コミュニケーション点
- `aff_question_comm` (integer): 肯定側 質疑コミュニケーション点
- `aff_answer_comm` (integer): 肯定側 応答コミュニケーション点
- `aff_first_rebuttal_comm` (integer): 肯定側 第一反駁コミュニケーション点
- `aff_second_rebuttal_comm` (integer): 肯定側 第二反駁コミュニケーション点
- `neg_constructive_comm` (integer): 否定側 立論コミュニケーション点
- `neg_question_comm` (integer): 否定側 質疑コミュニケーション点
- `neg_answer_comm` (integer): 否定側 応答コミュニケーション点
- `neg_first_rebuttal_comm` (integer): 否定側 第一反駁コミュニケーション点
- `neg_second_rebuttal_comm` (integer): 否定側 第二反駁コミュニケーション点
- `aff_comm_sum` (integer): 肯定側 コミュニケーション点合計
- `neg_comm_sum` (integer): 否定側 コミュニケーション点合計
- `aff_manner` (integer): 肯定側 マナー点
- `neg_manner` (integer): 否定側 マナー点
- `is_staffs_fixed` (boolean): スタッフ固定（変更不可）フラグ
- `is_result_confirmed` (boolean): 結果確定フラグ
- `order_number_in_segment` (integer): 時間枠内の順番
- `note` (string, null可): 備考
- `aff_won` (integer): 肯定側勝利数
- `neg_won` (integer): 否定側勝利数
- `name` (string, null可): 試合名
- `tournament_weight` (integer): トーナメント上のウェイト（デフォルト `0`）
- `is_result_public` (boolean): 結果公開フラグ
- `aff_pre_round_rank` (integer): 肯定側 予選順位
- `neg_pre_round_rank` (integer): 否定側 予選順位

### `event_match_voting_details`
試合に割り当てられた各ジャッジごとの詳細スコア。
- `event_match_id` (integer): 試合IDへの外部キー
- `judge_index` (integer): ジャッジのインデックス
- `aff_won` (integer): 肯定側勝利
- `neg_won` (integer): 否定側勝利
- `aff_constructive_comm` (integer): 肯定側 立論コミュニケーション点
- `aff_question_comm` (integer): 肯定側 質疑コミュニケーション点
- `aff_answer_comm` (integer): 肯定側 応答コミュニケーション点
- `aff_first_rebuttal_comm` (integer): 肯定側 第一反駁コミュニケーション点
- `aff_second_rebuttal_comm` (integer): 肯定側 第二反駁コミュニケーション点
- `neg_constructive_comm` (integer): 否定側 立論コミュニケーション点
- `neg_question_comm` (integer): 否定側 質疑コミュニケーション点
- `neg_answer_comm` (integer): 否定側 応答コミュニケーション点
- `neg_first_rebuttal_comm` (integer): 否定側 第一反駁コミュニケーション点
- `neg_second_rebuttal_comm` (integer): 否定側 第二反駁コミュニケーション点
- `aff_comm_sum` (integer): 肯定側 コミュニケーション点合計
- `neg_comm_sum` (integer): 否定側 コミュニケーション点合計
- `aff_manner` (integer): 肯定側 マナー点
- `neg_manner` (integer): 否定側 マナー点
- `note` (string, null可): 備考

## 5. CSV/TSV 一括データ登録運用仕様

実際の運用においては、システム上で手入力する以外にCSV/TSVによるデータの一括インポート機能を利用しています。
インポートするCSV/TSVの各カラムは、DBのテーブルと適切にリレーション・マッピングされています。

### 5.1 スタッフ (staffs)
- **カラム:** `orderOfApplication`, `name`, `note`, `canBeMainJudge`, `canBeSubJudge`, `canBeTimekeeper`, `interestedSchoolNameList`, `presentTimetableSegmentNameList`
- **DBマッピング:** `event_staffs` テーブルに基本情報を登録。利害関係のある学校名は `event_staff_interested_schools` へ、参加可能時間枠は `event_staff_present_timetable_segments` へ交差テーブルとして分解・格納されます。

### 5.2 タイムテーブル枠 (timeTableSegments)
- **カラム:** `orderNumber`, `name`, `note`, `timeDisplay`, `isPreRound`, `nameAliases`
- **DBマッピング:** `event_timetable_segments` テーブルに格納されます。

### 5.3 参加校 (schools)
- **カラム:** `orderNumber`, `name`, `nameAliases`
- **DBマッピング:** `event_schools` テーブルに格納されます。

### 5.4 チームグループ (groups)
- **カラム:** `orderNumber`, `name`
- **DBマッピング:** `event_team_groups` テーブルに格納されます。

### 5.5 部門 (sections)
- **カラム:** `orderNumber`, `name`
- **DBマッピング:** `event_sections` テーブルに格納されます。

### 5.6 チーム (teams-section)
- **カラム:** `orderOfApplication`, `name`, `schoolName`, `isSeed`, `note`, `groupName`
- **DBマッピング:** `event_teams` に登録されます。その際、`schoolName` から `event_schools` のIDを、`groupName` から `event_team_groups` のIDをそれぞれ引き当ててリレーションを持ちます。

### 5.7 部屋 (rooms)
- **カラム:** `orderNumber`, `name`, `note`
- **DBマッピング:** `event_rooms` テーブルに格納されます。

### 5.8 試合・組み合わせ (matches)
- **カラム:** `timetableSegmentOrderNumber`, `roomOrderNumber`, `affTeamName`, `negTeamName`, `sectionOrderNumber`, `orderNumberInSegment`, `judgesAssignmentCount`, `isTimekeeperAvailable`, `name`, `tournamentWeight`, `note`, `affPreRoundRank`, `negPreRoundRank`
- **DBマッピング:** `event_matches` に登録されます。時間枠・部屋・部門は `OrderNumber` からIDを引き当て、肯定側・否定側チームは名前からIDを引き当てて関連付けられます。DBに必要な全カラムが網羅されています。

## 6. Webページ・画面構成 (フロントエンドルーティング)

Angularのルーティング構成に基づき、本システムには以下の画面（パス）が存在します。

### トップレベル
- `/menu` : 大会一覧画面 (EventListComponent)
- `/events/new` : 大会新規作成画面 (EventEditComponent)

### 大会別メニュー (パスプレフィックス: `/events/:eventId`)
大会を選択した後の各種操作・設定画面です。

#### 大会概要・基本設定
- `/edit` : 大会編集画面 (EventEditComponent)
- `/overview` : 大会概要画面 (EventOverviewComponent)

#### 初期設定 (Init)
マスタデータの管理画面です。
- `/init/schools` : 参加校一覧画面
- `/init/schools/edit` : 参加校編集画面
- `/init/timetable` : タイムテーブル一覧画面
- `/init/timetable/edit` : タイムテーブル編集画面
- `/init/teamGroups` : チームグループ一覧画面
- `/init/teamGroups/edit` : チームグループ編集画面
- `/init/rooms` : 部屋一覧画面
- `/init/rooms/edit` : 部屋編集画面
- `/init/teams` : チーム一覧画面
- `/init/teams/sections` : 部門別チーム一覧画面
- `/init/teams/sections/:sectionId/edit` : 部門別チーム編集画面
- `/init/teams/sections/edit` : 部門編集画面
- `/init/staffs` : スタッフ一覧画面
- `/init/staffs/edit` : スタッフ編集画面

#### 試合生成・ジャッジマッチング
- `/registerMatches` : 試合登録一覧・編集画面
- `/registerMatches/sections/:sectionId/edit` : 部門別チームマッチング画面
- `/registerMatches/import` : 試合TSVインポート画面
- `/matchJudgeMatching` : ジャッジマッチング画面
- `/matchJudgeMatchingResult` : ジャッジマッチング結果画面

#### 試合設定・調整 (Match Setting)
- `/matchSetting/room` : 試合部屋割り当て設定画面
- `/matchSetting/order` : 試合順設定画面
- `/matchSetting/parameters` : 試合パラメータ設定画面
- `/matchSetting/timetable` : 試合タイムテーブル割り当て設定画面
- `/matchSetting/tournament` : トーナメントウェイト設定画面
- `/matchSetting/rank` : 予選順位設定画面
- `/matchSetting/reverse` : 肯定側・否定側チーム反転設定画面

#### 試合結果管理 (Match Result)
- `/results` : 全体結果一覧画面
- `/results/pre` : 予選結果画面
- `/results/tournament` : 本選・トーナメント結果画面
- `/matchResultManage` : 試合結果管理一覧画面
- `/matchResultManage/:matchId/votingDetails` : ジャッジ投票詳細(勝敗・スコア)入力画面

#### パブリケーション・結果公開
- `/publications` : 結果公開管理画面
- `/publications/matchesPublicationState` : 試合ごとの公開状態管理画面
- `/publications/timetableWithResults` : 結果付きタイムテーブル生成・公開画面

## 7. セキュリティ・認証
- **管理者認証:** `users` テーブルに基づき、Spring Security を用いた認証・認可を実施。権限に応じたアクセス制御(`PermissionAuthority`)を行う。