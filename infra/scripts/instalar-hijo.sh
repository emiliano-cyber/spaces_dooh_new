#!/usr/bin/env bash
# ============================================================================
#  instalar-hijo.sh — el instalador que corre DENTRO del droplet del cliente.
#  (ADR 0032, tarea 8)
# ----------------------------------------------------------------------------
# ===USO-INICIO===
#  Se corre COMO ROOT, EN LA PROPIA MAQUINA que el cliente creo y paga. La
#  direccion se invierte respecto de `provision-instancia.sh`: aquel empuja por
#  ssh desde nuestra maquina; este lo lanza el cliente en la suya. No hay
#  `remoto()` porque no hace falta red para llegar al servidor: ya estamos en
#  el.
#
#  Uso:
#    instalar-hijo.sh --instancia <nombre> --dominio <dominio> \
#        --flota-token <token> --licencia <dir> --contacto <correo> \
#        [--spaces-key <k> --spaces-secret <s> --spaces-bucket <b>] \
#        [--confirmar | --dry-run]
#
#  NADA se ejecuta sin `--confirmar`. Sin esa bandera el guion se comporta como
#  `--dry-run` aunque no se pida: esto crea roles de base de datos, escribe
#  secretos en disco y pide un certificado de verdad, y el modo por omision de
#  algo asi es «cuentame que harias». Misma disciplina que
#  `provision-instancia.sh`.
#
#  Variables de entorno (nunca argumentos, para que no acaben en `ps` ni en el
#  historial de la shell):
#    REGISTRY        (obligatoria)  registry.digitalocean.com/<nombre>
#    REGISTRY_TOKEN  (obligatoria con --confirmar)  de SOLO LECTURA
#
#  Lo que este guion NO hace, y es deliberado:
#   · NO crea el droplet: el cliente ya lo creo, en SU cuenta.
#   · NO toca el DNS: el cliente ya lo apunto antes de bajar este instalador
#     (asi lo dice su tarjeta, `docs/evidencias/alta-droplet-propio.txt`).
#   · NO deja el canal en `beta`: una instancia de cliente sigue SIEMPRE
#     `estable` (invariante 13). No es un argumento a proposito.
# ===USO-FIN===
# ============================================================================
set -euo pipefail

# ─── Codigos de salida ──────────────────────────────────────────────────────
EX_USO=64        # argumentos mal, o un dato de entrada no tiene forma valida
EX_ENTORNO=1     # falta una herramienta o un archivo que el paquete deberia traer
EX_ROOT=2        # no es root, o no es Ubuntu 22.04
EX_LICENCIA=8    # la licencia no verifica (mismo numero que EX_LICENCIA en update.sh)
EX_FALLA=3       # un paso que se ejecuto de verdad no salio bien

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# ─── Lo que este paquete trae consigo ───────────────────────────────────────
SETUP_DROPLET="$RAIZ/infra/scripts/setup-droplet.sh"
UPDATE_SH="$RAIZ/infra/scripts/update.sh"
RESPALDO_SH="$RAIZ/infra/scripts/respaldo.sh"
MIGRAR_MJS="$RAIZ/scripts/migrar.mjs"
TPL_APP="$RAIZ/infra/env/app.env.example"
TPL_INST="$RAIZ/infra/env/instancia.env.example"
TPL_NGINX_NORMAL="$RAIZ/infra/nginx/instancia.conf.tpl"
TPL_NGINX_SIN_LICENCIA="$RAIZ/infra/nginx/instancia-sin-licencia.conf.tpl"
TPL_LICENCIA_HTML="$RAIZ/infra/nginx/publico/licencia-vencida.html"
LICENCIA_PUB_ORIGEN="$RAIZ/infra/licencias/space-os.pub"

uso() { sed -n '/^# ===USO-INICIO===$/,/^# ===USO-FIN===$/p' "$0" | sed '1d;$d'; }

# ─── Argumentos ──────────────────────────────────────────────────────────────
INSTANCIA=""
DOMINIO=""
FLOTA_TOKEN=""
LICENCIA_ORIGEN=""
CONTACTO=""
SPACES_KEY=""
SPACES_SECRET=""
SPACES_BUCKET=""
CONFIRMAR=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --instancia)      INSTANCIA="${2:-}"; shift 2 ;;
    --dominio)        DOMINIO="${2:-}"; shift 2 ;;
    --flota-token)    FLOTA_TOKEN="${2:-}"; shift 2 ;;
    --licencia)       LICENCIA_ORIGEN="${2:-}"; shift 2 ;;
    --contacto)       CONTACTO="${2:-}"; shift 2 ;;
    --spaces-key)     SPACES_KEY="${2:-}"; shift 2 ;;
    --spaces-secret)  SPACES_SECRET="${2:-}"; shift 2 ;;
    --spaces-bucket)  SPACES_BUCKET="${2:-}"; shift 2 ;;
    --confirmar)      CONFIRMAR=1; shift ;;
    --dry-run)        CONFIRMAR=0; shift ;;
    -h|--ayuda|--help) uso; exit 0 ;;
    *) echo "instalar-hijo: argumento desconocido: $1" >&2; uso >&2; exit "$EX_USO" ;;
  esac
done

# ─── Validacion de argumentos ────────────────────────────────────────────────
# Todo lo que el operador escribe se revisa ANTES de mirar un solo archivo del
# paquete: es el dato mas facil de equivocar (una `y` de mas, un dominio sin
# apuntar todavia), y el mensaje tiene que senalar ESO, no una plantilla que
# falte tres pasos despues.
[[ -n "$INSTANCIA" ]]     || { echo "instalar-hijo: falta --instancia <nombre>" >&2; exit "$EX_USO"; }
[[ -n "$DOMINIO" ]]       || { echo "instalar-hijo: falta --dominio <dominio>" >&2; exit "$EX_USO"; }
[[ -n "$FLOTA_TOKEN" ]]   || { echo "instalar-hijo: falta --flota-token <token>" >&2; exit "$EX_USO"; }
[[ -n "$LICENCIA_ORIGEN" ]] || { echo "instalar-hijo: falta --licencia <directorio>" >&2; exit "$EX_USO"; }

# `--contacto` no esta en la lista de argumentos del brief, y por eso es
# OPCIONAL y no se exige: la prueba en seco de la tarea 2 del brief la invoca
# sin el, verbatim, y esta linea no puede romper ese caso. Sin el se deriva de
# `--dominio` -- parametrico, nunca un valor real quemado -- y se avisa, para
# que quien instala de verdad decida a proposito si quiere un correo distinto.
# Es la direccion a la que escribe el cliente si la licencia vence, y tambien
# la que recibe los avisos de vencimiento de Let's Encrypt.

# Mismo patron que `NOMBRE_VALIDO_INSTANCIA` en apps/flota/licencia.mjs: si no
# coincide aqui, la licencia tampoco va a anclar despues y es mejor saberlo ya.
if ! [[ "$INSTANCIA" =~ ^[a-z0-9][a-z0-9-]{0,39}$ ]]; then
  echo "instalar-hijo: --instancia '$INSTANCIA' no es un nombre valido (minusculas, digitos, guiones, max 40)" >&2
  exit "$EX_USO"
fi
# El dominio se valida de verdad: un espacio o una barra acaban dentro de un
# `sed` y de un `server_name`, y el sintoma aparece mucho despues, cuando nginx
# no arranca. Mismo patron que `provision-instancia.sh`.
if ! [[ "$DOMINIO" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]; then
  echo "instalar-hijo: --dominio '$DOMINIO' no parece un dominio." >&2
  exit "$EX_USO"
fi
if [[ -z "$CONTACTO" ]]; then
  CONTACTO="soporte@$DOMINIO"
  echo "  aviso: sin --contacto, se usa '$CONTACTO' (derivado de --dominio). Si no es la direccion correcta, para y repite con --contacto." >&2
elif ! [[ "$CONTACTO" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "instalar-hijo: --contacto '$CONTACTO' no parece un correo." >&2
  exit "$EX_USO"
fi
# Las tres llaves de Spaces son un todo-o-nada: una a medias no rompe con un
# error claro en `s3cmd`, rompe en silencio (sube con una credencial vacia, o
# ni intenta). Mejor pararse aqui que adivinar cual falta.
N_SPACES=0
[[ -n "$SPACES_KEY" ]]    && N_SPACES=$((N_SPACES + 1))
[[ -n "$SPACES_SECRET" ]] && N_SPACES=$((N_SPACES + 1))
[[ -n "$SPACES_BUCKET" ]] && N_SPACES=$((N_SPACES + 1))
if [[ "$N_SPACES" -gt 0 && "$N_SPACES" -lt 3 ]]; then
  echo "instalar-hijo: --spaces-key, --spaces-secret y --spaces-bucket van juntas o ninguna. No se adivina cual falta." >&2
  exit "$EX_USO"
fi

command -v sed >/dev/null 2>&1 || { echo "instalar-hijo: falta 'sed' en esta maquina" >&2; exit "$EX_ENTORNO"; }

# ─── El registro de imagenes, por ENTORNO y no por argumento ────────────────
# Mismos dos motivos que en `provision-instancia.sh`: el token no debe
# aparecer en `ps` ni en el historial, y el nombre del registro no se quema en
# un archivo versionado (regla de CLAUDE.md). Se DECLARAN aqui pero se
# COMPRUEBAN mas abajo, despues de la licencia: un dato que el cliente
# proporciona (la licencia) se revisa antes que uno de configuracion del
# entorno de quien instala.
REGISTRY="${REGISTRY:-}"
REGISTRY_TOKEN="${REGISTRY_TOKEN:-}"
IMAGEN_NOMBRE="${IMAGEN_NOMBRE:-space-os}"
# Nunca `beta`: es la instancia de un cliente. No hay bandera para cambiarlo.
CANAL=estable

DRY_ETIQUETA="[SIMULACION]"
[[ "$CONFIRMAR" -eq 1 ]] && DRY_ETIQUETA=""

paso() { printf '\n── %s\n' "$*"; }

# Corre un comando de verdad, o lo imprime sin tocar nada. Todo pasa por aqui a
# proposito -- un `if $CONFIRMAR` repetido en cada sitio es donde se cuela el
# paso que si se ejecuta porque alguien olvido uno.
ejecutar() {
  if [[ "$CONFIRMAR" -eq 1 ]]; then
    "$@"
  else
    printf '%s' "$DRY_ETIQUETA"
    printf ' %q' "$@"
    printf '\n'
  fi
}

# Escribe un archivo LOCAL por la entrada estandar. Modo por omision 600
# porque la mayoria de lo que se escribe con esto lleva secretos.
escribir() {
  local destino="$1" modo="${2:-600}"
  if [[ "$CONFIRMAR" -eq 1 ]]; then
    install -m "$modo" /dev/null "$destino" && cat > "$destino"
  else
    cat >/dev/null
    printf '%s escribir %s (modo %s)\n' "$DRY_ETIQUETA" "$destino" "$modo"
  fi
}

# Aplica un `sed` a una plantilla y PARA si sobrevive algun `__MARCADOR__` sin
# sustituir, ANTES de escribir nada. Se comprueba el CONTENIDO, no el archivo
# ya instalado: asi la comprobacion vale igual en `--dry-run` que con
# `--confirmar`, y el riesgo real -- sustituir un marcador y olvidar el otro --
# se cacha con una persona delante en vez de en la pantalla del cliente.
sustituir_y_verificar() {
  local plantilla="$1" destino="$2" modo="$3"; shift 3
  local tmp
  tmp="$(mktemp)"
  sed "$@" "$plantilla" > "$tmp"
  if grep -q '__[A-Z][A-Z_]*__' "$tmp"; then
    echo "instalar-hijo: PARANDO -- quedo un marcador sin sustituir camino de $destino:" >&2
    grep -o '__[A-Z][A-Z_]*__' "$tmp" | sort -u | sed 's/^/               /' >&2
    echo "               Un marcador asi en la pagina que ve el cliente es peor que" >&2
    echo "               un fallo del instalador: el fallo se ve hoy, el marcador se" >&2
    echo "               ve el dia que algo va mal y ya no hay nadie mirando." >&2
    rm -f "$tmp"
    exit "$EX_ENTORNO"
  fi
  escribir "$destino" "$modo" < "$tmp"
  rm -f "$tmp"
}

# Secretos: hex y nada mas, mismo motivo que `provision-instancia.sh` --
# `instancia.env` se sourcea en bash, y con hex no hay nada que escapar.
secreto() {
  if [[ "$CONFIRMAR" -eq 1 ]]; then
    openssl rand -hex 32
  else
    echo "__SECRETO_SIMULADO__"
  fi
}

# ============================================================================
#  Verificar la licencia ANTES DE TOCAR NADA MAS (punto 7 del brief)
# ----------------------------------------------------------------------------
#  Corre SIEMPRE, con o sin --confirmar: es una lectura, no tiene efecto
#  secundario, y fallar aqui con una persona delante es infinitamente mejor
#  que fallar esa noche en el cron sin nadie mirando. Mismo algoritmo que
#  `licencia_valida()` en update.sh, en el mismo orden: primero que los
#  archivos existan, despues la llave publica, despues la firma, y solo con
#  la firma valida se leen y comparan los campos.
# ============================================================================
verificar_licencia() {
  local json="$LICENCIA_ORIGEN/licencia.json"
  local firma="$LICENCIA_ORIGEN/licencia.firma"

  [[ -f "$json" ]] || {
    echo "instalar-hijo: no hay licencia.json en $LICENCIA_ORIGEN" >&2
    exit "$EX_LICENCIA"
  }
  [[ -f "$firma" ]] || {
    echo "instalar-hijo: no hay licencia.firma en $LICENCIA_ORIGEN" >&2
    exit "$EX_LICENCIA"
  }
  [[ -f "$LICENCIA_PUB_ORIGEN" ]] || {
    echo "instalar-hijo: falta $LICENCIA_PUB_ORIGEN en este paquete." >&2
    echo "               Sin la llave publica no se puede comprobar NINGUNA licencia." >&2
    echo "               Genera el par con la tarjeta docs/evidencias/llaves-de-licencia.txt" >&2
    echo "               y vuelve a armar el paquete de alta." >&2
    exit "$EX_ENTORNO"
  }
  command -v openssl >/dev/null 2>&1 || {
    echo "instalar-hijo: falta 'openssl' en esta maquina; no se puede comprobar la firma." >&2
    exit "$EX_ENTORNO"
  }
  case "$(openssl version 2>/dev/null)" in
    'OpenSSL 3'*) ;;
    *)
      echo "instalar-hijo: $(openssl version 2>/dev/null || echo 'version de openssl no detectada') no soporta" >&2
      echo "               'pkeyutl -verify -rawin' con Ed25519 (hace falta OpenSSL 3.0 o mas)." >&2
      exit "$EX_ENTORNO"
      ;;
  esac

  if ! openssl pkeyutl -verify -pubin -inkey "$LICENCIA_PUB_ORIGEN" -rawin \
       -in "$json" -sigfile "$firma" >/dev/null 2>&1; then
    echo "instalar-hijo: la firma de la licencia NO valida. No se instala nada." >&2
    exit "$EX_LICENCIA"
  fi

  # Solo se lee y se cree el contenido DESPUES de que la firma valide -- leer
  # antes seria confiar en un archivo que cualquiera puede escribir.
  local inst dom
  inst="$(grep -o '"instancia"[[:space:]]*:[[:space:]]*"[^"]*"' "$json" | head -n1 | sed 's/.*:[[:space:]]*"//; s/"$//')"
  dom="$(grep -o '"dominio"[[:space:]]*:[[:space:]]*"[^"]*"' "$json" | head -n1 | sed 's/.*:[[:space:]]*"//; s/"$//')"
  if [[ "$inst" != "$INSTANCIA" ]]; then
    echo "instalar-hijo: la licencia es de la instancia \"$inst\", no de \"$INSTANCIA\" (--instancia)." >&2
    exit "$EX_LICENCIA"
  fi
  if [[ "$dom" != "$DOMINIO" ]]; then
    echo "instalar-hijo: la licencia es del dominio \"$dom\", no de \"$DOMINIO\" (--dominio)." >&2
    exit "$EX_LICENCIA"
  fi
  echo "  licencia: firma valida, instancia y dominio coinciden con lo pedido"
}

verificar_licencia

# ─── El resto de lo que este paquete tiene que traer ────────────────────────
# Se comprueba TODO antes de tocar el servidor, igual que
# `provision-instancia.sh`: pararse a la mitad deja una maquina con roles
# creados y el entorno a medio escribir, que es el peor sitio para pararse
# porque parece hecha.
for t in "$SETUP_DROPLET" "$UPDATE_SH" "$RESPALDO_SH" "$MIGRAR_MJS" \
         "$TPL_APP" "$TPL_INST" "$TPL_NGINX_NORMAL" "$TPL_NGINX_SIN_LICENCIA" \
         "$TPL_LICENCIA_HTML"; do
  [[ -f "$t" ]] || { echo "instalar-hijo: falta $t en este paquete" >&2; exit "$EX_ENTORNO"; }
done

[[ -n "$REGISTRY" ]] || {
  echo "instalar-hijo: falta REGISTRY en el entorno (p. ej. registry.digitalocean.com/<nombre>)." >&2
  echo "               Va por entorno, no por argumento: no se quema en el repo." >&2
  exit "$EX_USO"
}
if [[ "$CONFIRMAR" -eq 1 && -z "$REGISTRY_TOKEN" ]]; then
  echo "instalar-hijo: falta REGISTRY_TOKEN (de SOLO LECTURA) en el entorno para bajar la imagen." >&2
  exit "$EX_USO"
fi

# ─── Root y Ubuntu 22.04, como setup-droplet.sh ─────────────────────────────
# Gateado por --confirmar, igual que todo lo demas: en seco, cualquiera puede
# leer el plan sin tener que hacerlo desde una maquina que ya es root.
if [[ "$CONFIRMAR" -eq 1 ]]; then
  if [[ "$EUID" -ne 0 ]]; then
    echo "instalar-hijo: hay que correr esto como root." >&2
    exit "$EX_ROOT"
  fi
  # shellcheck disable=SC1091
  . /etc/os-release 2>/dev/null || true
  if [[ "${VERSION_ID:-}" != "22.04" ]]; then
    echo "instalar-hijo: esta maquina no es Ubuntu 22.04 (VERSION_ID=${VERSION_ID:-desconocido})." >&2
    echo "               setup-droplet.sh se escribio y se probo solo contra esa version." >&2
    exit "$EX_ROOT"
  fi
else
  echo "  $DRY_ETIQUETA se comprobaria: EUID=0 (root) y Ubuntu 22.04"
fi

if [[ "$N_SPACES" -eq 0 ]]; then
  cat <<'AVISO'

  ################################################################
  #  ⚠️  SIN CREDENCIALES DE SPACES: ESTA INSTANCIA QUEDA SIN     #
  #      RESPALDO NI LOG FUERA DEL DROPLET                        #
  ################################################################

  No se pasaron --spaces-key / --spaces-secret / --spaces-bucket. La
  instancia se sirve igual -- una maquina a medias es peor que una
  servida sin respaldo remoto -- pero cada corrida del actualizador,
  cada noche, va a fallar ABIERTO al intentar subir el respaldo y el
  log, y va a decirlo en su propio registro. Si esto no fue a
  proposito, para y consigue las tres claves antes de --confirmar.

AVISO
fi

if [[ "$CONFIRMAR" -eq 0 ]]; then
  echo ""
  echo "  ############################################################"
  echo "  #  SIMULACION. No se toca nada.                            #"
  echo "  #  Para instalar de verdad, repite con --confirmar.        #"
  echo "  ############################################################"
fi

# ─── 1 · Base del servidor ──────────────────────────────────────────────────
paso "Base del servidor (Docker, PostgreSQL, nginx, certbot, ufw)"
ejecutar bash "$SETUP_DROPLET"

# ─── 2 · Base de datos: DOS roles ───────────────────────────────────────────
# Mismo diseno que `provision-instancia.sh`, corrido en la propia maquina en
# vez de por ssh. Ver ahi el porque de NOBYPASSRLS en el rol de la app y
# BYPASSRLS en el de migracion -- la explicacion no cambia por correr local.
paso "Base de datos"
CLAVE_APP="$(secreto)"
CLAVE_MIGRADOR="$(secreto)"
URL_MIGRADOR="postgresql://spaces_migrador:$CLAVE_MIGRADOR@127.0.0.1:5432/spaces"

ejecutar sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
  "create role spaces_app login password '$CLAVE_APP' nosuperuser nocreatedb nocreaterole noinherit nobypassrls"
ejecutar sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
  "create role spaces_migrador login password '$CLAVE_MIGRADOR' nosuperuser nocreaterole noinherit bypassrls"
ejecutar sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
  "create database spaces owner spaces_migrador"

# ─── 3 · La llave publica de licencia ───────────────────────────────────────
paso "Llave publica de licencia"
ejecutar mkdir -p /opt/space-os
escribir /opt/space-os/space-os.pub 644 < "$LICENCIA_PUB_ORIGEN"

# ─── 4 · La licencia, ya verificada arriba ──────────────────────────────────
paso "Licencia"
ejecutar mkdir -p /etc/space-os/licencia
escribir /etc/space-os/licencia/licencia.json 600 < "$LICENCIA_ORIGEN/licencia.json"
escribir /etc/space-os/licencia/licencia.firma 600 < "$LICENCIA_ORIGEN/licencia.firma"

# ─── 5 · Los dos archivos de entorno ────────────────────────────────────────
paso "Entorno"
BOOTSTRAP_TOKEN="$(secreto)"
ejecutar mkdir -p /etc/space-os

# `DOCKER_OPCIONES_APP` puede traer ya un valor en la plantilla (hoy
# `--network host`): se COMPONE con el, no se pisa. Montar el DIRECTORIO de la
# licencia y no el archivo suelto es lo que deja que una renovacion la vea el
# contenedor sin reiniciarlo -- un archivo montado ata el montaje a su inodo,
# y la licencia nueva quedaria invisible para siempre.
VALOR_DOCKER_OPCIONES_APP="$(grep '^DOCKER_OPCIONES_APP=' "$TPL_INST" | head -n1 | sed 's/^DOCKER_OPCIONES_APP=//; s/^"//; s/"$//')"
DOCKER_OPCIONES_APP_NUEVO="${VALOR_DOCKER_OPCIONES_APP} -v /etc/space-os/licencia:/etc/space-os/licencia:ro"

sed_args_inst=(
  -e "s#^INSTANCIA=.*#INSTANCIA=$INSTANCIA#"
  -e "s#^DATABASE_URL=.*#DATABASE_URL=$URL_MIGRADOR#"
  -e "s#^REGISTRY=.*#REGISTRY=$REGISTRY#"
  -e "s#^REGISTRY_TOKEN=.*#REGISTRY_TOKEN=$REGISTRY_TOKEN#"
  -e "s#^CANAL=.*#CANAL=$CANAL#"
  -e "s#^DOCKER_OPCIONES_APP=.*#DOCKER_OPCIONES_APP=\"$DOCKER_OPCIONES_APP_NUEVO\"#"
)
[[ -n "$SPACES_KEY" ]]    && sed_args_inst+=(-e "s#^SPACES_KEY=.*#SPACES_KEY=$SPACES_KEY#")
[[ -n "$SPACES_SECRET" ]] && sed_args_inst+=(-e "s#^SPACES_SECRET=.*#SPACES_SECRET=$SPACES_SECRET#")
[[ -n "$SPACES_BUCKET" ]] && sed_args_inst+=(-e "s#^SPACES_BUCKET=.*#SPACES_BUCKET=$SPACES_BUCKET#")

TMP_INST="$(mktemp)"
sed "${sed_args_inst[@]}" "$TPL_INST" > "$TMP_INST"
{
  printf '\n'
  printf '# ─── Anadidas por instalar-hijo.sh (ADR 0032, tarea 8) ────────────────\n'
  printf '# No viven como VALORES ACTIVOS en la plantilla: su sola presencia\n'
  printf '# enciende un mecanismo (el apagado por licencia, el anclaje de dominio\n'
  printf '# de licencia_valida() en update.sh). La plantilla solo lleva DOMINIO\n'
  printf '# comentada, como documentacion.\n'
  printf 'DOMINIO=%s\n' "$DOMINIO"
  printf 'LICENCIA_REQUERIDA=1\n'
} >> "$TMP_INST"
escribir /etc/space-os/instancia.env 600 < "$TMP_INST"
rm -f "$TMP_INST"

sed \
  -e "s#^APP_URL=.*#APP_URL=https://$DOMINIO#" \
  -e "s#^DATABASE_URL=.*#DATABASE_URL=postgresql://spaces_app:$CLAVE_APP@127.0.0.1:5432/spaces#" \
  -e "s#^GOOGLE_REDIRECT_URI=.*#GOOGLE_REDIRECT_URI=https://$DOMINIO/spaces-dooh/api/auth/google/callback/#" \
  -e "s#^BOOTSTRAP_TOKEN=.*#BOOTSTRAP_TOKEN=$BOOTSTRAP_TOKEN#" \
  -e "s#^FLOTA_TOKEN=.*#FLOTA_TOKEN=$FLOTA_TOKEN#" \
  -e "s#^CANAL=.*#CANAL=$CANAL#" \
  "$TPL_APP" | escribir /etc/space-os/app.env 600

# ─── 6 · docker login ───────────────────────────────────────────────────────
paso "Entrando al registro de imagenes"
REGISTRY_HOST="${REGISTRY%%/*}"
if [[ "$CONFIRMAR" -eq 1 ]]; then
  printf '%s' "$REGISTRY_TOKEN" | docker login "$REGISTRY_HOST" --username "$REGISTRY_TOKEN" --password-stdin >/dev/null
else
  printf '%s docker login %s (token por stdin)\n' "$DRY_ETIQUETA" "$REGISTRY_HOST"
fi

# ─── 7 · Esquema y migraciones ──────────────────────────────────────────────
# No esta en la lista de pasos del brief, pero sin esto "primera corrida de
# update.sh" no tiene contra que base actualizar: `update.sh` migra una base
# que YA EXISTE, no la crea. Mismo orden y mismos comandos que
# `provision-instancia.sh` (el esquema base sale de la imagen, y se aplica
# como `spaces_migrador` para que las migraciones que alteran esas tablas mas
# tarde no choquen con el dueno).
paso "Esquema y migraciones"
IMAGEN="$REGISTRY/$IMAGEN_NOMBRE:$CANAL"
ejecutar docker pull "$IMAGEN"
if [[ "$CONFIRMAR" -eq 1 ]]; then
  docker run --rm "$IMAGEN" cat /app/db/schema.sql > /tmp/space-os-schema.sql
  PGPASSWORD="$CLAVE_MIGRADOR" psql -h 127.0.0.1 -U spaces_migrador -d spaces -v ON_ERROR_STOP=1 -f /tmp/space-os-schema.sql
  rm -f /tmp/space-os-schema.sql
  docker run --rm --network host --env DATABASE_URL="$URL_MIGRADOR" "$IMAGEN" node scripts/migrar.mjs --instalacion-nueva
else
  printf '%s docker run --rm %s cat /app/db/schema.sql > (esquema local) ; psql -f (esquema local)\n' "$DRY_ETIQUETA" "$IMAGEN"
  printf '%s docker run --rm --network host --env DATABASE_URL=(oculta) %s node scripts/migrar.mjs --instalacion-nueva\n' "$DRY_ETIQUETA" "$IMAGEN"
fi

# ─── 8 · Los dos sitios de nginx ────────────────────────────────────────────
# `update.sh` decide cual de los dos sirve con un enlace simbolico
# (`NGINX_SITIO_ACTIVO`), y sus rutas por omision derivan del DOMINIO:
#   normal        -> /etc/nginx/sites-available/$DOMINIO
#   sin-licencia  -> /etc/nginx/sites-available/$DOMINIO-sin-licencia.conf
#   activo        -> /etc/nginx/sites-enabled/$DOMINIO
# Y coinciden EXACTAMENTE con lo que instala `provision-instancia.sh:284-287`
# para el sitio normal -- las rutas de las dos herramientas coinciden, no hizo
# falta reconciliar nada.
#
# Los dos archivos de nginx necesitan el certificado para arrancar (referencian
# /etc/letsencrypt/live/$DOMINIO/), y el certificado es el ULTIMO paso: por eso
# el sitio SIN-LICENCIA se escribe ya con su contenido final (no se activa
# hasta que update.sh decida servirlo, y para entonces el certificado ya
# existe), y el sitio NORMAL se escribe con un vhost PROVISIONAL de solo HTTP
# que sirve el reto de ACME -- el mismo patron que `provision-instancia.sh`.
paso "nginx: sitio sin-licencia (contenido final)"
CONTACTO_SED="$(printf '%s' "$CONTACTO" | sed 's/[&/\]/\\&/g')"
DOMINIO_SED="$(printf '%s' "$DOMINIO" | sed 's/[&/\]/\\&/g')"
sustituir_y_verificar "$TPL_NGINX_SIN_LICENCIA" "/etc/nginx/sites-available/$DOMINIO-sin-licencia.conf" 644 \
  -e "s/__DOMINIO__/$DOMINIO_SED/g" -e "s/__CONTACTO__/$CONTACTO_SED/g"

paso "La pagina de licencia vencida"
ejecutar mkdir -p /var/www/space-os-licencia
# Se sustituyen los DOS marcadores en los TRES archivos, siempre, aunque uno de
# ellos no aparezca como placeholder funcional en este archivo en particular:
# `licencia-vencida.html` menciona `__DOMINIO__` dentro de un comentario HTML
# (documentacion sobre la convencion de `instancia-sin-licencia.conf.tpl`), y
# ese comentario sobrevive intacto en el HTML final. Sustituir ahi tambien
# evita que la comprobacion de "no quedo ningun marcador" (mas abajo) confunda
# una mencion de documentacion con un marcador de verdad sin sustituir -- sin
# aumentar el riesgo: sustituir un marcador que no esta no hace nada.
sustituir_y_verificar "$TPL_LICENCIA_HTML" /var/www/space-os-licencia/licencia-vencida.html 644 \
  -e "s/__DOMINIO__/$DOMINIO_SED/g" -e "s/__CONTACTO__/$CONTACTO_SED/g"

paso "nginx: sitio normal (provisional, solo HTTP, para el reto de ACME)"
ejecutar mkdir -p /var/www/html/.well-known/acme-challenge
cat <<NGINX | escribir "/etc/nginx/sites-available/$DOMINIO" 644
# Provisional: solo sirve el reto de ACME hasta que exista el certificado.
# Lo sustituye el paso de "certificado", mas abajo, con instancia.conf.tpl.
server {
  listen 80;
  listen [::]:80;
  server_name $DOMINIO;
  location /.well-known/acme-challenge/ { root /var/www/html; }
  location / { return 503 "instancia en aprovisionamiento\n"; }
}
NGINX
ejecutar ln -sfn "/etc/nginx/sites-available/$DOMINIO" "/etc/nginx/sites-enabled/$DOMINIO"
ejecutar bash -c "nginx -t && systemctl reload nginx"

# ─── 9 · El actualizador y su cron ──────────────────────────────────────────
# Tampoco esta en la lista del brief, pero es lo que instala
# `provision-instancia.sh:657-673` justo antes de "levantar la aplicacion", y
# sin `respaldo.sh` AL LADO de `update.sh` cada corrida del cron aborta
# (`update.sh` lo exige con EX_CONFIG). Sin este paso, "primera corrida de
# update.sh" no tiene que correr.
paso "Actualizador"
ejecutar mkdir -p /opt/space-os /var/log/space-os
escribir /opt/space-os/update.sh 750 < "$UPDATE_SH"
escribir /opt/space-os/respaldo.sh 750 < "$RESPALDO_SH"
escribir /opt/space-os/migrar.mjs 640 < "$MIGRAR_MJS"
cat <<'CRON' | escribir /etc/cron.d/space-os-update 644
# La instancia se actualiza SOLA. Nadie entra por ssh desde fuera a desplegar.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
17 4 * * * root /opt/space-os/update.sh >> /var/log/space-os/cron.log 2>&1
CRON

# ─── 10 · Primera corrida, sin esperar al cron ──────────────────────────────
# Si falla no se aborta: la maquina ya esta aprovisionada y el cron la
# reintenta a las 4:17. Mismo criterio que `provision-instancia.sh` -- abortar
# aqui convertiria una instancia buena en un alta fallida.
paso "Levantando la aplicacion"
if [[ "$CONFIRMAR" -eq 1 ]]; then
  if /opt/space-os/update.sh; then
    echo "  la instancia ya sirve: no hay que esperar al cron de las 4:17"
  else
    echo "" >&2
    echo "  AVISO: el alta SI termino y la maquina esta lista, pero la aplicacion" >&2
    echo "         no quedo levantada. El cron lo reintentara a las 4:17. Para no" >&2
    echo "         esperar: tail -40 /var/log/space-os/update-publicable.log" >&2
  fi
else
  printf '%s /opt/space-os/update.sh\n' "$DRY_ETIQUETA"
fi

# ─── 11 · El certificado ────────────────────────────────────────────────────
# A diferencia de `provision-instancia.sh` (que se detiene aqui porque el
# owner todavia no aplico su DNS), este guion lo corre AHORA: la tarjeta del
# cliente le pide apuntar su DNS ANTES de bajar el instalador, asi que para
# cuando llega hasta aqui el dominio ya resuelve.
paso "Certificado"
ejecutar certbot certonly --webroot -w /var/www/html -n --agree-tos --no-eff-email \
  -m "$CONTACTO" -d "$DOMINIO"

paso "Instalando el vhost con TLS"
# Los DOS marcadores, aqui tambien: `instancia.conf.tpl` no usa `__CONTACTO__`
# hoy, pero sustituirlo si algun dia aparece (por ejemplo en un comentario) no
# hace nada malo, y evita el mismo falso positivo que se encontro en
# `licencia-vencida.html`.
sustituir_y_verificar "$TPL_NGINX_NORMAL" "/etc/nginx/sites-available/$DOMINIO" 644 \
  -e "s/__DOMINIO__/$DOMINIO_SED/g" -e "s/__CONTACTO__/$CONTACTO_SED/g"
ejecutar bash -c "nginx -t && systemctl reload nginx"

paso "Comprobacion"
# Se COMPARA, no se imprime lo esperado y se sale 0 -- la leccion de
# `provision-instancia.sh` sobre comprobaciones que no comparan nada.
if [[ "$CONFIRMAR" -ne 1 ]]; then
  printf '%s curl https://%s/spaces-dooh/login/ (esperando 200)\n' "$DRY_ETIQUETA" "$DOMINIO"
else
  CODIGO_LOGIN="$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMINIO/spaces-dooh/login/" || true)"
  echo "login $CODIGO_LOGIN"
  if [[ "$CODIGO_LOGIN" != "200" ]]; then
    echo "" >&2
    echo "instalar-hijo: el certificado quedo puesto y nginx sirve, pero la" >&2
    echo "               aplicacion NO responde (esperado 200, recibido '$CODIGO_LOGIN')." >&2
    echo "               Revisa: docker logs --tail 50 space-os" >&2
    exit "$EX_FALLA"
  fi
fi

cat <<FIN

╔══════════════════════════════════════════════════════════════════════╗
║  INSTALACION HECHA                                                    ║
╚══════════════════════════════════════════════════════════════════════╝

  El gate que cierra el alta no lo comprueba este guion: es que la fila de
  "$INSTANCIA" aparezca en https://space-os.io/flota/ -- eso es lo que le
  cuenta a AS OOH que la instancia esta viva sin que nadie entre a mirarla.

FIN
