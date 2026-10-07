#!/usr/bin/env bash
# ============================================================================
#  instalar.sh — deja una Raspberry Pi lista para Space Eye, UNA sola vez.
# ----------------------------------------------------------------------------
#  Despues de esto todo se hace a distancia desde SPACE OS: actualizar el
#  agente (y lo que la version nueva necesite del sistema), reiniciar el agente
#  o el equipo, cambiar la configuracion de la vigilancia.
#
#  En una Pi recien grabada (Raspberry Pi OS / Debian 13, con red):
#
#    curl -fsSL https://eyes.<dominio>/instalar-pi.sh | \
#      sudo bash -s -- --servidor https://eyes.<dominio> --codigo ABCD-2345
#
#  (O sin conectarse nunca a la Pi: el archivo de la microSD que da SPACE OS
#  corre este mismo instalador en el primer arranque.)
#
#  --servidor   el Space Eye de la empresa (de ahi baja el agente y ahi se da
#               de alta el equipo).
#  --codigo     el codigo de vinculacion de SPACE OS (Agregar dispositivo >
#               Raspberry): de un solo uso, es lo que deja entrar al equipo.
#  --testigo    el testigo de alta de los instaladores de antes (compatibilidad).
#  --usuario    con que usuario corre el agente, si no se lanza con sudo desde
#               el (el primer arranque corre como root).
#  --paquete    instalar desde un .tar.gz local en vez de bajarlo (sin red).
#  --sin-servicio  no instala el servicio de systemd (contenedores de ensayo).
#  --zona       zona horaria si la Pi esta en UTC (America/Mexico_City). El
#               horario de la pantalla se compara con la hora LOCAL: en UTC se
#               corre 6 horas y la vigilancia mira con la pantalla apagada.
#
#  Se puede correr otra vez: no duplica nada y conserva la identidad del
#  equipo (state.json), su configuracion y lo que la vigilancia aprendio.
# ============================================================================
set -euo pipefail

SERVIDOR="" TESTIGO="" CODIGO="" USUARIO="" PAQUETE="" SERVICIO=1 ZONA="America/Mexico_City"
while [ $# -gt 0 ]; do
  case "$1" in
    --servidor) SERVIDOR="${2%/}"; shift 2 ;;
    --testigo) TESTIGO="$2"; shift 2 ;;
    --codigo) CODIGO="$2"; shift 2 ;;
    --usuario) USUARIO="$2"; shift 2 ;;
    --paquete) PAQUETE="$2"; shift 2 ;;
    --sin-servicio) SERVICIO=0; shift ;;
    --zona) ZONA="$2"; shift 2 ;;
    *) echo "opcion desconocida: $1" >&2; exit 2 ;;
  esac
done

[ "$(id -u)" -eq 0 ] || { echo "hay que correrlo con sudo" >&2; exit 2; }
[ -n "$SERVIDOR" ] || { echo "falta --servidor https://eyes.<dominio>" >&2; exit 2; }

# El agente corre con el usuario que lanzo sudo, no con root: si alguien le
# metiera mano, no tendria la Pi entera.
USUARIO="${USUARIO:-${SUDO_USER:-}}"
[ -n "$USUARIO" ] && [ "$USUARIO" != root ] || { echo "correrlo con sudo desde el usuario de la Pi, o con --usuario" >&2; exit 2; }
id "$USUARIO" >/dev/null 2>&1 || { echo "no existe el usuario $USUARIO" >&2; exit 2; }
CASA="$(getent passwd "$USUARIO" | cut -d: -f6)"
DIR="$CASA/pi-agent"
paso() { echo; echo "[$1] $2"; }

# La hora local. Solo si la Pi sigue en UTC (la de fabrica): una zona que
# alguien ya eligio no se toca. El archivo de la microSD ya la pone.
ACTUAL="$(readlink /etc/localtime 2>/dev/null | sed 's|.*/zoneinfo/||')"
case "${ACTUAL:-UTC}" in
  UTC|Etc/UTC|Etc/Universal|Universal|Zulu)
    if [ -f "/usr/share/zoneinfo/$ZONA" ]; then
      if command -v timedatectl >/dev/null && timedatectl set-timezone "$ZONA" 2>/dev/null; then :
      else ln -sf "/usr/share/zoneinfo/$ZONA" /etc/localtime; echo "$ZONA" > /etc/timezone; fi
      echo "zona horaria: $ZONA (estaba en UTC)"
    fi ;;
esac

paso 1 "Paquetes del sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
# nodejs: el agente. python3-opencv: la vigilancia de la pantalla (fallas y
# creativos nuevos). vnstat: el consumo de datos que se ve en el panel.
apt-get install -y -q --no-install-recommends nodejs python3 python3-numpy python3-opencv vnstat ca-certificates curl
command -v systemctl >/dev/null && systemctl enable --now vnstat >/dev/null 2>&1 || true
node -e 'process.exit(+process.versions.node.split(".")[0] >= 18 ? 0 : 1)' \
  || { echo "node $(node -v) es viejo: hace falta 18 o mas" >&2; exit 1; }

paso 2 "El agente"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
if [ -z "$PAQUETE" ]; then
  curl -fsSL "$SERVIDOR/space-eye-pi-agent.json" -o "$TMP/meta.json"
  curl -fsSL "$SERVIDOR/space-eye-pi-agent.tar.gz" -o "$TMP/agente.tar.gz"
  ESPERADA="$(node -e 'console.log(require(process.argv[1]).sha256)' "$TMP/meta.json")"
  CALCULADA="$(sha256sum "$TMP/agente.tar.gz" | cut -d' ' -f1)"
  # Viaja por la red: la huella es lo que garantiza que es el paquete publicado.
  [ "$ESPERADA" = "$CALCULADA" ] || { echo "el paquete no coincide con su huella; no se instala" >&2; exit 1; }
  PAQUETE="$TMP/agente.tar.gz"
fi
mkdir -p "$DIR"
# Solo lo que reemplaza una actualizacion: config.json, state.json, pantalla/ y
# la cola de fotos se quedan como estan.
for c in src vision node_modules package.json requisitos.json; do rm -rf "${DIR:?}/$c"; done
tar -xzf "$PAQUETE" -C "$DIR"
VERSION="$(node "$DIR/src/index.js" --version)"
echo "    pi-agent $VERSION"

paso 3 "Configuracion"
CONFIG="$DIR/config.json"
node - "$CONFIG" "$SERVIDOR" "$TESTIGO" "$CODIGO" <<'NODE'
const fs = require('fs');
const [archivo, servidor, testigo, codigo] = process.argv.slice(2);
let c = {};
try { c = JSON.parse(fs.readFileSync(archivo, 'utf8')); } catch {}
c.server_url = servidor;
if (testigo) c.testigo_de_alta = testigo;
if (codigo) c.codigo_vinculacion = codigo;
fs.writeFileSync(archivo, JSON.stringify(c, null, 2) + '\n');
NODE
chmod 600 "$CONFIG"
chown -R "$USUARIO:$USUARIO" "$DIR"

paso 4 "Permisos para operarla a distancia"
# Lo UNICO que el agente puede hacer como root, y sin contrasena: instalar los
# paquetes que pida una version nueva y reiniciar el equipo. Nada mas.
SUDOERS=/etc/sudoers.d/space-eye-agente
cat > "$SUDOERS.tmp" <<EOF
# Space Eye: lo que el agente puede hacer como root (instalar.sh).
Cmnd_Alias SPACE_EYE_APT = /usr/bin/apt-get update *, /usr/bin/apt-get install *, \
  /usr/bin/apt-get -o DPkg\:\:Lock\:\:Timeout\=900 update *, \
  /usr/bin/apt-get -o DPkg\:\:Lock\:\:Timeout\=900 install *
$USUARIO ALL=(root) NOPASSWD: SPACE_EYE_APT, /usr/bin/systemctl reboot
EOF
chmod 440 "$SUDOERS.tmp"
visudo -cf "$SUDOERS.tmp" >/dev/null && mv "$SUDOERS.tmp" "$SUDOERS" || { rm -f "$SUDOERS.tmp"; echo "sudoers invalido" >&2; exit 1; }

if [ "$SERVICIO" -eq 1 ] && command -v systemctl >/dev/null && [ -d /run/systemd/system ]; then
  paso 5 "Servicio"
  cat > /etc/systemd/system/space-eye-agente.service <<EOF
[Unit]
Description=SPACE EYE — agente de Raspberry Pi
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USUARIO
WorkingDirectory=$DIR
ExecStart=$(command -v node) $DIR/src/index.js
# Que se levante siempre: un equipo en un espectacular no tiene quien lo reinicie.
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
  # Si el kernel se cuelga, la Pi se reinicia sola.
  mkdir -p /etc/systemd/system.conf.d
  printf '[Manager]\nRuntimeWatchdogSec=15\n' > /etc/systemd/system.conf.d/watchdog.conf
  systemctl daemon-reload
  systemctl enable space-eye-agente >/dev/null
  systemctl restart space-eye-agente
  echo "    servicio space-eye-agente activo"
fi

echo
echo "LISTO: pi-agent $VERSION contra $SERVIDOR${CODIGO:+ (con codigo de vinculacion)}${TESTIGO:+ (con testigo de alta)}."
echo "En unos segundos aparece en SPACE OS > Space Eyes > Equipos."
