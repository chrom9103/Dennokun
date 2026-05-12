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

---

# restrict-main-merges

## main へのマージ元をサブメインブランチに制限する GitHub Actions ワークフロー

## 目的
`main` 宛の PR について、作成元ブランチを `ctrl`、`algo`、`infra` の 3 つに限定する。

これにより、個人の作業ブランチや他の派生ブランチから直接 `main` にマージされることを防ぐ。

## 対象ブランチ
- `main` 宛の pull request
- 許可する source branch は `ctrl`、`algo`、`infra`

## ワークフローの動作
1. `main` 宛の PR を検知する
2. `github.event.pull_request.head.ref` から source branch 名を取得する
3. source branch が `ctrl`、`algo`、`infra` のいずれかであれば成功する
4. それ以外の場合は失敗し、`main` にマージできないようにする

## 実装ファイル
- [/.github/workflows/restrict-main-merges.yml](../../.github/workflows/restrict-main-merges.yml)

## 必要な追加設定
このワークフローだけでは制限は完結しないため、GitHub 側の保護設定と組み合わせる。

- `main` ブランチの direct push を禁止する
- `main` へのマージを PR 必須にする
- この workflow を required status check にする
- 可能なら ruleset か branch protection で bypass を無効化する

## 採用技術
- GitHub Actions の `pull_request` トリガー
- `github.event.pull_request.head.ref` による source branch 判定
- Branch protection / Rulesets によるマージ制御

## 補足
GitHub Actions 単体では「絶対にマージできない」状態までは作れない。
実際の強制力は GitHub の保護ルール側にあり、Actions はその判定用チェックとして機能する。
