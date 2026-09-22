#!/usr/bin/env bash
# ============================================================================
#  respaldo-diario.sh — los datos salen del droplet TODOS LOS DIAS.
# ----------------------------------------------------------------------------
#  Se instala en /opt/space-os/respaldo-diario.sh, al lado de `update.sh`, y lo
#  lanza el cron de la propia instancia. Hace UNA cosa: dump, poda y subida.
#  No actualiza nada, no habla con el registro de imagenes y no toca el
#  contenedor de la aplicacion.
#
#  Uso:
#    /opt/space-os/respaldo-diario.sh
#    SPACE_OS_CONF=/etc/space-os/demo-instancia.env /opt/space-os/respaldo-diario.sh
#
#  Codigos de salida (los mira el cron, y los lee una persona en el log):
#    0  respaldo hecho. Si la instancia tiene respaldo remoto configurado,
#       ademas salio del droplet; si no, se dice en el log y NO es un error.
#    1  configuracion: falta el archivo, falta DATABASE_URL, o no se puede
#       interpretar. No se toco nada.
#    4  BACKUP VACIO: el dump fallo o salio de 0 bytes. No se subio nada.
#    5  el dump esta bien pero NO salio del droplet. El archivo local se
#       conserva.
#
# ── POR QUE EXISTE ─────────────────────────────────────────────────────────
#  Medido el 2026-09-22 y escrito en
#  `docs/evidencias/11-g500-sin-respaldo-programado.md`:
#
#    g500 -la unica instancia con datos reales de cliente- se respaldaba fuera
#    de su droplet UNICAMENTE cuando se desplegaba una version nueva.
#
#  No era un olvido de configuracion: es donde vive el dump. `update.sh` respalda
#  en su paso 3, y a ese paso solo se llega si hay imagen nueva -- las corridas
#  `sin cambios` salen antes. Como `estable` no se movia desde el 17/09, la copia
#  remota mas reciente tenia CINCO DIAS y la habia subido una persona a mano.
#
#  La regla real era «la frecuencia de tus respaldos la decide el ritmo de los
#  releases», que nadie habria escrito a proposito. Este guion la rompe: el
#  respaldo pasa a depender del reloj y de nada mas.
#
#  `update.sh` NO se toca, y eso tambien es a proposito: esta desplegado en
#  produccion y su arnes tarda 15 minutos. Su respaldo antes de migrar sigue
#  donde estaba y sigue haciendo falta -- es el que da la vuelta atras de un
#  release malo. Los dos respaldos son cosas distintas y conviven:
#
#    update.sh       · respaldo ANTES DE MIGRAR, para deshacer un release malo
#    respaldo-diario · respaldo POR RELOJ, para sobrevivir a la perdida del droplet
#
# ── DE QUE INSTANCIAS ──────────────────────────────────────────────────────
#  DECISION DEL DUENO, 2026-09-22: **de TODAS**, no solo de las que tienen datos
#  reales. Eso obliga a las dos cosas que siguen.
#
#  1) Una instancia SIN credenciales de Spaces -- DEMO hoy es exactamente esa--
#     hace su dump local, poda, DICE que no tiene respaldo fuera del droplet y
#     sale con 0. No es un error: es una instancia sin respaldo remoto
#     configurado, y su cron no tiene que quejarse cada noche. El criterio no se
#     inventa aqui: es el que ya usa `respaldo.sh:229-232`.
#
#  2) Hay DOS montajes y no se configuran igual:
#       g500 · estandar        · /etc/space-os/instancia.env       · base `spaces`
#       DEMO · dentro del PADRE· SPACE_OS_CONF=…/demo-instancia.env· base `spaces_demo`
#     Por eso `SPACE_OS_CONF` manda, igual que en `update.sh:430`. Sin eso, en el
#     PADRE este guion leeria la configuracion de la otra instancia y respaldaria
#     la base equivocada SIN dar ningun error, porque las dos existen en esa
#     maquina. Lo fija el escenario R9 del arnes.
#
# ── LO QUE NO HACE, Y NO ES UNA FALTA ──────────────────────────────────────
#  · No borra nada en el bucket. La retencion remota (30 dias) es una regla de
#    ciclo de vida de la cuenta: un `rm` remoto en un guion que corre en TODAS
#    las instancias es una forma elegante de perderlo todo a la vez. Ver la
#    cabecera de `respaldo.sh`.
#  · No se protege de correr dos veces a la vez. Se penso y se descarto: un
#    candado mal soltado deja la instancia SIN respaldos para siempre y en
#    silencio, que es peor que dos dumps solapados. Si algun dia el dump tarda
#    mas que el hueco entre corridas, esto hay que revisarlo.
#
# ── CONFIGURACION ──────────────────────────────────────────────────────────
#    SPACE_OS_CONF       /etc/space-os/instancia.env   (se SOURCEA)
#    SPACE_OS_DIR_ESTADO /var/lib/space-os
#    SPACE_OS_DIR_LOG    /var/log/space-os
#    ENV_APP             /etc/space-os/app.env  (de donde sale DATABASE_URL si
#                                                no esta en la configuracion)
#    PG_DUMP             pg_dump
#    DIR_RESPALDOS       $SPACE_OS_DIR_ESTADO/respaldos
#  Las de Spaces (SPACES_KEY, SPACES_SECRET, SPACES_BUCKET, SPACES_REGION,
#  INSTANCIA, RESPALDOS_LOCALES) las lee `respaldo.sh`; salen del mismo archivo.
#
#  Ningun valor real va escrito aqui: ni bucket, ni region, ni dominio, ni
#  llaves. Todo entra por configuracion.
# ============================================================================
set -uo pipefail

EX_OK=0
EX_CONFIG=1
EX_RESPALDO=4
EX_REMOTO=5

CONF="${SPACE_OS_CONF:-/etc/space-os/instancia.env}"
DIR_ESTADO="${SPACE_OS_DIR_ESTADO:-/var/lib/space-os}"
DIR_LOG="${SPACE_OS_DIR_LOG:-/var/log/space-os}"
LOG="$DIR_LOG/respaldo-diario.log"

# Un log propio, y no el de `update.sh`, para que `grep 'respaldo remoto OK'`
# sobre cada archivo siga contestando a una pregunta distinta: el de update dice
# «se respaldo al desplegar», este dice «se respaldo anoche».
mkdir -p "$DIR_LOG" 2>/dev/null || true
if ! { : >>"$LOG"; } 2>/dev/null; then
  # Sin log no se para: un respaldo que no corre porque no pudo escribir su
  # bitacora es el peor cambio posible en este archivo.
  LOG=/dev/null
fi

# `registrar` y `eco` se definen ANTES de sourcear `respaldo.sh`, a proposito:
# ese archivo comprueba si existen (`respaldo.sh:85-90`) y solo define las suyas
# minimas si no. Asi sus lineas entran en el mismo log que las de aqui.
registrar() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S%z')" "$*" | tee -a "$LOG"; }
eco() { tee -a "$LOG"; }
salir() { local codigo="$1"; shift; registrar "$*"; exit "$codigo"; }

case "${1:-}" in
  '') ;;
  -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
  *) printf 'respaldo-diario: no entiendo `%s`. Este guion no lleva argumentos; usa --help.\n' "$1" >&2; exit "$EX_CONFIG" ;;
esac

# ─── 0 · La configuracion de la instancia ──────────────────────────────────
[ -f "$CONF" ] || salir "$EX_CONFIG" "ERROR respaldo-diario: no existe $CONF. Sin configuracion no se sabe ni que base respaldar ni a donde subirla. Si esta instancia es DEMO dentro del PADRE, la configuracion es otra y se indica con SPACE_OS_CONF."
# Se SOURCEA, igual que `update.sh:841`, con la misma trampa heredada: un valor
# con espacios y sin comillas hace que bash EJECUTE la segunda palabra. El
# archivo es 0600 y de root, asi que quien puede escribirlo ya puede ejecutar lo
# que quiera; queda dicho porque sorprende.
# shellcheck disable=SC1090
. "$CONF"

ENV_APP="${ENV_APP:-/etc/space-os/app.env}"
DATABASE_URL="${DATABASE_URL:-}"
if [ -z "$DATABASE_URL" ] && [ -f "$ENV_APP" ]; then
  # Formato `--env-file`: CLAVE=valor, sin comillas ni `export`. Por eso se lee
  # con grep y no con `.` -- sourcearlo interpretaria las comillas de otra
  # manera que el contenedor, y ahi nacen las diferencias invisibles.
  DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$ENV_APP" 2>/dev/null | cut -d= -f2- || true)"
  [ -z "$DATABASE_URL" ] || registrar "AVISO respaldo-diario: DATABASE_URL no esta en $CONF; se usa la de $ENV_APP."
fi
[ -n "$DATABASE_URL" ] || salir "$EX_CONFIG" "ERROR respaldo-diario: falta DATABASE_URL (ni en $CONF ni en $ENV_APP). No se adivina la base."

# ─── 0b · Las dos bibliotecas ──────────────────────────────────────────────
# El orden importa y no es estilo: `respaldo.sh` lee SPACES_* EN EL MOMENTO de
# sourcearse (`respaldo.sh:92-99`), asi que tiene que ir DESPUES de leer $CONF o
# se quedaria con los valores por omision. Mismo motivo que `update.sh:851-853`.
CONEXION_SH="${SPACE_OS_CONEXION_PG_SH:-$(dirname "$0")/conexion-pg.sh}"
[ -f "$CONEXION_SH" ] || salir "$EX_CONFIG" "ERROR respaldo-diario: falta $CONEXION_SH. Ahi vive la separacion de la contrasena de DATABASE_URL; sin el no se puede respaldar sin dejarla en argv."
# shellcheck disable=SC1090
. "$CONEXION_SH"

RESPALDO_SH="${SPACE_OS_RESPALDO_SH:-$(dirname "$0")/respaldo.sh}"
[ -f "$RESPALDO_SH" ] || salir "$EX_CONFIG" "ERROR respaldo-diario: falta $RESPALDO_SH. Ahi viven la subida y la poda."
# shellcheck disable=SC1090
. "$RESPALDO_SH"

# ─── 0c · La conexion, sin que la contrasena pase por `argv` ───────────────
if ! pg_derivar_conexion "$DATABASE_URL"; then
  salir "$EX_CONFIG" "ERROR respaldo-diario: $PG_ERROR Revisa DATABASE_URL en $CONF o en $ENV_APP. Nada se toco."
fi
[ -z "$PG_AVISO" ] || registrar "AVISO respaldo-diario: $PG_AVISO"

PG_DUMP="${PG_DUMP:-pg_dump}"
command -v "$PG_DUMP" >/dev/null 2>&1 || salir "$EX_CONFIG" "ERROR respaldo-diario: no hay \`$PG_DUMP\` en el PATH. Sin el no hay respaldo."

# ─── 1 · El dump ───────────────────────────────────────────────────────────
DIR_RESPALDOS="${DIR_RESPALDOS:-$DIR_ESTADO/respaldos}"
mkdir -p "$DIR_RESPALDOS" || salir "$EX_CONFIG" "ERROR respaldo-diario: no se pudo crear $DIR_RESPALDOS."

# Mismo nombre y mismo formato que los de `update.sh:2333`, y eso es un
# requisito, no una coincidencia: la poda de `respaldo.sh` busca
# `spaces_*.dump`, y la vuelta atras de un release restaura con `pg_restore` un
# archivo `--format=custom`. Dos convenciones distintas dejarian dos montones de
# respaldos que no se podan ni se restauran entre si.
BK="$DIR_RESPALDOS/spaces_$(date +%Y%m%d_%H%M%S).dump"
registrar "1 · respaldo diario -> $BK · base=$(destino_de_url "$DATABASE_URL")"
codigo=0
correr_pg "$PG_DUMP" --format=custom --file="$BK" 2>&1 | eco || codigo=$?

# ─── 2 · El guard del archivo vacio ────────────────────────────────────────
# Copiado de `update.sh:2337-2348`, y es la comprobacion mas importante del
# guion. Un `pg_dump` que muere a media conexion deja un archivo de 0 bytes y su
# salida se parece muchisimo a la de uno bueno. Si eso se sube, el bucket queda
# con un objeto de la fecha correcta y el tamano equivocado -- y se descubre el
# dia que hay que restaurar, que es el unico dia en que no se puede arreglar.
if [ "$codigo" -ne 0 ] || [ ! -s "$BK" ]; then
  # El vacio se BORRA. Si se queda, en un `ls` parece un respaldo mas y el dia
  # que alguien restaure a mano bajo presion elegiria el mas reciente.
  rm -f "$BK"
  salir "$EX_RESPALDO" "BACKUP VACIO — abortado, y NO se subio nada. El archivo de 0 bytes se borro para que no se confunda con un respaldo bueno. Mira primero base=$(destino_de_url "$DATABASE_URL"): si esa NO es la base de esta instancia, lo que fallo fue interpretar DATABASE_URL —no el respaldo— y hay que revisar la URL en $CONF. Si si lo es, revisa $PG_DUMP contra ella."
fi
registrar "   respaldo de $(wc -c <"$BK") bytes"

# ─── 3 · La poda local ─────────────────────────────────────────────────────
# DESPUES de comprobar que el dump nuevo es bueno: podar antes tiraria un
# respaldo viejo a cambio de uno que luego resulta que fallo. Y en un `if !`
# porque `respaldo_local_podar` devuelve 1 cuando solo pudo retirar parte:
# llenar el disco es un problema de manana, no subir el respaldo es de hoy.
if ! respaldo_local_podar "$DIR_RESPALDOS"; then
  registrar "   AVISO: la poda de $DIR_RESPALDOS no se pudo completar. El respaldo SIGUE; el disco hay que mirarlo."
fi

# ─── 4 · La subida ─────────────────────────────────────────────────────────
# `respaldo_remoto_subir` devuelve 0 tambien cuando NO hay respaldo remoto
# configurado, despues de escribirlo en el log. Esa distincion es justo la que
# hace falta para que DEMO no de un error cada noche.
codigo_subida=0
respaldo_remoto_subir "$BK" || codigo_subida=$?

if [ "$codigo_subida" -ne 0 ]; then
  # AQUI ESTE GUION SE SEPARA DE `update.sh` A PROPOSITO, y es la decision de
  # diseno que mas vale la pena dejar escrita.
  #
  # Para `update.sh` una subida fallida NO para el update: el respaldo local ya
  # existe, basta para la vuelta atras, y no actualizar es un problema mayor.
  # Para ESTE guion sacar los datos del droplet es lo UNICO que hace. Si sale
  # con 0, el cron lo da por bueno todas las noches y volvemos exactamente al
  # agujero que este archivo existe para tapar -- con la diferencia de que
  # ahora habria un guion llamado «respaldo diario» diciendo que todo va bien.
  #
  # Y el dump local NO se borra: es lo unico que queda de esos datos fuera de la
  # base. Borrarlo «porque el respaldo fallo» seria destruir la copia buena por
  # no tener la remota.
  salir "$EX_REMOTO" "RESPALDO REMOTO FALLIDO — el dump se quedo SOLO en este droplet ($BK), y ahi sigue: no se borra. Si esta maquina desaparece, este respaldo desaparece con ella. El motivo esta en la linea de arriba; si dice 403, es permiso de la llave sobre ESE bucket y se arregla en el panel, no aqui."
fi

if respaldo_remoto_configurado; then
  salir "$EX_OK" "respaldo diario OK: la copia de hoy salio del droplet."
fi
salir "$EX_OK" "respaldo diario terminado en local. Esta instancia NO tiene respaldo fuera de su droplet y eso NO es un fallo de esta corrida: es que no tiene credenciales de Spaces configuradas. Si deberia tenerlas, la linea de arriba dice cuales faltan."
