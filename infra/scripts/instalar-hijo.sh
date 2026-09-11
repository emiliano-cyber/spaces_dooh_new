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
#  historial de la shell). Se pasan con `sudo -E` -- `sudo` sin `-E` limpia el
#  entorno (`env_reset`) y el guion moriria en "falta REGISTRY" a pesar de
#  haberlo exportado:
#    REGISTRY        (obligatoria)  registry.digitalocean.com/<nombre>
#    REGISTRY_TOKEN  (obligatoria con --confirmar)  de SOLO LECTURA
#    PADRE_URL       (obligatoria)  https://<dominio-del-padre>, sin barra
#                     final. De ahi sale a donde esta instancia reporta su
#                     version cada noche (F6.4) y donde el cliente comprueba
#                     que su alta quedo hecha -- ninguno de los dos se quema
#                     aqui.
#
#  Lo que este guion NO hace, y es deliberado:
#   · NO crea el droplet: el cliente ya lo creo, en SU cuenta.
#   · NO toca el DNS: el cliente ya lo apunto antes de bajar este instalador
#     (asi lo dice su tarjeta, `docs/evidencias/alta-droplet-propio.txt`), y
#     este guion lo COMPRUEBA (no lo asume) antes de tocar nada.
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

# Rechaza un valor que un archivo SOURCEADO por bash (`instancia.env`,
# `app.env`, via `update.sh`) no puede llevar sin riesgo: comillas dobles,
# `$`, un backtick o una barra invertida bastan para que una asignacion se
# convierta en codigo que se ejecuta como root la proxima vez que el cron
# corra `update.sh` a las 4:17. Documentado en CLAUDE.md, y ya paso una vez
# con un espacio sin comillas -- esto va mas lejos que comillas: rechaza en
# vez de intentar escapar, porque escapar a mano este conjunto es como se
# llega al defecto de `sed` que esta misma ronda encontro (M1).
validar_valor_seguro() {
  local etiqueta="$1" valor="$2"
  case "$valor" in
    *'"'*|*'$'*|*'`'*|*'\'*)
      echo "instalar-hijo: $etiqueta trae un caracter que no se puede escribir con seguridad" >&2
      echo "               en un archivo que \`update.sh\` sourcea (comillas dobles, \$," >&2
      echo "               backtick o barra invertida). No se adivina que se quiso decir:" >&2
      echo "               se rechaza." >&2
      exit "$EX_USO"
      ;;
  esac
  if [[ "$valor" == *$'\n'* ]]; then
    echo "instalar-hijo: $etiqueta trae un salto de linea. No se escribe." >&2
    exit "$EX_USO"
  fi
}

# ─── Validacion de argumentos ────────────────────────────────────────────────
# Todo lo que el operador escribe se revisa ANTES de mirar un solo archivo del
# paquete: es el dato mas facil de equivocar (una `y` de mas, un dominio sin
# apuntar todavia), y el mensaje tiene que senalar ESO, no una plantilla que
# falte tres pasos despues.
[[ -n "$INSTANCIA" ]]     || { echo "instalar-hijo: falta --instancia <nombre>" >&2; exit "$EX_USO"; }
[[ -n "$DOMINIO" ]]       || { echo "instalar-hijo: falta --dominio <dominio>" >&2; exit "$EX_USO"; }
[[ -n "$FLOTA_TOKEN" ]]   || { echo "instalar-hijo: falta --flota-token <token>" >&2; exit "$EX_USO"; }
[[ -n "$LICENCIA_ORIGEN" ]] || { echo "instalar-hijo: falta --licencia <directorio>" >&2; exit "$EX_USO"; }
validar_valor_seguro "--flota-token" "$FLOTA_TOKEN"

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
[[ -n "$SPACES_KEY" ]]    && validar_valor_seguro "--spaces-key" "$SPACES_KEY"
[[ -n "$SPACES_SECRET" ]] && validar_valor_seguro "--spaces-secret" "$SPACES_SECRET"
[[ -n "$SPACES_BUCKET" ]] && validar_valor_seguro "--spaces-bucket" "$SPACES_BUCKET"

command -v sed >/dev/null 2>&1 || { echo "instalar-hijo: falta 'sed' en esta maquina" >&2; exit "$EX_ENTORNO"; }

# ─── El registro de imagenes y el PADRE, por ENTORNO y no por argumento ─────
# Mismos dos motivos que en `provision-instancia.sh`: el token no debe
# aparecer en `ps` ni en el historial, y ni el registro ni el dominio del
# PADRE se queman en un archivo versionado (regla de CLAUDE.md). Se DECLARAN
# aqui pero se COMPRUEBAN mas abajo, despues de la licencia: un dato que el
# cliente proporciona (la licencia) se revisa antes que uno de configuracion
# del entorno de quien instala.
REGISTRY="${REGISTRY:-}"
REGISTRY_TOKEN="${REGISTRY_TOKEN:-}"
PADRE_URL="${PADRE_URL:-}"
IMAGEN_NOMBRE="${IMAGEN_NOMBRE:-space-os}"
# Nunca `beta`: es la instancia de un cliente. No hay bandera para cambiarlo.
CANAL=estable

DRY_ETIQUETA="[SIMULACION]"
[[ "$CONFIRMAR" -eq 1 ]] && DRY_ETIQUETA=""

paso() { printf '\n── %s\n' "$*"; }

# Corre un comando de verdad, o lo imprime sin tocar nada. Todo pasa por aqui a
# proposito -- un `if $CONFIRMAR` repetido en cada sitio es donde se cuela el
# paso que si se ejecuta porque alguien olvido uno. NO USAR con un comando que
# lleve un secreto en uno de sus argumentos: `printf ' %q'` lo imprimiria
# entero en pantalla. Para eso hay funciones dedicadas mas abajo.
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
# porque la mayoria de lo que se escribe con esto lleva secretos. El
# CONTENIDO nunca pasa por un argumento de ningun proceso: solo por la
# tuberia, que no es visible en `ps`.
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
#
# Solo se usa con DOMINIO y CONTACTO, que no son secretos (viajan igual de
# claros en el propio certificado TLS y en el remitente de un correo): los
# valores que SI son secretos (tokens, claves) nunca pasan por aqui ni por
# ningun `sed -e`, para no repetir el defecto que esta ronda encontro (I6,
# M1) en un sitio nuevo.
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

# Reescribe una plantilla de entorno linea por linea, EN BASH -- nunca con
# `sed`. Dos razones, las dos de esta ronda de correccion:
#   1. `sed -e "s#...#$VALOR#"` pasa el VALOR como parte del propio programa
#      de `sed`, y ese programa es un argumento de linea de comandos: un
#      token queda en el `ps` de esta maquina mientras `sed` corre (I6).
#   2. Un valor con `&`, `/` o una barra invertida CORROMPE la sustitucion
#      -- son caracteres especiales del lado derecho de un `s///` -- y un
#      token de DigitalOcean o de Spaces puede traer cualquiera de los tres
#      sin que nadie lo note hasta que la instancia no arranca (M1, medido
#      por el revisor: `ab&cd` quedaba escrito como `abREGISTRY_TOKEN=cd`).
# Una funcion de bash no genera un proceso nuevo (no hay `exec` de por
# medio), asi que los valores tampoco aparecen en NINGUN `ps` al pasarlos
# como argumentos de esta funcion, y la comparacion de cadenas no interpreta
# nada del valor: es texto literal, siempre.
#
# Ademas ENTRECOMILLA todo lo que reemplaza. `update.sh` hace `. "$CONF"` --
# SOURCEA el archivo -- y un valor con un espacio sin comillas hace que bash
# ejecute la SEGUNDA PALABRA como si fuera un comando, como root, cada noche
# (I7; documentado tambien en CLAUDE.md). `validar_valor_seguro()` ya
# rechazo antes cualquier valor que pudiera romper las comillas mismas
# (comillas dobles, `$`, backtick, barra invertida).
reescribir_env() {
  local plantilla="$1"; shift
  local linea clave valor par encontrado
  while IFS= read -r linea || [[ -n "$linea" ]]; do
    # Si la plantilla trae CRLF (medido: un checkout de Windows con
    # `core.autocrlf=true` deja `infra/env/*.example` asi, aunque el
    # repositorio guarda LF), `read -r` solo quita el `\n` y el `\r` se queda
    # pegado al final de la linea. Sin esto, la comparacion de clave sigue
    # funcionando (el `\r` cae DESPUES del `=`), pero el VALOR que se
    # preserva de una linea sin reemplazo arrastraria el `\r`, y quien lea el
    # archivo instalado veria un caracter invisible al final de cada linea
    # asi. Se quita aqui, una sola vez, en vez de en cada sitio que use esta
    # funcion.
    linea="${linea%$'\r'}"
    if [[ "$linea" =~ ^([A-Z_][A-Z0-9_]*)= ]]; then
      clave="${BASH_REMATCH[1]}"
      encontrado=0
      for par in "$@"; do
        if [[ "$par" == "$clave="* ]]; then
          valor="${par#*=}"
          encontrado=1
          break
        fi
      done
      if [[ "$encontrado" -eq 1 ]]; then
        printf '%s="%s"\n' "$clave" "$valor"
        continue
      fi
    fi
    printf '%s\n' "$linea"
  done < "$plantilla"
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
validar_valor_seguro "REGISTRY" "$REGISTRY"
if [[ "$CONFIRMAR" -eq 1 && -z "$REGISTRY_TOKEN" ]]; then
  echo "instalar-hijo: falta REGISTRY_TOKEN (de SOLO LECTURA) en el entorno para bajar la imagen." >&2
  exit "$EX_USO"
fi
[[ -n "$REGISTRY_TOKEN" ]] && validar_valor_seguro "REGISTRY_TOKEN" "$REGISTRY_TOKEN"

[[ -n "$PADRE_URL" ]] || {
  echo "instalar-hijo: falta PADRE_URL en el entorno (https://<dominio-del-padre>, sin barra final)." >&2
  echo "               De ahi sale FLOTA_REPORTE_URL, y sin ella la instancia no" >&2
  echo "               tiene a donde contar en que version se quedo cada noche." >&2
  exit "$EX_USO"
}
if ! [[ "$PADRE_URL" =~ ^https://[a-z0-9.-]+(:[0-9]+)?$ ]]; then
  echo "instalar-hijo: PADRE_URL '$PADRE_URL' no parece 'https://dominio', sin barra final." >&2
  exit "$EX_USO"
fi
validar_valor_seguro "PADRE_URL" "$PADRE_URL"

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

# ============================================================================
#  El DNS, ANTES de tocar nada -- I9
# ----------------------------------------------------------------------------
#  Sin esto, todo el aprovisionamiento se hacia igual y era CERTBOT quien
#  reventaba al final, con la maquina ya montada y un intento de Let's
#  Encrypt gastado (limite: cinco por hora). Se comprueba aqui, de lectura
#  pura y sin tocar nada, y si el dominio no resuelve a ESTE droplet se para
#  con el registro exacto que falta -- mismo espiritu que `avanzarDns()` en
#  `apps/flota/avanzar.mjs`, que hace la misma comparacion para el alta
#  administrada.
# ============================================================================
comprobar_dns() {
  local ip_publica resueltos
  # La IP publica de ESTE droplet, desde el metadata service de
  # DigitalOcean: no depende de que ningun DNS resuelva todavia, y por eso
  # sirve como referencia. Si esta maquina no es un droplet de DigitalOcean
  # (por ejemplo, al ensayar este guion en otra maquina), el metadata no
  # contesta y la comprobacion se OMITE con aviso en vez de fallar -- no es
  # el problema que este guion existe para resolver.
  ip_publica="$(curl -s -m 5 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address 2>/dev/null || true)"
  if [[ -z "$ip_publica" ]]; then
    echo "  aviso: no se pudo leer la IP publica de este droplet (metadata de DigitalOcean no contesto); se omite la comprobacion de DNS." >&2
    return 0
  fi
  if ! command -v getent >/dev/null 2>&1; then
    echo "  aviso: no hay 'getent' en esta maquina; se omite la comprobacion de DNS." >&2
    return 0
  fi
  resueltos="$(getent hosts "$DOMINIO" 2>/dev/null | awk '{print $1}' | sort -u)"
  if [[ -z "$resueltos" ]]; then
    echo "" >&2
    echo "instalar-hijo: '$DOMINIO' todavia no resuelve a ninguna IP." >&2
    echo "               Falta un registro EN TU DNS antes de seguir:" >&2
    echo "" >&2
    echo "                 A    $DOMINIO    ->    $ip_publica" >&2
    echo "" >&2
    echo "               Apuntalo y espera a que propague (dig +short $DOMINIO tiene" >&2
    echo "               que devolver esa IP). Certbot falla si no resuelve, y Let's" >&2
    echo "               Encrypt limita a 5 intentos por hora." >&2
    exit "$EX_USO"
  fi
  if ! grep -qxF "$ip_publica" <<< "$resueltos"; then
    echo "" >&2
    echo "instalar-hijo: '$DOMINIO' resuelve a $(tr '\n' ' ' <<< "$resueltos")y no a $ip_publica (la IP de este droplet)." >&2
    echo "               Corrige el registro A en tu DNS antes de seguir:" >&2
    echo "" >&2
    echo "                 A    $DOMINIO    ->    $ip_publica" >&2
    echo "" >&2
    exit "$EX_USO"
  fi
  echo "  DNS: $DOMINIO resuelve a $ip_publica (esta maquina)"
}
comprobar_dns

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

# M11: este instalador es de UN SOLO USO por droplet -- no se hizo
# idempotente a proposito (no hace falta: un droplet propio no se reinstala,
# se destruye y se crea de nuevo). Sin este chequeo, reejecutarlo muere en
# `create role ... ya existe`, un error de Postgres que no dice nada de lo
# que en verdad paso. Se detecta ANTES y se explica.
if [[ "$CONFIRMAR" -eq 1 ]]; then
  if sudo -u postgres psql -tAc "select 1 from pg_roles where rolname='spaces_app'" 2>/dev/null | grep -q '^1$'; then
    echo "" >&2
    echo "instalar-hijo: el rol 'spaces_app' ya existe en esta maquina: este" >&2
    echo "               instalador ya se corrio aqui antes." >&2
    echo "               Es de UN SOLO USO por droplet -- no reintenta ni compone" >&2
    echo "               sobre una instalacion previa. Si de verdad quieres" >&2
    echo "               reinstalar EN ESTA maquina, borra primero lo que quedo:" >&2
    echo "" >&2
    echo "                 sudo -u postgres psql -c 'drop database if exists spaces'" >&2
    echo "                 sudo -u postgres psql -c \"drop role if exists spaces_app\"" >&2
    echo "                 sudo -u postgres psql -c \"drop role if exists spaces_migrador\"" >&2
    echo "" >&2
    echo "               Y si el problema es la maquina entera, lo mas simple es" >&2
    echo "               destruir este droplet y crear uno nuevo." >&2
    exit "$EX_FALLA"
  fi
fi

CLAVE_APP="$(secreto)"
CLAVE_MIGRADOR="$(secreto)"
URL_MIGRADOR="postgresql://spaces_migrador:$CLAVE_MIGRADOR@127.0.0.1:5432/spaces"

# El SQL entra a `psql` por la ENTRADA ESTANDAR, nunca por `-c`: un `-c` con
# la clave dentro queda en el argv de `psql`, visible para cualquier otro
# usuario de esta maquina mientras el proceso corre (I6). `printf` aqui es un
# builtin de bash -- no crea un proceso propio, asi que la clave nunca sale
# de la memoria de ESTE guion hasta que entra por la tuberia a `psql`.
crear_rol_o_base() {
  local sql="$1" sql_oculto="$2"
  if [[ "$CONFIRMAR" -eq 1 ]]; then
    printf '%s\n' "$sql" | sudo -u postgres psql -v ON_ERROR_STOP=1
  else
    printf '%s sudo -u postgres psql -v ON_ERROR_STOP=1   <<< "%s"\n' "$DRY_ETIQUETA" "$sql_oculto"
  fi
}

crear_rol_o_base \
  "create role spaces_app login password '$CLAVE_APP' nosuperuser nocreatedb nocreaterole noinherit nobypassrls;" \
  "create role spaces_app login password '(oculta)' nosuperuser nocreatedb nocreaterole noinherit nobypassrls;"
crear_rol_o_base \
  "create role spaces_migrador login password '$CLAVE_MIGRADOR' nosuperuser nocreaterole noinherit bypassrls;" \
  "create role spaces_migrador login password '(oculta)' nosuperuser nocreaterole noinherit bypassrls;"
crear_rol_o_base \
  "create database spaces owner spaces_migrador;" \
  "create database spaces owner spaces_migrador;"

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
# y la licencia nueva quedaria invisible para siempre. Se lee en BASH, no con
# `sed`/`grep`+`sed` como antes: es texto de la plantilla (no un secreto), pero
# mantener un solo mecanismo de lectura de plantillas es mas simple de revisar.
VALOR_DOCKER_OPCIONES_APP=""
while IFS= read -r _linea_dopc; do
  _linea_dopc="${_linea_dopc%$'\r'}"  # ver el comentario sobre CRLF en reescribir_env()
  if [[ "$_linea_dopc" == DOCKER_OPCIONES_APP=* ]]; then
    VALOR_DOCKER_OPCIONES_APP="${_linea_dopc#DOCKER_OPCIONES_APP=}"
    VALOR_DOCKER_OPCIONES_APP="${VALOR_DOCKER_OPCIONES_APP%\"}"
    VALOR_DOCKER_OPCIONES_APP="${VALOR_DOCKER_OPCIONES_APP#\"}"
    break
  fi
done < "$TPL_INST"
DOCKER_OPCIONES_APP_NUEVO="${VALOR_DOCKER_OPCIONES_APP} -v /etc/space-os/licencia:/etc/space-os/licencia:ro"

# El PADRE recibe el reporte saliente de esta instancia cada noche (F6.4) --
# es el mecanismo que sobrevive a que el cliente cierre `/api/version` desde
# fuera, que es SU derecho porque es SU servidor. Dejar esto vacio (como
# hacia la version anterior de este guion) renuncia a ese mecanismo sin
# decirlo (I8): la fila del panel quedaria dependiendo por completo de que
# el PADRE pueda ENTRAR a preguntar, que es justo lo que el reporte saliente
# existe para no necesitar.
FLOTA_REPORTE_URL_VALOR="$PADRE_URL/flota/reporte"

TMP_INST="$(mktemp)"
reescribir_env "$TPL_INST" \
  "INSTANCIA=$INSTANCIA" \
  "DATABASE_URL=$URL_MIGRADOR" \
  "REGISTRY=$REGISTRY" \
  "REGISTRY_TOKEN=$REGISTRY_TOKEN" \
  "CANAL=$CANAL" \
  "DOCKER_OPCIONES_APP=$DOCKER_OPCIONES_APP_NUEVO" \
  "FLOTA_REPORTE_URL=$FLOTA_REPORTE_URL_VALOR" \
  ${SPACES_KEY:+"SPACES_KEY=$SPACES_KEY"} \
  ${SPACES_SECRET:+"SPACES_SECRET=$SPACES_SECRET"} \
  ${SPACES_BUCKET:+"SPACES_BUCKET=$SPACES_BUCKET"} \
  > "$TMP_INST"
{
  printf '\n'
  printf '# ─── Anadidas por instalar-hijo.sh (ADR 0032, tarea 8) ────────────────\n'
  printf '# No viven como VALORES ACTIVOS en la plantilla: su sola presencia\n'
  printf '# enciende un mecanismo (el apagado por licencia, el anclaje de dominio\n'
  printf '# de licencia_valida() en update.sh). La plantilla solo lleva DOMINIO\n'
  printf '# comentada, como documentacion.\n'
  printf 'DOMINIO="%s"\n' "$DOMINIO"
  printf 'LICENCIA_REQUERIDA="1"\n'
} >> "$TMP_INST"
escribir /etc/space-os/instancia.env 600 < "$TMP_INST"
rm -f "$TMP_INST"

reescribir_env "$TPL_APP" \
  "APP_URL=https://$DOMINIO" \
  "DATABASE_URL=postgresql://spaces_app:$CLAVE_APP@127.0.0.1:5432/spaces" \
  "GOOGLE_REDIRECT_URI=https://$DOMINIO/spaces-dooh/api/auth/google/callback/" \
  "BOOTSTRAP_TOKEN=$BOOTSTRAP_TOKEN" \
  "FLOTA_TOKEN=$FLOTA_TOKEN" \
  "CANAL=$CANAL" \
  | escribir /etc/space-os/app.env 600

# ─── 6 · Entrar al registro de imagenes, sin credenciales en la linea de
#         comandos ───────────────────────────────────────────────────────────
# `docker login --username "$TOKEN" --password-stdin` deja el TOKEN en el
# argv del proceso `docker login` mientras corre -- `--password-stdin` evita
# que la CONTRASENA viaje por argv, pero no dice nada del `--username` (I6).
# Se evita del todo escribiendo el credential store de Docker directamente:
# es exactamente lo que `docker login` hace por dentro, solo que sin pasar
# el secreto como argumento de ningun proceso. `base64` lo recibe por su
# ENTRADA ESTANDAR, nunca como argumento.
paso "Entrando al registro de imagenes"
REGISTRY_HOST="${REGISTRY%%/*}"
AUTH_B64="$(printf '%s:%s' "$REGISTRY_TOKEN" "$REGISTRY_TOKEN" | base64 -w0)"
ejecutar mkdir -p /root/.docker
{
  printf '{\n'
  printf '  "auths": {\n'
  printf '    "%s": { "auth": "%s" }\n' "$REGISTRY_HOST" "$AUTH_B64"
  printf '  }\n'
  printf '}\n'
} | escribir /root/.docker/config.json 600

# ─── 7 · Esquema y migraciones ──────────────────────────────────────────────
# No esta en la lista de pasos del brief, pero sin esto "primera corrida de
# update.sh" no tiene contra que base actualizar: `update.sh` migra una base
# que YA EXISTE, no la crea. Mismo orden y mismos comandos que
# `provision-instancia.sh` (el esquema base sale de la imagen, y se aplica
# como `spaces_migrador` para que las migraciones que alteran esas tablas mas
# tarde no choquen con el dueno). El `DATABASE_URL` de migraciones va por
# variable de ENTORNO del contenedor (`--env`), nunca en el propio comando de
# `docker run` como texto: eso es lo que ya evitaba I6 aqui.
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
# M8: a diferencia de `provision-instancia.sh` (que no aborta aqui porque el
# cron reintenta esa misma noche sin que nadie este mirando), este guion lo
# corre un CLIENTE, en vivo, delante de la pantalla (tarjeta, bloque B6). Que
# la aplicacion no levante y el guion siga de todos modos hacia el
# certificado es peor que pararse: el chequeo final fallaria igual, pero tres
# pasos y varios minutos despues, y por la misma razon que aqui ya se sabia.
paso "Levantando la aplicacion"
if [[ "$CONFIRMAR" -eq 1 ]]; then
  if /opt/space-os/update.sh; then
    echo "  la instancia ya sirve: no hay que esperar al cron de las 4:17"
  else
    echo "" >&2
    echo "instalar-hijo: la primera corrida de update.sh fallo. La maquina quedo con" >&2
    echo "               Docker, PostgreSQL, la base y el entorno instalados, pero la" >&2
    echo "               aplicacion NO levanto. No se sigue al certificado sobre una" >&2
    echo "               aplicacion que no responde. Revisa:" >&2
    echo "                 tail -60 /var/log/space-os/update.log" >&2
    exit "$EX_FALLA"
  fi
else
  printf '%s /opt/space-os/update.sh\n' "$DRY_ETIQUETA"
fi

# ─── 11 · El certificado ────────────────────────────────────────────────────
# A diferencia de `provision-instancia.sh` (que se detiene aqui porque el
# owner todavia no aplico su DNS), este guion lo corre AHORA: `comprobar_dns`
# (arriba) ya confirmo que el dominio resuelve a esta maquina antes de llegar
# hasta aqui.
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

# I10: en `--dry-run` este banner tiene que decir que no se hizo nada -- la
# version anterior decia "INSTALACION HECHA" tambien en seco, contradiciendo
# el propio aviso de mas arriba ("SIMULACION. No se toca nada."). M6: la URL
# del panel no se queda quemada aqui: sale de PADRE_URL, la misma variable
# que ya trajo FLOTA_REPORTE_URL.
if [[ "$CONFIRMAR" -eq 1 ]]; then
  cat <<FIN

╔══════════════════════════════════════════════════════════════════════╗
║  INSTALACION HECHA                                                    ║
╚══════════════════════════════════════════════════════════════════════╝

  El gate que cierra el alta no lo comprueba este guion: es que la fila de
  "$INSTANCIA" aparezca en $PADRE_URL/flota/ -- eso es lo que le cuenta a
  AS OOH que la instancia esta viva sin que nadie entre a mirarla.

FIN
else
  cat <<FIN

╔══════════════════════════════════════════════════════════════════════╗
║  SIMULACION TERMINADA — NO SE TOCO NADA                               ║
╚══════════════════════════════════════════════════════════════════════╝

  Todo lo de arriba es lo que este guion HARIA. Si el plan se ve bien,
  repite el mismo comando con --confirmar para instalar de verdad.

FIN
fi
