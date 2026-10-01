#!/usr/bin/env bash
# ============================================================================
#  mudar-prueba-a-v2.sh — el telefono de pruebas pasa de :4100 a :4200 (V2) con
#  todo su historial, y queda conectado DIRECTO a V2 (no por el espejo).
# ----------------------------------------------------------------------------
#    bash /tmp/mudar-prueba-a-v2.sh [id del equipo en :4100, por omision 2]
#
#  Espera en /tmp: codigo-v2.tgz, importar-equipo.js, space-eye.apk y
#  space-eye.json (la APK 0.15.15 compilada contra :4200).
#
#  1. Actualiza el codigo de V2 (los equipos propios ya no se confunden con los
#     del espejo) y lo reinicia.
#  2. Copia de :4100 el equipo y todo lo suyo a una base aparte de V2, y de ahi
#     a la de verdad con sus numeros corridos a la zona propia (1.000.000.000+).
#  3. Copia sus fotos.
#  4. Publica en :4100 la APK que apunta a :4200: al pulsar "Actualizar" en la
#     ficha del equipo en :4100, el telefono se muda solo.
#
#  Ni V1 (:4000) ni sus datos se tocan. :4100 solo cambia su APK publicada.
# ============================================================================
set -euo pipefail
DID="${1:-2}"
V2=/var/www/Marketplace/space-eye-v2
PR=/var/www/Marketplace/space-eye-pruebas
B=1000000000
rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
paso()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
cd "$V2/infra/deploy/v2"
C="docker compose -p space-eye-v2 -f docker-compose.v2.yml --env-file .env.v2"
CL=$(grep -E '^DB_PASSWORD=' .env.v2 | tail -1 | cut -d= -f2-)
v2sql() { $C exec -T v2mysql mysql -N -h127.0.0.1 -uroot -p"$CL" "$@" 2>/dev/null; }
prsql() { docker exec seprueba-mysql-1 sh -c "mysql -N -uroot -p\"\$MYSQL_ROOT_PASSWORD\" space_eye -e \"$1\" 2>/dev/null"; }

for f in codigo-v2.tgz importar-equipo.js space-eye.apk space-eye.json; do [[ -f /tmp/$f ]] || { rojo "Falta /tmp/$f"; exit 1; }; done

paso "1) Que equipo se muda"
FILA=$(prsql "SELECT device_uid, name FROM devices WHERE id = $DID")
[[ -n "$FILA" ]] || { rojo "   No existe el equipo $DID en :4100"; exit 1; }
UID_=$(echo "$FILA" | cut -f1)
echo "   #$DID  $(echo "$FILA" | cut -f2)  ($UID_)"
# Si ese telefono ya existiera en produccion, el espejo lo traeria con otro
# numero y quedaria dos veces: no se sigue.
EN_V1=$(docker exec infra-mysql-1 sh -c "mysql -N -uroot -p\"\$MYSQL_ROOT_PASSWORD\" space_eye -e \"SELECT COUNT(*) FROM devices WHERE device_uid = '$UID_'\" 2>/dev/null")
[[ "$EN_V1" == "0" ]] || { rojo "   Ese telefono tambien esta registrado en produccion. No se sigue."; exit 1; }
verde "   no esta en produccion: se puede mudar"

paso "2) Codigo nuevo de V2"
tar xzf /tmp/codigo-v2.tgz -C "$V2"
rm -f "$V2/frontend/public/space-eye.json" "$V2"/frontend/public/*.apk
$C up -d --build backend 2>&1 | grep -E 'Started|Error' || true
sleep 15
$C logs --since 1m backend 2>&1 | grep -E 'Espejo' | sed 's/^/   /'

paso "3) El historial del equipo, a V2"
docker exec seprueba-mysql-1 sh -c "mysqldump -uroot -p\"\$MYSQL_ROOT_PASSWORD\" --single-transaction space_eye devices --where='id=$DID' 2>/dev/null; \
  mysqldump -uroot -p\"\$MYSQL_ROOT_PASSWORD\" --single-transaction space_eye photos commands device_status device_logs device_data_usage pantalla_fallas device_creatives --where='device_id=$DID' 2>/dev/null" > /tmp/prueba-import.sql
grep -q "Dump completed" /tmp/prueba-import.sql || { rojo "   El volcado de :4100 salio vacio"; exit 1; }
v2sql -e "DROP DATABASE IF EXISTS prueba_import; CREATE DATABASE prueba_import"
$C exec -T v2mysql mysql -h127.0.0.1 -uroot -p"$CL" prueba_import < /tmp/prueba-import.sql 2>/dev/null
CONT=$($C ps -q backend)
docker cp /tmp/importar-equipo.js "$CONT":/app/importar-equipo.js
docker exec -e ORIGEN_DB=prueba_import "$CONT" node /app/importar-equipo.js
v2sql -e "DROP DATABASE prueba_import"
echo "   en :4100 -> en :4200"
for t in photos pantalla_fallas device_creatives commands; do
  echo "   $t: $(prsql "SELECT COUNT(*) FROM $t WHERE device_id = $DID") -> $(v2sql space_eye -e "SELECT COUNT(*) FROM $t WHERE device_id = $((B + DID))")"
done

paso "4) Sus fotos"
docker run --rm -v seprueba_storage_data:/a:ro -v space-eye-v2_storage_data_v2:/b alpine sh -c 'cp -an /a/. /b/' && verde "   copiadas"

paso "5) Publicar en :4100 la APK que apunta a :4200"
cp -a "$PR/frontend/public/space-eye.apk" "/root/respaldos-pruebas/space-eye.apk.antes-de-mudar" 2>/dev/null || true
cp /tmp/space-eye.apk /tmp/space-eye.json "$PR/frontend/public/"
grep -E '"version"' "$PR/frontend/public/space-eye.json" | sed 's/^/   /'

paso "LISTO"
verde "En :4100, ficha del equipo -> Mas -> Actualizar. Al instalarse, el telefono se da de alta solo en :4200 (equipo $((B + DID)))."
