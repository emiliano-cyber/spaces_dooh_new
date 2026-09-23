#!/usr/bin/env bash
# ============================================================================
#  desplegar-v2.sh — levanta Space Eye V2 EN PARALELO, sin tocar producción.
# ----------------------------------------------------------------------------
#    bash desplegar-v2.sh /root/respaldos/space-eye-<fecha>
#
#  QUE HACE, EN ORDEN
#    1. Se niega a seguir si producción no esta sana (no vamos a estrenar V2
#       encima de un incendio).
#    2. Comprueba que ningun puerto de V2 este ocupado.
#    3. Prepara .env.v2 a partir del de producción, con lo justo cambiado.
#    4. Levanta la pila V2 con nombre de proyecto propio.
#    5. Carga en V2 una COPIA de la base de producción y corre las migraciones
#       nuevas SOBRE LA COPIA. Producción ni se entera.
#    6. Copia las fotos.
#    7. Comprueba V2 y, sobre todo, COMPRUEBA QUE PRODUCCION SIGUE VIVA.
#
#  LO QUE NO HACE, NUNCA: tocar los contenedores, los volumenes o el .env de
#  producción. Si algo sale mal, `docker compose -p space-eye-v2 down` y no
#  quedo rastro.
# ============================================================================
set -euo pipefail

RESPALDO="${1:-}"
AQUI="$(cd "$(dirname "$0")" && pwd)"
PROY="space-eye-v2"
PUERTO_V2=4100

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
paso()  { printf '\n\033[1m%s\033[0m\n' "$*"; }

[[ -z "$RESPALDO" ]] && { rojo "Falta la carpeta del respaldo: bash desplegar-v2.sh /root/respaldos/space-eye-<fecha>"; exit 1; }
[[ -f "$RESPALDO/base-completa.sql.gz" ]] || { rojo "No encuentro $RESPALDO/base-completa.sql.gz — corre antes respaldo.sh"; exit 1; }

# ─── 1. Producción tiene que estar sana ANTES de empezar ────────────────────
paso "1) Comprobando que producción esta bien (antes de tocar nada)"
COD=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:4000/api/app/version || echo 000)
if [[ "$COD" != "401" && "$COD" != "200" ]]; then
  rojo "   Producción responde $COD en el 4000. Arregla eso primero."
  exit 1
fi
verde "   producción viva (HTTP $COD)"

# ─── 2. Los puertos de V2, libres ───────────────────────────────────────────
paso "2) Comprobando que los puertos de V2 estan libres"
for p in 4100 8654 8989; do
  if ss -ltn 2>/dev/null | grep -q ":$p " ; then
    rojo "   El puerto $p esta ocupado. V2 no puede levantar ahi."
    exit 1
  fi
  echo "   $p libre"
done

# ─── 3. El .env de V2 ───────────────────────────────────────────────────────
paso "3) Preparando .env.v2"
ENV_PROD=""
for c in "$RESPALDO/config/backend_.env" /opt/space-eye/backend/.env /root/Space_eye/backend/.env; do
  [[ -f "$c" ]] && { ENV_PROD="$c"; break; }
done
[[ -z "$ENV_PROD" ]] && { rojo "   No encuentro el .env de producción"; exit 1; }
echo "   partiendo de $ENV_PROD"

# Se copia y se cambia SOLO lo que tiene que ser distinto en V2.
grep -vE '^(MEDIAMTX_WHEP_PUBLIC|MEDIAMTX_RTSP_PORT|MEDIAMTX_WEBRTC_PORT|PUBLIC_BASE_URL)=' "$ENV_PROD" > "$AQUI/.env.v2"
cat >> "$AQUI/.env.v2" <<'FIN'

# ─── Lo propio de V2 ────────────────────────────────────────────────────────
# V2 es la que vive detras del dominio; producción sigue por IP en el 4000.
PUBLIC_BASE_URL=https://eyes.g500.space-os.io
# El navegador abre el vivo por el dominio y su certificado: una pagina https no
# puede abrir un WHEP en http.
MEDIAMTX_WHEP_PUBLIC=https://eyes.g500.space-os.io/whep
# Los puertos de MediaMTX de V2, corridos para no chocar con producción.
MEDIAMTX_RTSP_PORT=8654
MEDIAMTX_WEBRTC_PORT=8989
FIN
chmod 600 "$AQUI/.env.v2"
verde "   .env.v2 listo (permisos 600)"

# ─── 4. Levantar V2 ─────────────────────────────────────────────────────────
paso "4) Levantando la pila V2 (proyecto $PROY)"
cd "$AQUI"
docker compose -p "$PROY" -f docker-compose.v2.yml --env-file .env.v2 up -d --build
echo "   esperando a MySQL de V2..."
for i in $(seq 1 60); do
  docker compose -p "$PROY" -f docker-compose.v2.yml exec -T mysql \
    mysqladmin ping -uroot -p"$(grep -E '^DB_PASSWORD=' .env.v2 | cut -d= -f2-)" >/dev/null 2>&1 && break
  sleep 2
done

# ─── 5. La copia de la base, y las migraciones SOBRE LA COPIA ───────────────
paso "5) Cargando una copia de la base de producción en V2"
CLAVE="$(grep -E '^DB_PASSWORD=' .env.v2 | cut -d= -f2-)"
zcat "$RESPALDO/base-completa.sql.gz" | docker compose -p "$PROY" -f docker-compose.v2.yml exec -T mysql \
  mysql -uroot -p"$CLAVE" 2>/dev/null
verde "   copia cargada"

paso "5b) Migraciones nuevas, sobre la COPIA"
docker compose -p "$PROY" -f docker-compose.v2.yml exec -T backend npm run migrate || {
  rojo "   Las migraciones fallaron. V2 queda abajo; producción no se toco."
  exit 1
}
verde "   migraciones aplicadas"

# ─── 6. Las fotos ───────────────────────────────────────────────────────────
paso "6) Copiando las fotos a V2"
if [[ -f "$RESPALDO/fotos.tar.gz" ]]; then
  CONT_V2_BACK="$(docker compose -p "$PROY" -f docker-compose.v2.yml ps -q backend)"
  docker run --rm --volumes-from "$CONT_V2_BACK" -v "$RESPALDO:/r:ro" \
    alpine sh -c 'cd /app && tar xzf /r/fotos.tar.gz' && verde "   fotos copiadas"
else
  echo "   (sin fotos en el respaldo; V2 arranca sin galeria)"
fi

docker compose -p "$PROY" -f docker-compose.v2.yml restart backend >/dev/null

# ─── 7. Comprobar V2 y, sobre todo, producción ──────────────────────────────
paso "7) Comprobando"
sleep 5
COD_V2=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "http://127.0.0.1:$PUERTO_V2/api/app/version" || echo 000)
COD_V1=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:4000/api/app/version || echo 000)

echo "   V2 (4100): HTTP $COD_V2"
echo "   V1 (4000): HTTP $COD_V1   <- esta es la que importa"

FALLOS=0
[[ "$COD_V2" == "401" || "$COD_V2" == "200" ]] || { rojo "   V2 no responde bien"; FALLOS=$((FALLOS+1)); }
[[ "$COD_V1" == "401" || "$COD_V1" == "200" ]] || { rojo "   ¡PRODUCCION AFECTADA! Apaga V2 ya: docker compose -p $PROY down"; FALLOS=$((FALLOS+1)); }

paso "RESULTADO"
if [[ "$FALLOS" -eq 0 ]]; then
  verde "V2 arriba en el 4100 y producción intacta en el 4000."
  echo
  echo "Siguiente: apuntar el vhost de Apache a V2 y recargar."
  echo "  ProxyPass / http://127.0.0.1:4100/     y     /whep/ -> 127.0.0.1:8989"
  echo "  apache2ctl configtest && systemctl reload apache2"
  echo
  echo "Para deshacerlo todo:  docker compose -p $PROY down"
else
  rojo "$FALLOS problema(s). Deshacer: docker compose -p $PROY down"
  exit 1
fi
