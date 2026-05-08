# ログインページ 要件

## 概要
- ユーザーがシステムにログインするための画面。成功後はダッシュボードへ遷移する。

## 必要項目
- ユーザー名（必須）
- パスワード（必須）
- ログイン失敗時のエラーメッセージ（理由表示）
- セッション継続（Remember me）オプション

## 振る舞い
- 認証に成功したら `/dashboard` に遷移する。
- 認証失敗時は適切なエラーメッセージを表示し、試行回数に応じたロックまたは警告を検討する。
- バックエンドでOAuth2やJWTなどのトークンベース認証を使用する
  参考: https://fastapi.tiangolo.com/ja/tutorial/security/oauth2-jwt/
- パーミッションに応じて表示されるメニュー項目を変える（R/W 権限など）。

## バリデーション
- 入力必須チェック。
- パスワードはサーバー側でハッシュ照合を行う。

## 関連DB
- `users`（`id`, `name`, `passwordHash`, `email`, `permissions`）

## セキュリティ要件
- パスワードはクライアント側で平文送信されないように注意（TLS 前提）。
- ログイン試行のレート制限・監査ログの保存を検討する。

---

## 実装仕様（今回の実装）

### 概要
- フロントエンド（Next.js）からバックエンド（FastAPI）への JWT ベース認証を実装しました。
- 成功すると JWT は `httpOnly` Cookie に保存され、フロントは `/dashboard` に遷移します。

### 採用理由
- JWT はステートレスであり、API 呼び出しごとに Authorization ヘッダで送るためサーバ側のセッション管理が不要でスケーラブル。
- `bcrypt` を直接使用してパスワードをハッシュ化することで、`passlib` 由来のバージョン依存問題を回避。
- 開発時は `.env` にシードユーザーを置くことで SQL を git に載せず安全に初期ユーザーを作成できる運用にした。

### アーキテクチャ（高レベル）
- フロント: Next.js (App Router, TypeScript)
  - `frontend/src/components/LoginForm.tsx`：入力フォーム、Remember me オプション、API 呼び出し、リダイレクト
  - `frontend/src/lib/auth.ts`：`login()`、`logout()`、`authenticatedFetch()`、`getCsrfToken()` 等のユーティリティ
- バックエンド: FastAPI (Python 3.11)
  - `backend/app/routers/auth.py`：`POST /auth/login`、`POST /auth/logout`、`GET /auth/me` エンドポイント
  - `backend/app/core/security.py`：`get_password_hash(password)`、`verify_password(plain, hashed)`、`create_access_token(data, expires_delta)`、`decode_access_token(token)`、`set_auth_cookies()`、`require_csrf_token()`
  - `backend/app/core/init_db.py`：起動時に `.env` から `SEED_USERNAME/SEED_PASSWORD/SEED_EMAIL` を読み取り、DB にユーザーを挿入（リトライ付き）
  - DB：Postgres（Docker）に DDL を配置し、アプリ起動時に必要であればシード処理を実行

### 認証フロー（シーケンス）
1. ユーザーがフォームでユーザー名とパスワードを入力し、`Remember me` を選択するかを指定して送信。
2. フロントは `POST ${NEXT_PUBLIC_API_URL}/auth/login` に JSON で送信。
   - 例リクエストボディ: `{ "username": "dev-test", "password": "qwerty", "remember_me": false }`
3. バックエンドはユーザーを検索し、`verify_password()` で bcrypt ハッシュを検証。
4. 認証成功なら `create_access_token()` で JWT（HS256）を発行し、`httpOnly` Cookie と CSRF Cookie をセットして `{ message, token_type: "bearer", expires_in }` を返す。
   - デフォルト有効期限: 1 時間、Remember me の場合: 24 時間
5. フロントはトークンを保存せず、以降のリクエストは `credentials: "include"` で Cookie を送る。
6. 状態変更系リクエストでは `X-CSRF-Token` ヘッダに Cookie の CSRF 値を設定し、バックエンドで二重送信一致を確認する。

### 主要なコード構成（要点）
- `backend/app/core/security.py`
  - `def get_password_hash(password: str) -> str`：`bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode()` を返す
  - `def verify_password(plain: str, hashed: str) -> bool`：`bcrypt.checkpw(plain_bytes, hashed_bytes)` を使って検証
  - `def create_access_token(data: dict, expires_delta: Optional[timedelta]) -> str`：`jose.jwt.encode(payload, SECRET_KEY, algorithm="HS256")`
  - `def decode_access_token(token: str) -> dict`：`jose.jwt.decode(...)` でデコード・検証

- `backend/app/routers/auth.py`（抜粋）
  - ルート `POST /auth/login` は受け取った username/password を検証し、失敗時は汎用エラーメッセージ（セキュリティのため）を返す
  - 成功時に Cookie を設定して JSON を返す
  - `POST /auth/logout` は CSRF 検証後に Cookie を削除する
  - `GET /auth/me` は Cookie 内の JWT を検証して現在のユーザー情報を返す

- `backend/app/core/init_db.py`
  - 起動時に `seed_database()` を呼び、`asyncpg` で DB 接続を試行（最大 5 回再試行）
  - `SEED_*` が未設定ならシードユーザー作成をスキップする
  - JSONB カラムへは `json.dumps()` で文字列を渡す（asyncpg の型要件に合わせるため）

- `frontend/src/lib/auth.ts`（抜粋）
  - `getApiBaseUrl()` は `NEXT_PUBLIC_API_URL` の必須チェックを行う
  - `async function login({ username, password, remember_me })` は `credentials: "include"` 付きで `fetch()` を実行する
  - `async function logout()` は CSRF ヘッダ付きで `POST /auth/logout` を呼ぶ

### 依存ライブラリ
- Backend
  - `fastapi`, `uvicorn`, `asyncpg`, `python-jose[cryptography]`, `bcrypt`
- Frontend
  - `next`, `react`, `typescript`（プロジェクト既存構成）

### セキュリティ上の考慮点
- パスワードは常にハッシュで保存（bcrypt）。bcrypt は最大 72 バイトの制約があるため、必要ならサーバ側で切り捨て方針を決定する。
- エラーメッセージは詮索を防ぐために一般化（例: 「ユーザー名またはパスワードが正しくありません」）しているが、要件により詳細なメッセージに変更可能。
- トークンは `httpOnly` Cookie に保存するため、XSS での直接参照は抑制できるが、CSP と入力サニタイズは引き続き必須。
- 本番環境では `SECRET_KEY` を安全に管理（Vault / 環境変数管理）し、TLS を必須にする。

### テスト手順（開発者向け）
1. 開発用コンテナを起動:
```bash
docker compose up -d --build
```
2. シード確認:
```bash
docker compose exec -T postgres psql -U denno -d dennodb -c "SELECT id, name, email FROM users;"
```
3. API ログインテスト（PowerShell 例）:
```powershell
$body = @{username='dev-test';password='qwerty';remember_me=$false} | ConvertTo-Json
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
(Invoke-WebRequest -Uri 'http://localhost:8001/auth/login' -Method Post -Headers @{'Content-Type'='application/json'} -Body $body -WebSession $session -UseBasicParsing).Content
$session.Cookies.GetCookies('http://localhost:8001') | Select-Object Name, Value, Secure, HttpOnly
```
4. フロントをブラウザで開き、ログインを実行。Network タブで `credentials: include` のリクエストになり、Cookie がセットされることを確認。

### 拡張 / 改善案
- Refresh トークンの導入（短期アクセストークン + 長期リフレッシュトークン）
- ログイン試行のレート制限とアカウントロック機構
- セッション管理をサーバ側で行う場合は Redis 等の導入を検討
- フロントでのトークン格納を `httpOnly` cookie に変更済み。今後は refresh token と再認証 UX の改善を検討する。

### 運用方針メモ
- 環境変数は必須扱いとし、アプリ側の既定値には依存しない。
- 開発環境は HTTP を許容しつつ、Cookie は `httpOnly` を必須、`Secure` は環境変数で切り替える。
- 本番環境は HTTPS 前提とし、`Secure` Cookie と CSRF 対策を必須にする。
- Cookie ベース認証へ移行する場合は、JWT を `httpOnly` Cookie に格納し、状態変更系リクエストに CSRF トークン検証を必須化する。

### レート制限要件（整理案）
- ログイン失敗回数は IP 単位とアカウント単位で別々に記録する。
- 一定回数を超えた場合は一時的に拒否し、再試行可能になるまでの待機時間を設ける。
- 成功時は失敗回数をリセットする。
- 監査ログには、ユーザー名、IP、成功/失敗、拒否理由、時刻を残す。
- 制限は固定窓よりもスライディング窓または指数バックオフを優先する。
- 実装基盤は Redis などの共有ストアを推奨し、複数インスタンスでも整合性を保つ。

---

この実装は要件ファイル上の項目（必須入力、Remember me、JWT ベース認証、パスワードのハッシュ照合）を満たしています。追加でドキュメント化して欲しい箇所があれば教えてください。

