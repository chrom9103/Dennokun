# レポート / 予選順位（Standings） 要件

## 概要
- セクション別の予選順位・集計を表示する画面。勝敗・投票数・得点・マナー等を集計して表示する。

## 表示項目
- チーム別順位、勝数、投票数、得点、マナー点
- 同順位時の補足メモ（直接対決等）

## 集計ルール
- 優先順位: 勝数 → 投票数 → 得点
- 直接対決は補助ルールとして表示する（必要に応じて適用）

## データ参照
- `event_matches`, `event_match_voting_details`, `event_sections`, `event_teams`

## 備考
- 表示用の `EventSectionResult` / `EventTeamResult` は DB に保持せず、動的集計で生成する。

