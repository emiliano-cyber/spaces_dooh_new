#!/usr/bin/env bash
# ─── deploy.sh ────────────────────────────────────────────────────────────────
# Manual deploy script. Normally CI/CD (GitHub Actions) handles this;
# use this script for hotfixes or environments without CI access.
#
# Usage:
#   ./infra/scripts/deploy.sh [--skip-build]
#
# Required env vars (set in .env or export before running):
#   DROPLET_IP        – DigitalOcean droplet IP
#   SSH_PRIVATE_KEY   – path to SSH private key (default: ~/.ssh/id_rsa)
#
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ── Config ────────────────────────────────────────────────────────────────────
DROPLET_IP="${DROPLET_IP:-}"
SSH_KEY="${SSH_PRIVATE_KEY:-$HOME/.ssh/id_rsa}"
REMOTE_DIR="/var/www/Marketplace/spaces-dooh"
SKIP_BUILD=false

for arg in "$@"; do
  case $arg in
    --skip-build) SKIP_BUILD=true ;;
    *) echo "Argumento desconocido: $arg"; exit 1 ;;
  esac
done

if [[ -z "$DROPLET_IP" ]]; then
  echo "ERROR: DROPLET_IP no está configurado."
  exit 1
fi

echo "=== Deploy → $DROPLET_IP ==="
echo ""

# ── Optional local build verification ────────────────────────────────────────
if [[ "$SKIP_BUILD" == "false" ]]; then
  echo "→ Verificando types localmente..."
  cd "$REPO_ROOT"
  npx turbo check-types
  echo "  ✓ Types ok"
fi

# ── SSH deploy commands ───────────────────────────────────────────────────────
ssh -i "$SSH_KEY" \
    -o StrictHostKeyChecking=no \
    -o ConnectTimeout=30 \
    "root@$DROPLET_IP" \
    "set -e
     echo '→ Pulling latest...'
     cd $REMOTE_DIR
     git pull origin main

     echo '→ Installing dependencies...'
     npm ci --prefer-offline

     echo '→ Building...'
     npx turbo check-types
     npx turbo build

     echo '→ Running migrations...'
     cd apps/api
     npx prisma migrate deploy

     echo '→ Reloading PM2...'
     cd $REMOTE_DIR
     pm2 reload ecosystem.config.js --update-env

     echo '→ Done!'
     pm2 list"

echo ""
echo "=== Deploy completado ==="
