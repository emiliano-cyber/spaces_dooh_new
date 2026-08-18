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
#  POSIX de `docker`, `curl`, `flock`, `pg_dump` y `pg_restore` en un PATH
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
    [ "${D_PULL_FALLA:-0}" = 1 ] && exit 1
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
  stop|logs) exit 0 ;;
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
  : >"$REG_LLAMADAS"; : >"$REG_DBURL"; : >"$REG_PGENV"
  montar_dobles

  export SPACE_OS_CONF="$RAIZ_TMP/instancia.env"
  export SPACE_OS_DIR_ESTADO="$RAIZ_TMP/estado"
  export SPACE_OS_DIR_LOG="$RAIZ_TMP/log"
  export SPACE_OS_CANDADO="$RAIZ_TMP/candado"
  export CONTENEDOR_NOMBRE=space-os
  SALIDA="$RAIZ_TMP/salida.txt"

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
        PGD_VACIO PGD_FALLA PGR_CODIGO FLOCK_OCUPADO D_PENDIENTES_CODIGO 2>/dev/null || true
  export PGR_CODIGO=0
  export PGD_VACIO=0
  export PGD_FALLA=0
  export FLOCK_OCUPADO=0
  export D_PULL_FALLA=0
  export D_RUN_FALLA=0
  export D_RENAME_FALLA=0
  export D_START_FALLA=0
}

correr() {
  ( PATH="$BIN:$PATH"; bash "$GUION" "$@" ) >"$SALIDA" 2>&1
  CODIGO=$?
}

limpiar() { rm -rf "$RAIZ_TMP"; }

# ─── Predicados ────────────────────────────────────────────────────────────
codigo_es() { if [ "$CODIGO" = "$1" ]; then bien; else mal "codigo esperado $1, real $CODIGO"; fi; }
log_dice() { if grep -qF -- "$1" "$SALIDA"; then bien; else mal "el log no dice: $1"; fi; }
log_calla() { if grep -qF -- "$1" "$SALIDA"; then mal "el log NO deberia decir: $1"; else bien; fi; }
hubo() { if grep -qF -- "$1" "$REG_LLAMADAS"; then bien; else mal "no se llamo: $1"; fi; }
no_hubo() { if grep -qF -- "$1" "$REG_LLAMADAS"; then mal "no deberia haberse llamado: $1"; else bien; fi; }
hubo_regex() { if grep -qE -- "$1" "$REG_LLAMADAS"; then bien; else mal "ninguna llamada casa con: $1"; fi; }
no_hubo_regex() { if grep -qE -- "$1" "$REG_LLAMADAS"; then mal "alguna llamada casa con lo prohibido: $1"; else bien; fi; }

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
  LINEAS_ORIG="$(wc -l <"$GUION")"
  MUT_FALLOS=0
  MUT_TOTAL=0

  probar_mutante() {
    local nombre="$1" programa_sed="$2" copia difs
    MUT_TOTAL=$((MUT_TOTAL + 1))
    copia="$(mktemp)"
    sed "$programa_sed" "$GUION" >"$copia"
    difs="$(diff "$GUION" "$copia" | grep -c '^[<>]' || true)"
    if [ "$(wc -l <"$copia")" != "$LINEAS_ORIG" ]; then
      printf '  INVALIDO %s: el mutante cambio el numero de lineas (%s vs %s)\n' \
        "$nombre" "$(wc -l <"$copia")" "$LINEAS_ORIG"
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
    rojas="$(GUION_UPDATE="$copia" bash "$0" 2>/dev/null | tail -n1 | awk '{print $(NF-1)}')"
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

  printf '\n%s mutantes · %s escapan\n' "$MUT_TOTAL" "$MUT_FALLOS"
  [ "$MUT_FALLOS" -eq 0 ] || exit 1
fi

[ "$FALLOS" -eq 0 ] || exit 1
