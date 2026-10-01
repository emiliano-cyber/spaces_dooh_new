# ============================================================================
#  cargar-datos.sh — el Space Eye local de la instancia con los datos REALES
# ----------------------------------------------------------------------------
#  Lo mismo que pasaria al mudar g500 a su droplet con Space Eye dentro:
#    1. instancia nueva (credenciales, eyes.env) con dueno g500
#    2. copia de la base de produccion (:4000) y migraciones 015+ sobre ella
#    3. el telefono de pruebas (:4100) con todo su historial, en la zona propia
#    4. las fotos (miniaturas de todo, completas de los ultimos 7 dias)
#
#  Uso (en WSL):  bash cargar-datos.sh /mnt/c/Users/hm284/datos-locales
#  Espera ahi: v1.sql.gz, pruebas.sql.gz, importar-equipo.js, fotos-v1.tar,
#  fotos-pruebas.tar (opcionales las fotos).
# ============================================================================
set -euo pipefail
DATOS="$1"
R=$HOME/spaces-lf; H=$HOME/hijo
IMAGEN="${IMAGEN:-space-eye:0.16.4-local}"
C() { docker compose -p space-eyes -f "$H/opt/eyes/docker-compose.yml" --env-file "$H/etc/eyes.env" "$@"; }

echo "1) instancia nueva (dueno g500)"
[ -f "$H/opt/eyes/docker-compose.yml" ] && C down -v >/dev/null 2>&1 || true
cd "$HOME"; rm -rf "$H"; mkdir -p "$H/etc" "$H/opt/eyes" "$H/respaldos"
. "$R/infra/scripts/entorno-instancia.sh"; . "$R/infra/scripts/eyes-alta.sh"
eyes_preparar_credenciales
eyes_pares_app > "$H/etc/app-space-eye.env"
eyes_env "$R/infra/eyes/eyes.env.example" g500 g500.localhost 127.0.0.1 "$IMAGEN" > "$H/etc/eyes.env"
# La base que llega ya existia hasta la 014 (produccion): se adopta, no se adivina.
sed -i 's/^MIGRACIONES_BASE=.*/MIGRACIONES_BASE=014/' "$H/etc/eyes.env"
chmod 600 "$H/etc/eyes.env" "$H/etc/app-space-eye.env"
while IFS=$'\t' read -r origen destino modo; do
  d="$H/opt${destino#/opt/space-os}"; mkdir -p "$(dirname "$d")"; cp "$origen" "$d"; chmod "$modo" "$d"
done < <(eyes_archivos "$R")
CL=$(sed -n 's/^DB_PASSWORD=//p' "$H/etc/eyes.env")

echo "2) base de produccion"
C up -d mysql >/dev/null 2>&1
for i in $(seq 1 60); do C exec -T mysql mysqladmin ping -h127.0.0.1 -uroot -p"$CL" >/dev/null 2>&1 && break; sleep 2; done
sleep 3
zcat "$DATOS/v1.sql.gz" | C exec -T mysql mysql -h127.0.0.1 -uroot -p"$CL" space_eye 2>/dev/null
echo "   equipos: $(C exec -T mysql mysql -N -h127.0.0.1 -uroot -p"$CL" space_eye -e 'SELECT COUNT(*) FROM devices' 2>/dev/null)"

echo "3) actualizador: migraciones 015+ y arranque"
EYES_CONF="$H/etc/eyes.env" EYES_DIR="$H/opt/eyes" EYES_RESPALDOS="$H/respaldos" EYES_CANDADO="$H/eyes.lock" \
  bash "$H/opt/update-eyes.sh" 2>&1 | grep -E "aplicando|adoptada|listo|fallo|no " || true

echo "4) el telefono de pruebas (:4100) con su historial"
C exec -T mysql mysql -h127.0.0.1 -uroot -p"$CL" -e "DROP DATABASE IF EXISTS prueba_import; CREATE DATABASE prueba_import" 2>/dev/null
zcat "$DATOS/pruebas.sql.gz" | C exec -T mysql mysql -h127.0.0.1 -uroot -p"$CL" prueba_import 2>/dev/null
# Solo el equipo de pruebas: lo demas de esa base (sus usuarios) no se trae.
C exec -T mysql mysql -h127.0.0.1 -uroot -p"$CL" prueba_import -e "
  DELETE FROM devices WHERE name <> 'Dispositivo de prueba';" 2>/dev/null
API=$(C ps -q api)
docker cp "$DATOS/importar-equipo.js" "$API":/app/importar-equipo.js
docker exec -e ORIGEN_DB=prueba_import "$API" node /app/importar-equipo.js
C exec -T mysql mysql -h127.0.0.1 -uroot -p"$CL" -e "DROP DATABASE prueba_import" 2>/dev/null

echo "5) todo es de g500 (decision del 17/09: todas las camaras de hoy son suyas)"
C exec -T mysql mysql -h127.0.0.1 -uroot -p"$CL" space_eye -e "UPDATE devices SET owner='g500' WHERE owner IS NULL OR owner=''" 2>/dev/null

echo "6) fotos"
for t in fotos-v1.tar fotos-pruebas.tar; do
  [ -f "$DATOS/$t" ] || { echo "   (sin $t)"; continue; }
  docker run --rm -v space-eyes_fotos:/d -v "$DATOS":/s:ro alpine sh -c "cd /d && tar xf /s/$t" && echo "   $t ok"
done

echo "LISTO:"
C exec -T mysql mysql -h127.0.0.1 -uroot -p"$CL" space_eye -e "SELECT id, LEFT(name,40) nombre, owner, app_version, (SELECT COUNT(*) FROM photos p WHERE p.device_id=d.id) fotos FROM devices d ORDER BY id" 2>/dev/null
