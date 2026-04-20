#!/usr/bin/env bash
set -euo pipefail

# ─── Usage ────────────────────────────────────────────────────────────────────
# ./infra/scripts/migrate-all-tenants.sh
# ./infra/scripts/migrate-all-tenants.sh --dry-run

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

DRY_RUN=false
for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=true ;;
    *) echo "Argumento desconocido: $arg"; exit 1 ;;
  esac
done

# ─── Load DATABASE_URL ────────────────────────────────────────────────────────
if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -f "$REPO_ROOT/apps/api/.env" ]]; then
    export $(grep -E '^DATABASE_URL=' "$REPO_ROOT/apps/api/.env" | xargs)
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL no está definida"
  exit 1
fi

BASE_URL="${DATABASE_URL%%\?*}"

# ─── Fetch active tenant schemas ──────────────────────────────────────────────
echo ""
echo "Obteniendo schemas activos..."
SCHEMAS=$(psql "$DATABASE_URL" -t -A -c \
  "SELECT \"dbSchema\" FROM public.\"Tenant\" WHERE activo = true ORDER BY \"creadoEn\";" 2>&1)

if [[ -z "$SCHEMAS" ]]; then
  echo "No se encontraron tenants activos."
  exit 0
fi

TOTAL=$(echo "$SCHEMAS" | wc -l | tr -d ' ')
SUCCESS=0
FAILED=0

echo "Tenants encontrados: $TOTAL"
[[ "$DRY_RUN" == "true" ]] && echo "(modo --dry-run: no se ejecutarán cambios)"
echo ""

# ─── Migrate each schema ──────────────────────────────────────────────────────
while IFS= read -r schema; do
  [[ -z "$schema" ]] && continue

  echo "Migrando schema: $schema..."

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  [dry-run] DATABASE_URL=${BASE_URL}?schema=${schema} prisma migrate deploy"
    ((SUCCESS++)) || true
    continue
  fi

  set +e
  OUTPUT=$(DATABASE_URL="${BASE_URL}?schema=${schema}" \
    npx prisma migrate deploy \
      --schema="$REPO_ROOT/apps/api/prisma/schema.prisma" 2>&1)
  EXIT_CODE=$?
  set -e

  if [[ $EXIT_CODE -eq 0 ]]; then
    echo "  ✓ $schema migrado"
    ((SUCCESS++)) || true
  else
    echo "  ✗ $schema falló: $(echo "$OUTPUT" | tail -3)"
    ((FAILED++)) || true
  fi

done <<< "$SCHEMAS"

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────────────────"
echo "Migración completa: ${SUCCESS}/${TOTAL} schemas exitosos"
[[ $FAILED -gt 0 ]] && echo "Fallos: $FAILED" && exit 1
echo ""
