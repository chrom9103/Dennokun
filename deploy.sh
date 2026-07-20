#!/bin/bash

# Dennokun デプロイスクリプト
# 使用方法: ./deploy.sh [version]
# 例: ./deploy.sh v0.1.0
#
# 必要ファイル:
#   - infra/k8s/secrets/dennokun-app-secret.yaml (環境変数設定)
#   - infra/k8s/secrets/tls.crt (SSL証明書)
#   - infra/k8s/secrets/tls.key (SSL秘密鍵)

set -e

VERSION=${1:-v0.1.0}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

cd "$PROJECT_ROOT"

echo "=========================================="
echo "Deploying Dennokun - Version: $VERSION"
echo "=========================================="

# .env ファイルから環境変数を読み込む
if [ -f .env ]; then
  echo "Loading environment variables from .env..."
  export $(grep -v '^#' .env | xargs)
elif [ -f frontend/.env ]; then
  echo "Loading environment variables from frontend/.env..."
  export $(grep -v '^#' frontend/.env | xargs)
else
  echo "⚠ Warning: .env file not found"
fi

# Frontend ビルドに必要な環境変数の初期値設定 (未定義の場合)
NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-"https://dennokun.chrom.jp"}

# 設定ファイルの存在を確認
echo ""
echo "Checking required configuration files..."
if [ ! -f infra/k8s/secrets/tls.crt ] || [ ! -f infra/k8s/secrets/tls.key ]; then
  echo "❌ Error: infra/k8s/secrets/tls.crt or infra/k8s/secrets/tls.key not found"
  exit 1
fi

# tls.crt がフルチェーン（サーバー証明書＋中間CA）を含んでいるか確認
CERT_COUNT=$(grep -c "BEGIN CERTIFICATE" infra/k8s/secrets/tls.crt 2>/dev/null || echo 0)
if [ "$CERT_COUNT" -lt 2 ]; then
  echo "❌ Error: infra/k8s/secrets/tls.crt contains only $CERT_COUNT certificate(s)."
  echo "  tls.crt must be a full-chain certificate (server cert + intermediate CA certs)."
  echo "  Example (Let's Encrypt):"
  echo "    cat your-cert.pem intermediate.pem > infra/k8s/secrets/tls.crt"
  exit 1
fi
echo "  ✓ tls.crt contains $CERT_COUNT certificates (full chain)"

if [ ! -f infra/k8s/secrets/dennokun-app-secret.yaml ]; then
  echo "❌ Error: infra/k8s/secrets/dennokun-app-secret.yaml not found"
  echo "Please copy infra/k8s/secrets/dennokun-app-secret.yaml.example to that path and configure it."
  exit 1
fi
echo "✓ Configuration files checked successfully"

# 1. Docker イメージをビルド
echo ""
echo "[1/6] Building Docker images..."
echo "  - Building frontend with NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL..."
docker build -t dennokun-frontend:$VERSION -t dennokun-frontend:latest \
  -f infra/Dockerfile.frontend \
  --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
  .

echo "  - Building backend..."
docker build -t dennokun-backend:$VERSION -t dennokun-backend:latest -f infra/Dockerfile.backend .

# 2. ディスク容量チェック
echo ""
echo "[2/6] Checking disk space..."
AVAILABLE_SPACE=$(df /var/lib/docker 2>/dev/null | awk 'NR==2 {print $4}')
if [ -z "$AVAILABLE_SPACE" ]; then
  AVAILABLE_SPACE=$(df / 2>/dev/null | awk 'NR==2 {print $4}')
fi
REQUIRED_SPACE=$((3 * 1024 * 1024))  # 3GB in KB

if [ -n "$AVAILABLE_SPACE" ] && [ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]; then
  echo "⚠ Warning: Low disk space available ($(($AVAILABLE_SPACE / 1024 / 1024))GB)"
  echo "  Cleaning up old Docker resources..."
  docker image prune -af --filter "until=72h" 2>/dev/null || true
  docker container prune -f 2>/dev/null || true
fi

# 3. MicroK8s にイメージをインポート（パイプで直接ロード）
echo ""
echo "[3/6] Importing images to MicroK8s..."
echo "  - Loading frontend image..."
docker save dennokun-frontend:$VERSION dennokun-frontend:latest | microk8s ctr images import -

echo "  - Loading backend image..."
docker save dennokun-backend:$VERSION dennokun-backend:latest | microk8s ctr images import -

# 4. TLS Secret を確認・再作成
echo ""
echo "[4/6] Ensuring TLS Secret is properly configured..."

# 既存の Secret を削除（古いハッシュ付きの Secret も削除）
echo "  - Cleaning up old TLS Secrets..."
microk8s kubectl get secrets -o name 2>/dev/null | grep "secret/dennokun-secret" | xargs microk8s kubectl delete 2>/dev/null || true

# Secret が確実に削除されるまで待つ
sleep 2

echo "  ✓ TLS Secret cleanup complete"

# 5. Kubernetes にデプロイ
echo ""
echo "[5/6] Deploying to Kubernetes..."
microk8s kubectl apply -k infra/k8s/

# 6. Pod の再起動と確認
echo ""
echo "[6/6] Restarting deployments..."
for deployment in dennokun-backend-deployment dennokun-frontend-deployment; do
  echo "  - Restarting $deployment..."
  microk8s kubectl rollout restart deployment/$deployment
done

# Ingress コントローラーを再起動して新しい Secret をロード
echo "  - Restarting Ingress controller..."
microk8s kubectl rollout restart deployment -n ingress -l app.kubernetes.io/name=nginx-ingress 2>/dev/null || true

echo ""
echo "Waiting for rollouts to complete..."
for deployment in dennokun-backend-deployment dennokun-frontend-deployment; do
  microk8s kubectl rollout status deployment/$deployment --timeout=5m || {
    echo "⚠ Timeout waiting for $deployment"
  }
done

# TLS Secret が正しく作成されたか確認
echo ""
echo "Verifying TLS Secret..."
sleep 3
TLS_SECRET=$(microk8s kubectl get secrets -o jsonpath='{.items[*].metadata.name}' 2>/dev/null | tr ' ' '\n' | grep '^dennokun-secret' | head -n 1 || echo "")
if [ -z "$TLS_SECRET" ]; then
  echo "⚠ Warning: TLS Secret dennokun-secret-* not found. Checking infra/k8s/secrets files..."
  ls -lh infra/k8s/secrets/tls.*
else
  echo "✓ TLS Secret verified: $TLS_SECRET"
  CERT_SUBJECT=$(microk8s kubectl get secret "$TLS_SECRET" -o jsonpath='{.data.tls\.crt}' 2>/dev/null | base64 -d | openssl x509 -noout -subject 2>/dev/null || echo "N/A")
  echo "  Certificate Subject: $CERT_SUBJECT"
fi

echo ""
echo "=========================================="
echo "✅ Deployment completed successfully!"
echo "=========================================="
echo ""
echo "Deployed images (Version: $VERSION):"
echo "  - dennokun-frontend:$VERSION"
echo "  - dennokun-backend:$VERSION"
echo ""
echo "Next steps:"
echo "  1. Check deployment status:"
echo "     microk8s kubectl get pods"
echo "     microk8s kubectl get services"
echo ""
echo "  2. Verify TLS configuration:"
echo "     microk8s kubectl get ingress dennokun-ingress -o wide"
echo ""
echo "  3. View deployment logs:"
echo "     microk8s kubectl logs -f deployment/dennokun-frontend-deployment"
echo "     microk8s kubectl logs -f deployment/dennokun-backend-deployment"
echo ""
echo "Access the application: https://dennokun.chrom.jp"
echo "=========================================="

