#!/usr/bin/env bash
# ============================================================================
#  Un SEGUNDO Space Eye local (el "nuevo"), para ensayar mudanzas de equipos.
# ----------------------------------------------------------------------------
#  Para no gastar memoria no es otra pila completa: es otro contenedor de la
#  API sobre el MISMO MySQL y Redis del ensayo de la instancia, con su propia
#  base (space_eye_b) y su propio indice de Redis. Escucha en 127.0.0.1:4300 y
#  se anuncia como http://host.docker.internal:4300 (asi lo ve la Pi simulada).
#
#  Correr en WSL:  bash servidor-b.sh            (crear o recrear)
#                  bash servidor-b.sh --borrar   (quitarlo)
# ============================================================================
set -euo pipefail
H=$HOME/hijo; E=$H/etc/eyes.env
IMAGEN="$(sed -n 's/^EYES_IMAGEN=//p' "$E")"
CL="$(sed -n 's/^DB_PASSWORD=//p' "$E")"
RED=space-eyes_default
docker rm -f eyes-b >/dev/null 2>&1 || true
[ "${1:-}" = --borrar ] && { echo "servidor B quitado"; exit 0; }

docker exec space-eyes-mysql-1 mysql -h127.0.0.1 -uroot -p"$CL" -e "CREATE DATABASE IF NOT EXISTS space_eye_b" 2>/dev/null
comun=(--env-file "$E" --network "$RED" -e DB_HOST=mysql -e DB_NAME=space_eye_b -e REDIS_URL=redis://redis:6379/1
       -e NODE_ENV=production -e PUBLIC_BASE_URL=http://host.docker.internal:4300 -e STORAGE_DIR=/app/storage)
docker run --rm "${comun[@]}" "$IMAGEN" node dist/migrar.js 2>&1 | tail -1
docker run -d --name eyes-b --restart unless-stopped "${comun[@]}" -p 127.0.0.1:4300:4000 "$IMAGEN" >/dev/null
for _ in $(seq 1 30); do curl -sf http://127.0.0.1:4300/health >/dev/null && break; sleep 1; done
echo "servidor B en http://127.0.0.1:4300 ($IMAGEN, base space_eye_b)"
