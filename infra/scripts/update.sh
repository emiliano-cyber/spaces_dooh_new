#!/usr/bin/env bash
# ============================================================================
#  update.sh — una instancia de SPACE OS se actualiza SOLA.
# ----------------------------------------------------------------------------
#  Se instala en /opt/space-os/update.sh y lo lanza el cron de la propia
#  instancia. El PADRE no aparece por ningun lado: este script habla con el
#  registry de imagenes y con su propia base, y con nadie mas. Nadie entra por
#  ssh desde fuera para desplegar — ese camino se retira en F3.6.
#
#  Uso:
#    /opt/space-os/update.sh --dry-run   # mira y cuenta; NO toca nada
#    /opt/space-os/update.sh             # actualiza, con respaldo y vuelta atras
#    tail -n 40 /var/log/space-os/update.log
#
#  Respuestas del --dry-run:
#    "sin cambios"                        → la instancia esta al dia
#    "pull v0.4.2 -> 3 migraciones pendientes" → hay actualizacion
#    cualquier mencion a "BACKUP VACIO"   → NO SEGUIR, avisar a una persona
#
#  Codigos de salida (los mira el cron, y los lee una persona en el log):
#    0  sin cambios, o actualizada y sana
#    1  no se puede ni empezar: falta configuracion, falta docker o pg_dump,
#       el pull fallo, el respaldo salio VACIO, o el runner de migraciones se
#       nego a arrancar (por ejemplo: base con datos y sin `schema_migrations`,
#       que pide intervencion humana). NADA se toco.
#    2  las migraciones fallaron a medias, o se aplicaron y no se pudieron
#       registrar: LA BASE PUDO CAMBIAR. No se conmuto el trafico —la version
#       anterior sigue sirviendo— y NO se restaura nada automaticamente (ver
#       "por que no se restaura aqui", abajo). Requiere que alguien mire.
#    3  el registro de la base y las migraciones de la imagen no cuentan la
#       misma historia (una ya aplicada cambio de contenido). No se aplico
#       NADA y no se conmuto. Lo levanta `migrar.mjs` (F3.3).
#    4  el health check fallo y la vuelta atras SALIO BIEN: la instancia esta
#       sirviendo la version anterior. Esto es el exito del mecanismo.
#    5  el health check fallo y la vuelta atras NO se pudo completar. La
#       instancia puede estar caida. Urgente.
#   75  ya habia otro update en marcha (candado `flock`). No es un error.
#
#  Los codigos 1, 2 y 3 vienen de `scripts/migrar.mjs:21-32` y NO son
#  intercambiables: con un 2 la base ya cambio y el registro puede no saberlo;
#  con un 3 no se aplico nada. Un `set -e` que los aplanara todos en "fallo"
#  seria justamente el error que este script no puede cometer, porque de esa
#  distincion depende si hay que ir a mirar la base o no.
#
# ── LA VENTANA: durante la conmutacion la instancia NO responde ─────────────
#  Conmutar es `docker stop` + `docker run`, no un cambio de puerto en caliente.
#  O sea que hay un hueco sin servicio, y conviene tenerlo escrito:
#    · caso bueno  ~10-20 s  (el `stop` espera hasta 10 s al SIGTERM, y el
#                             contenedor nuevo tarda en contestar el primer curl)
#    · caso malo   hasta ~3 min: el sondeo de salud puede costar
#                  SALUD_INTENTOS x (5 s de `--max-time` + SALUD_ESPERA) = 80 s,
#                  luego el `pg_restore`, y luego OTRO sondeo igual sobre la
#                  version anterior.
#  Por eso el cron va a las 4 de la manana. "El owner no se entera" del criterio
#  de aceptacion de F3.4 hay que leerlo como "se queda en la version anterior y
#  no pierde datos", NO como "no hay corte": el corte existe y se mide en
#  minutos. Cerrarlo de verdad (arrancar el nuevo en otro puerto y mover nginx)
#  es otra tarea; aqui se documenta, no se disimula.
#
# ── Configuracion: /etc/space-os/instancia.env ─────────────────────────────
#  Lo escribe el aprovisionamiento (Fase 5). Claves (o=obligatoria):
#    CANAL=estable|beta            (o)  el canal que sigue esta instancia
#    REGISTRY=registry/…           (o)  de donde se jala la imagen
#    DATABASE_URL=postgresql://…   (o*) conexion PRIVILEGIADA: migraciones y
#                                       respaldo. NO es la del app (esa es
#                                       `spaces_app`, sin DDL). (*) si falta,
#                                       se toma la de ENV_APP y se avisa.
#    IMAGEN_NOMBRE=space-os             nombre de la imagen dentro del registry
#    CONTENEDOR=space-os                nombre del contenedor que sirve
#    ENV_APP=/etc/space-os/app.env      variables de la app (docker --env-file)
#    DOCKER_OPCIONES_APP="--publish 127.0.0.1:3000:3000"
#    RED_MIGRACION=host                 red del contenedor efimero que migra
#    SALUD_URL=http://127.0.0.1:3000/spaces-dooh/api/auth/metodos/
#    SALUD_INTENTOS=10  SALUD_ESPERA=3
#    RUNNER_MIGRACIONES=/opt/space-os/migrar.mjs   (ver el aviso de abajo)
#    PG_DUMP=pg_dump    PG_RESTORE=pg_restore      rutas si hay varias versiones
#
#  El archivo lleva credenciales: 0600 y de root. El script avisa si no.
#
# ── Cron: una vez al dia, con candado ──────────────────────────────────────
#  /etc/cron.d/space-os-update:
#    17 4 * * *  root  /opt/space-os/update.sh >/dev/null 2>&1
#  El candado lo toma el propio script (`flock -n` sobre
#  /var/lock/space-os-update.lock), asi que tambien protege a la corrida que
#  alguien lance a mano mientras el cron esta dentro. Mismo criterio que
#  `concurrency: deploy-produccion` en `.github/workflows/deploy.yml:56-58`:
#  cortar a mitad de una migracion es peor que esperar.
#
# ── AVISO 1 · el runner de migraciones NO viaja en la imagen ───────────────
#  El plan (F3.4, paso 5) manda correr `node scripts/migrar.mjs` DENTRO de la
#  imagen nueva, pero `Dockerfile:94-95` copia `db/schema.sql` y `db/migrations`
#  y NO copia `scripts/`. Comprobado: `docker run --rm space-os:dev ls /app`
#  devuelve apps, db, node_modules y package.json — no hay `scripts`.
#
#  Mientras eso siga asi, este script MONTA el runner dentro del contenedor
#  efimero, en /app/scripts/migrar.mjs. Funciona porque el runner resuelve sus
#  rutas desde su propio archivo y no desde el directorio de trabajo
#  (`scripts/migrar.mjs:43-48`): montado ahi, `/app/scripts/../db/migrations`
#  son las migraciones DE LA IMAGEN, que es lo que la tarea exige. Y `pg` se
#  resuelve en /app/node_modules, que el standalone si trae.
#
#  El costo, escrito para que nadie lo descubra tarde: el runner queda
#  versionado con el APROVISIONAMIENTO y no con la imagen. Una instancia
#  aprovisionada antes de F3.3 seguiria migrando sin la comprobacion de
#  checksum aunque jale imagenes nuevas. El arreglo duradero es una linea
#  `COPY scripts/migrar.mjs ./scripts/migrar.mjs` en el Dockerfile — que es
#  F2.2 y no se toca desde aqui. Este script ya lo prevee: si la imagen TRAE
#  el runner, no monta nada y usa el de dentro.
#
# ── AVISO 2 · que pasa con `schema_migrations` al volver atras ─────────────
#  El respaldo es de la base ENTERA, asi que `schema_migrations` viaja dentro
#  del dump. Restaurarlo devuelve a la vez el esquema y el registro al mismo
#  instante: la instancia vuelve a afirmar exactamente las migraciones que la
#  imagen anterior lleva dentro, y la comprobacion de checksum de F3.3 no tiene
#  de que quejarse.
#
#  Si la restauracion NO llega a correr (porque no corrio ninguna migracion, o
#  porque fallo), el registro se queda nombrando migraciones cuyo archivo la
#  imagen anterior NO tiene. Eso NO aborta nada, y es a proposito: F3.3 dejo ese
#  caso fuera precisamente porque una imagen anterior carece por definicion de
#  las migraciones nuevas que su registro afirma, y abortar ahi romperia esta
#  vuelta atras. El runner las trata como aplicadas y no las toca.
#
# ── AVISO 3 · como sabe este script si la base cambio: PREGUNTANDOSELO ──────
#  La primera version de este archivo lo deducia leyendo la PROSA del runner con
#  un `sed` ("N aplicadas."). Fallaba, y no en teoria:
#
#    · `migrar.mjs:694-696` imprime "67 aplicadas, 1 de datos pendientes." en
#      cuanto hay una migracion `@tipo: datos` pendiente — y la hay:
#      `db/migrations/20260731_calendario_meses_cortos.sql`. El patron pedia un
#      punto pegado a "aplicadas", no casaba, la cuenta caia a 0 y la VUELTA
#      ATRAS NO RESTAURABA LA BASE: el contenedor volvia a la version vieja
#      sobre un esquema nuevo, en silencio.
#    · `migrar.mjs:670-678` y `:687-692` imprimen "se aplicaron N migraciones y
#      no se pudieron registrar", que tampoco casaba, y el log acababa diciendo
#      "no consta ninguna migracion aplicada; suele ser que no pudo conectar"
#      justo debajo del mensaje del runner que decia lo contrario.
#
#  La leccion no es afinar el patron: es que la redaccion de OTRO programa no
#  puede ser la fuente de verdad de una decision que lanza `pg_restore --clean`.
#  Asi que este script no cuenta migraciones a partir del texto. Toma una HUELLA
#  de la base ANTES y DESPUES de migrar —esquema (columnas, indices,
#  restricciones, politicas RLS, funciones) mas el contenido de
#  `schema_migrations`— y compara. Si la huella cambio, la base cambio. Punto.
#
#  Lo importante de esa eleccion:
#    · funciona aunque `schema_migrations` NO exista (el caso de `migrar.mjs
#      :687-692`, alcanzable HOY porque la imagen no lleva
#      20260812_schema_migrations.sql): el hash del esquema ya es distinto.
#    · NO se mueve con el trafico normal de la app —un `insert` no cambia
#      columnas ni indices— asi que la version anterior puede seguir sirviendo
#      entre las dos lecturas sin producir un falso "cambio".
#    · si la huella no se puede leer ANTES de migrar, el update se PARA (codigo
#      1) sin migrar: sin punto de partida no hay decision de vuelta atras que
#      se pueda defender.
#  El numero de migraciones que sale en el log es la diferencia de filas de
#  `schema_migrations`, o "?" si la tabla no existe. Es informativo: la decision
#  cuelga de la huella, no del numero.
# ============================================================================
set -Eeuo pipefail

# ─── Rutas. Se pueden mover SOLO para ensayar fuera de una instancia ───────
CONF="${SPACE_OS_CONF:-/etc/space-os/instancia.env}"
DIR_ESTADO="${SPACE_OS_DIR_ESTADO:-/var/lib/space-os}"
DIR_LOG="${SPACE_OS_DIR_LOG:-/var/log/space-os}"
CANDADO="${SPACE_OS_CANDADO:-/var/lock/space-os-update.lock}"
LOG="$DIR_LOG/update.log"

# ─── Codigos de salida, con nombre ─────────────────────────────────────────
EX_OK=0
EX_CONFIG=1
EX_MIGRACION=2
EX_HISTORIA=3
EX_VUELTA_OK=4
EX_VUELTA_FALLO=5
EX_OCUPADO=75

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    # Hasta la linea 78: uso, codigos de salida, la ventana de corte y las
    # claves de instancia.env. Los AVISOS 1-3 no salen en el --help a proposito:
    # son para quien va a TOCAR el script, no para quien lo corre.
    -h|--help) sed -n '2,78p' "$0"; exit 0 ;;
    *) echo "update: argumento desconocido: $arg (usa --dry-run o --help)" >&2; exit "$EX_CONFIG" ;;
  esac
done

mkdir -p "$DIR_LOG" "$DIR_ESTADO"

# ─── Bitacora ──────────────────────────────────────────────────────────────
# Se escribe a la consola Y al log en la misma llamada, en vez de redirigir
# todo con `exec > >(tee …)`: con la sustitucion de proceso las ultimas lineas
# se pierden a veces al salir, y este log es lo unico que queda de un update
# que corrio a las 4 de la manana.
registrar() {
  local linea
  linea="$(date '+%Y-%m-%d %H:%M:%S%z')  $*"
  printf '%s\n' "$linea"
  printf '%s\n' "$linea" >>"$LOG"
}
# Para la salida de un comando: a la consola y al log.
eco() { tee -a "$LOG"; }

salir() {
  local codigo="$1"
  shift || true
  if [ "$#" -gt 0 ]; then registrar "$@"; fi
  exit "$codigo"
}

# ─── El candado, antes que nada ────────────────────────────────────────────
# `flock -n` no espera: si hay otro update dentro, este se va. `-E 75` le da a
# ese caso un codigo propio para no confundirlo con un fallo del update.
if [ "${SPACE_OS_UPDATE_EN_CANDADO:-}" != "1" ]; then
  if ! command -v flock >/dev/null 2>&1; then
    salir "$EX_CONFIG" "ERROR update: falta \`flock\` (paquete util-linux). Sin candado no se corre: dos updates a la vez pueden migrar la misma base en paralelo."
  fi
  export SPACE_OS_UPDATE_EN_CANDADO=1
  codigo_candado=0
  flock -n -E "$EX_OCUPADO" "$CANDADO" "$0" "$@" || codigo_candado=$?
  if [ "$codigo_candado" -eq "$EX_OCUPADO" ]; then
    registrar "update: ya hay otro update en marcha (candado $CANDADO). Este no hace nada."
  fi
  exit "$codigo_candado"
fi

# ─── Configuracion ─────────────────────────────────────────────────────────
if [ ! -f "$CONF" ]; then
  salir "$EX_CONFIG" "ERROR update: no existe $CONF. Lo escribe el aprovisionamiento; sin el no se sabe ni que canal sigue esta instancia."
fi
permisos="$(stat -c '%a' "$CONF" 2>/dev/null || echo '?')"
case "$permisos" in
  600|400|700|?) ;;
  *) registrar "AVISO update: $CONF tiene permisos $permisos y lleva credenciales dentro. Deberia ser 600 y de root." ;;
esac
# shellcheck disable=SC1090
. "$CONF"

CANAL="${CANAL:-}"
REGISTRY="${REGISTRY:-}"
IMAGEN_NOMBRE="${IMAGEN_NOMBRE:-space-os}"
CONTENEDOR="${CONTENEDOR:-space-os}"
ENV_APP="${ENV_APP:-/etc/space-os/app.env}"
DOCKER_OPCIONES_APP="${DOCKER_OPCIONES_APP:---publish 127.0.0.1:3000:3000}"
RED_MIGRACION="${RED_MIGRACION:-host}"
# La ruta de salud vive en UNA variable para que F6.1 la cambie en una linea.
# Hoy apunta a `metodos` y no a `/api/version` porque `/api/version` todavia no
# existe. `metodos` es publica, sin sesion y sin datos de negocio
# (`apps/web/app/api/auth/metodos/route.ts`).
SALUD_URL="${SALUD_URL:-http://127.0.0.1:3000/spaces-dooh/api/auth/metodos/}"
SALUD_INTENTOS="${SALUD_INTENTOS:-10}"
SALUD_ESPERA="${SALUD_ESPERA:-3}"
RUNNER_MIGRACIONES="${RUNNER_MIGRACIONES:-/opt/space-os/migrar.mjs}"
PG_DUMP="${PG_DUMP:-pg_dump}"
PG_RESTORE="${PG_RESTORE:-pg_restore}"
DIR_RESPALDOS="${DIR_RESPALDOS:-$DIR_ESTADO/respaldos}"

[ -n "$CANAL" ] || salir "$EX_CONFIG" "ERROR update: falta CANAL en $CONF (estable o beta)."
[ -n "$REGISTRY" ] || salir "$EX_CONFIG" "ERROR update: falta REGISTRY en $CONF."
case "$CANAL" in
  estable|beta) ;;
  *) salir "$EX_CONFIG" "ERROR update: CANAL='$CANAL' no es ni estable ni beta. Se para antes de jalar una etiqueta que no existe." ;;
esac

# ─── La base: una sola, y se comprueba ─────────────────────────────────────
# `host:puerto/base` de una URL de conexion, SIN credenciales — este valor se
# imprime. Mismo criterio que `destinoSeguro()` en `scripts/migrar.mjs:225-232`.
destino_de_url() {
  printf '%s' "$1" | sed -E 's#^[a-zA-Z+]+://([^@/]*@)?##; s#\?.*$##'
}

url_de_env_app() {
  [ -f "$ENV_APP" ] || return 0
  # Formato `--env-file` de docker: CLAVE=valor, sin comillas ni `export`. Por
  # eso se lee con grep y no con `.`: sourcearlo interpretaria las comillas de
  # otra manera que docker, y ahi es donde nacen las diferencias invisibles.
  grep -m1 '^DATABASE_URL=' "$ENV_APP" 2>/dev/null | cut -d= -f2- || true
}

URL_APP="$(url_de_env_app)"
if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="$URL_APP"
  if [ -n "$DATABASE_URL" ]; then
    registrar "AVISO update: DATABASE_URL no esta en $CONF; se usa la de $ENV_APP. Migrar con el rol de la app suele fallar por permisos: es rol sin DDL."
  fi
elif [ -n "$URL_APP" ] && [ "$(destino_de_url "$DATABASE_URL")" != "$(destino_de_url "$URL_APP")" ]; then
  # Migrar una base mientras la app habla con otra no da ningun error: deja dos
  # bases distintas, cada una a medias. Por eso se para.
  salir "$EX_CONFIG" "ERROR update: $CONF y $ENV_APP apuntan a bases DISTINTAS ($(destino_de_url "$DATABASE_URL") vs $(destino_de_url "$URL_APP")). Se para: migrar una y servir la otra no da error, deja dos bases a medias."
fi
[ -n "$DATABASE_URL" ] || salir "$EX_CONFIG" "ERROR update: falta DATABASE_URL (ni en $CONF ni en $ENV_APP). El runner de migraciones la exige y no adivina la base (scripts/migrar.mjs:344-355)."
# EXPORTADA a proposito, y no es cosmetico: los contenedores efimeros la reciben
# con `docker run --env DATABASE_URL` (sin valor), que toma el valor del entorno
# del proceso. Sin `export` docker no pasa NADA y el runner sale 1 en todas las
# instancias — un fallo total que no se ve leyendo el diff.
export DATABASE_URL

# ─── La contrasena NO viaja en argv ────────────────────────────────────────
# `pg_dump --dbname="postgresql://usuario:clave@…"` deja la clave visible en
# `ps` para cualquier usuario de la maquina. `deploy.yml:119` lo evita con
# `sudo -u postgres` (autenticacion peer, sin clave); aqui la conexion es por
# red, asi que se parte: usuario y destino en argv, clave por PGPASSWORD.
PG_URL_SEGURA="$DATABASE_URL"
PG_CLAVE=""
if printf '%s' "$DATABASE_URL" | grep -Eq '^[a-zA-Z+]+://[^@/]+@'; then
  pg_esquema="${DATABASE_URL%%://*}"
  pg_resto="${DATABASE_URL#*://}"
  pg_userinfo="${pg_resto%%@*}"
  pg_destino="${pg_resto#*@}"
  pg_usuario="${pg_userinfo%%:*}"
  pg_clave_cruda=""
  case "$pg_userinfo" in *:*) pg_clave_cruda="${pg_userinfo#*:}" ;; esac
  if [ -z "$pg_clave_cruda" ]; then
    : # sin clave en la URL (peer, trust o .pgpass): no hay nada que esconder
  elif case "$pg_clave_cruda" in *\\*) true ;; *) false ;; esac; then
    # `printf '%b'` interpretaria la barra invertida como escape y corromperia
    # la clave. Mejor una clave visible en `ps` que un respaldo que no corre.
    registrar "AVISO update: la contrasena de DATABASE_URL trae una barra invertida sin codificar; se deja la URL completa en argv (visible en \`ps\`) porque decodificarla podria corromperla. Codificala como %5C en $CONF y este aviso se va."
  else
    # Percent-decoding: en una URL un '%' literal va como %25, asi que
    # convertir cada '%' en '\x' y pasarlo por `printf '%b'` es exacto.
    case "$pg_clave_cruda" in
      *%*) PG_CLAVE="$(printf '%b' "${pg_clave_cruda//%/\\x}")" ;;
      *)   PG_CLAVE="$pg_clave_cruda" ;;
    esac
    PG_URL_SEGURA="$pg_esquema://$pg_usuario@$pg_destino"
  fi
fi

# `pg_dump`/`pg_restore` siempre por aqui: un solo sitio decide como viaja la
# clave. `$binario` se pasa como argumento para respetar PG_DUMP/PG_RESTORE.
correr_pg() {
  local binario="$1"
  shift
  if [ -n "$PG_CLAVE" ]; then
    PGPASSWORD="$PG_CLAVE" "$binario" --dbname="$PG_URL_SEGURA" "$@"
  else
    "$binario" --dbname="$PG_URL_SEGURA" "$@"
  fi
}

# ─── Herramientas ──────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || salir "$EX_CONFIG" "ERROR update: no hay \`docker\` en el PATH."
command -v curl >/dev/null 2>&1 || salir "$EX_CONFIG" "ERROR update: no hay \`curl\`. Sin health check no se conmuta: seria actualizar a ciegas."
command -v "$PG_DUMP" >/dev/null 2>&1 || salir "$EX_CONFIG" "ERROR update: no hay \`$PG_DUMP\`. Sin respaldo no se actualiza."
[ -f "$ENV_APP" ] || salir "$EX_CONFIG" "ERROR update: no existe $ENV_APP; el contenedor nuevo naceria sin variables de entorno."

IMAGEN="$REGISTRY/$IMAGEN_NOMBRE:$CANAL"

MODO='(actualiza de verdad)'
if [ "$DRY_RUN" = 1 ]; then MODO='(--dry-run: no se toca nada)'; fi
registrar "── update $MODO · canal=$CANAL · imagen=$IMAGEN · base=$(destino_de_url "$DATABASE_URL")"

# ─── Identidad de la imagen ────────────────────────────────────────────────
# Se compara el Id local (el digest de la configuracion de la imagen) y no el
# RepoDigest, porque el Id existe SIEMPRE en los dos lados —el de la imagen
# recien jalada y el de la que corre el contenedor— aunque la etiqueta se haya
# movido o la imagen vieja se haya quedado sin etiqueta. El RepoDigest se
# guarda igual, que es el que sirve para volver a jalarla a mano.
id_de_imagen()   { docker image inspect --format '{{.Id}}' "$1" 2>/dev/null || true; }
digest_de_imagen(){ docker image inspect --format '{{if .RepoDigests}}{{index .RepoDigests 0}}{{end}}' "$1" 2>/dev/null || true; }
id_del_contenedor(){ docker inspect --format '{{.Image}}' "$1" 2>/dev/null || true; }
version_de_imagen() {
  docker image inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$1" 2>/dev/null \
    | sed -n 's/^SPACE_OS_VERSION=//p' | head -n1
}

ID_ACTUAL="$(id_del_contenedor "$CONTENEDOR")"

registrar "1 · pull $IMAGEN"
if ! docker pull "$IMAGEN" 2>&1 | eco; then
  salir "$EX_CONFIG" "ERROR update: fallo el \`docker pull\` de $IMAGEN. La instancia se queda como estaba."
fi

ID_NUEVO="$(id_de_imagen "$IMAGEN")"
[ -n "$ID_NUEVO" ] || salir "$EX_CONFIG" "ERROR update: el pull dijo que si pero la imagen $IMAGEN no esta. Nada que hacer."
DIGEST_NUEVO="$(digest_de_imagen "$IMAGEN")"
VERSION_NUEVA="$(version_de_imagen "$IMAGEN")"
[ -n "$VERSION_NUEVA" ] || VERSION_NUEVA="$CANAL"

if [ -n "$ID_ACTUAL" ] && [ "$ID_ACTUAL" = "$ID_NUEVO" ]; then
  salir "$EX_OK" "sin cambios: la instancia ya corre $VERSION_NUEVA ($ID_NUEVO)."
fi
if [ -z "$ID_ACTUAL" ]; then
  registrar "2 · no hay contenedor '$CONTENEDOR' corriendo: no habra a donde volver si la salud falla."
else
  registrar "2 · hay version nueva: $ID_ACTUAL -> $ID_NUEVO ($VERSION_NUEVA)"
fi

# ─── El runner de migraciones, dentro de la imagen nueva ───────────────────
# Si la imagen lo trae, se usa el suyo; si no, se monta el de la instancia.
# Ver AVISO 1 de la cabecera.
montaje_runner=()
if docker run --rm "$IMAGEN" node -e 'process.exit(require("fs").existsSync("/app/scripts/migrar.mjs") ? 0 : 1)' >/dev/null 2>&1; then
  registrar "   runner: el de la imagen (/app/scripts/migrar.mjs)"
else
  [ -f "$RUNNER_MIGRACIONES" ] || salir "$EX_CONFIG" "ERROR update: la imagen no trae /app/scripts/migrar.mjs y tampoco hay copia en $RUNNER_MIGRACIONES. Sin runner no se migra, y sin migrar no se conmuta."
  montaje_runner=(--volume "$RUNNER_MIGRACIONES:/app/scripts/migrar.mjs:ro")
  registrar "   runner: montado desde $RUNNER_MIGRACIONES (la imagen no lo trae; ver AVISO 1)"
fi

# Corre `migrar.mjs` en un contenedor EFIMERO de la imagen nueva. Las
# migraciones que aplica son las de la imagen, no las del disco de la
# instancia: en el servidor de una instancia no hay repo clonado.
correr_runner() {
  docker run --rm \
    --network "$RED_MIGRACION" \
    --env DATABASE_URL \
    "${montaje_runner[@]}" \
    "$IMAGEN" node scripts/migrar.mjs "$@"
}

# ─── La huella de la base — ver AVISO 3 ────────────────────────────────────
# Se ejecuta con el `node` y el `pg` de la MISMA imagen, por la MISMA red y con
# la MISMA DATABASE_URL que el runner: si esto lee la base, el runner tambien.
# El guion va por STDIN y no por `-e` ni por un montaje: asi no hay comillas que
# escapar ni rutas del anfitrion que existan dentro del contenedor.
guion_huella() {
  cat <<'FIN_GUION_HUELLA'
const { Client } = require('pg')
const cli = new Client({ connectionString: process.env.DATABASE_URL })
// Todo lo que una migracion puede cambiar y el trafico normal de la app no:
// columnas (y sus DEFAULT), indices, restricciones, politicas RLS y funciones.
// Un `insert` de la version anterior sirviendo NO mueve ninguna de las cinco.
const SQL_ESQUEMA = `
  select coalesce(md5(string_agg(t, chr(10) order by t)), 'vacia') as h from (
    select 'c:'||table_schema||'.'||table_name||'.'||column_name||':'||data_type
           ||':'||coalesce(column_default,'') as t
      from information_schema.columns
     where table_schema not in ('pg_catalog','information_schema')
    union all
    select 'i:'||schemaname||'.'||indexname||':'||indexdef from pg_indexes
     where schemaname not in ('pg_catalog','information_schema')
    union all
    select 'k:'||n.nspname||'.'||cl.relname||':'||co.conname||':'||pg_get_constraintdef(co.oid)
      from pg_constraint co
      join pg_class cl on cl.oid = co.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
     where n.nspname not in ('pg_catalog','information_schema')
    union all
    select 'p:'||schemaname||'.'||tablename||':'||policyname||':'
           ||coalesce(qual,'')||':'||coalesce(with_check,'')
      from pg_policies
     where schemaname not in ('pg_catalog','information_schema')
    union all
    select 'f:'||n.nspname||'.'||p.proname||':'||md5(coalesce(p.prosrc,''))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname not in ('pg_catalog','information_schema')
  ) s`
const SQL_REGISTRO = `
  select count(*)::int as n,
         coalesce(md5(string_agg(archivo||':'||checksum, chr(10) order by archivo)), 'vacia') as h
    from schema_migrations`
cli
  .connect()
  .then(async () => {
    const esquema = (await cli.query(SQL_ESQUEMA)).rows[0].h
    // La tabla puede no existir (instalacion nueva, o imagen sin
    // 20260812_schema_migrations.sql): eso no es un error, es un dato.
    const hay = (await cli.query("select to_regclass('public.schema_migrations') is not null as hay")).rows[0].hay
    let registro = 'sin-tabla'
    let cuantas = -1
    if (hay) {
      const r = (await cli.query(SQL_REGISTRO)).rows[0]
      registro = r.h
      cuantas = r.n
    }
    // Una sola linea, con marca al principio: la lee `huella_base()` treinta
    // lineas mas arriba, en ESTE archivo. No es prosa de otro programa.
    console.log('HUELLA ' + esquema + ' ' + registro + ' ' + cuantas)
    await cli.end()
  })
  .catch(async (e) => {
    console.error('huella: ' + e.message)
    await cli.end().catch(() => {})
    process.exit(9)
  })
FIN_GUION_HUELLA
}

# Imprime "<huella_esquema> <huella_registro> <filas_de_schema_migrations>".
# Devuelve != 0 y no imprime nada si la base no se pudo leer.
huella_base() {
  local salida codigo=0 linea
  salida="$(guion_huella | docker run --rm --interactive \
    --network "$RED_MIGRACION" --env DATABASE_URL "$IMAGEN" node 2>&1)" || codigo=$?
  if [ "$codigo" -ne 0 ]; then
    printf '%s\n' "$salida" >>"$LOG"
    return 1
  fi
  linea="$(printf '%s\n' "$salida" | sed -n 's/^HUELLA //p' | tail -n1)"
  [ -n "$linea" ] || { printf '%s\n' "$salida" >>"$LOG"; return 1; }
  printf '%s' "$linea"
}

# Tercer campo de la huella: filas de `schema_migrations`, o -1 si no hay tabla.
registradas_de_huella() { printf '%s' "$1" | awk '{print $3}'; }

# ─── --dry-run: mira y cuenta ──────────────────────────────────────────────
if [ "$DRY_RUN" = 1 ]; then
  # `--pendientes` lista y no aplica (`scripts/migrar.mjs:598-604`): es la
  # unica forma de contar migraciones pendientes sin escribir en la base.
  salida_seca="$(mktemp)"
  codigo=0
  correr_runner --pendientes >"$salida_seca" 2>&1 || codigo=$?
  eco <"$salida_seca"
  # ESTE `sed` si lee la prosa del runner, y se queda a proposito: aqui el
  # numero es DECORADO de una linea de log, no decide nada. Si la redaccion de
  # `migrar.mjs` cambia, el peor caso es que el log diga "? migraciones
  # pendientes" — no que se deje de restaurar una base. La cuenta que SI decide
  # (la del update real) no pasa por aqui: ver AVISO 3.
  pendientes="$(sed -n 's/^\([0-9][0-9]*\) pendientes.*/\1/p' "$salida_seca" | tail -n1)"
  rm -f "$salida_seca"
  case "$codigo" in
    0) registrar "pull $VERSION_NUEVA -> ${pendientes:-?} migraciones pendientes. Nada se toco: --dry-run." ;;
    3) salir "$EX_HISTORIA" "pull $VERSION_NUEVA -> el registro de la base y las migraciones de la imagen NO cuentan la misma historia (arriba, con los dos checksums). Un update real se negaria. Nada se toco." ;;
    *) salir "$EX_CONFIG" "pull $VERSION_NUEVA -> el runner no pudo ni listar (codigo $codigo). El mensaje de arriba es suyo y dice que hacer. Nada se toco." ;;
  esac
  salir "$EX_OK" "--dry-run terminado. Ni base, ni contenedor, ni respaldo: nada cambio."
fi

# ─── 3 · Respaldo ──────────────────────────────────────────────────────────
# Un pg_dump que falla deja un archivo de 0 bytes y su salida se ve casi igual
# que la de uno bueno. Criterio copiado tal cual de
# `.github/workflows/deploy.yml:117-125`: sin respaldo NO se sigue.
mkdir -p "$DIR_RESPALDOS"
BK="$DIR_RESPALDOS/spaces_$(date +%Y%m%d_%H%M%S).dump"
registrar "3 · respaldo -> $BK"
codigo=0
correr_pg "$PG_DUMP" --format=custom --file="$BK" 2>&1 | eco || codigo=$?
if [ "$codigo" -ne 0 ] || [ ! -s "$BK" ]; then
  # El archivo de 0 bytes se BORRA antes de abortar. Si se queda, en un `ls` del
  # directorio de respaldos parece uno mas —mismo nombre, misma extension, misma
  # hora— y el bueno es el de al lado; el dia que alguien restaure a mano bajo
  # presion, elegir el mas reciente seria elegir el vacio.
  rm -f "$BK"
  salir "$EX_CONFIG" "BACKUP VACIO — abortado. El archivo de 0 bytes se borro para que no se confunda con un respaldo bueno. No se toco ni la base ni el contenedor. Revisa $PG_DUMP contra $(destino_de_url "$DATABASE_URL")."
fi
registrar "   respaldo de $(wc -c <"$BK") bytes"

# ─── 4 · La version anterior, por escrito ──────────────────────────────────
ARCHIVO_ANTERIOR="$DIR_ESTADO/version-anterior"
{
  echo "id=$ID_ACTUAL"
  echo "digest=$(digest_de_imagen "$ID_ACTUAL")"
  echo "version=$( [ -n "$ID_ACTUAL" ] && version_de_imagen "$ID_ACTUAL" || true)"
  echo "respaldo=$BK"
  echo "fecha=$(date '+%Y-%m-%d %H:%M:%S%z')"
} >"$ARCHIVO_ANTERIOR"
registrar "4 · version anterior anotada en $ARCHIVO_ANTERIOR"

# ─── 5a · Migraciones, ANTES de conmutar ───────────────────────────────────
# La huella de partida. Si no se puede leer, no se migra: ver AVISO 3.
HUELLA_ANTES="$(huella_base || true)"
if [ -z "$HUELLA_ANTES" ]; then
  salir "$EX_CONFIG" "ABORTADO: no se pudo leer la huella de la base antes de migrar (el mensaje esta en $LOG). Sin punto de partida no se puede decidir despues si hay que restaurar, asi que NO se migra. Nada se aplico y nada se conmuto. El respaldo de este intento esta en $BK."
fi
registrar "5 · migraciones (imagen nueva, contenedor efimero) · huella previa: $HUELLA_ANTES"
salida_mig="$(mktemp)"
codigo=0
correr_runner >"$salida_mig" 2>&1 || codigo=$?
eco <"$salida_mig"
rm -f "$salida_mig"

# Si la base cambio NO se deduce del texto del runner (ver AVISO 3): se lee la
# base otra vez y se compara la huella. `desconocido` solo si la segunda lectura
# falla, y entonces se dice, no se supone.
HUELLA_DESPUES="$(huella_base || true)"
BASE_CAMBIO=desconocido
if [ -n "$HUELLA_DESPUES" ]; then
  if [ "$HUELLA_ANTES" = "$HUELLA_DESPUES" ]; then BASE_CAMBIO=no; else BASE_CAMBIO=si; fi
fi
# Cuenta informativa para el log. La decision NO cuelga de ella.
APLICADAS='?'
reg_antes="$(registradas_de_huella "$HUELLA_ANTES")"
reg_despues="$(registradas_de_huella "${HUELLA_DESPUES:-}")"
if [ -n "$reg_antes" ] && [ -n "$reg_despues" ] && [ "$reg_antes" -ge 0 ] && [ "$reg_despues" -ge 0 ]; then
  APLICADAS=$(( reg_despues - reg_antes ))
fi

case "$codigo" in
  0)
    registrar "   base tras migrar: cambio=$BASE_CAMBIO · $APLICADAS migraciones nuevas en schema_migrations · huella: ${HUELLA_DESPUES:-ILEGIBLE}"
    ;;
  3)
    salir "$EX_HISTORIA" "ABORTADO (3): una migracion ya aplicada cambio de contenido. NADA se aplico y NADA se conmuto — la instancia sigue en la version anterior. El mensaje de arriba nombra el archivo y los dos checksums."
    ;;
  2)
    # El 2 tapa dos cosas muy distintas y el log tiene que decir CUAL, porque es
    # la unica pregunta que el 2 existe para responder: ¿hay que ir a mirar la
    # base? Antes se contestaba leyendo la prosa del runner, y con el mensaje de
    # `migrar.mjs:687-692` —"se aplicaron 66 migraciones y no se pudieron
    # registrar"— el log acababa diciendo lo contrario de lo que habia pasado.
    # Ahora se contesta mirando la base (AVISO 3).
    #
    # Por que NO se restaura aqui, en ninguno de los tres casos: el trafico no
    # se conmuto, o sea que la version ANTERIOR sigue sirviendo y con clientes
    # dentro. Restaurar el dump es un `--clean` sobre la base viva: tumbaria la
    # instancia que ahora mismo funciona y perderia lo que se haya escrito desde
    # el respaldo. Se para y se avisa; el dump esta ahi para quien decida usarlo.
    case "$BASE_CAMBIO" in
      si)
        salir "$EX_MIGRACION" "ABORTADO (2): LA BASE CAMBIO. Comprobado leyendo la base antes y despues, no el mensaje del runner: la huella paso de [$HUELLA_ANTES] a [$HUELLA_DESPUES] ($APLICADAS filas nuevas en schema_migrations; '?' significa que la tabla no existe, o sea que se aplico esquema SIN registro y la proxima corrida lo reaplicaria). NO se conmuto el trafico —sigue sirviendo la version anterior— y NO se restaura nada automaticamente estando la base viva y en uso. Alguien tiene que mirar esto. Respaldo: $BK"
        ;;
      no)
        # Aqui habia una suposicion —"tipicamente no pudo conectar o no pudo
        # abrir la transaccion"— y en el ensayo local la causa medida fue otra:
        # una migracion que fallo contra un objeto que ya existia. El mensaje
        # del runner va impreso JUSTO ENCIMA y ese si es exacto, asi que este
        # script no adivina: remite. Cambiar una suposicion por otra seria
        # repetir el fallo con distinta redaccion.
        salir "$EX_MIGRACION" "ABORTADO (2): el runner fallo y la base NO cambio — misma huella antes y despues [$HUELLA_ANTES]. El motivo lo dice el mensaje del runner, aqui arriba; este script no lo adivina. No se conmuto el trafico. Respaldo: $BK"
        ;;
      *)
        salir "$EX_MIGRACION" "ABORTADO (2): el runner fallo y NO se pudo volver a leer la huella de la base, asi que este script NO sabe si cambio. Trata el caso como el peor: alguien tiene que mirar la base. Huella previa: [$HUELLA_ANTES]. No se conmuto el trafico. Respaldo: $BK"
        ;;
    esac
    ;;
  1)
    salir "$EX_CONFIG" "ABORTADO (1): el runner de migraciones no pudo ni empezar. Su mensaje esta arriba y dice exactamente que hacer (por ejemplo: aplicar primero db/migrations/20260812_schema_migrations.sql). Nada se aplico y nada se conmuto."
    ;;
  *)
    salir "$EX_MIGRACION" "ABORTADO: el runner salio con un codigo que este script no conoce ($codigo). Se trata como el peor caso. La base, segun su huella, cambio=$BASE_CAMBIO. No se conmuto. Respaldo: $BK"
    ;;
esac

# ─── 5b · Conmutar el trafico ──────────────────────────────────────────────
# El contenedor viejo se RENOMBRA en vez de borrarse: conserva su configuracion
# exacta (puertos, env, red, politica de reinicio), asi que volver atras es
# arrancarlo otra vez y no reconstruir a mano como se levanto.
ANTERIOR="${CONTENEDOR}-anterior"
RENOMBRADO=0
# Con que comando se devuelve el servicio A MANO si la vuelta atras se queda a
# medias. Se calcula en vez de escribirse fijo porque depende de si el rename de
# 5b llego a hacerse: si se hizo, el contenedor viejo esta aparcado como
# `-anterior` y hay que devolverle el nombre; si no, conserva el suyo y basta
# con arrancarlo. Un comando equivocado en un mensaje de urgencia es peor que
# ninguno.
comando_rescate() {
  if [ "$RENOMBRADO" = 1 ]; then
    printf 'docker rename %s %s && docker start %s' "$ANTERIOR" "$CONTENEDOR" "$CONTENEDOR"
  else
    printf 'docker start %s' "$CONTENEDOR"
  fi
}
docker rm -f "$ANTERIOR" >/dev/null 2>&1 || true
if [ -n "$ID_ACTUAL" ]; then
  registrar "5b · parando $CONTENEDOR y guardandolo como $ANTERIOR"
  # A partir de aqui la instancia NO responde. Ver "LA VENTANA" en la cabecera.
  docker stop "$CONTENEDOR" >/dev/null 2>&1 || true
  # El resultado del rename se GUARDA en vez de tragarse con `|| true`: si el
  # rename falla, el contenedor viejo conserva su nombre original, y entonces la
  # vuelta atras no debe ni renombrarlo de vuelta ni borrar "$CONTENEDOR" —que
  # seria borrar justo el contenedor que se pretendia conservar.
  if docker rename "$CONTENEDOR" "$ANTERIOR" 2>&1 | eco; then
    RENOMBRADO=1
  else
    registrar "5b · AVISO: no se pudo renombrar $CONTENEDOR a $ANTERIOR. El contenedor viejo conserva su nombre; el contenedor nuevo no va a poder nacer con ese nombre y la vuelta atras se limitara a levantarlo otra vez."
  fi
fi

# Las opciones del contenedor las decide el aprovisionamiento y llegan como una
# cadena; se parten en palabras a proposito (son opciones, no un valor).
read -r -a opciones_app <<<"$DOCKER_OPCIONES_APP"
registrar "5c · levantando $CONTENEDOR con $VERSION_NUEVA"
# El ID del contenedor nuevo se guarda para poder retirarlo por ID en la vuelta
# atras. Retirarlo por NOMBRE era el error: si el rename de arriba fallo, el
# nombre lo lleva todavia el contenedor VIEJO.
CONTENEDOR_NUEVO_ID=""
salida_run="$(mktemp)"
codigo=0
docker run --detach --name "$CONTENEDOR" --restart unless-stopped \
  --env-file "$ENV_APP" "${opciones_app[@]}" "$IMAGEN" >"$salida_run" 2>&1 || codigo=$?
eco <"$salida_run"
if [ "$codigo" -eq 0 ]; then
  CONTENEDOR_NUEVO_ID="$(tail -n1 "$salida_run" | tr -d '\r' | tr -d '[:space:]')"
fi
rm -f "$salida_run"

# ─── 6 · Health check ──────────────────────────────────────────────────────
salud() {
  local i codigo_http
  for i in $(seq 1 "$SALUD_INTENTOS"); do
    # `-w '%{http_code}'` YA imprime un codigo pase lo que pase —000 si no hubo
    # respuesta—, asi que el `|| echo 000` que habia aqui pegaba un SEGUNDO
    # codigo detras del primero. Con un fallo de conexion solo se veia feo en el
    # log ("intento 1/5 -> 000000"); pero con un curl que alcanza a leer el 200 y
    # LUEGO sale != 0 —un `--max-time` agotado a mitad del cuerpo, un contenedor
    # recien arrancado y lento— la variable valia "200000", no casaba con "200",
    # y esta linea es la que gobierna si se restaura la base: un release SANO
    # acababa tirado por un `pg_restore` que ademas pierde lo escrito desde el
    # respaldo. Por eso la salida y el codigo de salida se recogen POR SEPARADO:
    # lo que curl imprimio es el valor, y si no imprimio nada, 000.
    codigo_http="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$SALUD_URL" 2>/dev/null)" || true
    case "$codigo_http" in ''|*[!0-9]*) codigo_http=000 ;; esac
    if [ "$codigo_http" = "200" ]; then
      registrar "6 · salud: 200 en el intento $i/$SALUD_INTENTOS"
      return 0
    fi
    registrar "6 · salud: intento $i/$SALUD_INTENTOS -> $codigo_http"
    if [ "$i" -lt "$SALUD_INTENTOS" ]; then sleep "$SALUD_ESPERA"; fi
  done
  return 1
}

sano=0
if [ "$codigo" -eq 0 ]; then
  salud || sano=$?
else
  registrar "5c · el contenedor nuevo ni siquiera arranco (codigo $codigo)"
  sano=1
fi

if [ "$sano" -eq 0 ]; then
  docker rm -f "$ANTERIOR" >/dev/null 2>&1 || true
  {
    echo "id=$ID_NUEVO"
    echo "digest=$DIGEST_NUEVO"
    echo "version=$VERSION_NUEVA"
    echo "fecha=$(date '+%Y-%m-%d %H:%M:%S%z')"
  } >"$DIR_ESTADO/version-actual"
  salir "$EX_OK" "OK: $VERSION_NUEVA sirviendo. La base cambio=$BASE_CAMBIO ($APLICADAS filas nuevas en schema_migrations). Respaldo en $BK"
fi

# ─── 7 · Vuelta atras ──────────────────────────────────────────────────────
registrar "7 · VUELTA ATRAS: la version nueva no contesta 200 en $SALUD_URL"
# Por ID, nunca por nombre: si el rename de 5b fallo, el nombre "$CONTENEDOR" lo
# lleva el contenedor VIEJO y un `docker rm -f` por nombre lo destruiria, que es
# justo la configuracion que renombrar pretendia conservar.
if [ -n "$CONTENEDOR_NUEVO_ID" ]; then
  docker logs --tail 30 "$CONTENEDOR_NUEVO_ID" 2>&1 | eco || true
  docker rm -f "$CONTENEDOR_NUEVO_ID" >/dev/null 2>&1 || true
else
  registrar "7 · no hay contenedor nuevo que retirar: no llego a crearse."
fi

if [ -z "$ID_ACTUAL" ]; then
  salir "$EX_VUELTA_FALLO" "VUELTA ATRAS IMPOSIBLE: no habia version anterior corriendo. La instancia queda SIN servicio. Respaldo en $BK"
fi

# Se restaura si la BASE CAMBIO — medido con la huella, no leyendo cuantas
# migraciones dijo el runner que aplico (AVISO 3). Y con `desconocido` tambien
# se restaura: dejar la version vieja sobre un esquema nuevo es el fallo
# silencioso que nadie denuncia despues; restaurar de mas cuesta, como mucho, lo
# que se haya escrito desde el respaldo de hace unos minutos.
if [ "$BASE_CAMBIO" != "no" ]; then
  if [ "$BASE_CAMBIO" = "si" ]; then
    registrar "7a · restaurando $BK: la huella de la base cambio al migrar ($APLICADAS filas nuevas en schema_migrations). [$HUELLA_ANTES] -> [$HUELLA_DESPUES]. Se restaura ANTES de levantar la version anterior, para que no vea un esquema que no conoce."
  else
    registrar "7a · restaurando $BK POR PRUDENCIA: no se pudo releer la huella de la base, asi que no consta que NO haya cambiado. Se prefiere restaurar de mas a dejar la version anterior sobre un esquema nuevo, que no da error y no lo denuncia nadie."
  fi
  if ! command -v "$PG_RESTORE" >/dev/null 2>&1; then
    salir "$EX_VUELTA_FALLO" "VUELTA ATRAS A MEDIAS: no hay \`$PG_RESTORE\` para restaurar $BK. La base se quedo con las migraciones nuevas. La instancia queda SIN servicio: el contenedor de la version anterior esta PARADO y aparcado como $ANTERIOR. Para devolver el servicio ya: $(comando_rescate) — eso levanta la version ANTERIOR sobre la base YA MIGRADA, asi que es un parche hasta que alguien mire. Una persona tiene que mirar esto."
  fi
  codigo=0
  # `--clean --if-exists --single-transaction` no son adorno y no se quitan:
  # sin `--clean` la restauracion muere objeto por objeto contra lo que ya
  # existe; sin `--if-exists` los DROP de lo que no existe la abortan; y sin
  # `--single-transaction` un fallo a la mitad deja la base medio limpiada, que
  # es peor que no haber restaurado.
  correr_pg "$PG_RESTORE" --clean --if-exists --single-transaction "$BK" 2>&1 | eco || codigo=$?
  if [ "$codigo" -ne 0 ]; then
    salir "$EX_VUELTA_FALLO" "VUELTA ATRAS A MEDIAS: fallo la restauracion de $BK (codigo $codigo). La base puede tener las migraciones nuevas y la app va a ser la vieja. La instancia queda SIN servicio: el contenedor de la version anterior esta PARADO y aparcado como $ANTERIOR. Para devolver el servicio ya: $(comando_rescate) — con la base en el estado en que la dejo la restauracion fallida, asi que es un parche hasta que alguien mire. Una persona tiene que mirar esto."
  fi
  registrar "7a · base restaurada (esquema Y registro de migraciones: schema_migrations viaja dentro del dump)"
else
  registrar "7a · la huella de la base es la misma antes y despues de migrar [$HUELLA_ANTES]: no se toca. Restaurar solo podria perder lo escrito desde el respaldo."
fi

registrar "7b · levantando otra vez la version anterior"
# Los dos comandos se miran POR SEPARADO: si el segundo pisara el codigo del
# primero, un rename fallido con un start que "funciona" (sobre otro
# contenedor) se leeria como vuelta atras buena.
if [ "$RENOMBRADO" = 1 ] && ! docker rename "$ANTERIOR" "$CONTENEDOR" 2>&1 | eco; then
  salir "$EX_VUELTA_FALLO" "VUELTA ATRAS FALLIDA: no se pudo devolver el nombre a $ANTERIOR. La instancia queda SIN servicio. Respaldo en $BK"
fi
if ! docker start "$CONTENEDOR" 2>&1 | eco; then
  salir "$EX_VUELTA_FALLO" "VUELTA ATRAS FALLIDA: no se pudo levantar la version anterior. La instancia queda SIN servicio. Respaldo en $BK"
fi

if salud; then
  salir "$EX_VUELTA_OK" "VUELTA ATRAS COMPLETA: la instancia sirve otra vez la version anterior. El release $VERSION_NUEVA queda descartado. Respaldo en $BK"
fi
salir "$EX_VUELTA_FALLO" "VUELTA ATRAS SIN SALUD: se levanto la version anterior y tampoco contesta 200. La instancia esta caida. Respaldo en $BK"
