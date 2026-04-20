#!/usr/bin/env bash
set -euo pipefail

# ─── Usage ────────────────────────────────────────────────────────────────────
# ./infra/scripts/new-tenant.sh \
#   --slug=westmedia \
#   --nombre="West Media" \
#   --owner-email=owner@westmedia.com

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ─── Parse arguments ──────────────────────────────────────────────────────────
slug=""
nombre=""
owner_email=""

for arg in "$@"; do
  case $arg in
    --slug=*)       slug="${arg#*=}" ;;
    --nombre=*)     nombre="${arg#*=}" ;;
    --owner-email=*) owner_email="${arg#*=}" ;;
    *) echo "Argumento desconocido: $arg"; exit 1 ;;
  esac
done

# ─── Validate required args ───────────────────────────────────────────────────
if [[ -z "$slug" || -z "$nombre" || -z "$owner_email" ]]; then
  echo "Error: se requieren --slug, --nombre y --owner-email"
  echo ""
  echo "Uso:"
  echo "  ./infra/scripts/new-tenant.sh \\"
  echo "    --slug=westmedia \\"
  echo "    --nombre=\"West Media\" \\"
  echo "    --owner-email=owner@westmedia.com"
  exit 1
fi

# Sanitize slug: lowercase, only alphanumeric and hyphens
slug=$(echo "$slug" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')
schema="tenant_${slug}"

# ─── Load DATABASE_URL ────────────────────────────────────────────────────────
if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -f "$REPO_ROOT/.env" ]]; then
    export $(grep -E '^DATABASE_URL=' "$REPO_ROOT/.env" | xargs)
  fi
  if [[ -f "$REPO_ROOT/apps/api/.env" ]]; then
    export $(grep -E '^DATABASE_URL=' "$REPO_ROOT/apps/api/.env" | xargs)
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL no está definida en el entorno ni en .env"
  exit 1
fi

# Strip any existing ?schema= param to get the base URL
BASE_URL="${DATABASE_URL%%\?*}"

echo ""
echo "┌─────────────────────────────────────────────────┐"
echo "│  Nuevo Tenant: $nombre"
echo "│  Schema:       $schema"
echo "│  Owner:        $owner_email"
echo "└─────────────────────────────────────────────────┘"
echo ""

# ─── Step 1: Create PostgreSQL schema ─────────────────────────────────────────
echo "→ Creando schema PostgreSQL: $schema..."
psql "$DATABASE_URL" -c "CREATE SCHEMA IF NOT EXISTS \"$schema\";" 2>&1
echo "  ✓ Schema listo"

# ─── Step 2: Run Prisma migrations on the new schema ──────────────────────────
echo "→ Aplicando migraciones en $schema..."
DATABASE_URL="${BASE_URL}?schema=${schema}" \
  npx prisma migrate deploy \
    --schema="$REPO_ROOT/apps/api/prisma/schema.prisma" 2>&1
echo "  ✓ Migraciones aplicadas"

# ─── Step 3: Seed the tenant (builtin roles + owner user) ─────────────────────
echo "→ Creando roles y usuario owner..."
SEED_OUTPUT=$(DATABASE_URL="${BASE_URL}?schema=${schema}" \
  npx ts-node "$REPO_ROOT/apps/api/prisma/seeds/seed-tenant.ts" \
    --schema="$schema" \
    --nombre="$nombre" \
    --ownerEmail="$owner_email" 2>&1)
echo "$SEED_OUTPUT" | sed 's/^/  /'

# Extract temp password from seed output
temp_password=$(echo "$SEED_OUTPUT" | grep -oP '(?<=Contraseña temporal: )\S+' || echo "(ver output del seed)")

# ─── Step 4: Insert Tenant record in public schema ────────────────────────────
echo "→ Registrando tenant en schema público..."
psql "$DATABASE_URL" -c "
  INSERT INTO public.\"Tenant\" (\"subdominioBase\", \"nombre\", \"dbSchema\", \"plan\", \"activo\")
  VALUES ('$slug', '$nombre', '$schema', 'starter', true)
  ON CONFLICT (\"subdominioBase\") DO NOTHING;
" 2>&1
echo "  ✓ Tenant registrado"

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "┌─────────────────────────────────────────────────┐"
echo "│  ✓ Schema creado:        $schema"
echo "│  ✓ Migraciones aplicadas"
echo "│  ✓ 9 roles builtin creados"
echo "│  ✓ Usuario owner:        $owner_email"
echo "│  ✓ Contraseña temporal:  $temp_password"
echo "│  ✓ URL de acceso:        https://admin.$slug.spaces.com"
echo "└─────────────────────────────────────────────────┘"
echo ""
