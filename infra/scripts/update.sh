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
    -h|--help) sed -n '2,60p' "$0"; exit 0 ;;
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
export DATABASE_URL

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

# ─── --dry-run: mira y cuenta ──────────────────────────────────────────────
if [ "$DRY_RUN" = 1 ]; then
  # `--pendientes` lista y no aplica (`scripts/migrar.mjs:598-604`): es la
  # unica forma de contar migraciones pendientes sin escribir en la base.
  salida_seca="$(mktemp)"
  codigo=0
  correr_runner --pendientes >"$salida_seca" 2>&1 || codigo=$?
  eco <"$salida_seca"
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
"$PG_DUMP" --dbname="$DATABASE_URL" --format=custom --file="$BK" 2>&1 | eco || codigo=$?
if [ "$codigo" -ne 0 ] || [ ! -s "$BK" ]; then
  salir "$EX_CONFIG" "BACKUP VACIO — abortado. No se toco ni la base ni el contenedor. Revisa $PG_DUMP contra $(destino_de_url "$DATABASE_URL")."
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
registrar "5 · migraciones (imagen nueva, contenedor efimero)"
salida_mig="$(mktemp)"
codigo=0
correr_runner >"$salida_mig" 2>&1 || codigo=$?
eco <"$salida_mig"
# "N aplicadas." al final de una corrida buena; "  N aplicadas antes del fallo."
# cuando aborta a medias. Las dos cuentan para decidir si hay que restaurar.
APLICADAS="$(sed -n -e 's/^\([0-9][0-9]*\) aplicadas\..*/\1/p' -e 's/^ *\([0-9][0-9]*\) aplicadas antes del fallo.*/\1/p' "$salida_mig" | tail -n1)"
APLICADAS="${APLICADAS:-0}"
rm -f "$salida_mig"

case "$codigo" in
  0)
    registrar "   $APLICADAS migraciones aplicadas y registradas"
    ;;
  3)
    salir "$EX_HISTORIA" "ABORTADO (3): una migracion ya aplicada cambio de contenido. NADA se aplico y NADA se conmuto — la instancia sigue en la version anterior. El mensaje de arriba nombra el archivo y los dos checksums."
    ;;
  2)
    # El 2 tapa dos cosas muy distintas y el log tiene que decir cual: "no se
    # pudo conectar" (nada cambio) y "se aplicaron N y algo se torcio" (la base
    # SI cambio). Lo dice la propia cuenta del runner, no una suposicion.
    #
    # Por que NO se restaura aqui: el trafico no se conmuto, o sea que la
    # version ANTERIOR sigue sirviendo y con clientes dentro. Restaurar el dump
    # es un `--clean` sobre la base viva: tumbaria la instancia que ahora mismo
    # funciona y perderia lo que se haya escrito desde el respaldo. Se para y se
    # avisa; el dump esta ahi para quien decida usarlo.
    if [ "$APLICADAS" -gt 0 ]; then
      salir "$EX_MIGRACION" "ABORTADO (2): se aplicaron $APLICADAS migraciones y quedaron a medias o sin registrar: LA BASE CAMBIO. NO se conmuto el trafico —sigue sirviendo la version anterior— y NO se restaura nada automaticamente estando la base viva y en uso. Respaldo: $BK"
    fi
    salir "$EX_MIGRACION" "ABORTADO (2): el runner fallo sin aplicar nada (no consta ninguna migracion aplicada; suele ser que no pudo conectar). No se conmuto el trafico. Respaldo: $BK"
    ;;
  1)
    salir "$EX_CONFIG" "ABORTADO (1): el runner de migraciones no pudo ni empezar. Su mensaje esta arriba y dice exactamente que hacer (por ejemplo: aplicar primero db/migrations/20260812_schema_migrations.sql). Nada se aplico y nada se conmuto."
    ;;
  *)
    salir "$EX_MIGRACION" "ABORTADO: el runner salio con un codigo que este script no conoce ($codigo). Se trata como el peor caso: la base pudo cambiar. No se conmuto. Respaldo: $BK"
    ;;
esac

# ─── 5b · Conmutar el trafico ──────────────────────────────────────────────
# El contenedor viejo se RENOMBRA en vez de borrarse: conserva su configuracion
# exacta (puertos, env, red, politica de reinicio), asi que volver atras es
# arrancarlo otra vez y no reconstruir a mano como se levanto.
ANTERIOR="${CONTENEDOR}-anterior"
docker rm -f "$ANTERIOR" >/dev/null 2>&1 || true
if [ -n "$ID_ACTUAL" ]; then
  registrar "5b · parando $CONTENEDOR y guardandolo como $ANTERIOR"
  docker stop "$CONTENEDOR" >/dev/null 2>&1 || true
  docker rename "$CONTENEDOR" "$ANTERIOR" 2>&1 | eco || true
fi

# Las opciones del contenedor las decide el aprovisionamiento y llegan como una
# cadena; se parten en palabras a proposito (son opciones, no un valor).
read -r -a opciones_app <<<"$DOCKER_OPCIONES_APP"
registrar "5c · levantando $CONTENEDOR con $VERSION_NUEVA"
codigo=0
docker run --detach --name "$CONTENEDOR" --restart unless-stopped \
  --env-file "$ENV_APP" "${opciones_app[@]}" "$IMAGEN" 2>&1 | eco || codigo=$?

# ─── 6 · Health check ──────────────────────────────────────────────────────
salud() {
  local i codigo_http
  for i in $(seq 1 "$SALUD_INTENTOS"); do
    codigo_http="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$SALUD_URL" 2>/dev/null || echo 000)"
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
  salir "$EX_OK" "OK: $VERSION_NUEVA sirviendo, $APLICADAS migraciones aplicadas. Respaldo en $BK"
fi

# ─── 7 · Vuelta atras ──────────────────────────────────────────────────────
registrar "7 · VUELTA ATRAS: la version nueva no contesta 200 en $SALUD_URL"
docker logs --tail 30 "$CONTENEDOR" 2>&1 | eco || true
docker rm -f "$CONTENEDOR" >/dev/null 2>&1 || true

if [ -z "$ID_ACTUAL" ]; then
  salir "$EX_VUELTA_FALLO" "VUELTA ATRAS IMPOSIBLE: no habia version anterior corriendo. La instancia queda SIN servicio. Respaldo en $BK"
fi

# El dump se restaura SOLO si corrieron migraciones. Si no corrio ninguna, la
# base no cambio y restaurar solo podria perder lo que se haya escrito.
if [ "$APLICADAS" -gt 0 ]; then
  registrar "7a · restaurando $BK ($APLICADAS migraciones aplicadas). Se restaura ANTES de levantar la version anterior, para que no vea un esquema que no conoce."
  if ! command -v "$PG_RESTORE" >/dev/null 2>&1; then
    salir "$EX_VUELTA_FALLO" "VUELTA ATRAS A MEDIAS: no hay \`$PG_RESTORE\` para restaurar $BK. La base se quedo con las migraciones nuevas. Una persona tiene que mirar esto."
  fi
  codigo=0
  "$PG_RESTORE" --clean --if-exists --single-transaction --dbname="$DATABASE_URL" "$BK" 2>&1 | eco || codigo=$?
  if [ "$codigo" -ne 0 ]; then
    salir "$EX_VUELTA_FALLO" "VUELTA ATRAS A MEDIAS: fallo la restauracion de $BK (codigo $codigo). La base puede tener las migraciones nuevas y la app va a ser la vieja. Una persona tiene que mirar esto."
  fi
  registrar "7a · base restaurada (esquema Y registro de migraciones: schema_migrations viaja dentro del dump)"
else
  registrar "7a · no corrio ninguna migracion: la base no se toca."
fi

registrar "7b · levantando otra vez la version anterior"
# Los dos comandos se miran POR SEPARADO: si el segundo pisara el codigo del
# primero, un rename fallido con un start que "funciona" (sobre otro
# contenedor) se leeria como vuelta atras buena.
if ! docker rename "$ANTERIOR" "$CONTENEDOR" 2>&1 | eco; then
  salir "$EX_VUELTA_FALLO" "VUELTA ATRAS FALLIDA: no se pudo devolver el nombre a $ANTERIOR. La instancia queda SIN servicio. Respaldo en $BK"
fi
if ! docker start "$CONTENEDOR" 2>&1 | eco; then
  salir "$EX_VUELTA_FALLO" "VUELTA ATRAS FALLIDA: no se pudo levantar la version anterior. La instancia queda SIN servicio. Respaldo en $BK"
fi

if salud; then
  salir "$EX_VUELTA_OK" "VUELTA ATRAS COMPLETA: la instancia sirve otra vez la version anterior. El release $VERSION_NUEVA queda descartado. Respaldo en $BK"
fi
salir "$EX_VUELTA_FALLO" "VUELTA ATRAS SIN SALUD: se levanto la version anterior y tampoco contesta 200. La instancia esta caida. Respaldo en $BK"
