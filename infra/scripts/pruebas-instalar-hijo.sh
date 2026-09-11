#!/usr/bin/env bash
# ============================================================================
#  pruebas-instalar-hijo.sh — el arnes de `instalar-hijo.sh` (tarea 11).
# ----------------------------------------------------------------------------
#  POR QUE EXISTE:
#
#  `instalar-hijo.sh` (600+ lineas, corre COMO ROOT en la maquina de un
#  cliente) no tenia NINGUN arnes automatizado. La tarea 8 que lo creo solo
#  dejo un `--dry-run` para correr a mano (su propio brief lo dice: "es lo
#  unico que se puede probar aqui"). Y por eso el defecto de la tarea 11 --dos
#  archivos de configuracion con el mismo parser, uno de los dos roto-- se
#  escapo: nadie miraba el CONTENIDO de lo que el instalador escribe.
#
#  NACE PEQUENO A PROPOSITO: solo cubre lo que la tarea 11 necesita --el
#  contenido de `app.env` e `instancia.env`--, no la suite entera. Que crezca
#  para cubrir el resto del guion es trabajo de otra tarea, no de esta.
#
#  NO sale a la red (dobla `curl`), NO toca el sistema real (todo corre en
#  `--dry-run`, nunca con `--confirmar`, asi que `escribir()` nunca instala
#  nada de verdad) y NO usa una llave de licencia real: fabrica su propio par
#  de llaves y firma su propia licencia de prueba en un directorio temporal,
#  igual que ya hace `pruebas-update.sh` con `update.sh` (misma tecnica,
#  mismo motivo: `update.sh:843` tambien deja `LICENCIA_PUB` como variable de
#  entorno, y `instalar-hijo.sh` ahora tiene su propia costura equivalente,
#  `SPACE_OS_LICENCIA_PUB`).
#
#  Uso:
#    bash infra/scripts/pruebas-instalar-hijo.sh [--mutantes]
# ============================================================================
set -uo pipefail

# Mismo motivo que en `pruebas-provision.sh`: un doble de `curl` que drena su
# entrada no necesita nada de la nuestra, pero cerrar stdin evita que este
# arnes se cuelgue si alguna vez hereda una tuberia que nadie va a cerrar.
exec </dev/null

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
GUION="${GUION_INSTALAR:-$RAIZ/infra/scripts/instalar-hijo.sh}"

ESCENARIOS=0
COMPROBACIONES=0
FALLOS=0
ESCENARIO_ACTUAL=''

escenario() {
  ESCENARIO_ACTUAL="$1"
  ESCENARIOS=$((ESCENARIOS + 1))
  printf '\n── %s\n' "$1"
}
bien() { COMPROBACIONES=$((COMPROBACIONES + 1)); }
mal() {
  COMPROBACIONES=$((COMPROBACIONES + 1))
  FALLOS=$((FALLOS + 1))
  printf '   FALLO [%s]: %s\n' "$ESCENARIO_ACTUAL" "$1" >&2
}

# ─── El doble de curl ───────────────────────────────────────────────────────
#  `comprobar_dns()`, dentro de `instalar-hijo.sh`, empieza preguntandole al
#  metadata service de DigitalOcean (169.254.169.254) la IP publica de esta
#  maquina. Aqui esa direccion no contesta -- pero CUANTO tarda en fallar (y
#  si `getent` existe para seguir con la comprobacion de DNS) depende de la
#  maquina donde corra esto. Doblar `curl` deja las dos cosas deterministas:
#  vacio e inmediato, sea cual sea el sistema. Con la IP vacia,
#  `comprobar_dns()` se sale con un aviso y nunca llega a `getent`.
montar_dobles() {
  mkdir -p "$BIN"
  cat >"$BIN/curl" <<'FIN'
#!/usr/bin/env bash
exit 0
FIN
  chmod +x "$BIN/curl"
}

# Fabrica una licencia FIRMADA para este escenario, con su propio par de
# llaves -- mismo patron que `usar_licencia()` en `pruebas-update.sh`.
# `verificar_licencia()` en `instalar-hijo.sh` solo lee "instancia" y
# "dominio" del JSON (no vence/gracia, eso es cosa de `update.sh`), asi que
# esos dos campos son los unicos que hacen falta que coincidan con lo que se
# le pasa al instalador.
fabricar_licencia() {
  local instancia="$1" dominio="$2"
  openssl genpkey -algorithm ed25519 -out "$RAIZ_TMP/k.pem" 2>/dev/null
  openssl pkey -in "$RAIZ_TMP/k.pem" -pubout -out "$RAIZ_TMP/k.pub" 2>/dev/null
  cat >"$LICDIR/licencia.json" <<FIN
{
  "instancia": "$instancia",
  "dominio": "$dominio",
  "emitida": "2026-01-01",
  "vence": "2099-01-01",
  "aviso_dias": 30,
  "gracia_dias": 15
}
FIN
  openssl pkeyutl -sign -inkey "$RAIZ_TMP/k.pem" -rawin \
    -in "$LICDIR/licencia.json" -out "$LICDIR/licencia.firma" 2>/dev/null
  export SPACE_OS_LICENCIA_PUB="$RAIZ_TMP/k.pub"
}

preparar() {
  RAIZ_TMP="$(mktemp -d)"
  BIN="$RAIZ_TMP/bin"
  CAPTURA="$RAIZ_TMP/capturado"
  LICDIR="$RAIZ_TMP/licencia"
  SALIDA="$RAIZ_TMP/salida"
  mkdir -p "$BIN" "$CAPTURA" "$LICDIR"
  montar_dobles
  RUTA_ANTES="$PATH"
  PATH="$BIN:$PATH"
  export SPACE_OS_CAPTURA_DIR="$CAPTURA"
  unset SPACE_OS_LICENCIA_PUB
}

limpiar() {
  PATH="$RUTA_ANTES"
  rm -rf "$RAIZ_TMP"
  unset SPACE_OS_CAPTURA_DIR SPACE_OS_LICENCIA_PUB
}

# Corre el guion y guarda codigo y salida. Mismo patron y misma advertencia
# que `pruebas-provision.sh:235`: el entorno va por `env`, NUNCA por un
# subshell `( ... )`, o los contadores de aciertos y fallos se quedan
# atrapados ahi y el arnes miente con un 0 de salida.
correr() {
  local -a pre=()
  while [ "$#" -gt 0 ] && [ "$1" != '--' ]; do
    pre+=("$1")
    shift
  done
  shift 2>/dev/null || true
  CODIGO=0
  env "${pre[@]}" "$GUION" "$@" >"$SALIDA" 2>&1 || CODIGO=$?
}

# ─── Predicados ─────────────────────────────────────────────────────────────
codigo_es() { if [ "$CODIGO" = "$1" ]; then bien; else mal "codigo esperado $1, real $CODIGO ($(tail -3 "$SALIDA" | tr '\n' ' '))"; fi; }

# Sobre el CONTENIDO de lo que `instalar-hijo.sh` escribiria -- capturado por
# la costura de `escribir()` en vez de tirarse a `/dev/null`. Mismo trio de
# ayudantes que `pruebas-provision.sh` (`ruta_escrita`, `escrito_dice`,
# `escrito_calla`, `escrito_casa`), apuntando al directorio de captura de
# ESTE arnes.
ruta_escrita() { printf '%s/%s' "$CAPTURA" "$(printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '_')"; }

escrito_dice() {
  local f; f="$(ruta_escrita "$1")"
  if [ ! -f "$f" ]; then mal "no se escribio $1"
  elif grep -qF -- "$2" "$f"; then bien
  else mal "$1 no lleva: $2"; fi
}

escrito_casa() {
  local f; f="$(ruta_escrita "$1")"
  if [ ! -f "$f" ]; then mal "no se escribio $1"
  elif grep -qE -- "$2" "$f"; then bien
  else mal "en $1, ninguna linea casa con: $2"; fi
}

# Con QUE MODO se instalaria un archivo. En `--dry-run` no se instala nada,
# pero la linea que `escribir()` imprime lleva el modo dentro -- y el modo es
# justo lo que aqui se afirma. Existe por el defecto F2 de la revision final:
# la licencia se instalaba 600 de root, el contenedor corre como `node`, y con
# eso la banda de aviso de vencimiento NO SE PINTABA NUNCA en ninguna instancia
# de droplet propio. No lo veia nada: ni un gate, ni un log, ni una prueba.
modo_escrito() {
  if grep -qF -- "escribir $1 (modo $2)" "$SALIDA"; then bien
  else mal "$1 no se escribe en modo $2 (linea real: $(grep -F -- "escribir $1 (" "$SALIDA" | head -n1 || true))"; fi
}

# Por AUSENCIA, y por eso comprueba PRIMERO que el archivo exista: una
# comprobacion de que algo NO aparece en un archivo que nadie escribio pasa
# sola, y pasaria justo el dia en que el instalador dejara de escribirlo.
escrito_calla() {
  local f; f="$(ruta_escrita "$1")"
  if [ ! -f "$f" ]; then mal "no se escribio $1: la comprobacion por ausencia habria pasado sola"
  elif grep -qF -- "$2" "$f"; then mal "$1 NO deberia llevar: $2"
  else bien; fi
}

# Los dos archivos los lee `update.sh` por caminos DISTINTOS, y eso es a
# proposito de este arnes replicarlo y no allanarlo:
#   - `app.env` lo lee CRUDO, con `grep`+`cut` (`url_de_env_app()`). Si el
#     valor trae una comilla pegada al frente -- el propio defecto de esta
#     tarea -- esa comilla llega intacta.
#   - `instancia.env` lo SOURCEA (`. "$CONF"`), y sourcear quita UN par de
#     comillas que envuelvan el valor entero. `valor_sourceado()` simula
#     justo eso -- no un parser de bash completo, no hace falta: los valores
#     que este instalador escribe no llevan nada mas que bash interprete
#     distinto, porque `validar_valor_seguro()` ya lo garantizo antes.
valor_sourceado() {
  local v="$1"
  if [[ "$v" == \"*\" ]]; then v="${v#\"}"; v="${v%\"}"; fi
  printf '%s' "$v"
}

# El "destino" -- host:puerto/base, SIN credenciales -- es justo lo que
# `destino_de_url()` calcula en `update.sh` para decidir si los dos archivos
# hablan de la MISMA base (`update.sh:1430-1433`). Aqui basta con partir por
# el PRIMER `@` (las claves son hex: nunca llevan uno) DESPUES de comprobar
# que el valor empieza por un esquema valido -- que es precisamente lo que
# `partir_url()` en `update.sh` tambien exige antes de intentar nada. Una
# comilla pegada al frente ROMPE esa comprobacion (no empieza por una letra),
# y ese "no parseable" es la mitad del mecanismo real detras del `EX_CONFIG`:
# un lado da un destino de verdad y el otro una cadena fija, y no coinciden
# nunca.
destino_de() {
  local v="$1"
  case "$v" in
    [a-zA-Z]*://*@*) printf '%s' "${v#*@}" ;;
    *) printf '%s' '(url no parseable)' ;;
  esac
}

IP=203.0.113.10          # RFC 5737 — direccion de documentacion, no existe
DOM=prueba.ejemplo.com   # dominio de prueba, no existe

# ============================================================================
#  CONTENIDO · app.env lo lee Docker sin comillas, instancia.env lo sourcea
#  bash con comillas, y los dos apuntan al MISMO destino  (tarea 11)
# ----------------------------------------------------------------------------
#  Las tres afirmaciones del brief, en el orden en que aparecen ahi:
#   1. `app.env`: `DATABASE_URL` no puede empezar por comilla -- Docker no
#      la quita, se la queda dentro del valor.
#   2. `instancia.env`: `DATABASE_URL` SI va entrecomillado -- bash lo
#      sourcea, y sin comillas un espacio ejecuta la segunda palabra.
#   3. La comparacion que hace abortar a `update.sh` (`update.sh:1430-1433`):
#      el destino que se leeria de `app.env` con `grep`+`cut` (su propio
#      metodo, sin sourcear) tiene que COINCIDIR con el de `instancia.env`.
#      Antes de la tarea 11, la (1) fallaba: `app.env` tambien llevaba
#      comillas, `update.sh` las incluia en su lectura cruda, y el destino
#      "distinto" resultante era justo lo que hacia abortar al cron.
# ============================================================================
escenario 'CONTENIDO · app.env sin comillas, instancia.env con comillas, mismo destino en los dos'
preparar
fabricar_licencia p "$DOM"
correr REGISTRY=registro.ejemplo/x PADRE_URL=https://padre.ejemplo.invalid FLOTA_TOKEN=t0ken-de-flota -- \
  --instancia p --dominio "$DOM" --licencia "$LICDIR"
codigo_es 0

# 1 · app.env: Docker no quita comillas, asi que no puede haber ninguna.
escrito_calla /etc/space-os/app.env 'DATABASE_URL="'

# 2 · instancia.env: bash lo sourcea, y el valor tiene que ir entrecomillado.
escrito_casa /etc/space-os/instancia.env '^DATABASE_URL="'

# 3 · La comparacion que aborta el cron -- ver `destino_de()` y
#     `valor_sourceado()` arriba. `VAL_APP` se deja CRUDO (asi lo lee
#     `url_de_env_app()`); `VAL_INST` pasa por `valor_sourceado()` porque asi
#     es como `update.sh` lo recibe de verdad, sourceando `instancia.env`.
VAL_APP="$(grep -m1 '^DATABASE_URL=' "$(ruta_escrita /etc/space-os/app.env)" 2>/dev/null | cut -d= -f2-)"
VAL_INST_CRUDO="$(grep -m1 '^DATABASE_URL=' "$(ruta_escrita /etc/space-os/instancia.env)" 2>/dev/null | cut -d= -f2-)"
D_APP="$(destino_de "$VAL_APP")"
D_INST="$(destino_de "$(valor_sourceado "$VAL_INST_CRUDO")")"
if [ -z "$VAL_APP" ] || [ -z "$VAL_INST_CRUDO" ]; then
  mal "no se pudo leer DATABASE_URL de uno de los dos archivos (app='$VAL_APP' instancia='$VAL_INST_CRUDO')"
elif [ "$D_APP" = '(url no parseable)' ] || [ "$D_INST" = '(url no parseable)' ]; then
  mal "update.sh no podria interpretar el destino de alguno de los dos (app='$VAL_APP' instancia='$VAL_INST_CRUDO')"
elif [ "$D_APP" = "$D_INST" ]; then
  bien
else
  mal "app.env e instancia.env apuntan a destinos DISTINTOS ($D_APP vs $D_INST): es la comparacion que hace abortar a update.sh con EX_CONFIG"
fi

# Y que la comprobacion de arriba sea real y no un empate vacio: los roles
# tienen que ser DISTINTOS (la aplicacion usa `spaces_app`, el actualizador
# `spaces_migrador`) aunque el destino sea el mismo -- si no, (3) pasaria
# aunque `destino_de()` estuviera mal escrito y devolviera la URL entera.
escrito_dice /etc/space-os/app.env 'DATABASE_URL=postgresql://spaces_app:'
escrito_dice /etc/space-os/instancia.env 'DATABASE_URL="postgresql://spaces_migrador:'
limpiar

# ============================================================================
#  PERMISOS · un secreto va en 600; un documento publico, en 644  (F2)
# ----------------------------------------------------------------------------
#  La licencia NO es un secreto: es una afirmacion firmada y publica, y su
#  valor esta en la firma. El cliente puede abrirla y leer que se le concedio.
#  Lo que SI es secreto son los dos `.env`, y siguen en 600.
#
#  Este escenario afirma LAS DOS COSAS a la vez a proposito. Comprobar solo el
#  644 invitaria a "arreglar" un futuro fallo abriendo permisos en bloque; con
#  el 600 al lado, la regla que se protege es la distincion, no un numero.
# ============================================================================
escenario 'PERMISOS · la licencia se instala legible por el contenedor (644); los .env no (600)'
preparar
fabricar_licencia p "$DOM"
correr REGISTRY=registro.ejemplo/x PADRE_URL=https://padre.ejemplo.invalid FLOTA_TOKEN=t0ken-de-flota -- \
  --instancia p --dominio "$DOM" --licencia "$LICDIR"
codigo_es 0

# El montaje `-v /etc/space-os/licencia:...:ro` conserva dueno y permisos del
# anfitrion, y dentro el proceso es `node` (`Dockerfile:145`): con 600 de root
# el `readFile` del layout da EACCES, y EACCES se veia igual que "no hay
# licencia". Los 30 dias de aviso y los 15 de gracia pasaban mudos.
modo_escrito /etc/space-os/licencia/licencia.json 644
modo_escrito /etc/space-os/licencia/licencia.firma 644
# Y el directorio, explicito y no heredado del umask: un 644 dentro de un 700
# sigue siendo ilegible, y falla igual de callado.
if grep -qE 'chmod 755 /etc/space-os /etc/space-os/licencia' "$SALIDA"; then bien
else mal 'no se fija el modo del directorio de la licencia: un umask restrictivo lo dejaria ilegible igual'; fi

# Lo que si es secreto sigue siendolo.
modo_escrito /etc/space-os/app.env 600
modo_escrito /etc/space-os/instancia.env 600
limpiar

# ============================================================================
#  SECRETOS · ninguno viaja en `argv`  (F4)
# ----------------------------------------------------------------------------
#  La cabecera de `instalar-hijo.sh` prometia «nunca argumentos, para que no
#  acaben en `ps` ni en el historial de la shell» y tres lineas mas abajo
#  aceptaba `--flota-token`, `--spaces-key` y `--spaces-secret`. En la maquina
#  del cliente eso son varios minutos de `ps` y una linea permanente en su
#  `~/.bash_history` -- una maquina que no es nuestra y cuya lista de usuarios
#  no controlamos.
#
#  Se comprueba UNA BANDERA POR CORRIDA, y no las cuatro juntas: con las
#  cuatro en la misma linea, reponer una sola de ellas seguiria dando el mismo
#  codigo de salida y el arnes no se enteraria.
# ============================================================================
escenario 'SECRETOS · las cuatro banderas que ponian un valor del cliente en argv estan retiradas'
preparar
fabricar_licencia p "$DOM"
for bandera in --flota-token --spaces-key --spaces-secret --spaces-bucket; do
  correr REGISTRY=registro.ejemplo/x PADRE_URL=https://padre.ejemplo.invalid FLOTA_TOKEN=t0ken-de-flota -- \
    --instancia p --dominio "$DOM" --licencia "$LICDIR" "$bandera" valor-cualquiera
  if [ "$CODIGO" != 64 ]; then
    mal "$bandera no se rechaza (codigo $CODIGO): un secreto en argv queda en el historial del cliente"
  elif ! grep -qF "'$bandera' ya no existe" "$SALIDA"; then
    mal "$bandera se rechaza pero sin decir como pasarla por entorno"
  else bien; fi
done
limpiar

escenario 'SECRETOS · FLOTA_TOKEN entra por el ENTORNO y llega entero a app.env'
preparar
fabricar_licencia p "$DOM"
correr REGISTRY=registro.ejemplo/x PADRE_URL=https://padre.ejemplo.invalid FLOTA_TOKEN=t0ken-de-flota -- \
  --instancia p --dominio "$DOM" --licencia "$LICDIR"
codigo_es 0
# Que el camino nuevo FUNCIONE, no solo que el viejo este cerrado: sin esto,
# retirar las banderas podria haber dejado el token vacio y nadie lo veria
# hasta que el panel no reconociera a la instancia.
escrito_dice /etc/space-os/app.env 'FLOTA_TOKEN=t0ken-de-flota'
limpiar

escenario 'SECRETOS · sin FLOTA_TOKEN en el entorno, para y dice donde ponerlo'
preparar
fabricar_licencia p "$DOM"
correr REGISTRY=registro.ejemplo/x PADRE_URL=https://padre.ejemplo.invalid -- \
  --instancia p --dominio "$DOM" --licencia "$LICDIR"
codigo_es 64
if grep -qF 'falta FLOTA_TOKEN en el entorno' "$SALIDA"; then bien
else mal "no dice que falta FLOTA_TOKEN: $(tail -2 "$SALIDA" | tr '\n' ' ')"; fi
limpiar

printf '\n%s escenarios · %s comprobaciones · %s fallos\n' "$ESCENARIOS" "$COMPROBACIONES" "$FALLOS"
[ "$FALLOS" -eq 0 ] || exit 1

# ============================================================================
#  MUTANTES · que este escenario MUERDA  (tarea 11)
# ----------------------------------------------------------------------------
#  Un arnes en verde no demuestra nada por si solo. Lo que hay que demostrar
#  es que si alguien reunifica los dos parsers "para simplificar" -- que es
#  exactamente como nacio este defecto -- esto se pone rojo.
#
#    bash infra/scripts/pruebas-instalar-hijo.sh --mutantes
# ============================================================================
if [ "${1:-}" = '--mutantes' ]; then
  MUT_TOTAL=0
  MUT_FALLOS=0

  # AL LADO del guion, nunca en /tmp: `instalar-hijo.sh` resuelve `RAIZ` desde
  # su propia ubicacion (`dirname "${BASH_SOURCE[0]}"`), y con la copia en
  # /tmp ese calculo sale mal y CUALQUIER mutante muere por eso, no por el
  # sabotaje -- la misma trampa que ya penaron y documentaron
  # `pruebas-provision.sh:656-671`.
  copia_al_lado() { mktemp "$RAIZ/infra/scripts/.mutante-instalar-XXXXXX.sh"; }

  rojas_con() {
    local copia="$1" resumen
    resumen="$(GUION_INSTALAR="$copia" bash "$0" 2>/dev/null | tail -n1)"
    case "$resumen" in
      *comprobaciones*fallos) printf '%s' "$resumen" | awk '{print $(NF-1)}' ;;
      *) printf '' ;;
    esac
  }

  probar_mutante() {
    local desc="$1" expresion="$2" copia rojas
    MUT_TOTAL=$((MUT_TOTAL + 1))
    copia="$(copia_al_lado)"
    sed "$expresion" "$GUION" >"$copia"
    if cmp -s "$copia" "$GUION"; then
      printf '   NO APLICADO (la expresion no casa): %s\n' "$desc" >&2
      MUT_FALLOS=$((MUT_FALLOS + 1)); rm -f "$copia"; return
    fi
    if ! bash -n "$copia" 2>/dev/null; then
      printf '   INVALIDO (bash -n no lo acepta): %s\n' "$desc" >&2
      MUT_FALLOS=$((MUT_FALLOS + 1)); rm -f "$copia"; return
    fi
    chmod +x "$copia"
    rojas="$(rojas_con "$copia")"
    if [ -z "$rojas" ]; then
      printf '   SIN RESUMEN (el arnes no llego a terminar): %s\n' "$desc" >&2
      MUT_FALLOS=$((MUT_FALLOS + 1))
    elif [ "$rojas" -gt 0 ] 2>/dev/null; then
      printf '   muerde: %s (%s en rojo)\n' "$desc" "$rojas"
    else
      printf '   ESCAPA: %s\n' "$desc" >&2
      MUT_FALLOS=$((MUT_FALLOS + 1))
    fi
    rm -f "$copia"
  }

  # ─── El CENTINELA ─────────────────────────────────────────────────────────
  #  El unico "mutante" que TIENE que escapar: el guion tal cual con un
  #  comentario de mas al final, que no cambia ningun comportamiento. Si
  #  muere, la barrida esta matando a todos por el mismo motivo -- por donde
  #  vive la copia, por un archivo que no encuentra -- y los "muerde" de abajo
  #  son humo. Mismo mecanismo que `pruebas-provision.sh:739-754`.
  probar_centinela() {
    local copia rojas
    MUT_TOTAL=$((MUT_TOTAL + 1))
    copia="$(copia_al_lado)"
    { cat "$GUION"; printf '# centinela de la barrida de mutantes: no cambia nada.\n'; } >"$copia"
    chmod +x "$copia"
    rojas="$(rojas_con "$copia")"
    if [ "${rojas:-vacio}" = 0 ]; then
      printf '   centinela: ESCAPA, como debe (la barrida discrimina)\n'
    else
      printf '   CENTINELA MUERTO (%s en rojo): la barrida NO discrimina y los «muerde» de abajo no significan nada\n' \
        "${rojas:-sin resumen}" >&2
      MUT_FALLOS=$((MUT_FALLOS + 1))
    fi
    rm -f "$copia"
  }

  printf '\n── mutantes\n'

  probar_centinela

  # El guard contra la reunificacion: si `app.env` vuelve a escribirse con el
  # parser que entrecomilla, la comprobacion (1) de arriba tiene que morder.
  probar_mutante 'app.env vuelve a escribirse con el parser que entrecomilla (la reunificacion)' \
    's@reescribir_env_docker "\$TPL_APP" \\@reescribir_env_sourceado "$TPL_APP" \\@'

  # F2: el modo de fallo mas caro de esta rama, porque no daba ninguna senal.
  # «Asegurar» la licencia de vuelta a 600 mata la banda de aviso en toda la
  # flota de droplet propio sin romper nada visible. Tiene que morder.
  probar_mutante 'la licencia vuelve a instalarse 600 (el fallo mudo de F2)' \
    's@licencia/licencia.json 644@licencia/licencia.json 600@'

  # F4: reponer UNA sola de las cuatro banderas retiradas. Se elige
  # `--spaces-secret` y no `--flota-token` a proposito: es la que menos se
  # echaria de menos y la que mas facil se repone «por comodidad».
  probar_mutante 'vuelve a aceptarse --spaces-secret como argumento (el secreto en argv)' \
    's@--spaces-secret)  bandera_retirada --spaces-secret SPACES_SECRET ;;@--spaces-secret)  SPACES_SECRET="${2:-}"; shift 2 ;;@'

  printf '\n%s mutantes (el primero es el centinela) · %s mal\n' "$MUT_TOTAL" "$MUT_FALLOS"
  [ "$MUT_FALLOS" -eq 0 ] || exit 1
fi
