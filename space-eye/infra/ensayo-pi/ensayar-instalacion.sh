#!/usr/bin/env bash
# ============================================================================
#  Ensayo de la instalacion de una Raspberry NUEVA con un solo comando.
# ----------------------------------------------------------------------------
#  Una Pi simulada recien "grabada" (pi-nueva-1) corre lo mismo que se correria
#  en campo:
#
#    curl -fsSL <servidor>/instalar-pi.sh | sudo bash -s -- --servidor <servidor> --testigo se_...
#
#  y despues se le QUITA el sudo amplio con el que viene la imagen de ensayo,
#  para comprobar que el agente opera solo con lo que le deja instalar.sh:
#  instalar paquetes y reiniciar el equipo, nada mas.
#
#  Uso:  bash infra/ensayo-pi/ensayar-instalacion.sh
# ============================================================================
set -uo pipefail
export MSYS_NO_PATHCONV=1
RAIZ="$(cd "$(dirname "$0")/../.." && pwd -W)"
DATOS="$(cygpath -m "$RAIZ/../datos-locales/pi")"
API=http://127.0.0.1:4200
SERV=http://host.docker.internal:4200
PI=pi-nueva-1
WSL() { wsl.exe -d Ubuntu -- bash -lc "$1"; }
LLAVE="$(WSL 'sed -n "s/^INSTANCIA_LLAVE=//p" ~/hijo/etc/eyes.env' | tr -d '\r')"
se() { curl -s -H "Authorization: Bearer $LLAVE" "$@"; }
fallos=0
afirmar() { if eval "$1"; then echo "  ok     $2"; else echo "  FALLA  $2"; fallos=$((fallos+1)); fi; }

docker rm -f $PI >/dev/null 2>&1
docker run -d --name $PI --hostname $PI -v "$DATOS:/ensayo:ro" -v "$DATOS/camara:/camara" pi-simulada >/dev/null

echo "1) Instalar con un comando (como en campo)"
docker exec $PI su pi -c "curl -fsSL $SERV/instalar-pi.sh | sudo bash -s -- --servidor $SERV --testigo \$(cat /ensayo/testigo.txt) --sin-servicio" 2>&1 | grep -E '^\[|LISTO|pi-agent|error|no ' | sed 's/^/   /'
afirmar "docker exec $PI test -f /home/pi/pi-agent/vision/monitor.py" "el agente quedo en ~/pi-agent, con su vigilancia"
afirmar "docker exec $PI python3 -c 'import cv2'" "OpenCV instalado"
afirmar "docker exec $PI test -f /etc/sudoers.d/space-eye-agente" "dejo los permisos del agente"
# La Pi de fabrica viene en UTC: el horario de la pantalla quedaria corrido 6 h.
afirmar "docker exec $PI readlink /etc/localtime | grep -q America/Mexico_City" "dejo la hora de Mexico (venia en UTC)"

echo; echo "2) Sin el sudo amplio de la imagen: solo lo que dejo instalar.sh"
docker exec $PI rm -f /etc/sudoers.d/pi
afirmar "docker exec $PI su pi -c 'sudo -n -l /usr/bin/apt-get -o DPkg::Lock::Timeout=900 install -y python3' >/dev/null 2>&1" "puede instalar paquetes (lo que pide una actualizacion)"
afirmar "docker exec $PI su pi -c 'sudo -n -l /usr/bin/systemctl reboot' >/dev/null 2>&1" "puede reiniciar el equipo"
afirmar "! docker exec $PI su pi -c 'sudo -n -l /usr/bin/apt-get remove -y bash' >/dev/null 2>&1" "NO puede desinstalar"
afirmar "! docker exec $PI su pi -c 'sudo -n -l /bin/cat /etc/shadow' >/dev/null 2>&1" "NO puede leer lo que quiera como root"

echo; echo "3) Arranca, se da de alta con su empresa y vigila"
sleep 20
ID="$(docker exec $PI cat /home/pi/pi-agent/state.json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).device_id||"")}catch{console.log("")}})')"
afirmar "[ -n \"$ID\" ]" "se dio de alta (equipo #$ID)"
DUENO="$(se "$API/api/devices/$ID" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).device.owner||"")}catch{console.log("")}})')"
afirmar "[ \"$DUENO\" = g500 ]" "nacio de la empresa del testigo (dueno: ${DUENO:-ninguno})"
vigilando() { for _ in $(seq 1 30); do docker exec $PI pgrep -f vision/monitor.py >/dev/null && return 0; sleep 2; done; return 1; }
afirmar "vigilando" "la vigilancia esta corriendo"

echo
[ "$fallos" -eq 0 ] && echo "TODO BIEN." || echo "$fallos FALLAS."
exit "$fallos"
