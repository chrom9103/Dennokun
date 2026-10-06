# TLS 証明書の更新手順

`dennokun.chrom.jp` の SSL 証明書を更新するときの手順です。

`kustomization.yaml` の `secretGenerator` が、このディレクトリの `tls.crt` と `tls.key` から TLS Secret（`dennokun-secret-<hash>`）を作ります。Ingress はその Secret を参照します。

## tls.crt と tls.key に入れるもの

| ファイル | 中身 | 作り方 |
| --- | --- | --- |
| `tls.crt` | **サーバー証明書 + 中間証明書**（フルチェーン） | 2つのファイルを `cat` でつなげる |
| `tls.key` | **秘密鍵** | 受け取ったファイルをそのままコピー |

### tls.crt の中身（上から順に）

```
-----BEGIN CERTIFICATE-----   ← ① サーバー証明書 (CN = dennokun.chrom.jp)
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----   ← ② 中間証明書 (例: Let's Encrypt YR1)
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----   ← ③ 中間証明書 (例: ISRG Root YR)
-----END CERTIFICATE-----
```

- 必ず**サーバー証明書を先頭**にしてください。順番が逆だと正しく配信されません。
- 中間証明書を入れないと、一部のブラウザや端末（特に Android や curl）で証明書エラーになります。
- `deploy.sh` は、`tls.crt` に証明書が2枚以上入っているかを**確認するだけ**です。中間証明書の連結はしてくれません。

### 受け取るファイルの例

| 受け取ったファイル | 中身 | 使い道 |
| --- | --- | --- |
| `letsencryptXXXXXXXX.crt` | サーバー証明書 | `tls.crt` の先頭 |
| `letsencryptXXXXXXXXInt.crt` | 中間証明書（複数枚入り） | `tls.crt` の後ろにつなげる |
| `letsencryptXXXXXXXX.key` | 秘密鍵 | `tls.key` |

## 更新手順

`infra/k8s/secrets/` で作業します。`XXXXXXXX` は受け取ったファイルの番号に置き換えてください。

### 1. 旧ファイルをバックアップ

```bash
cd infra/k8s/secrets
cp -p tls.crt tls.crt.bak-$(date +%Y%m%d)
cp -p tls.key tls.key.bak-$(date +%Y%m%d)
```

### 2. tls.crt と tls.key を作成

```bash
cat letsencryptXXXXXXXX.crt letsencryptXXXXXXXXInt.crt > tls.crt
cp letsencryptXXXXXXXX.key tls.key
```

> サーバー証明書ファイルの末尾に改行がないと、`-----END CERTIFICATE----------BEGIN CERTIFICATE-----` のように行がつながって壊れます。手順3の確認で検出できます。

### 3. 中身を確認

```bash
# 証明書の枚数（3 前後になるはず）
grep -c "BEGIN CERTIFICATE" tls.crt

# 先頭がサーバー証明書か・有効期限
openssl x509 -in tls.crt -noout -subject -issuer -dates

# 証明書と秘密鍵がペアか（2行のハッシュが一致すれば OK）
openssl x509 -in tls.crt -noout -pubkey | sha256sum
openssl pkey -in tls.key -pubout | sha256sum

# 中間証明書を使ってチェーンが検証できるか（"OK" が出れば OK）
openssl verify -untrusted letsencryptXXXXXXXXInt.crt letsencryptXXXXXXXX.crt
```

### 4. クラスタに反映

どちらか一方を実行します。

**証明書だけ更新したい場合**（イメージのビルドや Pod の再起動は行いません）

```bash
cd infra/k8s
kubectl diff -k .    # 差分が TLS Secret と Ingress の secretName だけか確認
kubectl apply -k .
```

**アプリも一緒にデプロイする場合**

```bash
./deploy.sh
```

> 証明書の内容が変わると、kustomize が新しい名前の Secret を作成し、Ingress の参照先も自動で切り替えます。旧 Secret を事前に削除する必要はありません。

### 5. 配信されている証明書を確認

```bash
echo | openssl s_client -connect 127.0.0.1:443 -servername dennokun.chrom.jp -showcerts 2>/dev/null \
  | grep -E "^ *[0-9] s:|Verify return"
echo | openssl s_client -connect 127.0.0.1:443 -servername dennokun.chrom.jp 2>/dev/null \
  | openssl x509 -noout -enddate
```

`0 s:CN = dennokun.chrom.jp` に続いて中間証明書（`1 s:` 以降）が表示され、`Verify return code: 0 (ok)` と新しい有効期限が出れば完了です。

### 6. 後片付け（任意）

反映後も旧 Secret はクラスタに残ります。Ingress から参照されていないことを確認してから削除してください。

```bash
kubectl get ingress dennokun-ingress -o jsonpath='{.spec.tls[0].secretName}'   # 使用中の Secret
kubectl get secret | grep dennokun-secret
kubectl delete secret dennokun-secret-<旧ハッシュ>
```

## 注意

- このディレクトリは `.gitignore` で `*` が除外されています。証明書や秘密鍵は Git に入りません。
- 秘密鍵（`*.key`）を Slack やチャットなどに貼らないでください。
