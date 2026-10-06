#!/usr/bin/env bash
# ============================================================================
#  Ensayo: una Raspberry que se instala SOLA con el archivo de la microSD.
# ----------------------------------------------------------------------------
#  Raspberry Pi OS (Debian 13) aplica en el primer arranque, con cloud-init,
#  los archivos `user-data` y `network-config` de la microSD. Aqui se corre el
#  cloud-init DE VERDAD (el paquete de Debian 13) sobre una Pi simulada recien
#  "grabada", con el user-data que arma SPACE OS (lib/space-eyes-kit-pi.ts):
#
#    1. SPACE OS genera un codigo de vinculacion para una Raspberry.
#    2. Se arma el user-data con ese codigo y el servidor de la empresa.
#    3. cloud-init corre sus etapas: crea el usuario `spaceeye`, y su runcmd
#       baja el instalador y lo corre con el codigo.
#    4. La Pi aparece dada de alta, de la empresa, con el codigo gastado.
#
#  La red no se ensaya aqui (network-config se valido con netplan); el
#  contenedor ya tiene red. Lo unico que este ensayo no cubre es el arranque
#  real de una Raspberry: eso necesita una Pi con una microSD recien grabada.
#
#  Uso:  bash infra/ensayo-pi/ensayar-microsd.sh
# ============================================================================
set -uo pipefail
export MSYS_NO_PATHCONV=1
RAIZ="$(cd "$(dirname "$0")/../.." && pwd -W)"
SPACEOS="${SPACEOS:-C:/Users/hm284/spaces-space-eyes/apps/web}"
API=http://127.0.0.1:4200
SERV=http://host.docker.internal:4200
PI=pi-microsd-1
WSL() { wsl.exe -d Ubuntu -- bash -lc "$1"; }
LLAVE="$(WSL 'sed -n "s/^INSTANCIA_LLAVE=//p" ~/hijo/etc/eyes.env' | tr -d '\r')"
fallos=0
afirmar() { if eval "$1"; then echo "  ok     $2"; else echo "  FALLA  $2"; fallos=$((fallos+1)); fi; }
TMP="$(cygpath -m "$(mktemp -d)")"

echo "1) SPACE OS genera un codigo para una Raspberry"
CODIGO="$(curl -s -X POST "$API/api/vinculaciones" -H "Authorization: Bearer $LLAVE" -H 'Content-Type: application/json' \
  -H 'X-SpaceOS-Usuario: ensayo@microsd' -d '{"tipo":"raspberry","nota":"Ensayo microSD"}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).codigo||""))')"
afirmar "[ -n \"$CODIGO\" ]" "codigo $CODIGO"

echo; echo "2) El user-data, armado con el mismo codigo que usa la pantalla"
cat > "$TMP/gen.ts" <<EOF
import { writeFileSync } from 'fs'
import { userData } from '$SPACEOS/lib/space-eyes-kit-pi'
writeFileSync('$TMP/user-data', userData({ servidor: '$SERV', codigo: '$CODIGO', nombre: 'Ensayo microSD' }))
writeFileSync('$TMP/meta-data', 'instance-id: ensayo-microsd\n')
EOF
(cd "$SPACEOS" && npx tsx "$TMP/gen.ts")
afirmar "grep -q -e \"--codigo '\${CODIGO//-/}'\" \"$TMP/user-data\"" "el user-data lleva el codigo y el servidor"

echo; echo "3) Una Pi recien grabada corre cloud-init (las etapas del primer arranque)"
docker rm -f $PI >/dev/null 2>&1
docker run -d --name $PI --hostname raspberrypi -v "$TMP:/semilla:ro" pi-simulada >/dev/null
docker exec $PI sh -c 'apt-get update -qq >/dev/null && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq cloud-init >/dev/null 2>&1; cloud-init --version'
docker exec $PI sh -c 'mkdir -p /var/lib/cloud/seed/nocloud && cp /semilla/user-data /semilla/meta-data /var/lib/cloud/seed/nocloud/ \
  && printf "datasource_list: [ NoCloud ]\n" > /etc/cloud/cloud.cfg.d/99-ensayo.cfg'
docker exec $PI sh -c 'cloud-init init --local >/tmp/ci.log 2>&1; cloud-init init >>/tmp/ci.log 2>&1; \
  cloud-init modules --mode=config >>/tmp/ci.log 2>&1; cloud-init modules --mode=final >>/tmp/ci.log 2>&1; echo cloud-init termino'
afirmar "docker exec $PI id spaceeye >/dev/null 2>&1" "creo el usuario spaceeye"
afirmar "docker exec $PI passwd -S spaceeye | grep -q ' L '" "sin contrasena (bloqueada)"
afirmar "docker exec $PI test -f /home/spaceeye/pi-agent/src/index.js" "el instalador dejo el agente en /home/spaceeye/pi-agent"
afirmar "docker exec $PI grep -q codigo_vinculacion /home/spaceeye/pi-agent/config.json" "con el codigo en su config.json"
docker exec $PI tail -5 /var/log/space-eye-instalacion.log 2>/dev/null | sed 's/^/   /'

echo; echo "4) Arranca, se da de alta con el codigo y queda de la empresa"
sleep 25
ID="$(docker exec $PI cat /home/spaceeye/pi-agent/state.json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).device_id||"")}catch{console.log("")}})')"
afirmar "[ -n \"$ID\" ]" "se dio de alta (equipo #$ID)"
ESTADO="$(curl -s "$API/api/vinculaciones" -H "Authorization: Bearer $LLAVE" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const v=JSON.parse(s).vinculaciones.find(x=>x.codigo==='$CODIGO');console.log(v?v.estado+':'+(v.equipo&&v.equipo.id):'')})")"
afirmar "[ \"$ESTADO\" = \"usado:$ID\" ]" "el codigo quedo usado por ese equipo ($ESTADO)"
DUENO="$(curl -s "$API/api/devices/$ID" -H "Authorization: Bearer $LLAVE" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).device.owner||"")}catch{console.log("")}})')"
afirmar "[ \"$DUENO\" = g500 ]" "es de la empresa (dueno: ${DUENO:-ninguno})"

echo
[ "$fallos" -eq 0 ] && echo "TODO BIEN." || echo "$fallos FALLAS."
exit "$fallos"
