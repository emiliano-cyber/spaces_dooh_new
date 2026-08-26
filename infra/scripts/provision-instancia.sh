#!/usr/bin/env bash
# ============================================================================
#  provision-instancia.sh — deja una instancia de owner lista, salvo el DNS.
# ----------------------------------------------------------------------------
#  Se corre DESDE LA MAQUINA DEL OPERADOR, no dentro del droplet. Todo lo que
#  toca el servidor pasa por una sola funcion, `remoto()`, y esa funcion es
#  tambien la que respeta `--dry-run`. Un solo camino: si `--dry-run` funciona
#  en un paso, funciona en todos.
#
#  Uso:
#    provision-instancia.sh --host <ip|dns> --dominio <dominio> --instancia <nombre> --dry-run
#    provision-instancia.sh --host <ip|dns> --dominio <dominio> --instancia <nombre> --confirmar
#    provision-instancia.sh --host <ip|dns> --dominio <dominio> --emitir-certificado --confirmar
#    provision-instancia.sh --host <ip|dns> --dominio <dominio> --instancia <nombre> \
#                           --email <correo-del-dueno> --bootstrap --confirmar
#
#  NADA se ejecuta sin `--confirmar`. Sin esa bandera el script se comporta
#  como `--dry-run` aunque no se pida: aprovisionar es crear una base y un
#  usuario Dueño, y el modo por defecto de algo asi es «cuentame que harias».
#
#  ─── El alta de un owner NO es insertar una fila ───────────────────────────
#  Es aprovisionar una instancia entera: su droplet, su base, su dominio. Si
#  alguien vuelve a buscar aqui un `INSERT INTO tenants`, esta en el modelo
#  equivocado — el que murio el 2026-08-12.
#
#  ─── Lo que este script NO hace, y es deliberado ───────────────────────────
#   · NO toca el DNS del owner. La zona es suya; AS OOH no entra ahi. El script
#     se DETIENE y entrega la instruccion para que la ponga el owner.
#   · NO instala el canal `beta`. Una instancia de owner sigue `estable`
#     siempre: el invariante 13 dice que nada llega a un owner sin pasar antes
#     por el banco de pruebas.
#   · NO deja credenciales en disco del operador ni en el historial: el token
#     de arranque y la clave del Dueño se imprimen UNA VEZ.
#
#  ─── Los dos modos de servidor, y por que estan los dos ────────────────────
#  Todavia no esta decidido en que cuenta de DigitalOcean nacen las instancias
#  (§8.3 del plan). En vez de esperar, el script lleva los dos caminos:
#
#    --crear-droplet   lo crea con `doctl` en la cuenta ya configurada
#    --host <ip|dns>   usa un servidor que ya existe (el caso «cuenta del owner»)
#
#  Lo que NO se decide aqui es cual es el de por defecto: no hay ninguno. Hay
#  que elegir uno en cada corrida, a proposito.
# ============================================================================
set -euo pipefail

# ─── Codigos de salida ──────────────────────────────────────────────────────
EX_USO=64        # argumentos mal
EX_ENTORNO=1     # falta una herramienta o una plantilla
EX_REMOTO=2      # el servidor contesto mal

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TPL_APP="$RAIZ/infra/env/app.env.example"
TPL_INST="$RAIZ/infra/env/instancia.env.example"
TPL_NGINX="$RAIZ/infra/nginx/instancia.conf.tpl"

HOST=""
DOMINIO=""
INSTANCIA=""
EMAIL_DUENO=""
CREAR_DROPLET=0
CONFIRMAR=0
EMITIR_CERT=0
BOOTSTRAP=0
# Region y tamano solo se usan con --crear-droplet. Se dejan como variables de
# entorno y sin valor por defecto quemado: son decisiones de cuenta, no del
# script.
DO_REGION="${DO_REGION:-}"
DO_TAMANO="${DO_TAMANO:-}"
DO_IMAGEN="${DO_IMAGEN:-ubuntu-22-04-x64}"

uso() { sed -n '2,44p' "$0"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)                HOST="${2:-}"; shift 2 ;;
    --dominio)             DOMINIO="${2:-}"; shift 2 ;;
    --instancia)           INSTANCIA="${2:-}"; shift 2 ;;
    --email)               EMAIL_DUENO="${2:-}"; shift 2 ;;
    --crear-droplet)       CREAR_DROPLET=1; shift ;;
    --confirmar)           CONFIRMAR=1; shift ;;
    --dry-run)             CONFIRMAR=0; shift ;;
    --emitir-certificado)  EMITIR_CERT=1; shift ;;
    --bootstrap)           BOOTSTRAP=1; shift ;;
    -h|--ayuda|--help)     uso; exit 0 ;;
    *) echo "provision: argumento desconocido: $1" >&2; uso >&2; exit "$EX_USO" ;;
  esac
done

# ─── Validacion ─────────────────────────────────────────────────────────────
[[ -n "$DOMINIO" ]] || { echo "provision: falta --dominio" >&2; exit "$EX_USO"; }

if [[ "$CREAR_DROPLET" -eq 1 && -n "$HOST" ]]; then
  echo "provision: --crear-droplet y --host se excluyen. Elige uno." >&2
  exit "$EX_USO"
fi
if [[ "$CREAR_DROPLET" -eq 0 && -z "$HOST" ]]; then
  echo "provision: hace falta --host <ip|dns> o --crear-droplet." >&2
  echo "           No hay modo por defecto: en que cuenta nacen las instancias" >&2
  echo "           sigue sin decidirse (§8.3)." >&2
  exit "$EX_USO"
fi

# El dominio se valida de verdad: un dominio con un espacio o una barra acaba
# dentro de un `sed` y de un `server_name`, y el sintoma aparece mucho despues,
# cuando nginx no arranca.
if ! [[ "$DOMINIO" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]; then
  echo "provision: --dominio '$DOMINIO' no parece un dominio." >&2
  exit "$EX_USO"
fi

# ─── El unico camino que toca el servidor ───────────────────────────────────
DRY_ETIQUETA="[SIMULACION]"
[[ "$CONFIRMAR" -eq 1 ]] && DRY_ETIQUETA=""

paso() { printf '\n── %s\n' "$*"; }

# Ejecuta un comando EN EL SERVIDOR. Sin --confirmar, solo lo imprime.
#
# Todo pasa por aqui a proposito. La alternativa —un `if $DRY_RUN` en cada
# sitio— es donde se cuela el paso que si se ejecuta: basta olvidar uno.
remoto() {
  if [[ "$CONFIRMAR" -eq 1 ]]; then
    ssh -o StrictHostKeyChecking=accept-new "root@$HOST" "$@"
  else
    printf '%s ssh root@%s %s\n' "$DRY_ETIQUETA" "${HOST:-<pendiente>}" "$*"
  fi
}

# Manda un archivo al servidor por la entrada estandar: NO por argv, porque
# argv es visible en `ps` para cualquier usuario de la maquina y estos archivos
# llevan la clave de la base y los tokens.
remoto_escribir() {
  local destino="$1" modo="${2:-600}"
  if [[ "$CONFIRMAR" -eq 1 ]]; then
    ssh -o StrictHostKeyChecking=accept-new "root@$HOST" \
      "install -m $modo /dev/null '$destino' && cat > '$destino'"
  else
    cat >/dev/null
    printf '%s escribir %s (modo %s) por stdin\n' "$DRY_ETIQUETA" "$destino" "$modo"
  fi
}

local_requiere() {
  command -v "$1" >/dev/null 2>&1 || { echo "provision: falta '$1' en esta maquina" >&2; exit "$EX_ENTORNO"; }
}

# ─── Secretos: hex y nada mas ───────────────────────────────────────────────
# Hexadecimal a proposito, y no una clave "fuerte" con simbolos. La cadena de
# conexion se percent-encodea mal con facilidad —cada cliente se rompe con un
# caracter distinto, medido el 19/08— y ademas `update.sh` hace `source` de
# `instancia.env` en bash. Con hex no hay nada que escapar en ningun eslabon, y
# 32 bytes de entropia sobran.
secreto() {
  if [[ "$CONFIRMAR" -eq 1 ]]; then
    openssl rand -hex 32
  else
    echo "__SECRETO_SIMULADO__"
  fi
}

# ============================================================================
#  MODO C · --emitir-certificado   (se corre CUANDO el owner ya apunto su DNS)
# ============================================================================
if [[ "$EMITIR_CERT" -eq 1 ]]; then
  paso "Emitiendo certificado para $DOMINIO"

  # HTTP-01 por webroot y NO `--nginx`: el reto lo sirve el vhost de solo-HTTP
  # que ya quedo instalado, asi que nginx no se toca mientras tanto. Con
  # `--nginx`, certbot reescribe la configuracion por su cuenta y deja de
  # parecerse a la plantilla versionada.
  #
  # `--webroot` tampoco necesita parar nginx, que es lo que obliga
  # `--standalone` y lo que convierte una renovacion en una caida.
  remoto "certbot certonly --webroot -w /var/www/html -n --agree-tos --no-eff-email -d '$DOMINIO'"

  paso "Instalando el vhost con TLS"
  # Hasta aqui el sitio era solo HTTP. Ahora si existe el certificado, asi que
  # se puede instalar la plantilla completa: nginx NO ARRANCA si apunta a un
  # `fullchain.pem` que no existe, y por eso este paso va despues y no antes.
  [[ -f "$TPL_NGINX" ]] || { echo "provision: falta $TPL_NGINX" >&2; exit "$EX_ENTORNO"; }
  sed "s/__DOMINIO__/$DOMINIO/g" "$TPL_NGINX" \
    | remoto_escribir "/etc/nginx/sites-available/$DOMINIO" 644
  remoto "ln -sfn '/etc/nginx/sites-available/$DOMINIO' '/etc/nginx/sites-enabled/$DOMINIO'"
  remoto "nginx -t && systemctl reload nginx"

  paso "Comprobacion"
  remoto "curl -s -o /dev/null -w 'login %{http_code}\n' 'https://$DOMINIO/spaces-dooh/login/'"
  echo "Esperado: login 200"
  exit 0
fi

# ============================================================================
#  MODO D · --bootstrap   (la primera organizacion y su Dueño)
# ============================================================================
if [[ "$BOOTSTRAP" -eq 1 ]]; then
  paso "Creando la primera organizacion de $DOMINIO"

  [[ -n "$INSTANCIA" ]] || { echo "provision: --bootstrap necesita --instancia <nombre de la organizacion>" >&2; exit "$EX_USO"; }
  # El correo del Dueño es un PARAMETRO y no un marcador de posicion. Es su
  # identidad para entrar y la unica via de recuperar su contraseña: un
  # `CAMBIAME@...` deja al owner sin poder entrar el dia que pierda la clave
  # que se imprime abajo, y esa clave se imprime UNA sola vez.
  [[ -n "$EMAIL_DUENO" ]] || { echo "provision: --bootstrap necesita --email <correo del Dueño>" >&2; exit "$EX_USO"; }
  [[ "$EMAIL_DUENO" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || {
    echo "provision: --email '$EMAIL_DUENO' no parece un correo." >&2; exit "$EX_USO"; }

  # El token se lee del `app.env` del propio servidor y no se pide por
  # argumento: asi no acaba en el historial de la consola del operador.
  TOKEN_ARRANQUE="$(remoto "sed -n 's/^BOOTSTRAP_TOKEN=//p' /etc/space-os/app.env" || true)"
  if [[ "$CONFIRMAR" -eq 1 && -z "$TOKEN_ARRANQUE" ]]; then
    echo "provision: la instancia no tiene BOOTSTRAP_TOKEN." >&2
    echo "           O ya se arranco --y entonces la puerta esta cerrada sola--" >&2
    echo "           o el aprovisionamiento no llego a escribirlo." >&2
    exit "$EX_REMOTO"
  fi

  CLAVE_DUENO="$(secreto)"
  echo ""
  echo "  Estos datos se imprimen UNA VEZ y no se guardan en ningun sitio:"
  echo "    dominio:  https://$DOMINIO/spaces-dooh/login/"
  echo "    correo:   $EMAIL_DUENO"
  echo "    clave:    $CLAVE_DUENO"
  echo ""

  # La llamada va DESDE EL PROPIO SERVIDOR, por loopback: el token de arranque
  # no tiene por que cruzar internet, y asi funciona aunque el DNS todavia no
  # haya propagado.
  remoto "curl -s -o /dev/null -w 'bootstrap %{http_code}\n' \
    -X POST http://127.0.0.1:3000/spaces-dooh/api/bootstrap/ \
    -H 'Content-Type: application/json' \
    -H \"x-bootstrap-token: \$(sed -n 's/^BOOTSTRAP_TOKEN=//p' /etc/space-os/app.env)\" \
    --data-binary @-" <<JSON
{"organizacion":"$INSTANCIA","nombre":"Dueno","email":"$EMAIL_DUENO","password":"$CLAVE_DUENO"}
JSON

  echo "Esperado: bootstrap 201"
  echo ""
  echo "  La puerta ya se cerro sola: existe una organizacion, asi que"
  echo "  /api/bootstrap responde 404 desde ahora, con token o sin el."
  exit 0
fi

# ============================================================================
#  MODO A/B · aprovisionar
# ============================================================================
[[ -n "$INSTANCIA" ]] || { echo "provision: falta --instancia <nombre>" >&2; exit "$EX_USO"; }
# Se comprueba TODO lo que se va a enviar antes de tocar el servidor. Un
# archivo que falte a mitad deja la instancia con la base creada, el entorno
# escrito y el actualizador incompleto — el peor sitio para pararse, porque
# parece hecha.
for t in "$TPL_APP" "$TPL_INST" "$TPL_NGINX" \
         "$RAIZ/infra/scripts/update.sh" "$RAIZ/infra/scripts/respaldo.sh" \
         "$RAIZ/scripts/migrar.mjs"; do
  [[ -f "$t" ]] || { echo "provision: falta $t" >&2; exit "$EX_ENTORNO"; }
done
local_requiere sed
[[ "$CONFIRMAR" -eq 1 ]] && local_requiere ssh

if [[ "$CONFIRMAR" -eq 0 ]]; then
  echo ""
  echo "  ############################################################"
  echo "  #  SIMULACION. No se toca nada.                            #"
  echo "  #  Para ejecutarlo de verdad, repite con --confirmar.      #"
  echo "  ############################################################"
fi

# ─── 1 · El servidor ────────────────────────────────────────────────────────
if [[ "$CREAR_DROPLET" -eq 1 ]]; then
  paso "Creando el droplet"
  local_requiere doctl
  [[ -n "$DO_REGION" && -n "$DO_TAMANO" ]] || {
    echo "provision: con --crear-droplet hacen falta DO_REGION y DO_TAMANO en el entorno." >&2
    echo "           No tienen valor por defecto a proposito: son decisiones de cuenta." >&2
    exit "$EX_USO"
  }
  if [[ "$CONFIRMAR" -eq 1 ]]; then
    doctl compute droplet create "$INSTANCIA" \
      --region "$DO_REGION" --size "$DO_TAMANO" --image "$DO_IMAGEN" --wait
    HOST="$(doctl compute droplet get "$INSTANCIA" --format PublicIPv4 --no-header)"
    echo "  droplet creado: $HOST"
  else
    echo "$DRY_ETIQUETA doctl compute droplet create $INSTANCIA --region $DO_REGION --size $DO_TAMANO --wait"
    HOST="<ip-del-droplet-nuevo>"
  fi

  paso "Base del servidor (Node, nginx, certbot, ufw)"
  remoto "bash -s" < "$RAIZ/infra/scripts/setup-droplet.sh"
fi

# ─── 2 · Base de datos: DOS roles ───────────────────────────────────────────
paso "Base de datos"
CLAVE_APP="$(secreto)"

# El rol de la aplicacion es NOSUPERUSER **y NOBYPASSRLS**, y las dos palabras
# hacen falta. Un rol que atraviesa la RLS funciona perfectamente y sin
# aislamiento, que es la peor combinacion posible: no da ningun error.
remoto "sudo -u postgres psql -v ON_ERROR_STOP=1 -c \"create role spaces_app login password '$CLAVE_APP' nosuperuser nocreatedb nocreaterole noinherit nobypassrls\""
remoto "sudo -u postgres psql -v ON_ERROR_STOP=1 -c \"create database spaces owner postgres\""

# ─── 3 · Esquema y migraciones ──────────────────────────────────────────────
# Con el rol de MIGRACION, no con el de la app: el de la app no tiene DDL.
# `--instalacion-nueva` se verifica a si mismo, y el orden de las migraciones
# no es lexicografico puro (hay un mapa de excepciones en el runner).
paso "Esquema y migraciones"
remoto "cd /var/www/Spaces && DATABASE_URL='postgresql:///spaces?host=/var/run/postgresql' node scripts/migrar.mjs --instalacion-nueva"

# ─── 4 · Los dos archivos de entorno ────────────────────────────────────────
paso "Entorno"
TOKEN_ARRANQUE="$(secreto)"
TOKEN_FLOTA="$(secreto)"

remoto "mkdir -p /etc/space-os"

# `app.env`. Se parte de la plantilla versionada para que los COMENTARIOS
# viajen al servidor: quien abra este archivo dentro de seis meses necesita
# leer por que `COOKIE_DOMAIN` no esta, no solo que no esta.
sed \
  -e "s#^APP_URL=.*#APP_URL=https://$DOMINIO#" \
  -e "s#^DATABASE_URL=.*#DATABASE_URL=postgresql://spaces_app:$CLAVE_APP@127.0.0.1:5432/spaces#" \
  -e "s#^GOOGLE_REDIRECT_URI=.*#GOOGLE_REDIRECT_URI=https://$DOMINIO/spaces-dooh/api/auth/google/callback/#" \
  -e "s#^BOOTSTRAP_TOKEN=.*#BOOTSTRAP_TOKEN=$TOKEN_ARRANQUE#" \
  -e "s#^FLOTA_TOKEN=.*#FLOTA_TOKEN=$TOKEN_FLOTA#" \
  "$TPL_APP" | remoto_escribir /etc/space-os/app.env 600

# `instancia.env`. `REGISTRY` se queda como este en la plantilla —vacio— hasta
# que se decida el nombre del registry (TH-P4). Con el vacio, `update.sh` para
# con un error de configuracion, que es lo que hay que ver.
sed \
  -e "s#^INSTANCIA=.*#INSTANCIA=$INSTANCIA#" \
  -e "s#^DATABASE_URL=.*#DATABASE_URL=postgresql:///spaces?host=/var/run/postgresql#" \
  "$TPL_INST" | remoto_escribir /etc/space-os/instancia.env 600

# ─── 5 · nginx, TODAVIA SIN certificado ─────────────────────────────────────
paso "nginx (solo HTTP por ahora)"
# El vhost completo apunta a `/etc/letsencrypt/live/$DOMINIO/fullchain.pem`, y
# nginx NO ARRANCA si ese archivo no existe. Como el certificado no se puede
# emitir hasta que el owner apunte su DNS, aqui se instala un vhost minimo de
# solo HTTP que sirve el reto de ACME. El completo entra con
# `--emitir-certificado`.
remoto "mkdir -p /var/www/html/.well-known/acme-challenge"
remoto_escribir "/etc/nginx/sites-available/$DOMINIO" 644 <<NGINX
# Provisional: solo sirve el reto de ACME hasta que exista el certificado.
# Lo sustituye instancia.conf.tpl al correr --emitir-certificado.
server {
  listen 80;
  listen [::]:80;
  server_name $DOMINIO;
  location /.well-known/acme-challenge/ { root /var/www/html; }
  location / { return 503 "instancia en aprovisionamiento\n"; }
}
NGINX
remoto "ln -sfn '/etc/nginx/sites-available/$DOMINIO' '/etc/nginx/sites-enabled/$DOMINIO'"
remoto "nginx -t && systemctl reload nginx"

# ─── 6 · El actualizador y su cron ──────────────────────────────────────────
paso "Actualizador"
remoto "mkdir -p /opt/space-os /var/log/space-os"
remoto_escribir /opt/space-os/update.sh 750 < "$RAIZ/infra/scripts/update.sh"
# `respaldo.sh` NO es opcional, y olvidarlo no da un aviso: da una instancia
# rota en silencio. `update.sh:579-582` lo busca AL LADO SUYO y **aborta con
# EX_CONFIG si no esta** —«sin el, la instancia se actualizaria sin respaldo
# fuera del droplet y llenando el disco»—, asi que una instancia recien
# aprovisionada fallaria en CADA corrida del cron, de madrugada y sin que nadie
# mire. Se detecto al escribir el ADR 0022, no al probar el script.
remoto_escribir /opt/space-os/respaldo.sh 750 < "$RAIZ/infra/scripts/respaldo.sh"
remoto_escribir /opt/space-os/migrar.mjs 640 < "$RAIZ/scripts/migrar.mjs"
remoto_escribir /etc/cron.d/space-os-update 644 <<'CRON'
# La instancia se actualiza SOLA. El padre no entra por ssh a desplegar.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
17 4 * * * root /opt/space-os/update.sh >> /var/log/space-os/cron.log 2>&1
CRON

# ─── 7 · Alto. El DNS lo pone el owner ──────────────────────────────────────
cat <<FIN

╔══════════════════════════════════════════════════════════════════════╗
║  APROVISIONAMIENTO HECHO — Y AQUI SE PARA A PROPOSITO                ║
╚══════════════════════════════════════════════════════════════════════╝

  Lo que falta NO lo hacemos nosotros. Se le pide al owner:

      Apunta  $DOMINIO  a  ${HOST}
      con un registro A en TU propio DNS.

  La zona del owner es suya y AS OOH no entra en ella. No es una
  formalidad: es la parte de «soberana» que se puede comprobar.

  Cuando el owner confirme que ya apunta, y SOLO entonces:

      $0 --host ${HOST} --dominio $DOMINIO --emitir-certificado --confirmar
      $0 --host ${HOST} --dominio $DOMINIO --instancia $INSTANCIA \
         --email <correo-del-dueno> --bootstrap --confirmar

  Antes de que el DNS resuelva, el certificado FALLA — y Let's Encrypt
  solo permite cinco intentos por hora. Comprueba primero:

      dig +short $DOMINIO      # tiene que devolver ${HOST}

FIN
