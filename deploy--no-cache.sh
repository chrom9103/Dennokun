#!/bin/bash

# Dennokun デプロイスクリプト (キャッシュなしビルド版)
# 使用方法: ./deploy--no-cache.sh [version]
# 例: ./deploy--no-cache.sh v0.1.0
#
# 必要ファイル:
#   - infra/k8s/secrets/dennokun-app-secret.yaml (環境変数設定)
#
# TLS 証明書（Secret: dennokun-chrom-jp-tls）は cert-manager が自動で発行・更新します（chrom9103/k8s-certs）。

set -e

VERSION=${1:-v0.1.0}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

cd "$PROJECT_ROOT"

echo "=========================================="
echo "Deploying Dennokun (No Cache) - Version: $VERSION"
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
# TLS 証明書の Secret を確認（cert-manager が自動で発行・更新する。chrom9103/k8s-certs を参照）
TLS_SECRET=$(grep -m1 -E '^[[:space:]]*secretName:' infra/k8s/ingress.yaml | awk '{print $2}')
if ! microk8s kubectl get secret "$TLS_SECRET" > /dev/null 2>&1; then
  echo "❌ Error: TLS Secret $TLS_SECRET not found"
  echo "  Apply the cert-manager manifests first: kubectl apply -k ~/develops/certs"
  exit 1
fi
echo "  ✓ TLS Secret $TLS_SECRET found"

if [ ! -f infra/k8s/secrets/dennokun-app-secret.yaml ]; then
  echo "❌ Error: infra/k8s/secrets/dennokun-app-secret.yaml not found"
  echo "Please copy infra/k8s/secrets/dennokun-app-secret.yaml.example to that path and configure it."
  exit 1
fi
echo "✓ Configuration files checked successfully"

# 1. Docker イメージをビルド (キャッシュなし)
echo ""
echo "[1/6] Building Docker images (No Cache)..."
echo "  - Building frontend with NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL..."
docker build --no-cache -t dennokun-frontend:$VERSION -t dennokun-frontend:latest \
  -f infra/Dockerfile.frontend \
  --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
  .

echo "  - Building backend..."
docker build --no-cache -t dennokun-backend:$VERSION -t dennokun-backend:latest -f infra/Dockerfile.backend .

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

# 4. マニフェストを検証（クラスタを変更する前に kustomize / API のエラーを検出）
echo ""
echo "[4/6] Validating Kubernetes manifests (server-side dry-run)..."
microk8s kubectl apply -k infra/k8s/ --dry-run=server > /dev/null
echo "  ✓ Manifests are valid"

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
TLS_SECRET=$(microk8s kubectl get ingress dennokun-ingress -o jsonpath='{.spec.tls[0].secretName}' 2>/dev/null || echo "")
if [ -z "$TLS_SECRET" ]; then
  echo "⚠ Warning: TLS Secret for dennokun-ingress not found"
else
  echo "✓ TLS Secret verified: $TLS_SECRET"
  CERT_SUBJECT=$(microk8s kubectl get secret "$TLS_SECRET" -o jsonpath='{.data.tls\.crt}' 2>/dev/null | base64 -d | openssl x509 -noout -subject -enddate 2>/dev/null || echo "N/A")
  echo "  Certificate: $CERT_SUBJECT"
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
