#!/bin/sh
# Despliega en la instancia de PRUEBAS (puerto 4100). NO toca produccion.
#
#   sh /tmp/desplegar-pruebas.sh
#
# Espera en /tmp: codigo-pruebas.tgz (git archive de backend, infra y frontend),
# space-eye.apk y space-eye.json (la APK de pruebas, compilada contra :4100).
set -e
DIR=/var/www/Marketplace/space-eye-pruebas
cd "$DIR"

echo "[1] Respaldo de lo que se reemplaza"
R=/root/respaldos-pruebas/$(date +%Y%m%d_%H%M%S)
mkdir -p "$R"
tar czf "$R/codigo.tgz" --exclude='*.apk' --exclude='*.exe' backend/src backend/migrations infra frontend/public frontend/src
cp -a backend/.env "$R/env"
cp -a frontend/public/space-eye.apk frontend/public/space-eye.json "$R/" 2>/dev/null || true
echo "    en $R"

echo "[2] Codigo nuevo"
tar xzf /tmp/codigo-pruebas.tgz
cp /tmp/space-eye.apk /tmp/space-eye.json frontend/public/

echo "[3] Servidor de medios propio de pruebas (8899/tcp, 8199/udp)"
grep -q '^MEDIAMTX_HOST=' backend/.env || echo 'MEDIAMTX_HOST=159.203.188.58' >> backend/.env
grep -q '^MEDIAMTX_WEBRTC_PORT=' backend/.env || echo 'MEDIAMTX_WEBRTC_PORT=8899' >> backend/.env
grep -q '^MEDIAMTX_PASS=.' backend/.env || echo "MEDIAMTX_PASS=$(head -c 18 /dev/urandom | od -An -tx1 | tr -d ' \n')" >> backend/.env
if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
  ufw allow 8899/tcp >/dev/null && ufw allow 8199/udp >/dev/null && echo "    puertos abiertos en ufw"
fi

echo "[4] Arranque (proyecto seprueba: los contenedores de produccion no se tocan)"
docker compose -p seprueba -f infra/docker-compose.pruebas.yml --env-file backend/.env up -d --build backend mediamtx

echo "[5] Comprobacion"
sleep 8
docker ps --format '{{.Names}}\t{{.Status}}' | grep seprueba
curl -s -o /dev/null -w "    dashboard :4100 -> %{http_code}\n" http://localhost:4100/dashboard.html
curl -s -o /dev/null -w "    servidor de medios :8899 -> %{http_code} (404 es lo esperado sin transmision)\n" http://localhost:8899/x/whep
docker logs --tail 5 seprueba-backend-1 2>&1 | sed 's/^/    /'
echo "Listo."
