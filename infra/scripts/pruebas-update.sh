#!/usr/bin/env bash
# ============================================================================
#  pruebas-update.sh — el arnes de `update.sh`, en el repositorio.
# ----------------------------------------------------------------------------
#  Por que existe en vez de un parrafo diciendo "se probo": la primera version
#  de `update.sh` venia con un README que afirmaba "18 escenarios y 58
#  comprobaciones" y esos escenarios NO estaban en ningun sitio. Nadie podia
#  repetirlos, y cuando la auditoria los reconstruyo aparecieron dos mutantes
#  que el arnes original no cazaba. Una afirmacion que no se puede repetir no es
#  una verificacion: es una promesa.
#
#  Uso:
#    bash infra/scripts/pruebas-update.sh              # los escenarios
#    bash infra/scripts/pruebas-update.sh --mutantes   # ademas, que MUERDEN
#
#  No sale a la red, no habla con Docker, no toca ninguna base. Monta dobles
#  POSIX de `docker`, `curl`, `flock`, `sleep`, `pg_dump` y `pg_restore` en un PATH
#  propio y observa que se les pide. Corre en cualquier sitio con bash.
#
#  Los dobles son FIELES en un punto que importa: si no ven `DATABASE_URL` en
#  su entorno, fallan como fallaria el runner de verdad. Eso es lo que convierte
#  "quitar el `export DATABASE_URL`" en un rojo y no en un cambio invisible.
# ============================================================================
set -uo pipefail

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
GUION="${GUION_UPDATE:-$RAIZ/infra/scripts/update.sh}"

ESCENARIOS=0
COMPROBACIONES=0
FALLOS=0
ESCENARIO_ACTUAL=''

bien() { COMPROBACIONES=$((COMPROBACIONES + 1)); }
mal() {
  COMPROBACIONES=$((COMPROBACIONES + 1))
  FALLOS=$((FALLOS + 1))
  printf '    ROJO [%s] %s\n' "$ESCENARIO_ACTUAL" "$1"
}

# ─── Los dobles ────────────────────────────────────────────────────────────
montar_dobles() {
  mkdir -p "$BIN"

  cat >"$BIN/docker" <<'FIN'
#!/usr/bin/env bash
printf 'docker %s\n' "$*" >>"$REG_LLAMADAS"
todo="$*"
# Lo que un `docker run --env DATABASE_URL` recibe DE VERDAD: el valor del
# entorno del proceso, o nada si nadie lo exporto.
case "$todo" in *"--env DATABASE_URL"*) printf '%s\n' "${DATABASE_URL-<NO-EXPORTADA>}" >>"$REG_DBURL" ;; esac
sub="$1"; shift
case "$sub" in
  pull)
    printf 'pull de %s\n' "$1"
    # Cuantas veces se ha pedido el pull: `D_PULL_FALLA` falla siempre;
    # `D_PULL_FALLA_VECES=2` falla las dos primeras y a la tercera va bien, que
    # es la red intermitente que F3.8 existe para aguantar.
    n=$(cat "$REG_PULL_N" 2>/dev/null || echo 0); n=$((n + 1))
    printf '%s' "$n" >"$REG_PULL_N"
    [ "${D_PULL_FALLA:-0}" = 1 ] && exit 1
    [ "$n" -le "${D_PULL_FALLA_VECES:-0}" ] && exit 1
    exit 0 ;;
  image)
    shift  # "inspect"
    fmt=''; ref=''
    while [ $# -gt 0 ]; do
      case "$1" in --format) fmt="$2"; shift 2 ;; *) ref="$1"; shift ;; esac
    done
    viejo=0
    [ -n "${D_ID_CONTENEDOR:-}" ] && [ "$ref" = "${D_ID_CONTENEDOR:-}" ] && viejo=1
    case "$fmt" in
      *RepoDigests*) [ "$viejo" = 1 ] && printf '%s\n' "${D_DIGEST_VIEJO:-reg/space-os@sha256:viejo}" || printf '%s\n' "${D_DIGEST:-reg/space-os@sha256:nuevo}" ;;
      *Config.Env*)  [ "$viejo" = 1 ] && printf 'SPACE_OS_VERSION=%s\n' "${D_VERSION_VIEJA:-v0.4.1}" || printf 'SPACE_OS_VERSION=%s\n' "${D_VERSION:-v0.4.2}" ;;
      *) printf '%s\n' "${D_ID_IMAGEN:-sha256:nueva}" ;;
    esac
    exit 0 ;;
  inspect)
    [ -n "${D_ID_CONTENEDOR:-}" ] || exit 1
    printf '%s\n' "$D_ID_CONTENEDOR"
    exit 0 ;;
  run)
    case "$todo" in
      *--detach*)
        [ "${D_RUN_FALLA:-0}" = 1 ] && { echo 'no se pudo crear el contenedor'; exit 125; }
        printf '%s\n' "${D_NUEVO_ID:-c0ntened0rnuev0}"
        exit 0 ;;
      *"node -e"*)
        [ "${D_RUNNER_EN_IMAGEN:-0}" = 1 ] && exit 0
        exit 1 ;;
      *"scripts/migrar.mjs"*)
        if [ -z "${DATABASE_URL:-}" ]; then
          echo 'ERROR migrar: falta DATABASE_URL. Sin ella no se sabe a que base migrar.'
          exit 1
        fi
        case "$todo" in
          *--pendientes*)
            printf '%s\n' "${D_PENDIENTES_SALIDA:-67 pendientes (66 de esquema, 1 de datos). Aplicadas: 0. Nada se aplico: --pendientes solo lista.}"
            exit "${D_PENDIENTES_CODIGO:-0}" ;;
        esac
        [ -n "${D_MIGRAR_SALIDA:-}" ] && printf '%s\n' "$D_MIGRAR_SALIDA"
        exit "${D_MIGRAR_CODIGO:-0}" ;;
      *)
        # La sonda de huella: guion por stdin, que hay que consumir.
        cat >/dev/null
        if [ -z "${DATABASE_URL:-}" ]; then
          echo 'huella: no se pudo conectar (falta DATABASE_URL)'
          exit 9
        fi
        n=$(cat "$REG_HUELLA_N" 2>/dev/null || echo 0); n=$((n + 1))
        printf '%s' "$n" >"$REG_HUELLA_N"
        var="D_HUELLA_$n"
        valor="${!var:-}"
        [ -n "$valor" ] || valor="${D_HUELLA_1:-aaa bbb 67}"
        case "$valor" in
          FALLA) echo 'huella: no se pudo leer la base'; exit 9 ;;
        esac
        printf 'HUELLA %s\n' "$valor"
        exit 0 ;;
    esac ;;
  stop) exit 0 ;;
  # `docker logs` del contenedor nuevo es la peor via de fuga del paso 7: son
  # los registros de la APLICACION, y ahi caben correos, importes y nombres de
  # clientes. Por omision no dice nada; E53 lo llena a proposito.
  logs) [ -n "${D_LOGS_SALIDA:-}" ] && printf '%s\n' "$D_LOGS_SALIDA"; exit 0 ;;
  rename)
    if [ "$1" = "${CONTENEDOR_NOMBRE:-space-os}" ] && [ "${D_RENAME_FALLA:-0}" = 1 ]; then
      echo 'Error: no such container'
      exit 1
    fi
    exit 0 ;;
  rm)   exit "${D_RM_CODIGO:-0}" ;;
  start)
    [ "${D_START_FALLA:-0}" = 1 ] && exit 1
    exit 0 ;;
  *) exit 0 ;;
esac
FIN

  cat >"$BIN/curl" <<'FIN'
#!/usr/bin/env bash
printf 'curl %s\n' "$*" >>"$REG_LLAMADAS"
n=$(cat "$REG_CURL_N" 2>/dev/null || echo 0); n=$((n + 1))
printf '%s' "$n" >"$REG_CURL_N"
cod="$(printf '%s\n' "${C_CODIGOS:-200}" | tr ' ' '\n' | sed -n "${n}p")"
[ -n "$cod" ] || cod="$(printf '%s\n' "${C_CODIGOS:-200}" | tr ' ' '\n' | tail -n1)"
# `C_SALIDAS` = el codigo de SALIDA de curl en cada intento (0 por omision), que
# NO es el codigo HTTP que imprime. Los dos se mueven por separado porque en la
# vida real se mueven por separado: `-w '%{http_code}'` imprime el codigo Y curl
# puede salir != 0 justo despues (un `--max-time` agotado a mitad del cuerpo).
# Un codigo `NADA` significa que curl no llego ni a imprimir.
sal="$(printf '%s\n' "${C_SALIDAS:-0}" | tr ' ' '\n' | sed -n "${n}p")"
[ -n "$sal" ] || sal="$(printf '%s\n' "${C_SALIDAS:-0}" | tr ' ' '\n' | tail -n1)"
[ "$cod" = NADA ] || printf '%s' "$cod"
exit "$sal"
FIN

  # `sleep` tambien es un doble: el arnes no puede tardar 36 s en comprobar un
  # backoff de 1+5+30 s. Anota lo que le piden y vuelve enseguida, asi que las
  # esperas se comprueban por lo que se PIDE, no por el reloj.
  cat >"$BIN/sleep" <<'FIN'
#!/usr/bin/env bash
printf 'sleep %s\n' "$*" >>"$REG_LLAMADAS"
exit 0
FIN

  cat >"$BIN/flock" <<'FIN'
#!/usr/bin/env bash
while [ $# -gt 0 ]; do
  case "$1" in
    -n) shift ;;
    -E) shift 2 ;;
    *) break ;;
  esac
done
shift   # el archivo de candado
[ "${FLOCK_OCUPADO:-0}" = 1 ] && exit 75
exec "$@"
FIN

  cat >"$BIN/pg_dump" <<'FIN'
#!/usr/bin/env bash
printf 'pg_dump %s\n' "$*" >>"$REG_LLAMADAS"
printf 'pg_dump PGPASSWORD=[%s]\n' "${PGPASSWORD-<NO-DEFINIDA>}" >>"$REG_PGENV"
archivo=''
for a in "$@"; do case "$a" in --file=*) archivo="${a#--file=}" ;; esac; done
[ "${PGD_FALLA:-0}" = 1 ] && exit 1
if [ "${PGD_VACIO:-0}" = 1 ]; then : >"$archivo"; else printf 'respaldo falso\n' >"$archivo"; fi
exit 0
FIN

  # `s3cmd` y `aws` son los dos clientes que el plan nombra para Spaces (F3.7).
  # Anotan lo que reciben por ARGV y, aparte, lo que reciben por el ENTORNO o
  # por un archivo de configuracion: la diferencia entre las dos cosas es justo
  # lo que decide si un secreto acaba siendo visible en `ps`.
  cat >"$BIN/s3cmd" <<'FIN'
#!/usr/bin/env bash
printf 's3cmd %s
' "$*" >>"$REG_LLAMADAS"
for a in "$@"; do
  case "$a" in
    --config=*)
      f="${a#--config=}"
      printf 's3cmd CONFIG modo=%s secreto=%s
'         "$(stat -c '%a' "$f" 2>/dev/null || echo '?')"         "$(grep -c "${S3_SECRETO_ESPERADO:-SECRETO_FALSO}" "$f" 2>/dev/null || echo 0)" >>"$REG_S3ENV" ;;
  esac
done
# La RUTA del temporal, aparte de su contenido: E51 tiene que saber que archivo
# mirar despues de matar al script a media subida.
for a in "$@"; do
  case "$a" in --config=*) printf 's3cmd CONFIG_RUTA %s
' "${a#--config=}" >>"$REG_S3ENV" ;; esac
done
# `S3_LENTO` mantiene la subida abierta unos segundos: sin eso no hay "media
# subida" que interrumpir. Duerme con el `sleep` DE VERDAD — el de $BIN es un
# doble que vuelve enseguida y no serviria de nada aqui.
# Lo que se sube DE VERDAD, no solo que se subio: el criterio de F3.9 va en
# NEGATIVO —«ni un dato de negocio aparece en el log»— y eso no se puede
# comprobar mirando la linea de comandos. Hay que leer el archivo que viaja.
prev=''
for a in "$@"; do
  case "$a" in
    s3://*)
      if [ -n "${REG_S3_SUBIDO:-}" ] && [ -f "$prev" ]; then
        printf '=== SUBIDO %s ===\n' "$a" >>"$REG_S3_SUBIDO"
        cat "$prev" >>"$REG_S3_SUBIDO"
      fi ;;
  esac
  prev="$a"
done
if [ -n "${S3_LENTO:-}" ]; then /bin/sleep "$S3_LENTO" 2>/dev/null || /usr/bin/sleep "$S3_LENTO" 2>/dev/null || true; fi
[ "${S3_FALLA:-0}" = 1 ] && { echo 'ERROR: S3 error: 403 (AccessDenied)'; exit 1; }
exit 0
FIN

  cat >"$BIN/aws" <<'FIN'
#!/usr/bin/env bash
printf 'aws %s
' "$*" >>"$REG_LLAMADAS"
printf 'aws ENV AWS_ACCESS_KEY_ID=[%s] AWS_SECRET_ACCESS_KEY=[%s]
'   "${AWS_ACCESS_KEY_ID-<NO-DEFINIDA>}" "${AWS_SECRET_ACCESS_KEY-<NO-DEFINIDA>}" >>"$REG_S3ENV"
# Lo que se sube DE VERDAD, no solo que se subio: el criterio de F3.9 va en
# NEGATIVO —«ni un dato de negocio aparece en el log»— y eso no se puede
# comprobar mirando la linea de comandos. Hay que leer el archivo que viaja.
prev=''
for a in "$@"; do
  case "$a" in
    s3://*)
      if [ -n "${REG_S3_SUBIDO:-}" ] && [ -f "$prev" ]; then
        printf '=== SUBIDO %s ===\n' "$a" >>"$REG_S3_SUBIDO"
        cat "$prev" >>"$REG_S3_SUBIDO"
      fi ;;
  esac
  prev="$a"
done
[ "${S3_FALLA:-0}" = 1 ] && { echo 'upload failed: 403 Forbidden'; exit 1; }
exit 0
FIN

  # `chmod` delega en el de verdad y anota lo que se le pidio. Hace falta porque
  # el permiso del archivo de credenciales se comprueba por lo que el script
  # PIDE: en un sistema de archivos sin permisos POSIX (msys, un volumen NTFS
  # montado) `stat` devuelve 644 aunque el `chmod 600` se haya ejecutado, y esa
  # comprobacion daria un rojo que no dice nada del script.
  cat >"$BIN/chmod" <<'FIN'
#!/usr/bin/env bash
printf 'chmod %s\n' "$*" >>"$REG_LLAMADAS"
for real in /bin/chmod /usr/bin/chmod; do [ -x "$real" ] && exec "$real" "$@"; done
exit 0
FIN

  # `rm` delega en el de verdad. Existe solo para poder hacer que falle UN
  # borrado —el de un dump— sin romper los demas `rm` del script: es la unica
  # forma de comprobar que el resumen de la poda cuenta lo que BORRO y no lo que
  # se proponia borrar.
  cat >"$BIN/rm" <<'FIN'
#!/usr/bin/env bash
if [ "${D_RM_DUMP_FALLA:-0}" = 1 ]; then
  for a in "$@"; do
    case "$a" in *spaces_*.dump) echo "rm: no se pudo retirar $a" >&2; exit 1 ;; esac
  done
fi
for real in /bin/rm /usr/bin/rm; do [ -x "$real" ] && exec "$real" "$@"; done
exit 0
FIN

  # El prefijo del bucket sale de INSTANCIA y, si falta, del hostname. Subir a
  # la RAIZ del bucket seria escribir en el prefijo de otra instancia.
  cat >"$BIN/hostname" <<'FIN'
#!/usr/bin/env bash
printf '%s
' "${D_HOSTNAME:-demo-owner}"
exit 0
FIN

  cat >"$BIN/pg_restore" <<'FIN'
#!/usr/bin/env bash
printf 'pg_restore %s\n' "$*" >>"$REG_LLAMADAS"
printf 'pg_restore PGPASSWORD=[%s]\n' "${PGPASSWORD-<NO-DEFINIDA>}" >>"$REG_PGENV"
exit "${PGR_CODIGO:-0}"
FIN

  chmod +x "$BIN"/*
}

# ─── Un escenario ──────────────────────────────────────────────────────────
# preparar <nombre>  monta un entorno limpio; luego el escenario ajusta las
# variables D_* / C_* y llama a `correr`.
preparar() {
  ESCENARIO_ACTUAL="$1"
  ESCENARIOS=$((ESCENARIOS + 1))
  RAIZ_TMP="$(mktemp -d)"
  BIN="$RAIZ_TMP/bin"
  export REG_LLAMADAS="$RAIZ_TMP/llamadas.txt"
  export REG_DBURL="$RAIZ_TMP/dburl.txt"
  export REG_PGENV="$RAIZ_TMP/pgenv.txt"
  export REG_HUELLA_N="$RAIZ_TMP/huella.n"
  export REG_CURL_N="$RAIZ_TMP/curl.n"
  export REG_PULL_N="$RAIZ_TMP/pull.n"
  export REG_S3ENV="$RAIZ_TMP/s3env.txt"
  export REG_S3_SUBIDO="$RAIZ_TMP/s3-subido.txt"
  : >"$REG_LLAMADAS"; : >"$REG_DBURL"; : >"$REG_PGENV"; : >"$REG_S3ENV"; : >"$REG_S3_SUBIDO"
  montar_dobles

  export SPACE_OS_CONF="$RAIZ_TMP/instancia.env"
  export SPACE_OS_DIR_ESTADO="$RAIZ_TMP/estado"
  export SPACE_OS_DIR_LOG="$RAIZ_TMP/log"
  export SPACE_OS_CANDADO="$RAIZ_TMP/candado"
  # El mutante corre una COPIA de update.sh en /tmp, y ahi no hay respaldo.sh al
  # lado. Sin esta linea, todos los escenarios de todos los mutantes moririan por
  # el mismo motivo y "cazado" no significaria nada.
  export SPACE_OS_RESPALDO_SH="${RESPALDO_MUT:-$RAIZ/infra/scripts/respaldo.sh}"
  export CONTENEDOR_NOMBRE=space-os
  SALIDA="$RAIZ_TMP/salida.txt"
  # El log que VIAJA, en el disco de la instancia. Se mira aparte de `$SALIDA`
  # y de `update.log`: los escenarios del candado necesitan saber que hay
  # DENTRO de este archivo, no solo si se subio.
  PUBLICABLE="$SPACE_OS_DIR_LOG/update-publicable.log"

  # La clave lleva un %40 a proposito: comprueba el percent-decoding y que la
  # clave NO acabe en argv.
  URL_BASE='postgresql://spaces:cl%40ve@localhost:5433/spaces'
  cat >"$RAIZ_TMP/app.env" <<FIN
DATABASE_URL=$URL_BASE
NODE_ENV=production
FIN
  cat >"$SPACE_OS_CONF" <<FIN
CANAL=estable
REGISTRY=reg.example.com/space-os-flota
IMAGEN_NOMBRE=space-os
CONTENEDOR=space-os
DATABASE_URL=$URL_BASE
ENV_APP=$RAIZ_TMP/app.env
RUNNER_MIGRACIONES=$RAIZ_TMP/migrar.mjs
SALUD_INTENTOS=2
SALUD_ESPERA=0
INSTANCIA=demo
SPACES_KEY=LLAVE_FALSA
SPACES_SECRET=SECRETO_FALSO
SPACES_BUCKET=space-os-respaldos
LOGS_BUCKET=space-os-logs
SPACES_REGION=nyc3
FIN
  printf '// runner falso de la instancia\n' >"$RAIZ_TMP/migrar.mjs"

  # Valores por omision: hay version nueva, la imagen no trae el runner, el
  # runner aplica bien, la base cambia, la salud contesta 200.
  export D_ID_CONTENEDOR='sha256:vieja'
  export D_ID_IMAGEN='sha256:nueva'
  export D_RUNNER_EN_IMAGEN=0
  export D_MIGRAR_CODIGO=0
  export D_MIGRAR_SALIDA='67 aplicadas, 1 de datos pendientes.'
  export D_HUELLA_1='esq-viejo reg-viejo 0'
  export D_HUELLA_2='esq-nuevo reg-nuevo 67'
  export C_CODIGOS='200'
  export C_SALIDAS='0'
  unset D_HUELLA_3 D_PULL_FALLA D_RUN_FALLA D_RENAME_FALLA D_START_FALLA \
        PGD_VACIO PGD_FALLA PGR_CODIGO FLOCK_OCUPADO D_PENDIENTES_CODIGO S3_LENTO \
        D_LOGS_SALIDA 2>/dev/null || true
  export PGR_CODIGO=0
  export PGD_VACIO=0
  export PGD_FALLA=0
  export FLOCK_OCUPADO=0
  export D_PULL_FALLA=0
  export D_PULL_FALLA_VECES=0
  export S3_FALLA=0
  export D_RM_DUMP_FALLA=0
  export D_RUN_FALLA=0
  export D_RENAME_FALLA=0
  export D_START_FALLA=0
}

correr() {
  ( PATH="$BIN:$PATH"; bash "$GUION" "$@" ) >"$SALIDA" 2>&1
  CODIGO=$?
}

limpiar() { rm -rf "$RAIZ_TMP"; }

# Cambia la URL de la base en los DOS sitios que la declaran. Existe porque los
# escenarios del hallazgo 3 usan urls con `@` y `/` sin codificar dentro de la
# contrasena, que un `sed -i` sobre el archivo no puede escribir sin pelearse
# con sus propios delimitadores.
usar_url() {
  cat >"$RAIZ_TMP/app.env" <<FIN
DATABASE_URL=$1
NODE_ENV=production
FIN
  grep -v '^DATABASE_URL=' "$SPACE_OS_CONF" >"$SPACE_OS_CONF.tmp"
  mv "$SPACE_OS_CONF.tmp" "$SPACE_OS_CONF"
  cat >>"$SPACE_OS_CONF" <<FIN
DATABASE_URL=$1
FIN
}

# ─── Predicados ────────────────────────────────────────────────────────────
codigo_es() { if [ "$CODIGO" = "$1" ]; then bien; else mal "codigo esperado $1, real $CODIGO"; fi; }
log_dice() { if grep -qF -- "$1" "$SALIDA"; then bien; else mal "el log no dice: $1"; fi; }
log_calla() { if grep -qF -- "$1" "$SALIDA"; then mal "el log NO deberia decir: $1"; else bien; fi; }
hubo() { if grep -qF -- "$1" "$REG_LLAMADAS"; then bien; else mal "no se llamo: $1"; fi; }
no_hubo() { if grep -qF -- "$1" "$REG_LLAMADAS"; then mal "no deberia haberse llamado: $1"; else bien; fi; }
hubo_regex() { if grep -qE -- "$1" "$REG_LLAMADAS"; then bien; else mal "ninguna llamada casa con: $1"; fi; }
no_hubo_regex() { if grep -qE -- "$1" "$REG_LLAMADAS"; then mal "alguna llamada casa con lo prohibido: $1"; else bien; fi; }
# Cuantas veces. "Ninguna" y "una sola" son afirmaciones distintas: que una
# migracion fallida NO se reintente solo se puede comprobar CONTANDO.
veces_regex() {
  local n
  n="$(grep -cE -- "$2" "$REG_LLAMADAS" || true)"
  if [ "$n" = "$1" ]; then bien; else mal "se esperaban $1 llamadas que casen con '$2', hubo $n"; fi
}
# Sobre el ARCHIVO de log, no sobre la salida: es lo que cuenta el comando de
# verificacion de F3.8 (`grep -c "reintento" /var/log/space-os/update.log`).
veces_en_log() {
  local n
  n="$(grep -c -- "$2" "$SPACE_OS_DIR_LOG/update.log" 2>/dev/null || true)"
  if [ "$n" = "$1" ]; then bien; else mal "se esperaban $1 lineas con '$2' en update.log, hubo $n"; fi
}

# Sobre el CONTENIDO de lo que se subio al bucket, que es lo unico que puede
# responder al criterio en NEGATIVO de F3.9. `log_dice` mira la consola y
# `veces_en_log` mira `update.log`; ninguno de los dos sabe que viajo fuera.
subido_dice() { if grep -qF -- "$1" "$REG_S3_SUBIDO" 2>/dev/null; then bien; else mal "lo subido al bucket no dice: $1"; fi; }
subido_calla() { if grep -qF -- "$1" "$REG_S3_SUBIDO" 2>/dev/null; then mal "lo subido al bucket NO deberia decir: $1"; else bien; fi; }
# Sobre `update.log`, el que se queda en el droplet: la separacion solo vale si
# lo crudo SIGUE estando en el disco de la instancia. Filtrar no es perder.
log_local_dice() { if grep -qF -- "$1" "$SPACE_OS_DIR_LOG/update.log" 2>/dev/null; then bien; else mal "update.log no dice: $1"; fi; }
# Sobre el ARCHIVO que viaja, tal cual esta en el disco de la instancia. No es lo
# mismo que `subido_*`: eso mira lo que el doble de `s3cmd` recibio, y hay una
# corrida —la que se encuentra el candado tomado— que no sube nada y aun asi
# puede escribir en el publicable de OTRA. Ese caso solo se ve abriendo el archivo.
publicable_dice()  { if grep -qF -- "$1" "$PUBLICABLE" 2>/dev/null; then bien; else mal "el log publicable no dice: $1"; fi; }
publicable_calla() { if grep -qF -- "$1" "$PUBLICABLE" 2>/dev/null; then mal "el log publicable NO deberia decir: $1"; else bien; fi; }

# ============================================================================
#  ESCENARIOS
# ============================================================================

# E1 · sin cambios: mismo id de imagen que el contenedor que corre
preparar 'E1 sin cambios'
export D_ID_CONTENEDOR='sha256:nueva'
correr
codigo_es 0
log_dice 'sin cambios'
no_hubo 'pg_dump'
no_hubo '--detach'
limpiar

# E2 · no existe instancia.env
preparar 'E2 sin instancia.env'
rm -f "$SPACE_OS_CONF"
correr
codigo_es 1
log_dice 'no existe'
no_hubo 'docker pull'
limpiar

# E3 · canal invalido
preparar 'E3 canal invalido'
sed -i 's/^CANAL=.*/CANAL=produccion/' "$SPACE_OS_CONF"
correr
codigo_es 1
log_dice 'no es ni estable ni beta'
no_hubo 'docker pull'
limpiar

# E4 · instancia.env y app.env apuntan a bases distintas
preparar 'E4 dos bases distintas'
sed -i 's#/spaces$#/spaces_otra#' "$RAIZ_TMP/app.env"
correr
codigo_es 1
log_dice 'bases DISTINTAS'
no_hubo 'pg_dump'
limpiar

# E5 · el pull falla
preparar 'E5 pull fallido'
export D_PULL_FALLA=1
correr
codigo_es 1
log_dice 'fallo el `docker pull`'
no_hubo 'pg_dump'
limpiar

# E6 · respaldo vacio: se para antes de migrar
preparar 'E6 respaldo vacio'
export PGD_VACIO=1
correr
codigo_es 1
log_dice 'BACKUP VACIO'
hubo 'pg_dump'
# Un dump de 0 bytes no se sube a ningun sitio: en el bucket seria el mas
# reciente y el que alguien elegiria para restaurar.
#
# Ojo: hasta F3.9 esto se comprobaba con `no_hubo 's3cmd'`, y desde F3.9 ese
# atajo dice otra cosa —el LOG de la corrida SI sube, precisamente porque el
# update fallo (E54)—. Lo que no puede subir es un DUMP, y eso es lo que se
# afirma ahora; el atajo afirmaba de mas.
no_hubo_regex 's3://[^ ]*\.dump'
no_hubo 'node scripts/migrar.mjs'
no_hubo '--detach'
# El archivo de 0 bytes NO se queda junto a los buenos: en un `ls` del directorio
# de respaldos parece uno mas, y el bueno es el de al lado.
if [ -z "$(ls -A "$SPACE_OS_DIR_ESTADO/respaldos" 2>/dev/null)" ]; then bien; else mal 'el respaldo vacio se quedo en disco'; fi
limpiar

# E7 · ya hay otro update dentro del candado
preparar 'E7 candado tomado'
export FLOCK_OCUPADO=1
correr
codigo_es 75
log_dice 'ya hay otro update en marcha'
# Y no sube NADA (F3.9): el log publicable es de la corrida que TIENE el candado,
# y esta no hizo nada que valga la pena diagnosticar. Escribirle encima seria
# mezclar dos historias en el mismo objeto del bucket.
no_hubo 's3cmd'
no_hubo 'docker pull'
limpiar

# E8 · --dry-run no toca nada
preparar 'E8 dry-run'
correr --dry-run
codigo_es 0
log_dice '67 migraciones pendientes'
hubo '--pendientes'
no_hubo 'pg_dump'
no_hubo '--detach'
limpiar

# E9 · el runner devuelve 3 (historia distinta)
preparar 'E9 codigo 3'
export D_MIGRAR_CODIGO=3
export D_MIGRAR_SALIDA='ERROR migrar: 20260715_x.sql cambio de contenido.'
correr
codigo_es 3
log_dice 'NADA se aplico'
no_hubo '--detach'
no_hubo 'pg_restore'
limpiar

# E10 · el runner devuelve 1 (no puede ni empezar)
preparar 'E10 codigo 1'
export D_MIGRAR_CODIGO=1
export D_MIGRAR_SALIDA='ERROR migrar: base con datos y sin schema_migrations.'
export D_HUELLA_2='esq-viejo reg-viejo 0'
correr
codigo_es 1
log_dice 'no pudo ni empezar'
log_dice 'base con datos y sin schema_migrations'
no_hubo '--detach'
limpiar

# E11 · ROJO 2 DE LA AUDITORIA · codigo 2 con la salida LITERAL de
#       `migrar.mjs:687-692` y la base cambiada: el log NO puede decir que no
#       consta ninguna migracion aplicada.
preparar 'E11 codigo 2 con la base cambiada (rojo 2)'
export D_MIGRAR_CODIGO=2
export D_MIGRAR_SALIDA='ERROR migrar: se aplicaron 66 migraciones y no se pudieron registrar: falta `schema_migrations` (la crea 20260812_schema_migrations.sql).'
export D_HUELLA_1='esq-viejo sin-tabla -1'
export D_HUELLA_2='esq-nuevo sin-tabla -1'
correr
codigo_es 2
log_dice 'LA BASE CAMBIO'
log_calla 'suele ser que no pudo conectar'
log_calla 'no consta ninguna migracion aplicada'
no_hubo '--detach'
no_hubo 'pg_restore'
limpiar

# E12 · codigo 2 y la base intacta: ahi si se dice que no cambio
preparar 'E12 codigo 2 sin cambios en la base'
export D_MIGRAR_CODIGO=2
export D_MIGRAR_SALIDA='ERROR migrar: no se pudo conectar a localhost:5433/spaces.'
export D_HUELLA_1='esq-viejo reg-viejo 67'
export D_HUELLA_2='esq-viejo reg-viejo 67'
correr
codigo_es 2
log_dice 'la base NO cambio'
log_calla 'LA BASE CAMBIO'
# El porque del fallo lo dice el runner, que imprime justo encima. Este script no
# lo adivina: en el ensayo local la causa medida fue una migracion que fallo
# contra un objeto que ya existia, no una conexion caida.
log_calla 'Tipicamente no pudo conectar'
no_hubo 'pg_restore'
limpiar

# E13 · ROJO 1 DE LA AUDITORIA · corrida buena con la salida LITERAL
#       "67 aplicadas, 1 de datos pendientes." y salud que falla: TIENE que
#       restaurar. Este es el escenario que el arnes anterior daba por verde.
preparar 'E13 vuelta atras con migraciones (rojo 1)'
export D_MIGRAR_SALIDA='67 aplicadas, 1 de datos pendientes.'
export C_CODIGOS='000 000 200 200'
correr
codigo_es 4
hubo 'pg_restore'
log_dice 'restaurando'
log_dice 'VUELTA ATRAS COMPLETA'
log_calla 'la base no se toca'
limpiar

# E14 · vuelta atras sin migraciones: la base NO se toca
preparar 'E14 vuelta atras sin migraciones'
export D_MIGRAR_SALIDA='0 aplicadas.'
export D_HUELLA_1='esq-igual reg-igual 67'
export D_HUELLA_2='esq-igual reg-igual 67'
export C_CODIGOS='000 000 200 200'
correr
codigo_es 4
no_hubo 'pg_restore'
log_dice 'no se toca'
limpiar

# E15 · la huella no se puede releer y la salud falla: se restaura por prudencia
preparar 'E15 huella ilegible despues'
export D_HUELLA_2='FALLA'
export C_CODIGOS='000 000 200 200'
correr
codigo_es 4
hubo 'pg_restore'
log_dice 'POR PRUDENCIA'
limpiar

# E16 · la huella no se puede leer ANTES: no se migra siquiera
preparar 'E16 huella ilegible antes'
export D_HUELLA_1='FALLA'
correr
codigo_es 1
log_dice 'no se pudo leer la huella de la base antes de migrar'
no_hubo 'node scripts/migrar.mjs'
no_hubo '--detach'
no_hubo 'pg_restore'
limpiar

# E17 · camino feliz completo
preparar 'E17 camino feliz'
correr
codigo_es 0
log_dice 'OK: v0.4.2 sirviendo'
hubo 'pg_dump'
hubo 'node scripts/migrar.mjs'
hubo '--detach'
no_hubo 'pg_restore'
if [ -s "$SPACE_OS_DIR_ESTADO/version-actual" ]; then bien; else mal 'no se escribio version-actual'; fi
if [ -s "$SPACE_OS_DIR_ESTADO/version-anterior" ]; then bien; else mal 'no se escribio version-anterior'; fi
limpiar

# E18 · la restauracion falla en la vuelta atras
preparar 'E18 pg_restore fallido'
export C_CODIGOS='000 000'
export PGR_CODIGO=1
correr
codigo_es 5
log_dice 'VUELTA ATRAS A MEDIAS'
# Un codigo 5 deja la instancia SIN servicio, con el contenedor viejo aparcado y
# parado. El mensaje que alguien lee a las cuatro de la manana tiene que decir
# las dos cosas: que no hay servicio, y el comando exacto que lo devuelve.
log_dice 'La instancia queda SIN servicio'
log_dice 'docker rename space-os-anterior space-os && docker start space-os'
limpiar

# E19 · no habia version anterior a la que volver
preparar 'E19 sin version anterior'
export D_ID_CONTENEDOR=''
export C_CODIGOS='000 000'
correr
codigo_es 5
log_dice 'VUELTA ATRAS IMPOSIBLE'
limpiar

# E20 · se vuelve atras y la version anterior tampoco contesta
preparar 'E20 la anterior tampoco responde'
export C_CODIGOS='000 000 000 000'
correr
codigo_es 5
log_dice 'VUELTA ATRAS SIN SALUD'
hubo 'pg_restore'
limpiar

# E21 · el rename de 5b falla: el contenedor VIEJO no se puede borrar por nombre
preparar 'E21 rename fallido en 5b'
export D_RENAME_FALLA=1
export D_RUN_FALLA=1
export C_CODIGOS='000 000 200 200'
correr
no_hubo_regex 'docker rm -f space-os$'
hubo_regex 'docker start space-os$'
no_hubo_regex 'docker rename space-os-anterior space-os'
limpiar

# E22 · el contenedor nuevo se retira por ID, no por nombre
preparar 'E22 retirada del contenedor nuevo por id'
export D_NUEVO_ID='deadbeef1234'
export C_CODIGOS='000 000 200 200'
correr
hubo 'docker rm -f deadbeef1234'
no_hubo_regex 'docker rm -f space-os$'
limpiar

# E23 · pg_restore SIEMPRE con --clean --if-exists --single-transaction
preparar 'E23 banderas de pg_restore'
export C_CODIGOS='000 000 200 200'
correr
hubo_regex 'pg_restore .*--clean'
hubo_regex 'pg_restore .*--if-exists'
hubo_regex 'pg_restore .*--single-transaction'
limpiar

# E24 · DATABASE_URL llega DE VERDAD a los contenedores efimeros
preparar 'E24 DATABASE_URL exportada'
correr
if grep -q 'NO-EXPORTADA' "$REG_DBURL"; then mal 'algun `docker run --env DATABASE_URL` no vio la variable'; else bien; fi
if grep -q 'localhost:5433/spaces' "$REG_DBURL"; then bien; else mal 'los contenedores efimeros no recibieron la URL'; fi
limpiar

# E25 · la contrasena no viaja en argv, y llega decodificada por el entorno
preparar 'E25 la clave no sale en ps'
export C_CODIGOS='000 000 200 200'
correr
no_hubo 'cl%40ve'
no_hubo 'cl@ve'
if grep -q 'PGPASSWORD=\[cl@ve\]' "$REG_PGENV"; then bien; else mal 'PGPASSWORD no llego decodificada'; fi
hubo_regex 'pg_dump .*--dbname=postgresql://spaces@localhost:5433/spaces'
limpiar

# E26 · el padre no aparece por ningun lado
preparar 'E26 el padre no aparece'
export C_CODIGOS='000 000 200 200'
correr
no_hubo_regex '(^| )(ssh|scp|rsync|doctl|ansible)( |$)'
no_hubo_regex 'docker (pull|run) .*(209\.97|space-os\.io|padre)'
hubo 'reg.example.com/space-os-flota/space-os:estable'
limpiar

# E27 · la imagen que SI trae el runner: no se monta nada
preparar 'E27 runner dentro de la imagen'
export D_RUNNER_EN_IMAGEN=1
correr
codigo_es 0
log_dice 'runner: el de la imagen'
no_hubo '--volume'
limpiar

# E28 · la imagen no lo trae y tampoco hay copia en la instancia
preparar 'E28 sin runner en ningun lado'
rm -f "$RAIZ_TMP/migrar.mjs"
correr
codigo_es 1
log_dice 'Sin runner no se migra'
no_hubo 'pg_dump'
limpiar

# E29 · EL DEFECTO D2 · curl imprime 200 y LUEGO sale != 0 (contenedor recien
#       arrancado, `--max-time` agotado a mitad del cuerpo). La instancia
#       contesto 200: es un release SANO y no se toca. Antes el `|| echo 000`
#       pegaba un segundo codigo detras, "200000" no casaba con "200", y esto
#       terminaba en un `pg_restore` que pierde lo escrito desde el respaldo.
preparar 'E29 curl contesta 200 y sale != 0 (D2)'
export C_CODIGOS='200'
export C_SALIDAS='28'
correr
codigo_es 0
log_dice 'salud: 200 en el intento 1/2'
log_calla '200000'
no_hubo 'pg_restore'
no_hubo_regex 'docker start space-os$'
limpiar

# E30 · EL DEFECTO D2, su mitad cosmetica · un curl que falla imprime 000 por
#       `-w` y ademas sale != 0: en el log tiene que verse UN codigo, no dos.
preparar 'E30 el log ensena un solo codigo (D2)'
export C_CODIGOS='000 000 200 200'
export C_SALIDAS='7 7 0 0'
correr
codigo_es 4
log_dice 'salud: intento 1/2 -> 000'
log_calla '000000'
limpiar

# E31 · curl no llega ni a imprimir (binario ausente, OOM): sigue dando 000
preparar 'E31 curl mudo -> 000'
export C_CODIGOS='NADA NADA 200 200'
export C_SALIDAS='7 7 0 0'
correr
codigo_es 4
log_dice 'salud: intento 1/2 -> 000'
log_calla '000000'
limpiar

# E32 · EL DEFECTO D3 · no hay `pg_restore` con el que restaurar: codigo 5. En
#       ese punto la instancia esta CAIDA y el contenedor viejo esta aparcado
#       como `-anterior` y parado. Medido en el ensayo local: se rescato con un
#       `rename` + `start` en 8 s, y ese comando tiene que estar en el mensaje.
preparar 'E32 sin pg_restore: codigo 5 con rescate (D3)'
printf 'PG_RESTORE=pg_restore_que_no_existe\n' >>"$SPACE_OS_CONF"
export C_CODIGOS='000 000 200 200'
correr
codigo_es 5
log_dice 'VUELTA ATRAS A MEDIAS'
log_dice 'La instancia queda SIN servicio'
log_dice 'docker rename space-os-anterior space-os && docker start space-os'
no_hubo 'pg_restore '
limpiar

# ── F3.8 · reintentos con backoff, y un limite ─────────────────────────────

# E33 · LA BANDERA DEL COMANDO DE VERIFICACION · `--simular-fallo-pull` deja
#       ejercitar la politica de reintentos en una instancia de verdad sin
#       cortarle la red al droplet. El pull no llega: la instancia tiene que
#       quedar EXACTAMENTE como estaba, y los tres reintentos NUMERADOS en el
#       log. El conteo es el del plan: `grep -c "reintento" update.log` == 3.
preparar 'E33 --simular-fallo-pull (F3.8)'
correr --simular-fallo-pull
codigo_es 1
veces_en_log 3 'reintento'
log_dice 'reintento 1/3'
log_dice 'reintento 2/3'
log_dice 'reintento 3/3'
log_dice 'fallo el `docker pull`'
# El backoff, comprobado por lo que se le PIDE a `sleep`: 1 s, 5 s y 30 s.
hubo 'sleep 1'
hubo 'sleep 5'
hubo 'sleep 30'
# La simulacion no habla con el registry: se para antes de llamar a docker.
no_hubo 'docker pull'
# "Deja la instancia exactamente como estaba": ni respaldo, ni base, ni
# contenedor. Las tres se comprueban por separado.
no_hubo 'pg_dump'
no_hubo 'pg_restore'
no_hubo 'node scripts/migrar.mjs'
no_hubo '--detach'
no_hubo_regex 'docker (stop|rename|start) '
if [ -e "$SPACE_OS_DIR_ESTADO/version-anterior" ]; then mal 'se anoto version-anterior con un pull que no llego'; else bien; fi
if [ -z "$(ls -A "$SPACE_OS_DIR_ESTADO/respaldos" 2>/dev/null)" ]; then bien; else mal 'se respaldo con un pull que no llego'; fi
limpiar

# E34 · el pull falla DE VERDAD (no simulado): 1 intento + 3 reintentos = 4
#       llamadas a `docker pull`, y despues se rinde. Sin esto, "3 reintentos"
#       podria ser 1, 7 o infinito y el arnes no notaria la diferencia.
preparar 'E34 pull fallido: 4 intentos y se rinde (F3.8)'
export D_PULL_FALLA=1
correr
codigo_es 1
veces_regex 4 '^docker pull '
veces_en_log 3 'reintento'
hubo 'sleep 1'
hubo 'sleep 5'
hubo 'sleep 30'
no_hubo 'pg_dump'
no_hubo 'node scripts/migrar.mjs'
no_hubo '--detach'
limpiar

# E35 · la red intermitente, que es el caso que F3.8 existe para aguantar: los
#       dos primeros pull fallan, el tercero entra y el update SIGUE. Un
#       reintento que no reintenta de verdad no sirve de nada.
preparar 'E35 pull que se recupera al tercer intento (F3.8)'
export D_PULL_FALLA_VECES=2
correr
codigo_es 0
veces_regex 3 '^docker pull '
log_dice 'reintento 2/3'
log_dice 'OK: v0.4.2 sirviendo'
hubo 'sleep 1'
hubo 'sleep 5'
no_hubo 'sleep 30'
hubo 'pg_dump'
hubo '--detach'
limpiar

# E36 · EL LIMITE · una migracion que falla NO se reintenta NUNCA. Es la mitad
#       importante de F3.8: reintentar una migracion a medias es como se
#       corrompe una base. Se comprueba CONTANDO las llamadas al runner —una y
#       solo una—, porque "no se reintenta" no se ve en un log.
preparar 'E36 la migracion fallida no se reintenta (F3.8)'
export D_MIGRAR_CODIGO=2
export D_MIGRAR_SALIDA='ERROR migrar: 20260812_x.sql fallo a la mitad.'
correr
codigo_es 2
veces_regex 1 'node scripts/migrar.mjs'
veces_en_log 0 'reintento'
no_hubo '--detach'
no_hubo 'pg_restore'
limpiar

# E37 · lo mismo con el codigo 3 (historia distinta): tampoco se reintenta.
#       Los dos codigos salen por ramas distintas del `case`, asi que se
#       comprueban por separado.
preparar 'E37 el codigo 3 tampoco se reintenta (F3.8)'
export D_MIGRAR_CODIGO=3
export D_MIGRAR_SALIDA='ERROR migrar: 20260715_x.sql cambio de contenido.'
correr
codigo_es 3
veces_regex 1 'node scripts/migrar.mjs'
veces_en_log 0 'reintento'
no_hubo '--detach'
limpiar

# ── F3.7 · el respaldo sale del droplet ────────────────────────────────────

# E38 · LA TAREA · el respaldo se sube a Spaces con la ruta EXACTA del plan:
#       s3://space-os-respaldos/<instancia>/<AAAA-MM-DD-HHMM>.dump
preparar 'E38 el respaldo sube a Spaces (F3.7)'
correr
codigo_es 0
hubo_regex '^s3cmd .* put .* s3://space-os-respaldos/demo/[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}\.dump$'
log_dice 'respaldo remoto'
log_calla 'RESPALDO REMOTO FALLIDO'
# `gsutil` es Google Cloud Storage y no habla con Spaces: el plan lo avisa
# expresamente y aqui se comprueba que nadie lo colo.
no_hubo_regex '(^| )gsutil( |$)'
# Se sube el respaldo de esta corrida, no otra cosa.
hubo_regex 's3cmd .*put .*respaldos/spaces_[0-9]+_[0-9]+\.dump'
limpiar

# E39 · EL CRITERIO DE ACEPTACION, SEGUNDA MITAD · la subida falla y el update
#       SIGUE —el respaldo local ya existe y basta para la vuelta atras— pero
#       NO pasa desapercibida.
preparar 'E39 subida fallida: el update sigue y queda escrito (F3.7)'
export S3_FALLA=1
correr
codigo_es 0
log_dice 'RESPALDO REMOTO FALLIDO'
log_dice 'OK: v0.4.2 sirviendo'
hubo '--detach'
# El respaldo local sigue en su sitio: es lo que hace que la subida pueda fallar
# sin detener nada.
if [ -n "$(ls -A "$SPACE_OS_DIR_ESTADO/respaldos" 2>/dev/null)" ]; then bien; else mal 'la subida fallida se llevo por delante el respaldo local'; fi
limpiar

# E40 · RETENCION LOCAL · 3 respaldos y ni uno mas. Cierra la segunda mitad de
#       D4: el directorio no se podaba NUNCA y en una instancia real son gigas
#       por noche. Los 3 que quedan son los mas recientes, y el de esta corrida
#       es uno de ellos (la vuelta atras lo necesita).
preparar 'E40 retencion: 3 respaldos locales (D4, F3.7)'
mkdir -p "$SPACE_OS_DIR_ESTADO/respaldos"
for viejo in 20250101_000000 20250102_000000 20250103_000000 20250104_000000 20250105_000000; do
  printf 'respaldo viejo\n' >"$SPACE_OS_DIR_ESTADO/respaldos/spaces_$viejo.dump"
done
correr
codigo_es 0
n_dumps="$(ls -1 "$SPACE_OS_DIR_ESTADO/respaldos"/spaces_*.dump 2>/dev/null | wc -l | tr -d ' ')"
if [ "$n_dumps" = 3 ]; then bien; else mal "quedaron $n_dumps respaldos locales, se esperaban 3"; fi
# El mas viejo se fue; el mas nuevo de los viejos se queda; el de esta corrida
# tambien (es el que nombra version-anterior).
if [ -e "$SPACE_OS_DIR_ESTADO/respaldos/spaces_20250101_000000.dump" ]; then mal 'el respaldo mas viejo no se podo'; else bien; fi
if [ -e "$SPACE_OS_DIR_ESTADO/respaldos/spaces_20250105_000000.dump" ]; then bien; else mal 'se podo un respaldo que estaba entre los 3 mas recientes'; fi
bk_actual="$(sed -n 's/^respaldo=//p' "$SPACE_OS_DIR_ESTADO/version-anterior" 2>/dev/null)"
if [ -s "$bk_actual" ]; then bien; else mal "la poda se llevo el respaldo de esta corrida ($bk_actual)"; fi
limpiar

# E41 · LA ASIMETRIA DE LA RETENCION · la poda REMOTA no la hace el script: son
#       30 dias por regla de ciclo de vida del bucket. Un `rm` mal escrito en un
#       script que corre en TODAS las instancias es una forma elegante de
#       perderlo todo, asi que aqui se comprueba que ese `rm` no existe.
preparar 'E41 el script NUNCA borra en el bucket (F3.7)'
correr
codigo_es 0
no_hubo_regex '^s3cmd .*(del|rm|expire|setlifecycle)'
no_hubo_regex '^aws s3 (rm|rb)'
no_hubo_regex '^aws s3api (delete-object|put-bucket-lifecycle)'
limpiar

# E42 · sin credenciales no se sube nada, y se dice con todas las letras: esa
#       instancia NO tiene respaldo fuera del droplet.
preparar 'E42 sin credenciales de Spaces (F3.7)'
sed -i '/^SPACES_KEY=/d; /^SPACES_SECRET=/d' "$SPACE_OS_CONF"
correr
codigo_es 0
log_dice 'respaldo remoto NO CONFIGURADO'
no_hubo 's3cmd'
no_hubo 'aws s3 cp'
hubo 'pg_dump'
hubo '--detach'
limpiar

# E43 · LAS CREDENCIALES NO VIAJAN EN ARGV · mismo criterio que la contrasena de
#       Postgres (E25): `--access_key=` en la linea de comandos es visible en
#       `ps` para cualquier usuario de la maquina.
preparar 'E43 la llave de Spaces no sale en ps (F3.7)'
correr
no_hubo 'SECRETO_FALSO'
no_hubo 'LLAVE_FALSA'
no_hubo_regex 's3cmd .*(--secret_key|--access_key)'
# Pero el cliente SI las recibe: por un archivo de configuracion aparte, y con
# el secreto dentro (si no, la subida "funcionaria" sin credenciales).
if grep -q 'CONFIG .*secreto=1' "$REG_S3ENV"; then bien; else mal 'el cliente no recibio las credenciales por un archivo de configuracion'; fi
# Y ese archivo se pide en 0600 ANTES de escribirle el secreto dentro.
hubo_regex '^chmod 600 '
limpiar

# E44 · no hay cliente de S3 instalado: es un fallo de subida como cualquier
#       otro. El update sigue y el log dice que instalar.
preparar 'E44 sin cliente s3 instalado (F3.7)'
rm -f "$BIN/s3cmd" "$BIN/aws"
correr
codigo_es 0
log_dice 'RESPALDO REMOTO FALLIDO'
log_dice 's3cmd'
hubo '--detach'
limpiar

# E45 · el segundo cliente que nombra el plan: sin `s3cmd`, `aws s3 cp` con
#       `--endpoint-url`, que es lo que hace hablar a la CLI de AWS con Spaces.
preparar 'E45 fallback a aws s3 cp --endpoint-url (F3.7)'
rm -f "$BIN/s3cmd"
correr
codigo_es 0
hubo_regex '^aws s3 cp .* s3://space-os-respaldos/demo/[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}\.dump --endpoint-url https://nyc3\.digitaloceanspaces\.com$'
log_calla 'RESPALDO REMOTO FALLIDO'
no_hubo 'SECRETO_FALSO'
if grep -q 'AWS_SECRET_ACCESS_KEY=\[SECRETO_FALSO\]' "$REG_S3ENV"; then bien; else mal 'aws no recibio el secreto por el entorno'; fi
limpiar

# E46 · la poda solo mira los respaldos. Un `rm` con un patron flojo, en el
#       directorio de estado de todas las instancias, no se arregla despues.
preparar 'E46 la poda no toca lo que no es un respaldo (F3.7)'
mkdir -p "$SPACE_OS_DIR_ESTADO/respaldos/subdirectorio"
printf 'no soy un respaldo\n' >"$SPACE_OS_DIR_ESTADO/respaldos/LEEME.txt"
for viejo in 20250101_000000 20250102_000000 20250103_000000 20250104_000000; do
  printf 'respaldo viejo\n' >"$SPACE_OS_DIR_ESTADO/respaldos/spaces_$viejo.dump"
done
correr
codigo_es 0
if [ -e "$SPACE_OS_DIR_ESTADO/respaldos/LEEME.txt" ]; then bien; else mal 'la poda borro un archivo que no es un respaldo'; fi
if [ -d "$SPACE_OS_DIR_ESTADO/respaldos/subdirectorio" ]; then bien; else mal 'la poda borro un subdirectorio'; fi
limpiar

# E47 · sin `respaldo.sh` al lado no se actualiza. Fail-closed y ANTES de tocar
#       nada: mejor una instancia que no se actualiza que una que se actualiza
#       sin respaldo fuera del droplet y sin podar el disco.
preparar 'E47 falta respaldo.sh: se para antes de tocar nada (F3.7)'
export SPACE_OS_RESPALDO_SH="$RAIZ_TMP/respaldo.sh"   # no existe: es un tmp vacio
correr
codigo_es 1
log_dice 'respaldo.sh'
no_hubo 'docker pull'
no_hubo 'pg_dump'
no_hubo '--detach'
limpiar

# E48 · si falta INSTANCIA el prefijo sale del hostname. Subir a la RAIZ del
#       bucket seria escribir donde no toca —y con una llave por instancia con
#       permiso solo a su prefijo, ademas, fallaria con un 403.
preparar 'E48 sin INSTANCIA, el prefijo sale del hostname (F3.7)'
sed -i '/^INSTANCIA=/d' "$SPACE_OS_CONF"
export D_HOSTNAME=demo-owner
correr
codigo_es 0
hubo_regex 's3://space-os-respaldos/demo-owner/[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}\.dump'
no_hubo_regex 's3://space-os-respaldos/[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}\.dump'
limpiar

# E49 · H1 · LA PODA ORDENA POR ANTIGUEDAD, NO POR NOMBRE. E40 solo sembraba
#       nombres con formato de fecha, y por eso nadie vio esto: `sort` ordena la
#       RUTA, asi que cualquier dump con otro nombre —`spaces_x.dump`, el que el
#       propio `respaldo.sh` documenta para el uso a mano— ordena DESPUES de
#       `spaces_2026...` y cuenta como "de los mas recientes". El que sobra pasa
#       a ser el de ESTA corrida, y con el se van la subida a Spaces y el
#       archivo que la vuelta atras del paso 7a necesita.
#       Las fechas se ponen con `touch -t`: aqui la antiguedad real y el nombre
#       dicen cosas distintas a proposito.
preparar 'E49 la poda ordena por antiguedad, no por nombre (F3.7, H1)'
mkdir -p "$SPACE_OS_DIR_ESTADO/respaldos"
for suelto in x y z; do
  printf 'respaldo viejo\n' >"$SPACE_OS_DIR_ESTADO/respaldos/spaces_$suelto.dump"
done
touch -t 202501010000 "$SPACE_OS_DIR_ESTADO/respaldos/spaces_x.dump"
touch -t 202501020000 "$SPACE_OS_DIR_ESTADO/respaldos/spaces_y.dump"
touch -t 202501030000 "$SPACE_OS_DIR_ESTADO/respaldos/spaces_z.dump"
correr
codigo_es 0
bk_actual="$(sed -n 's/^respaldo=//p' "$SPACE_OS_DIR_ESTADO/version-anterior" 2>/dev/null)"
if [ -s "$bk_actual" ]; then bien; else mal "la poda se llevo el respaldo de esta corrida ($bk_actual): ordena por nombre, no por antiguedad"; fi
if [ -e "$SPACE_OS_DIR_ESTADO/respaldos/spaces_x.dump" ]; then mal 'el dump mas ANTIGUO (spaces_x.dump) sigue ahi: la poda no ordena por antiguedad'; else bien; fi
if [ -e "$SPACE_OS_DIR_ESTADO/respaldos/spaces_z.dump" ]; then bien; else mal 'se podo spaces_z.dump, que estaba entre los 3 mas recientes'; fi
n_dumps="$(ls -1 "$SPACE_OS_DIR_ESTADO/respaldos"/spaces_*.dump 2>/dev/null | wc -l | tr -d ' ')"
if [ "$n_dumps" = 3 ]; then bien; else mal "quedaron $n_dumps respaldos locales, se esperaban 3"; fi
# La cadena de consecuencias, que es lo que hace grave el defecto: sin el dump
# de esta corrida no hay nada que subir, y el update escribe RESPALDO REMOTO
# FALLIDO sin que haya fallado ninguna subida.
hubo_regex 's3cmd .*put .*respaldos/spaces_[0-9]+_[0-9]+\.dump'
log_calla 'RESPALDO REMOTO FALLIDO'
limpiar

# E50 · H2 · el resumen de la poda cuenta lo que RETIRO, no lo que se proponia
#       retirar. Con los `rm` fallando quedan los 6 dumps y la linea de resumen
#       decia "3 respaldo(s) retirados, quedan los 3 mas recientes": lo
#       contrario de lo ocurrido, y justo en la linea que alguien leeria para
#       saber si el disco se esta vaciando.
preparar 'E50 el resumen de la poda cuenta lo retirado de verdad (F3.7, H2)'
mkdir -p "$SPACE_OS_DIR_ESTADO/respaldos"
for viejo in 20250101_000000 20250102_000000 20250103_000000 20250104_000000 20250105_000000; do
  printf 'respaldo viejo\n' >"$SPACE_OS_DIR_ESTADO/respaldos/spaces_$viejo.dump"
done
export D_RM_DUMP_FALLA=1
correr
codigo_es 0
n_dumps="$(ls -1 "$SPACE_OS_DIR_ESTADO/respaldos"/spaces_*.dump 2>/dev/null | wc -l | tr -d ' ')"
if [ "$n_dumps" = 6 ]; then bien; else mal "el doble de rm no fallo como se esperaba: quedaron $n_dumps dumps, no 6"; fi
log_dice 'AVISO poda: no se pudo retirar'
log_calla 'poda local: 3 respaldo(s) retirados'
log_dice 'se querian retirar 3 y solo se retiraron 0'
# Y el fallo parcial sale por el codigo de retorno, que es lo que hace que el
# `if !` de update.sh —escrito en F3.7 y hasta hoy inalcanzable— sirva de algo.
log_dice 'AVISO: la poda de'
log_dice 'OK: v0.4.2 sirviendo'
limpiar

# E51 · H4 · el temporal con la llave de Spaces no sobrevive a una senal. El
#       `rm -f "$conf"` del final solo corre si el flujo LLEGA ahi: con un
#       SIGTERM a media subida el archivo con el secreto se queda en el disco.
#       Se ejecuta `respaldo.sh` a mano —la via que su propia cabecera
#       documenta— y se le manda TERM mientras el cliente sigue subiendo.
preparar 'E51 el temporal con la llave se borra tambien por senal (F3.7, H4)'
export S3_LENTO=3
suelto="$RAIZ_TMP/spaces_suelto.dump"
printf 'respaldo suelto\n' >"$suelto"
PATH="$BIN:$PATH" INSTANCIA=demo SPACES_KEY=LLAVE_FALSA SPACES_SECRET=SECRETO_FALSO \
  bash "$SPACE_OS_RESPALDO_SH" subir "$suelto" >"$SALIDA" 2>&1 &
hijo=$!
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  grep -q CONFIG_RUTA "$REG_S3ENV" 2>/dev/null && break
  sleep 0.3
done
kill -TERM "$hijo" 2>/dev/null || true
wait "$hijo"; CODIGO=$?
conf_temporal="$(sed -n 's/^s3cmd CONFIG_RUTA //p' "$REG_S3ENV" 2>/dev/null | tail -n1)"
if [ -n "$conf_temporal" ]; then bien; else mal 'el cliente no llego a recibir el archivo de configuracion: el escenario no probo nada'; fi
if [ -n "$conf_temporal" ] && [ -e "$conf_temporal" ]; then
  mal "el temporal con la llave de Spaces sobrevivio al SIGTERM: $conf_temporal"
  rm -f "$conf_temporal"
else
  bien
fi
# Y morir por una senal no es salir bien: el codigo lo tiene que decir.
if [ "$CODIGO" != 0 ]; then bien; else mal 'el script salio con 0 despues de un SIGTERM a media subida'; fi
# Y tiene que quedar DICHO. Esta comprobacion no es decoracion: medido el 18/08,
# bash ejecuta el `trap ... EXIT` tambien cuando lo mata una senal, asi que el
# archivo desaparece con el `trap` de EXIT solo. Lo que unicamente pueden dar los
# traps de TERM/INT/HUP es esta linea y un codigo de salida elegido; sin
# comprobarla, quitarlos no lo veria nadie (y de hecho no lo vio: el mutante
# escapaba).
log_dice 'a media subida'
limpiar

# E52 · LA TAREA · el log de la corrida sale al bucket con la ruta EXACTA del
#       plan: s3://space-os-logs/<instancia>/<AAAA-MM-DD-HHMM>.log. Y es OTRO
#       bucket, no el de F3.7: otra regla de ciclo de vida (90 dias, no 30) y
#       otro permiso.
preparar 'E52 el log sube al bucket (F3.9)'
correr
codigo_es 0
hubo_regex '^s3cmd .* put .* s3://space-os-logs/demo/[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}\.log$'
log_dice 'log remoto OK'
# Lo que viaja son las lineas del propio script mas el codigo de salida, que es
# con lo que se diagnostica una corrida sin entrar por ssh.
subido_dice '1 · pull reg.example.com/space-os-flota/space-os:estable'
subido_dice 'OK: v0.4.2 sirviendo'
subido_dice 'salida: 0'
limpiar

# E53 · EL CORAZON DE F3.9, Y VA EN NEGATIVO · ni un dato de negocio en el log
#       que sale del droplet. Las dos vias de fuga son reales y estan medidas:
#       la salida cruda del runner de migraciones —un error de Postgres arrastra
#       la fila que lo provoco— y `docker logs --tail 30` del contenedor nuevo,
#       que son los registros de la APLICACION. Las dos entran hoy en
#       `update.log` por `eco`, y por eso `update.log` NO es lo que se sube.
#       Nombres de tabla y conteos son aceptables; cualquier fila, no.
preparar 'E53 ni un dato de negocio en el log que se sube (F3.9)'
export D_MIGRAR_SALIDA='ERROR: llave duplicada viola la restriccion de unicidad "arrendadores_tenant_rfc_uq" DETALLE: Ya existe la llave (tenant_id, rfc)=(rgb, XAXX010101000).'
export D_LOGS_SALIDA='[app] POST /api/clientes 500 cliente="Grupo Salinas SA de CV" contacto=jose.lopez@ejemplo.mx importe=184500.00'
export C_CODIGOS='500 500 200 200'
correr
codigo_es 4
# Lo crudo NO se pierde: sigue entero en el droplet, que es donde se mira
# cuando el bucket no basta. Filtrar no es tirar.
log_local_dice 'XAXX010101000'
log_local_dice 'Grupo Salinas SA de CV'
log_local_dice 'jose.lopez@ejemplo.mx'
# Y no sale de ahi.
subido_calla 'XAXX010101000'
subido_calla 'Grupo Salinas SA de CV'
subido_calla 'jose.lopez@ejemplo.mx'
subido_calla '184500.00'
# Tampoco las credenciales, que viven en el mismo entorno que todo lo demas.
subido_calla 'SECRETO_FALSO'
subido_calla 'LLAVE_FALSA'
# Y menos que ninguna la contrasena de Postgres, que es el peor string del
# entorno: hoy no sale porque cada linea que imprime la conexion pasa por
# `destino_de_url`, que corta el `usuario:clave@`. Un `registrar` que algun dia
# imprima "$DATABASE_URL" a secas mandaria la llave de la base a un bucket.
subido_calla 'cl@ve'
subido_calla 'cl%40ve'
# Y lo que SI tiene que llegar, porque sin eso el log no diagnostica nada.
subido_dice '7 · VUELTA ATRAS'
subido_dice 'salida: 4'
limpiar

# E54 · «salga bien o mal» es literal · el update aborta antes de migrar
#       —respaldo vacio, codigo 1— y el log viaja igual. Una actualizacion que
#       falla es justo la que hay que poder leer sin entrar al servidor.
preparar 'E54 el log sube tambien cuando el update falla (F3.9)'
export PGD_VACIO=1
correr
codigo_es 1
hubo_regex '^s3cmd .* put .* s3://space-os-logs/demo/[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}\.log$'
subido_dice 'BACKUP VACIO'
subido_dice 'salida: 1'
limpiar

# E55 · sin credenciales el log no sale, y se dice con esas palabras: esa
#       instancia solo se puede diagnosticar entrando por ssh, que es justo lo
#       que el modelo evita. Mismo criterio que E42 con el respaldo.
preparar 'E55 sin credenciales el log no sale del droplet (F3.9)'
sed -i '/^SPACES_KEY=/d; /^SPACES_SECRET=/d' "$SPACE_OS_CONF"
correr
codigo_es 0
log_dice 'log remoto NO CONFIGURADO'
no_hubo 's3://space-os-logs'
limpiar

# E56 · lo que sube es ESTA corrida, no el historico. `update.log` se acumula
#       desde que la instancia nacio; subir el acumulado seria subir cada corrida
#       otra vez —y con ella todo lo que se filtrara en cualquiera de las
#       anteriores—. El publicable se vacia al empezar, dentro del candado.
preparar 'E56 el log del bucket es solo el de esta corrida (F3.9)'
export D_LOGS_SALIDA='rastro-de-la-primera-corrida'
export C_CODIGOS='500 500 200 200'
correr
# Segunda corrida, esta buena, con el `update.log` ya poblado por la primera.
export D_ID_CONTENEDOR='sha256:vieja'
unset D_LOGS_SALIDA
export C_CODIGOS='200'
: >"$REG_S3_SUBIDO"
correr
codigo_es 0
subido_dice 'salida: 0'
subido_calla 'VUELTA ATRAS'
subido_calla 'rastro-de-la-primera-corrida'
# Y el `update.log` del droplet SI conserva las dos corridas: es el historico.
log_local_dice 'VUELTA ATRAS'
limpiar

# E57 · el `--dry-run` tambien manda su log, y es a proposito: es la corrida
#       OBLIGATORIA la primera vez en cada instancia, o sea justo la que alguien
#       quiere leer desde fuera para saber si esa instancia quedo bien montada.
#       Sale de que la subida cuelga de `salir()`, que es la unica puerta.
preparar 'E57 el --dry-run tambien manda su log (F3.9)'
correr --dry-run
codigo_es 0
hubo_regex '^s3cmd .* put .* s3://space-os-logs/demo/[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}\.log$'
subido_dice 'migraciones pendientes'
subido_dice 'salida: 0'
# Pero sigue sin tocar nada: ni respaldo, ni contenedor. Lo unico que sale del
# droplet es el relato de que no se hizo nada.
no_hubo 'pg_dump'
no_hubo_regex 's3://[^ ]*\.dump'
limpiar

# E58 · `LOGS_BUCKET` de la configuracion MANDA. Parece obvio y no lo es: el
#       valor por omision se declara arriba del todo, ANTES de sourcear
#       `instancia.env` —tiene que estar definido por si `salir()` se dispara
#       antes de leer la configuracion—, asi que si ese orden se invirtiera algun
#       dia la clave documentada dejaria de servir para nada y todas las
#       instancias escribirian en el mismo bucket sin que nadie lo notara.
preparar 'E58 LOGS_BUCKET de instancia.env manda (F3.9)'
sed -i 's/^LOGS_BUCKET=.*/LOGS_BUCKET=space-os-logs-de-pruebas/' "$SPACE_OS_CONF"
correr
codigo_es 0
hubo_regex '^s3cmd .* put .* s3://space-os-logs-de-pruebas/demo/[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}\.log$'
no_hubo 's3://space-os-logs/'
# Y el bucket de los RESPALDOS no se mueve con el: son dos claves distintas.
hubo_regex '^s3cmd .* put .* s3://space-os-respaldos/demo/[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}\.dump$'
limpiar

# E59 · INVALIDANTE 1 DE LA AUDITORIA · el que se encuentra el candado TOMADO
#       no escribe en el log publicable, porque ese archivo es de la OTRA
#       corrida. E7 comprobaba solo la mitad —«no sube», con `no_hubo s3cmd`—
#       y nunca abria el archivo que viaja. Y la otra mitad estaba rota: con
#       `SPACE_OS_UPDATE_EN_CANDADO` EXPORTADA antes del `flock`, el proceso de
#       fuera se quedaba con la variable a 1, asi que su linea de «ya hay otro
#       update en marcha» caia dentro del publicable de quien SI lo tenia y
#       viajaba al bucket dentro del objeto de esa corrida: dos historias
#       mezcladas en el mismo archivo, que es justo lo que el diseno evita.
preparar 'E59 el que encuentra el candado no ensucia el log de quien lo tiene (F3.9)'
export FLOCK_OCUPADO=1
mkdir -p "$SPACE_OS_DIR_LOG"
# El publicable de la corrida que TIENE el candado, a medio escribir.
printf '%s\n' '2026-08-18 10:00:00-0600  -- update · LA-CORRIDA-CON-EL-CANDADO' >"$PUBLICABLE"
correr
codigo_es 75
log_dice 'ya hay otro update en marcha'
# Lo de la otra corrida sigue intacto...
publicable_dice 'LA-CORRIDA-CON-EL-CANDADO'
# ...y no le han metido nada dentro.
publicable_calla 'ya hay otro update en marcha'
publicable_calla 'salida: 75'
limpiar

# E60 · INVALIDANTE 2 DE LA AUDITORIA · «al terminar, salga bien o mal, subir»
#       tambien vale para los fallos de CONFIGURACION, que son los de una
#       instancia mal aprovisionada: justo la clase de fallo que uno quiere
#       diagnosticar sin entrar al servidor del owner. Doce `salir "$EX_CONFIG"`
#       caian ANTES de que `respaldo.sh` estuviera sourceado, asi que escribian
#       el publicable y no subian nada: `subir_log_remoto` se rendia en su
#       `declare -F` sin decir una palabra.
preparar 'E60 el log sube tambien cuando la configuracion esta mal (F3.9)'
sed -i 's/^CANAL=.*/CANAL=produccion/' "$SPACE_OS_CONF"
correr
codigo_es 1
hubo_regex '^s3cmd .* put .* s3://space-os-logs/demo/[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}\.log$'
subido_dice 'no es ni estable ni beta'
subido_dice 'salida: 1'
# Y sigue sin tocarse nada: lo que sube es el log, no el update.
no_hubo 'docker pull'
no_hubo 'pg_dump'
limpiar

# E61 · EL LIMITE QUE QUEDA, Y QUEDA DICHO · si el update muere ANTES de leer
#       `instancia.env` no hay credenciales de Spaces con que subir nada, asi
#       que ese log no puede viajar por definicion. Antes se callaba —un
#       `declare -F … || return 0` mudo—; ahora lo dice en el log local, que es
#       el unico sitio donde alguien puede leerlo en ese caso.
preparar 'E61 sin instancia.env el log no puede viajar, y se dice (F3.9)'
rm -f "$SPACE_OS_CONF"
correr
codigo_es 1
log_dice 'no existe'
log_dice 'no hay con que subirlo'
no_hubo 's3://space-os-logs'
limpiar

# E62 · HALLAZGO 3 · una contrasena con `@` sin codificar no sale del droplet.
#       `destino_de_url` corta el `usuario:clave@` y su salida es la PRIMERA
#       linea de todo log que viaja. Cortaba por el PRIMER `@`, asi que de
#       `spaces:p@ssw0rd@localhost` dejaba `ssw0rd@localhost…`: un trozo de la
#       contrasena de Postgres. Hasta F3.9 eso se quedaba en el droplet; desde
#       F3.9 sale a un bucket, que es lo que cambio el perfil de riesgo.
preparar 'E62 la clave con @ sin codificar no sale del droplet (F3.9, hallazgo 3)'
usar_url 'postgresql://spaces:p@ssw0rd@localhost:5433/spaces'
correr
codigo_es 0
subido_dice 'base=localhost:5433/spaces'
subido_calla 'ssw0rd'
limpiar

# E63 · HALLAZGO 3, la otra mitad · con una `/` sin codificar en la contrasena
#       no se cortaba NADA: `postgresql://spaces:pa/ss@localhost:5433/spaces`
#       salia entera —usuario y clave— porque el patron exigia que el `@`
#       llegara antes de la primera barra.
preparar 'E63 la clave con / sin codificar no sale del droplet (F3.9, hallazgo 3)'
usar_url 'postgresql://spaces:pa/ss@localhost:5433/spaces'
correr
codigo_es 0
subido_dice 'base=localhost:5433/spaces'
subido_calla 'pa/ss'
subido_calla 'spaces:pa'
limpiar

printf '\n%s escenarios · %s comprobaciones · %s rojas\n' "$ESCENARIOS" "$COMPROBACIONES" "$FALLOS"

# ============================================================================
#  MUTANTES — que las comprobaciones MUERDAN
# ----------------------------------------------------------------------------
#  El ciclo anterior tuvo un falso verde porque un `sed` mal escrito dejo el
#  archivo vacio y "paso". Por eso cada mutante se VALIDA antes de correrlo:
#  cambia una sola linea, sigue teniendo el mismo numero de lineas y `bash -n`
#  lo acepta. Un mutante que no cumple las tres cosas no prueba nada.
# ============================================================================
if [ "${1:-}" = '--mutantes' ]; then
  printf '\n── mutantes ────────────────────────────────────────────\n'
  MUT_FALLOS=0
  MUT_TOTAL=0
  # Desde F3.7 hay DOS archivos que mutar: `update.sh` y el `respaldo.sh` que
  # sourcea. Un mutante que solo pudiera tocar el primero dejaria la subida a
  # Spaces y la poda del disco sin nadie que comprobara que sus comprobaciones
  # muerden — que es justo lo que este bloque existe para evitar.
  RESPALDO_ORIG="$RAIZ/infra/scripts/respaldo.sh"

  probar_mutante()          { probar_mutante_en "$GUION"         "$1" "$2"; }
  probar_mutante_respaldo() { probar_mutante_en "$RESPALDO_ORIG" "$1" "$2"; }

  probar_mutante_en() {
    local objetivo="$1" nombre="$2" programa_sed="$3" copia difs lineas_orig
    MUT_TOTAL=$((MUT_TOTAL + 1))
    copia="$(mktemp)"
    sed "$programa_sed" "$objetivo" >"$copia"
    lineas_orig="$(wc -l <"$objetivo")"
    difs="$(diff "$objetivo" "$copia" | grep -c '^[<>]' || true)"
    if [ "$(wc -l <"$copia")" != "$lineas_orig" ]; then
      printf '  INVALIDO %s: el mutante cambio el numero de lineas (%s vs %s)\n' \
        "$nombre" "$(wc -l <"$copia")" "$lineas_orig"
      MUT_FALLOS=$((MUT_FALLOS + 1)); rm -f "$copia"; return
    fi
    if [ "$difs" != 2 ]; then
      printf '  INVALIDO %s: toco %s lineas, no una\n' "$nombre" "$difs"
      MUT_FALLOS=$((MUT_FALLOS + 1)); rm -f "$copia"; return
    fi
    if ! bash -n "$copia" 2>/dev/null; then
      printf '  INVALIDO %s: `bash -n` no lo acepta\n' "$nombre"
      MUT_FALLOS=$((MUT_FALLOS + 1)); rm -f "$copia"; return
    fi
    local rojas
    if [ "$objetivo" = "$GUION" ]; then
      rojas="$(GUION_UPDATE="$copia" bash "$0" 2>/dev/null | tail -n1 | awk '{print $(NF-1)}')"
    else
      rojas="$(RESPALDO_MUT="$copia" bash "$0" 2>/dev/null | tail -n1 | awk '{print $(NF-1)}')"
    fi
    if [ "${rojas:-0}" -gt 0 ] 2>/dev/null; then
      printf '  CAZADO   %s (%s comprobaciones en rojo)\n' "$nombre" "$rojas"
    else
      printf '  ESCAPA   %s — el arnes NO lo ve\n' "$nombre"
      MUT_FALLOS=$((MUT_FALLOS + 1))
    fi
    rm -f "$copia"
  }

  # Los dos que el arnes anterior dejaba escapar
  probar_mutante 'quitar `export DATABASE_URL`' 's/^export DATABASE_URL$/: DATABASE_URL/'
  probar_mutante 'pg_restore sin --clean --if-exists --single-transaction' \
    's/correr_pg "\$PG_RESTORE" --clean --if-exists --single-transaction/correr_pg "$PG_RESTORE"                                     /'
  # Y los tres que ya se cazaban, para que sigan cazandose
  probar_mutante 'quitar el guard del respaldo vacio' 's/^if \[ "\$codigo" -ne 0 \] || \[ ! -s "\$BK" \]; then$/if [ "$codigo" -ne 0 ] \&\& [ ! -s "$BK" ]; then/'
  probar_mutante 'restaurar siempre' 's/^if \[ "\$BASE_CAMBIO" != "no" \]; then$/if true                          ; then/'
  probar_mutante 'no restaurar nunca' 's/^if \[ "\$BASE_CAMBIO" != "no" \]; then$/if false                         ; then/'
  # Y el que reintroduce el rojo 1: decidir por el texto del runner
  probar_mutante 'retirar el contenedor nuevo por nombre' \
    's/^  docker rm -f "\$CONTENEDOR_NUEVO_ID" >\/dev\/null 2>&1 || true$/  docker rm -f "$CONTENEDOR" >\/dev\/null 2>\&1 || true      /'
  # Y el que reintroduce D2: el `|| echo 000` pegado al `-w '%{http_code}'`
  probar_mutante 'el `|| echo 000` que concatena dos codigos http' \
    's#2>/dev/null)" || true#2>/dev/null || echo 000)"      #'
  # Y los tres de F3.8: el pull sin reintentos, la espera aplanada, y la
  # migracion reintentada — este ultimo es el que corrompe bases.
  probar_mutante 'dejar el pull sin reintentos' \
    's/^PULL_ESPERAS="\${PULL_ESPERAS:-1 5 30}"$/PULL_ESPERAS="${PULL_ESPERAS:-}"        /'
  probar_mutante 'aplanar la espera del backoff a 1 s' \
    's/^PULL_ESPERAS="\${PULL_ESPERAS:-1 5 30}"$/PULL_ESPERAS="${PULL_ESPERAS:-1 1 1}"/'
  probar_mutante 'reintentar la migracion fallida' \
    's#^correr_runner >"\$salida_mig" 2>&1 || codigo=\$?$#correr_runner >"$salida_mig" 2>\&1 || correr_runner >"$salida_mig" 2>\&1 || codigo=$?#'
  # Y los de F3.7. Los dos primeros viven en `update.sh`; los cinco siguientes,
  # en `respaldo.sh`.
  probar_mutante 'la subida fallida ABORTA el update' \
    's#^if ! respaldo_remoto_subir "\$BK"; then$#if ! respaldo_remoto_subir "$BK"; then salir "$EX_CONFIG" x;#'
  probar_mutante 'quitar la poda local (que es el defecto D4)' \
    's#^if ! respaldo_local_podar "\$DIR_RESPALDOS"; then$#if ! : no_podar        "$DIR_RESPALDOS"; then#'
  probar_mutante_respaldo 'subir con `del` en vez de `put` (borrar en el bucket)' \
    's#^  s3cmd --config="\$conf" put "\$archivo" "\$destino" 2>&1 | eco$#  s3cmd --config="$conf" del "$archivo" "$destino" 2>\&1 | eco#'
  probar_mutante_respaldo 'las credenciales de Spaces en argv (visibles en ps)' \
    's#^  s3cmd --config="\$conf" put "\$archivo" "\$destino" 2>&1 | eco$#  s3cmd --access_key="$SPACES_KEY" --secret_key="$SPACES_SECRET" put "$archivo" "$destino" 2>\&1 | eco#'
  probar_mutante_respaldo 'subir la retencion local a 99 (o sea, no podar)' \
    's#^RESPALDOS_LOCALES="\${RESPALDOS_LOCALES:-3}"$#RESPALDOS_LOCALES="${RESPALDOS_LOCALES:-99}"#'
  probar_mutante_respaldo 'podar del reves: se borran los MAS NUEVOS' \
    "s#| sort -k1,1n -k2 | cut -f2-)\$#| sort -k1,1nr -k2r | cut -f2-)#"
  # Y los tres de la auditoria de F3.7 (H1, H2 y H4). El primero es el defecto
  # tal cual estaba: ordenar por NOMBRE se lleva por delante el dump de la
  # corrida en marcha en cuanto hay un `spaces_x.dump` en el directorio.
  probar_mutante_respaldo 'podar por NOMBRE en vez de por fecha del archivo (H1)' \
    's#-printf .*| cut -f2-)$#2>/dev/null | sort)#'
  probar_mutante_respaldo 'el resumen de la poda cuenta lo que iba a borrar (H2)' \
    's#^  if \[ "\$retirados" -eq "\$sobran" \]; then$#  if true                                 ; then#'
  # Dos por H4, uno por propiedad: que el temporal se BORRE (lo hace el `trap` de
  # EXIT, que bash corre tambien al morir por una senal) y que la interrupcion
  # quede DICHA (eso solo lo dan los traps de TERM/INT/HUP). Un solo mutante no
  # cubre las dos: quitar la linea de TERM escapaba porque el archivo se borraba
  # igual.
  probar_mutante_respaldo 'que el trap no borre el temporal con la llave (H4)' \
    's#^  if \[ -n "\$conf" \]; then rm -f "\$conf"; fi$#  if [ -n "$conf" ]; then :             ; fi#'
  probar_mutante_respaldo 'quitar el trap de TERM: la interrupcion no queda dicha (H4)' \
    's#^  trap .respaldo_conf_limpiar "\$conf" TERM. TERM$#  : sin trap                               #'
  probar_mutante_respaldo 'tragarse el fallo de la subida' \
    's#^  return "\$resultado"$#  return 0#'

  # Y los cuatro de F3.9. El primero es EL defecto de la tarea: subir el log
  # crudo, con la salida de las herramientas dentro.
  probar_mutante 'subir `update.log` crudo en vez del publicable (F3.9)' \
    's#respaldo_subir_s3cmd "$LOG_PUBLICABLE"#respaldo_subir_s3cmd "$LOG"           #'
  probar_mutante 'que `eco` escriba tambien en el publicable (F3.9)' \
    's#^eco() { tee -a "$LOG"; }$#eco() { tee -a "$LOG" "$LOG_PUBLICABLE"; }#'
  probar_mutante 'subir el log solo cuando el update sale bien (F3.9)' \
    's#^  subir_log_remoto "$codigo" || true$#  case "$codigo" in 0) subir_log_remoto 0 || true ;; esac#'
  probar_mutante 'no vaciar el publicable: sube el historico entero (F3.9)' \
    's#^: >"$LOG_PUBLICABLE"$#: no_vaciar         #'

  # Y los tres de la correccion del 18/08, que son los dos invalidantes de la
  # auditoria de F3.9 y su hallazgo 3. Los tres reintroducen el defecto EXACTO
  # que se acaba de quitar, que es la unica forma de saber que las
  # comprobaciones nuevas muerden y no solo acompanan.
  probar_mutante 'exportar la marca del candado ANTES del flock (invalidante 1)' \
    's#^  SPACE_OS_UPDATE_EN_CANDADO=1 flock#  export SPACE_OS_UPDATE_EN_CANDADO=1; flock#'
  probar_mutante 'no subir el log de los fallos de configuracion (invalidante 2)' \
    's#^  subir_log_remoto "$codigo" || true$#  case "$codigo" in "$EX_CONFIG") : ;; *) subir_log_remoto "$codigo" || true ;; esac#'
  probar_mutante 'destino_de_url cortando por el PRIMER @ (hallazgo 3)' \
    's|s#\^\.\*@##|s#^[^@/]*@##|'

  printf '\n%s mutantes · %s escapan\n' "$MUT_TOTAL" "$MUT_FALLOS"
  [ "$MUT_FALLOS" -eq 0 ] || exit 1
fi

[ "$FALLOS" -eq 0 ] || exit 1
