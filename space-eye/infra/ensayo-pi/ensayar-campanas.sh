#!/usr/bin/env bash
# ============================================================================
#  Ensayo de las campanas de SPACE OS en la Raspberry simulada (oct-2026).
# ----------------------------------------------------------------------------
#  Lo que pidio el dueno: lo que se sube en Operaciones se reconoce en la
#  pantalla y se fotografia (una prueba al dia), aparte de lo programatico.
#
#  Aqui se hace de SPACE OS con curl (su sincronizacion se prueba aparte):
#    1. llega una campana para el codigo de la pantalla de la Pi, con su arte;
#    2. la Pi baja la referencia SOLA, sin reiniciarla (la huella de la
#       configuracion viaja en el reporte de estado);
#    3. el arte sale en la pantalla UNA vez: llega su foto de prueba ligada a
#       la campana, y no cuenta como creativo nuevo;
#    4. vuelve a salir: no hay segunda prueba hoy;
#    5. SPACE OS ya no la manda: se apaga y la Pi borra su referencia.
#
#  Requiere: ensayar-envio-y-apagon.sh corrido antes (la camara de ensayo con
#  /camara/unicos y el loop), Space Eye con la migracion 024 y la Pi en 0.7.4.
#  Uso: bash infra/ensayo-pi/ensayar-campanas.sh
# ============================================================================
set -uo pipefail
export MSYS_NO_PATHCONV=1
API=http://127.0.0.1:4200
PI=pi-simulada-1
VERSION="pi-agent 0.7.5"
CODIGO="ENSAYO-PI-1"
ANUNCIOS=/c/Users/hm284/datos-locales/pi/anuncios
WSL() { wsl.exe -d Ubuntu -- bash -lc "$1"; }
LLAVE="$(WSL 'sed -n "s/^INSTANCIA_LLAVE=//p" ~/hijo/etc/eyes.env' | tr -d '\r')"
se() { curl -s -H "Authorization: Bearer $LLAVE" "$@"; }
sej() { se -H 'Content-Type: application/json' "$@"; }
sql() { wsl.exe -d Ubuntu -- bash /mnt/c/Users/hm284/Space_eye/infra/ensayo-pi/sql.sh | tr -d '\r'; }
jq_() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log(eval(process.argv[1]))})' "$1"; }
fallos=0
afirmar() { if eval "$1"; then echo "  ok     $2"; else echo "  FALLA  $2"; fallos=$((fallos+1)); fi; }
esperar() {  # $1 comando que imprime true, $2 segundos
  local t0=$SECONDS
  while [ $((SECONDS - t0)) -lt "$2" ]; do [ "$(eval "$1")" = "true" ] && return 0; sleep 5; done; return 1
}
ID="$(docker exec $PI cat /home/pi/pi-agent/state.json | jq_ 'o.device_id')"
version() { se "$API/api/devices/$ID" | jq_ 'o.device.app_version'; }
pruebas() { echo "SELECT COUNT(*) FROM photos WHERE device_id=$ID AND source='campana' AND campaign_id=$1" | sql; }
con_foto() { se "$API/api/devices/$ID/creativos" | jq_ '(o.creativos||[]).filter(c=>c.photo_id).length'; }
referencias() { docker exec $PI sh -c 'ls /home/pi/pi-agent/pantalla/campanas/ 2>/dev/null | grep -c "\.jpg$"'; }
ARTE="$ANUNCIOS/$(ls "$ANUNCIOS" | sort | sed -n 12p)"   # el 12o: /camara/unicos/2.jpg
SHA="$(sha256sum "$ARTE" | cut -c1-64)"
HOY="$(date +%F)"; HASTA="$(date -d '+5 days' +%F)"

echo "Pi simulada: equipo #$ID ($(version)); arte: $(basename "$ARTE")"

echo; echo "0) La Pi en $VERSION, por la red"
sej -X POST "$API/api/devices/$ID/command" -d '{"command_type":"UPDATE_APP"}' >/dev/null
esperar '[ "$(version)" = "$VERSION" ] && echo true' 300
afirmar "[ \"\$(version)\" = '$VERSION' ]" "reporta $VERSION"
sej -X PUT "$API/api/devices/$ID" -d "{\"billboard_code\":\"$CODIGO\"}" >/dev/null
# Creativos en continuo, envio al momento (lo que deja el otro ensayo).
sej -X PUT "$API/api/devices/$ID/creativos" -d '{"vigilar":true,"cada_min":0,"envio_min":0}' >/dev/null
docker exec $PI sh -c 'echo sana > /camara/modo'
sleep 90

echo; echo "1) SPACE OS manda una campana para la pantalla $CODIGO"
CUERPO="{\"origen\":\"spaceos:ensayo\",\"campanas\":[{\"origen_id\":\"c-ensayo:k-1\",\"nombre\":\"Ensayo - arte 12\",\"anunciante\":\"Ensayo\",\"desde\":\"$HOY\",\"hasta\":\"$HASTA\",\"codigos\":[\"ensayo-pi-1\"],\"sha\":\"$SHA\"}]}"
R="$(sej -X POST "$API/api/campaigns/sincronizar" -d "$CUERPO")"
CID="$(echo "$R" | jq_ 'o.campanas[0].id')"
afirmar "[ \"\$(echo '$R' | jq_ 'o.campanas[0].necesita_creativo && o.campanas[0].equipos===1')\" = true ]" "campana #$CID ligada a 1 equipo, pide su arte"
se -X POST "$API/api/campaigns/$CID/creative" -F "creative=@$(cygpath -m "$ARTE");type=image/jpeg" -F "origen_sha=$SHA" >/dev/null
R2="$(sej -X POST "$API/api/campaigns/sincronizar" -d "$CUERPO")"
afirmar "[ \"\$(echo '$R2' | jq_ 'o.campanas[0].necesita_creativo')\" = false ]" "con el arte arriba ya no lo vuelve a pedir"
BASE_PRUEBAS="$(pruebas "$CID")"; BASE_FOTOS="$(con_foto)"

echo; echo "2) La Pi baja la referencia sola (huella de la configuracion)"
T0=$SECONDS
afirmar "esperar '[ \$(referencias) -ge 1 ] && echo true' 360" "referencia en disco"
echo "   tardo $((SECONDS - T0)) s"

echo; echo "3) El arte sale UNA vez en la pantalla (15 s)"
docker exec $PI sh -c "cp /camara/unicos/2.jpg /camara/.u.jpg && mv /camara/.u.jpg /camara/una.jpg"
T0=$SECONDS
afirmar "esperar '[ \$(pruebas $CID) -gt $BASE_PRUEBAS ] && echo true' 150" "llego su foto de prueba ligada a la campana"
echo "   tardo $((SECONDS - T0)) s"
afirmar "[ \"\$(con_foto)\" = \"$BASE_FOTOS\" ]" "no cuenta como creativo nuevo"
afirmar "docker logs --since 5m $PI 2>&1 | grep -q 'Campana $CID vista en la pantalla'" "queda en el registro del equipo"

echo; echo "4) Vuelve a salir: hoy ya tiene su prueba"
docker exec $PI sh -c "cp /camara/unicos/2.jpg /camara/.u.jpg && mv /camara/.u.jpg /camara/una.jpg"
sleep 120
afirmar "[ \"\$(pruebas $CID)\" = \"\$((BASE_PRUEBAS + 1))\" ]" "una sola prueba al dia"

echo; echo "5) SPACE OS ya no la manda (cancelada o vencida)"
R3="$(sej -X POST "$API/api/campaigns/sincronizar" -d '{"origen":"spaceos:ensayo","campanas":[]}')"
afirmar "[ \"\$(echo '$R3' | jq_ 'o.apagadas')\" = 1 ]" "se apaga en Space Eye"
afirmar "esperar '[ \$(referencias) = 0 ] && echo true' 360" "la Pi borra su referencia"
afirmar "[ \"\$(echo \"SELECT COUNT(*) FROM photos WHERE campaign_id=$CID\" | sql)\" -ge 1 ]" "las pruebas siguen ligadas (nada se borra)"

echo
[ "$fallos" -eq 0 ] && echo "TODO BIEN." || echo "$fallos FALLAS."
exit "$fallos"
