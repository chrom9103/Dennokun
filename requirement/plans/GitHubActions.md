# sync-main-to-submains

## main からサブメインブランチへ同期する GitHub Actions ワークフロー

## 目的
`main` に新しい変更が入ったとき、`ctrl`、`algo`、`infra` の各サブメインブランチに対して、最新の `main` を取り込むための PR を自動作成する。

自動マージは行わず、コンフリクト解消は人間が手動で行う。

## 対象ブランチ
- `main` を起点に監視する
- PR の作成先は `ctrl`、`algo`、`infra`

## ワークフローの動作
1. `main` への push を検知する
2. `ctrl`、`algo`、`infra` の 3 ブランチを並列で処理する
3. 各ブランチに対して、`base` をサブメイン、`head` を `main` とする PR を GitHub API で作成する
4. すでに同じ内容の PR がある場合は作成を重複させない

## 実装ファイル
- [.github/workflows/sync-main-to-submains.yml](../../.github/workflows/sync-main-to-submains.yml)

## この方式を採用する理由
- ブランチ保護ルールと相性がよい
- コンフリクトがあっても PR 自体は作成できる
- 手動レビューや手動解消の運用にそのまま乗せられる
- `main` の更新を各チームへ漏れなく伝えやすい

## 補足
この仕組みは「自動マージ」ではなく「自動 PR 作成」である。
そのため、CI は変更の取り込みを補助し、最終判断は人間が行う。
