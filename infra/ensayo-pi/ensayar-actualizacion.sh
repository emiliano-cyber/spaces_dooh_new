#!/usr/bin/env bash
# ============================================================================
#  Ensayo de punta a punta de la operacion remota de una Raspberry, sin Pi.
# ----------------------------------------------------------------------------
#  Contra el Space Eye local de la instancia (infra/ensayo-instancia) y la Pi
#  simulada (Dockerfile de esta carpeta, contenedor pi-simulada-1 con el agente
#  0.6.0, el que corre la Pi #13 de campo):
#
#    1. Space Eye nuevo con el agente 0.7.0 adentro: al arrancar lo publica.
#    2. "Actualizar app" desde el panel: 0.6.0 -> 0.7.0, y la actualizacion
#       instala sola python3-opencv (la Pi no lo tenia).
#    3. Una version ROTA (contesta --version pero no arranca): la Pi la prueba,
#       la instala, falla tres veces y vuelve SOLA a la 0.7.0.
#    4. "Reiniciar equipo": el agente pide `systemctl reboot` (aqui, un
#       sustituto que lo anota).
#
#  Uso, desde Git Bash en la raiz del repo:  bash infra/ensayo-pi/ensayar-actualizacion.sh
#  La llave de la instancia se lee de eyes.env y no se imprime.
# ============================================================================
set -uo pipefail
export MSYS_NO_PATHCONV=1
# Con la forma C:/...: con MSYS_NO_PATHCONV, docker de Windows no entiende /c/...
RAIZ="$(cd "$(dirname "$0")/../.." && pwd -W)"
API=http://127.0.0.1:4200
PI=pi-simulada-1
IMAGEN="${IMAGEN:-space-eye:0.16.5-local}"
WSL() { wsl.exe -d Ubuntu -- bash -lc "$1"; }
LLAVE="$(WSL 'sed -n "s/^INSTANCIA_LLAVE=//p" ~/hijo/etc/eyes.env' | tr -d '\r')"
[ -n "$LLAVE" ] || { echo "no encontre la llave de la instancia"; exit 1; }
se() { curl -s -H "Authorization: Bearer $LLAVE" -H 'Content-Type: application/json' "$@"; }
fallos=0
afirmar() { if eval "$1"; then echo "  ok     $2"; else echo "  FALLA  $2"; fallos=$((fallos+1)); fi; }
version_de() { se "$API/api/devices/$ID" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).device.app_version||"")}catch{console.log("")}})'; }
esperar_version() {  # $1 = texto esperado, $2 = segundos
  for _ in $(seq 1 "$2"); do [ "$(version_de)" = "$1" ] && return 0; sleep 1; done; return 1
}
# Tras update-eyes.sh el API vuelve a anunciar https://eyes.<dominio>, que en
# local no existe: se le devuelve la direccion que la Pi simulada si alcanza.
direccion_local() {
  WSL 'cd ~/hijo && EYES_CONF=$HOME/hijo/etc/eyes.env docker compose -p space-eyes -f opt/eyes/docker-compose.yml -f opt/eyes/ensayo-local.yml --env-file etc/eyes.env up -d api >/dev/null 2>&1'
  for _ in $(seq 1 30); do curl -sf "$API/health" >/dev/null && return 0; sleep 1; done
}

echo "0) La Pi simulada, de vuelta a la 0.6.0 (la de campo), sin OpenCV y con su misma identidad"
DATOS="$(cygpath -m "$RAIZ/../datos-locales/pi")"
ESTADO="$(docker exec $PI cat /home/pi/pi-agent/state.json 2>/dev/null)"
docker rm -f $PI >/dev/null 2>&1
docker run -d --name $PI --hostname $PI -v "$DATOS:/ensayo:ro" -v "$DATOS/camara:/camara" pi-simulada >/dev/null
docker exec $PI su pi -c 'mkdir -p ~/pi-agent && tar -xzf /ensayo/pi-agent-0.6.0.tar.gz -C ~/pi-agent && T=$(cat /ensayo/testigo.txt) && printf "{\"server_url\":\"http://host.docker.internal:4200\",\"testigo_de_alta\":\"%s\",\"camara\":{\"modo\":\"carpeta\",\"carpeta\":\"/camara\"}}
" "$T" > ~/pi-agent/config.json'
[ -n "$ESTADO" ] && printf '%s' "$ESTADO" | docker exec -i $PI su pi -c 'cat > ~/pi-agent/state.json'
sleep 12

ID="$(docker exec $PI cat /home/pi/pi-agent/state.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).device_id))')"
echo "Pi simulada: equipo #$ID, $(version_de)"

echo; echo "1) Space Eye con el agente 0.7.0 adentro"
(cd "$RAIZ/pi-agent" && npm install --omit=dev --silent >/dev/null 2>&1 && node empaquetar.js >/dev/null) || { echo "no pude empaquetar"; exit 1; }
docker build -q -f "$RAIZ/Dockerfile.instancia" -t "$IMAGEN" --build-arg VERSION="${IMAGEN#*:}" "$RAIZ" >/dev/null || { echo "no pude construir $IMAGEN"; exit 1; }
WSL "bash /mnt/c/Users/hm284/Space_eye/infra/ensayo-instancia/cambiar-version.sh $IMAGEN" | tail -3
direccion_local
afirmar "docker exec space-eyes-api-1 test -f /descargas/space-eye-pi-agent.tar.gz" "al arrancar publico el agente de Raspberry en /descargas"
afirmar "curl -s $API/space-eye-pi-agent.json | grep -q '\"0.7.0\"'" "el manifiesto publicado dice 0.7.0"
afirmar "curl -sf $API/instalar-pi.sh | grep -q 'instalar.sh'" "y el instalador de Pi nueva se puede bajar"

echo; echo "2) Actualizar desde el panel: 0.6.0 -> 0.7.0 (con OpenCV)"
afirmar "! docker exec $PI python3 -c 'import cv2' 2>/dev/null" "antes: la Pi no tiene OpenCV"
se -X POST "$API/api/devices/$ID/command" -d '{"command_type":"UPDATE_APP"}' >/dev/null
afirmar "esperar_version 'pi-agent 0.7.0' 900" "la Pi reporta pi-agent 0.7.0"
# apt en la Pi tarda (son ~80 MB); el agente ya trabaja mientras tanto.
con_opencv() { for _ in $(seq 1 120); do docker exec $PI python3 -c 'import cv2' 2>/dev/null && return 0; sleep 5; done; return 1; }
afirmar "con_opencv" "la actualizacion instalo python3-opencv sola (sin ir al sitio)"
sleep 10
afirmar "docker exec $PI test -f /home/pi/pi-agent/state.json" "conserva su identidad (state.json)"
vigilando() { for _ in $(seq 1 30); do docker exec $PI pgrep -f vision/monitor.py >/dev/null && return 0; sleep 2; done; return 1; }
afirmar "vigilando" "la vigilancia (monitor.py) esta corriendo"

echo; echo "3) Una version rota: se instala, no arranca y vuelve sola a la 0.7.0"
ROTA="$(cygpath -m "$(mktemp -d)")"   # node y docker de Windows: C:/...
(cd "$RAIZ/pi-agent" && tar --force-local -czf "$ROTA/base.tgz" src vision package.json node_modules requisitos.json)
mkdir -p "$ROTA/p" && tar --force-local -xzf "$ROTA/base.tgz" -C "$ROTA/p"
# Pasa la prueba de vida (--version) pero se cae al arrancar de verdad: el peor
# caso, el que solo atrapa el conteo de arranques fallidos.
node -e '
  const fs=require("fs"), f=process.argv[1]+"/p/src/index.js";
  let s=fs.readFileSync(f,"utf8").replace(/const VERSION = .[^;]+;/,"const VERSION = \"0.7.99\";");
  s=s.replace("const trasActualizar = actualizar.revisarArranque(log);","const trasActualizar = actualizar.revisarArranque(log); throw new Error(\"version rota a proposito\");");
  fs.writeFileSync(f,s);
  const p=process.argv[1]+"/p/package.json", j=JSON.parse(fs.readFileSync(p,"utf8")); j.version="0.7.99"; fs.writeFileSync(p,JSON.stringify(j,null,2));' "$ROTA"
(cd "$ROTA/p" && tar --force-local --format=ustar -czf ../rota.tar.gz src vision package.json node_modules requisitos.json)
SHA="$(sha256sum "$ROTA/rota.tar.gz" | cut -d' ' -f1)"
printf '{"version":"0.7.99","sha256":"%s","bytes":%s}\n' "$SHA" "$(stat -c %s "$ROTA/rota.tar.gz")" > "$ROTA/rota.json"
docker cp "$ROTA/rota.tar.gz" space-eyes-api-1:/descargas/space-eye-pi-agent.tar.gz
docker cp "$ROTA/rota.json" space-eyes-api-1:/descargas/space-eye-pi-agent.json
se -X POST "$API/api/devices/$ID/command" -d '{"command_type":"UPDATE_APP"}' >/dev/null
sleep 60
afirmar "docker logs $PI 2>&1 | grep -q 'no logro arrancar en 3 intentos; vuelvo a la anterior'" "la Pi detecto que la 0.7.99 no arranca y se revirtio"
afirmar "esperar_version 'pi-agent 0.7.0' 300" "y volvio a reportar pi-agent 0.7.0"
# Se deja publicada otra vez la buena.
docker exec space-eyes-api-1 sh -c 'cp /app/agentes/space-eye-pi-agent.tar.gz /descargas/ && cp /app/agentes/space-eye-pi-agent.json /descargas/'
rm -rf "$ROTA"

echo; echo "4) Reiniciar el equipo desde el panel"
docker exec $PI rm -f /tmp/reinicio-pedido
se -X POST "$API/api/devices/$ID/command" -d '{"command_type":"REBOOT_DEVICE"}' >/dev/null
sleep 10
afirmar "docker exec $PI grep -q 'systemctl reboot' /tmp/reinicio-pedido" "el agente pidio systemctl reboot"

echo
[ "$fallos" -eq 0 ] && echo "TODO BIEN." || echo "$fallos FALLAS."
exit "$fallos"
