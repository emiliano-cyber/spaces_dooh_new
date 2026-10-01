#!/usr/bin/env bash
# ============================================================================
#  desplegar-espejo.sh — levanta Space Eye V2 en el 4200 como ESPEJO de V1.
# ----------------------------------------------------------------------------
#    bash /tmp/desplegar-espejo.sh          (como root, en el droplet)
#
#  Espera en /tmp el paquete del codigo: codigo-v2.tgz (git archive de backend,
#  infra y frontend).
#
#  QUE HACE, EN ORDEN
#    1. Se niega a seguir si V1 no esta sana, si no hay memoria o disco, o si
#       algun puerto de V2 esta ocupado.
#    2. Respalda la base de V1 (mysqldump --single-transaction: no bloquea a
#       nadie) y su .env, y COMPRUEBA el respaldo.
#    3. Instala el codigo en su propia carpeta.
#    4. Prepara .env.v2: secretos propios, y como llegar a V1.
#    5. Carga en V2 una COPIA de la base de V1 y corre las migraciones nuevas
#       SOBRE LA COPIA.
#    6. Levanta V2. Desde ahi el espejo trae solo lo nuevo, cada pocos segundos.
#    7. Comprueba V2, el espejo, y sobre todo QUE V1 SIGA RESPONDIENDO.
#
#  A V1 no se le cambia ni se le reinicia nada. Lo unico que V2 escribe alla son
#  las ordenes que alguien pide desde V2 (foto, vista en vivo) y las ediciones de
#  un equipo (nombre, encuadre, giro, marca), igual que su propio dashboard.
#
#  DESHACER: cd /var/www/Marketplace/space-eye-v2/infra/deploy/v2 &&
#            docker compose -p space-eye-v2 -f docker-compose.v2.yml --env-file .env.v2 down
# ============================================================================
set -euo pipefail

DIR=/var/www/Marketplace/space-eye-v2
V1_DIR=/var/www/Marketplace/space-eye
V1_MYSQL=infra-mysql-1
V1_REDIS=infra-redis-1
V1_BACK=infra-backend-1
PROY=space-eye-v2
IP=159.203.188.58

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
paso()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
azar()  { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
v1_viva() { local c; c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:4000/api/app/version || echo 000); [[ "$c" == 401 || "$c" == 200 ]]; }

# ─── 1. Antes de tocar nada ─────────────────────────────────────────────────
paso "1) Comprobaciones previas"
v1_viva || { rojo "   V1 (4000) no responde bien. No se sigue."; exit 1; }
verde "   V1 viva"
for c in "$V1_MYSQL" "$V1_REDIS" "$V1_BACK"; do
  docker inspect "$c" >/dev/null 2>&1 || { rojo "   No existe el contenedor $c"; exit 1; }
done
[[ -f /tmp/codigo-v2.tgz ]] || { rojo "   Falta /tmp/codigo-v2.tgz"; exit 1; }
[[ -e "$DIR" ]] && { rojo "   $DIR ya existe: V2 ya se desplego antes. Revisa antes de repetir."; exit 1; }

MEM=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
echo "   memoria disponible: ${MEM} MB"
(( MEM >= 700 )) || { rojo "   Hace falta al menos 700 MB libres para no poner en riesgo a V1."; free -m; exit 1; }
DISCO=$(df -m /var/lib/docker | awk 'NR==2 {print $4}')
echo "   disco libre: ${DISCO} MB"
(( DISCO >= 3000 )) || { rojo "   Hace falta al menos 3 GB libres."; exit 1; }
for p in 4200 9089; do ss -ltn | grep -q ":$p " && { rojo "   Puerto $p ocupado"; exit 1; }; done
ss -lun | grep -q ":8389 " && { rojo "   Puerto 8389/udp ocupado"; exit 1; }
verde "   puertos 4200, 9089 y 8389/udp libres"

# Como se llama el volumen de fotos de V1 y su red (no se suponen: se leen).
V1_STORAGE_VOL=$(docker inspect "$V1_BACK" --format '{{range .Mounts}}{{if eq .Destination "/app/storage"}}{{.Name}}{{end}}{{end}}')
V1_RED=$(docker inspect "$V1_MYSQL" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')
[[ -n "$V1_STORAGE_VOL" && -n "$V1_RED" ]] || { rojo "   No pude leer el volumen o la red de V1"; exit 1; }
docker inspect "$V1_REDIS" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' | grep -qw "$V1_RED" \
  || { rojo "   El Redis de V1 no esta en la red $V1_RED"; exit 1; }
echo "   fotos de V1: volumen $V1_STORAGE_VOL   red de V1: $V1_RED"

V1_DB_NAME=$(docker exec "$V1_MYSQL" printenv MYSQL_DATABASE 2>/dev/null || echo space_eye)

# ─── 2. Respaldo de V1 ──────────────────────────────────────────────────────
paso "2) Respaldo de la base de V1"
R=/root/respaldos/espejo-$(date +%Y-%m-%d_%H%M)
mkdir -p "$R" && chmod 700 "$R"
docker exec "$V1_MYSQL" sh -c "mysqldump -uroot -p\"\$MYSQL_ROOT_PASSWORD\" --single-transaction --routines --triggers --no-tablespaces $V1_DB_NAME 2>/dev/null" | gzip > "$R/base-v1.sql.gz"
[[ "$(zcat "$R/base-v1.sql.gz" | tail -1)" == *"Dump completed"* ]] || { rojo "   El volcado salio cortado. No se sigue."; exit 1; }
for t in devices photos commands device_status users; do
  zgrep -q "CREATE TABLE \`$t\`" "$R/base-v1.sql.gz" || { rojo "   Falta la tabla $t en el volcado"; exit 1; }
done
cp "$V1_DIR/backend/.env" "$R/env-v1" && chmod 600 "$R/env-v1"
verde "   $R  ($(du -h "$R/base-v1.sql.gz" | cut -f1), comprobado)"

# ─── 3. Codigo ──────────────────────────────────────────────────────────────
paso "3) Codigo de V2 en $DIR"
mkdir -p "$DIR" && tar xzf /tmp/codigo-v2.tgz -C "$DIR"
# Mientras sea espejo, V2 no ofrece actualizar la app: una APK nueva apuntaria a
# rutas que V1 no tiene. Las actualizaciones se siguen haciendo desde V1.
rm -f "$DIR/frontend/public/space-eye.json" "$DIR"/frontend/public/*.apk
verde "   listo"

# ─── 4. .env de V2 ──────────────────────────────────────────────────────────
paso "4) Preparando .env.v2"
cd "$DIR/infra/deploy/v2"
grep -vE '^(DB_HOST|DB_PASSWORD|DB_NAME|REDIS_URL|JWT_SECRET|JWT_DEVICE_SECRET|PUBLIC_BASE_URL|MEDIAMTX_[A-Z_]*|ESPEJO_[A-Z_]*|STORAGE_DIR|PORT)=' "$V1_DIR/backend/.env" > .env.v2 || true
V1_ROOT=$(docker exec "$V1_MYSQL" printenv MYSQL_ROOT_PASSWORD)
cat >> .env.v2 <<FIN

# ─── Lo propio de V2 (espejo de V1) ─────────────────────────────────────────
DB_PASSWORD=$(azar)
DB_NAME=space_eye
JWT_SECRET=$(azar)
JWT_DEVICE_SECRET=$(azar)
PUBLIC_BASE_URL=http://$IP:4200
MEDIAMTX_HOST=$IP
MEDIAMTX_WEBRTC_PORT=9089
MEDIAMTX_PASS=$(azar)
ESPEJO_DB_HOST=$V1_MYSQL
ESPEJO_DB_USER=root
ESPEJO_DB_PASSWORD=$V1_ROOT
ESPEJO_DB_NAME=$V1_DB_NAME
ESPEJO_REDIS_URL=redis://$V1_REDIS:6379
ESPEJO_NOMBRE=$IP:4000
V1_STORAGE_VOL=$V1_STORAGE_VOL
V1_RED=$V1_RED
FIN
chmod 600 .env.v2
C="docker compose -p $PROY -f docker-compose.v2.yml --env-file .env.v2"
verde "   listo (permisos 600)"

# ─── 5. Base de V2: copia de V1 + migraciones nuevas ────────────────────────
paso "5) Base de V2: copia de V1 y migraciones nuevas sobre la copia"
$C up -d v2mysql v2redis
CLAVE=$(grep -E '^DB_PASSWORD=' .env.v2 | tail -1 | cut -d= -f2-)
# Por TCP y no por el socket: en su primer arranque la imagen de MySQL levanta un
# servidor TEMPORAL (sin red) para inicializarse y luego lo reinicia. Un ping por
# el socket le contesta a ese temporal, y cargar ahi se corta a la mitad.
LISTO=0
for i in $(seq 1 90); do
  $C exec -T v2mysql mysqladmin ping -h127.0.0.1 -uroot -p"$CLAVE" >/dev/null 2>&1 && { LISTO=1; break; }
  sleep 2
done
(( LISTO )) || { rojo "   El MySQL de V2 no arranco"; exit 1; }
sleep 3
if ! zcat "$R/base-v1.sql.gz" | $C exec -T v2mysql mysql -h127.0.0.1 -uroot -p"$CLAVE" space_eye 2>/tmp/carga.err; then
  rojo "   No se pudo cargar la copia:"; grep -v Warning /tmp/carga.err | head -5; exit 1
fi
N=$($C exec -T v2mysql mysql -N -h127.0.0.1 -uroot -p"$CLAVE" space_eye -e 'SELECT COUNT(*) FROM devices' 2>/dev/null)
verde "   copia cargada ($N equipos)"
for f in $(ls "$DIR/backend/migrations" | awk '$0 >= "015"' | sort); do
  if $C exec -T v2mysql mysql -uroot -p"$CLAVE" space_eye < "$DIR/backend/migrations/$f" 2>/tmp/mig.err; then
    echo "   ok  $f"
  else
    rojo "   FALLO $f:"; grep -v Warning /tmp/mig.err | head -5
    rojo "   V2 se queda abajo; V1 no se toco. Deshacer: $C down -v"
    exit 1
  fi
done

# ─── 6. Levantar V2 ─────────────────────────────────────────────────────────
paso "6) Levantando V2"
$C up -d --build backend v2mediamtx

# ─── 7. Comprobaciones ──────────────────────────────────────────────────────
paso "7) Comprobando"
sleep 20
COD_V2=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:4200/api/app/version || echo 000)
echo "   V2 (4200): HTTP $COD_V2"
$C logs --tail 40 backend 2>&1 | grep -E "Espejo|ERROR|Error" | sed 's/^/   /' | tail -8
N1=$(docker exec "$V1_MYSQL" sh -c "mysql -N -uroot -p\"\$MYSQL_ROOT_PASSWORD\" $V1_DB_NAME -e 'SELECT COUNT(*) FROM devices' 2>/dev/null")
N2=$($C exec -T v2mysql mysql -N -uroot -p"$CLAVE" space_eye -e 'SELECT COUNT(*) FROM devices' 2>/dev/null)
echo "   equipos: V1 $N1   V2 $N2"
FALLOS=0
[[ "$COD_V2" == 401 || "$COD_V2" == 200 ]] || { rojo "   V2 no responde bien"; FALLOS=1; }
$C logs backend 2>&1 | grep -q "escuchando a V1" || { rojo "   El espejo no logro escuchar a V1"; FALLOS=1; }
[[ "$N1" == "$N2" ]] || { rojo "   El espejo no tiene los mismos equipos que V1"; FALLOS=1; }
if v1_viva; then verde "   V1 (4000) sigue respondiendo"; else rojo "   ¡V1 NO RESPONDE! Apaga V2 ya: $C down"; FALLOS=1; fi
echo "   memoria disponible ahora: $(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo) MB"

paso "RESULTADO"
if (( FALLOS == 0 )); then
  verde "V2 arriba en http://$IP:4200, reflejando a los equipos de V1, y V1 intacta."
else
  rojo "Hubo problemas. Deshacer: cd $DIR/infra/deploy/v2 && $C down"
  exit 1
fi
