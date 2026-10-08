#!/usr/bin/env bash
# ============================================================================
#  update-eyes.sh — instala y actualiza el Space Eye de ESTA instancia (ADR 0041).
# ----------------------------------------------------------------------------
#  El hermano de update.sh para la otra pila del droplet. Por que no es el mismo
#  guion: update.sh maneja UNA imagen, contra el Postgres del host, con
#  migrar.mjs, /api/version y la licencia (update.sh:882-883). Space Eye es una
#  pila de cinco contenedores con su propio MySQL. Meterla ahi habria sido
#  ensuciar con ramas el guion que decide `pg_restore` en toda la flota.
#
#  Lo que si se copia de update.sh, a proposito, es el ORDEN:
#
#    1. candado (flock): una sola corrida a la vez           -> 75 si hay otra
#    2. jalar la imagen del canal                             -> 2 si no se puede
#    3. si ya corre esa misma imagen y responde: nada que hacer -> 0
#    4. respaldo de la base ANTES de tocar nada (mysqldump, comprobado)
#    5. migraciones con la imagen NUEVA en un contenedor desechable
#       -> si fallan, se restaura el respaldo y NO se cambia  -> 4
#    6. cambiar el contenedor de la API a la imagen nueva
#    7. salud: 127.0.0.1:4200/api/app/version contesta (401 = vivo)
#       -> si no, vuelta atras: imagen anterior + restaurar respaldo -> 6
#
#  Uso (como root, por cron igual que update.sh):
#    update-eyes.sh               instala o actualiza
#    update-eyes.sh --comprobar   solo dice si hay version nueva (0 al dia, 10 hay)
#
#  Rutas (se pueden mover con variables, asi lo ensaya pruebas-update-eyes.sh):
#    EYES_CONF=/etc/space-os/eyes.env        configuracion de Space Eye
#    INSTANCIA_CONF=/etc/space-os/instancia.env   REGISTRY, REGISTRY_TOKEN, CANAL
#    EYES_DIR=/opt/space-os/eyes             docker-compose.yml y mediamtx.yml
#    EYES_RESPALDOS=/var/backups/space-os/eyes
#    EYES_CANDADO=/run/lock/space-os-eyes.lock
#
#  CODIGOS: 0 bien · 2 no se pudo jalar · 3 configuracion incompleta ·
#  4 fallo la migracion (restaurado, sin cambio) · 5 fallo el respaldo ·
#  6 la version nueva no respondio (vuelta atras hecha) · 7 la vuelta atras
#  tampoco respondio (INTERVENIR) · 10 hay version nueva (--comprobar) · 75 otra
#  corrida en curso.
# ============================================================================
set -uo pipefail

EYES_CONF="${EYES_CONF:-/etc/space-os/eyes.env}"
INSTANCIA_CONF="${INSTANCIA_CONF:-/etc/space-os/instancia.env}"
EYES_DIR="${EYES_DIR:-/opt/space-os/eyes}"
EYES_RESPALDOS="${EYES_RESPALDOS:-/var/backups/space-os/eyes}"
EYES_CANDADO="${EYES_CANDADO:-/run/lock/space-os-eyes.lock}"
SALUD_URL="${SALUD_URL:-http://127.0.0.1:4200/api/app/version}"
SALUD_INTENTOS="${SALUD_INTENTOS:-30}"
PROYECTO=space-eyes
MODO="${1:-}"

di() { printf '[update-eyes] %s\n' "$*"; }

# Lee CLAVE=valor de un archivo SIN ejecutarlo: eyes.env es formato de docker
# (sin comillas) y no se le hace `source`, que ejecutaria lo que trajera.
leer() {
  local clave="$1" archivo="$2"
  [[ -f "$archivo" ]] || return 0
  sed -n "s/^${clave}=//p" "$archivo" | tail -1 | sed 's/^"\(.*\)"$/\1/'
}

# ─── 1. candado ─────────────────────────────────────────────────────────────
mkdir -p "$(dirname "$EYES_CANDADO")"
exec 9>"$EYES_CANDADO"
if ! flock -n 9; then di "otra corrida en curso; no se sigue"; exit 75; fi

[[ -f "$EYES_CONF" ]] || { di "falta $EYES_CONF"; exit 3; }
[[ -f "$EYES_DIR/docker-compose.yml" ]] || { di "falta $EYES_DIR/docker-compose.yml"; exit 3; }
for v in INSTANCIA_OWNER EYES_DOMINIO IP_PUBLICA DB_PASSWORD; do
  [[ -n "$(leer "$v" "$EYES_CONF")" ]] || { di "falta $v en $EYES_CONF"; exit 3; }
done

IMAGEN="$(leer EYES_IMAGEN "$EYES_CONF")"
if [[ -z "$IMAGEN" ]]; then
  REGISTRY="$(leer REGISTRY "$INSTANCIA_CONF")"
  CANAL="$(leer CANAL "$INSTANCIA_CONF")"
  [[ -n "$REGISTRY" && -n "$CANAL" ]] || { di "sin EYES_IMAGEN y sin REGISTRY/CANAL en $INSTANCIA_CONF"; exit 3; }
  IMAGEN="$REGISTRY/space-os:eyes-$CANAL"
fi

export EYES_CONF
C=(docker compose -p "$PROYECTO" -f "$EYES_DIR/docker-compose.yml" --env-file "$EYES_CONF")
CLAVE_DB="$(leer DB_PASSWORD "$EYES_CONF")"
sql() { "${C[@]}" exec -T mysql mysql -h127.0.0.1 -uroot -p"$CLAVE_DB" -N space_eye "$@" 2>/dev/null; }

# ─── 2. jalar ───────────────────────────────────────────────────────────────
TOKEN="$(leer REGISTRY_TOKEN "$INSTANCIA_CONF")"
if [[ -n "$TOKEN" && "$IMAGEN" == */* ]]; then
  printf '%s' "$TOKEN" | docker login "${IMAGEN%%/*}" -u token --password-stdin >/dev/null 2>&1 || true
fi
JALADA=0
if [[ "$IMAGEN" == */* ]]; then
  for i in 1 2 3; do docker pull -q "$IMAGEN" >/dev/null 2>&1 && { JALADA=1; break; }; sleep $((i * 5)); done
else
  # Una imagen local (sin registro): ensayo. Basta con que exista.
  docker image inspect "$IMAGEN" >/dev/null 2>&1 && JALADA=1
fi
(( JALADA )) || { di "no se pudo jalar $IMAGEN"; exit 2; }
NUEVA="$(docker image inspect --format '{{.Id}}' "$IMAGEN")"

CONT_API="$("${C[@]}" ps -q api 2>/dev/null)"
ACTUAL=""
[[ -n "$CONT_API" ]] && ACTUAL="$(docker inspect --format '{{.Image}}' "$CONT_API" 2>/dev/null)"

salud() {
  local i c
  for ((i = 1; i <= SALUD_INTENTOS; i++)); do
    c="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$SALUD_URL" || true)"
    [[ "$c" == 200 || "$c" == 401 ]] && return 0
    sleep 2
  done
  return 1
}

# ─── 3. al dia ──────────────────────────────────────────────────────────────
if [[ "$MODO" == "--comprobar" ]]; then
  if [[ "$ACTUAL" == "$NUEVA" ]]; then di "al dia ($IMAGEN)"; exit 0; fi
  di "hay version nueva: $IMAGEN"; exit 10
fi
if [[ -n "$ACTUAL" && "$ACTUAL" == "$NUEVA" ]] && salud; then
  di "al dia ($IMAGEN)"; exit 0
fi
# Una version que ya fallo aqui no se vuelve a intentar en cada vuelta del cron
# (cada intento es un respaldo y un reinicio): espera a que el canal traiga otra.
if [[ -f "$EYES_DIR/vetada" && "$(cat "$EYES_DIR/vetada")" == "$NUEVA" ]]; then
  di "la version $IMAGEN ya fallo en esta instancia; se espera a una distinta"; exit 6
fi

# El resto de la pila (base, redis, video) siempre arriba antes de migrar.
"${C[@]}" up -d mysql redis mediamtx coturn >/dev/null 2>&1 || { di "no se pudo levantar la pila"; exit 3; }
for i in $(seq 1 60); do
  "${C[@]}" exec -T mysql mysqladmin ping -h127.0.0.1 -uroot -p"$CLAVE_DB" >/dev/null 2>&1 && break
  sleep 2
done

# ─── 4. respaldo ────────────────────────────────────────────────────────────
RESPALDO=""
TABLAS="$(sql -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='space_eye'")"
if [[ "${TABLAS:-0}" -gt 0 ]]; then
  mkdir -p "$EYES_RESPALDOS" && chmod 700 "$EYES_RESPALDOS"
  RESPALDO="$EYES_RESPALDOS/space-eye-$(date +%Y%m%d-%H%M%S).sql.gz"
  "${C[@]}" exec -T mysql sh -c 'mysqldump -h127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --no-tablespaces space_eye 2>/dev/null' | gzip > "$RESPALDO"
  if [[ "$(zcat "$RESPALDO" 2>/dev/null | tail -1)" != *"Dump completed"* ]]; then
    di "el respaldo salio cortado ($RESPALDO); no se sigue"; exit 5
  fi
  di "respaldo: $RESPALDO"
fi
restaurar() {
  [[ -n "$RESPALDO" ]] || return 0
  di "restaurando $RESPALDO"
  # La base se borra y se vuelve a crear ANTES de cargar el respaldo: un volcado
  # solo reemplaza las tablas que trae, y lo que una migracion a medias creo
  # (una tabla nueva) se quedaria ahi, haciendo creer a la siguiente corrida que
  # esa migracion ya estaba. Es lo mismo que hace update.sh con `drop schema`.
  "${C[@]}" exec -T mysql mysql -h127.0.0.1 -uroot -p"$CLAVE_DB"     -e "DROP DATABASE IF EXISTS space_eye; CREATE DATABASE space_eye CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci" 2>/dev/null
  zcat "$RESPALDO" | "${C[@]}" exec -T mysql mysql -h127.0.0.1 -uroot -p"$CLAVE_DB" space_eye 2>/dev/null
}

# ─── 5. migraciones con la imagen nueva ─────────────────────────────────────
BASE="$(leer MIGRACIONES_BASE "$EYES_CONF")"
if ! EYES_IMAGEN="$IMAGEN" "${C[@]}" run --rm --no-deps -T -e MIGRACIONES_BASE="$BASE" api node dist/migrar.js; then
  di "fallo la migracion: se restaura y NO se cambia de version"
  restaurar
  exit 4
fi

# ─── 6. cambiar ─────────────────────────────────────────────────────────────
[[ -n "$ACTUAL" ]] && docker tag "$ACTUAL" "space-eye-local:anterior" >/dev/null 2>&1
if ! EYES_IMAGEN="$IMAGEN" "${C[@]}" up -d api >/dev/null 2>&1; then
  di "no se pudo arrancar la API nueva"
fi

# ─── 7. salud y vuelta atras ────────────────────────────────────────────────
if salud; then
  date -u +"%Y-%m-%dT%H:%M:%SZ $IMAGEN $NUEVA" > "$EYES_DIR/version"
  rm -f "$EYES_DIR/vetada"
  di "listo: $IMAGEN"
  exit 0
fi
di "la version nueva no respondio en $SALUD_URL"
echo "$NUEVA" > "$EYES_DIR/vetada"
if [[ -z "$ACTUAL" ]]; then di "era la primera instalacion: no hay a donde volver"; exit 6; fi
restaurar
EYES_IMAGEN="space-eye-local:anterior" "${C[@]}" up -d api >/dev/null 2>&1
if salud; then di "vuelta atras hecha: sigue la version anterior"; exit 6; fi
di "LA VUELTA ATRAS TAMPOCO RESPONDE: intervenir"
exit 7
