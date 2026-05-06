# 試合編集 要件

## 概要
- 個別試合の詳細編集・結果入力画面。判定者ごとの投票詳細も管理する。

## 必要項目（表示/編集）
- 試合基本情報（時間枠、会場、セクション）
- 肯定/否定チーム
- 判定者割当（主審/副審 等）
- 判定者ごとの投票詳細（`event_match_voting_details`）
- 各種スコア（立論、質問、答弁、再反論、マナー 等）
- 勝敗、集計値（合計得点・投票数）
- 結果公開フラグ（`isResultPublic`）

## 操作
- 判定者ごとの入力・保存
- 結果確定ボタン（`isResultConfirmed` を立てる）
- 確定時に集計値を再計算して `event_matches` に反映

## バリデーション
- 投票詳細の整合性チェック（必須フィールド・数値範囲）
- 結果確定後の再編集ルールを画面で明示

## 関連DB
- `event_matches`, `event_match_voting_details`, `event_staffs`, `event_teams`, `event_rooms`, `event_timetable_segments`

## 備考
- 1試合に複数の `event_match_voting_details` が紐づき、集計ロジックはフロント/バックいずれかで行う。

