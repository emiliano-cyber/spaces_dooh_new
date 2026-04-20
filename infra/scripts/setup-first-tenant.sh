#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Crea el primer tenant con datos de demo listos para presentar.
# Ejecutar desde la raíz del repositorio:
#   bash infra/scripts/setup-first-tenant.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ─── Datos del primer cliente ────────────────────────────────────────────────
SLUG="h3dm"
NOMBRE="H3DM Media"
OWNER_EMAIL="hm28443@gmail.com"
SCHEMA="tenant_${SLUG}"

echo ""
echo "┌─────────────────────────────────────────────────┐"
echo "│  Setup primer tenant — Spaces DOOH              │"
echo "│  Nombre : $NOMBRE"
echo "│  Slug   : $SLUG"
echo "│  Owner  : $OWNER_EMAIL"
echo "└─────────────────────────────────────────────────┘"
echo ""

# ─── 1. Crear tenant + roles + usuario owner ──────────────────────────────────
bash "$SCRIPT_DIR/new-tenant.sh" \
  --slug="$SLUG" \
  --nombre="$NOMBRE" \
  --owner-email="$OWNER_EMAIL"

# ─── 2. Cargar datos de demo ──────────────────────────────────────────────────
echo "→ Cargando datos de demo en schema $SCHEMA..."

# Load DATABASE_URL
if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -f "$REPO_ROOT/apps/api/.env" ]]; then
    export $(grep -E '^DATABASE_URL=' "$REPO_ROOT/apps/api/.env" | xargs)
  fi
fi

BASE_URL="${DATABASE_URL%%\?*}"

DATABASE_URL="${BASE_URL}?schema=${SCHEMA}" \
  npx ts-node "$REPO_ROOT/apps/api/prisma/seeds/seed-demo.ts"

echo ""
echo "┌─────────────────────────────────────────────────┐"
echo "│  ✓ Tenant listo para demo                       │"
echo "│  URL: http://$SLUG.localhost                    │"
echo "│  (o el dominio configurado en Apache)           │"
echo "└─────────────────────────────────────────────────┘"
echo ""
