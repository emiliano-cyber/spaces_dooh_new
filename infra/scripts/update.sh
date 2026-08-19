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
#    /opt/space-os/update.sh --simular-fallo-pull
#                                        # el pull falla A PROPOSITO: ensaya la
#                                        # politica de reintentos sin cortarle
#                                        # la red al droplet. No toca nada.
#    tail -n 40 /var/log/space-os/update.log        # todo, crudo, en el droplet
#    cat /var/log/space-os/update-publicable.log    # solo esta corrida, filtrado:
#                                                   # es lo que viaja al bucket
#
#  Respuestas del --dry-run:
#    "sin cambios"                        → la instancia esta al dia
#    "pull v0.4.2 -> 3 migraciones pendientes" → hay actualizacion
#    cualquier mencion a "BACKUP VACIO"   → NO SEGUIR, avisar a una persona
#
#  Codigos de salida (los mira el cron, y los lee una persona en el log):
#    0  sin cambios, o actualizada y sana
#    1  no se puede ni empezar: falta configuracion, falta docker o pg_dump,
#       DATABASE_URL no se entiende como URL de conexion, el pull fallo, el
#       respaldo salio VACIO, o el runner de migraciones se nego a arrancar
#       (por ejemplo: base con datos y sin `schema_migrations`, que pide
#       intervencion humana). NADA se toco.
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
#                                       La clave va SIEMPRE percent-encoded:
#                                       %40 por @, %2F por /, %3F por ? y %5C
#                                       por la barra invertida. Sin codificar,
#                                       cada cliente se rompe con un caracter
#                                       distinto —medido el 19/08— y este
#                                       archivo ademas lo sourcea bash. Si la
#                                       clave va en la CONSULTA (`?password=`)
#                                       tambien vale: el update la saca de ahi
#                                       y la manda por PGPASSWORD, conservando
#                                       el resto de la consulta. `?sslpassword=`
#                                       tambien sale, pero se PIERDE: avisa.
#    IMAGEN_NOMBRE=space-os             nombre de la imagen dentro del registry
#    CONTENEDOR=space-os                nombre del contenedor que sirve
#    ENV_APP=/etc/space-os/app.env      variables de la app (docker --env-file)
#    DOCKER_OPCIONES_APP="--publish 127.0.0.1:3000:3000"
#    RED_MIGRACION=host                 red del contenedor efimero que migra
#    SALUD_URL=http://127.0.0.1:3000/spaces-dooh/api/auth/metodos/
#    SALUD_INTENTOS=10  SALUD_ESPERA=3
#    PULL_ESPERAS="1 5 30"              esperas entre reintentos del pull, en s
#    RUNNER_MIGRACIONES=/opt/space-os/migrar.mjs   (ver el aviso de abajo)
#    PG_DUMP=pg_dump    PG_RESTORE=pg_restore      rutas si hay varias versiones
#    INSTANCIA=demo                     prefijo de esta instancia en el bucket
#    SPACES_KEY=…  SPACES_SECRET=…      llave de Spaces, UNA POR INSTANCIA y con
#                                       permiso solo sobre SU prefijo. Nunca la
#                                       llave maestra de la cuenta
#    SPACES_BUCKET=space-os-respaldos   a donde sale el respaldo
#    LOGS_BUCKET=space-os-logs          a donde sale el LOG de cada corrida. NO
#                                       es el bucket de los respaldos: otra regla
#                                       de ciclo de vida (90 dias contra 30) y,
#                                       si se quiere, otro permiso en la llave
#    SPACES_REGION=nyc3                 decide el endpoint de Spaces
#    RESPALDOS_LOCALES=3                cuantos dumps se guardan en el disco
#
#  El archivo lleva credenciales: 0600 y de root. El script avisa si no.
#
# ── Que se reintenta y que NO ──────────────────────────────────────────────
#    docker pull   3 reintentos esperando 1 s, 5 s y 30 s. Si a la cuarta
#                  tampoco llega, se ABORTA ANTES DE TOCAR LA BASE: sin
#                  respaldo, sin contenedor parado, sin migrar. Sale 1.
#    migracion     CERO reintentos, y es lo importante de esta politica:
#                  reintentar una migracion a medias es como se corrompe una
#                  base. Falla una vez y se para (codigos 2 y 3).
#    health check  SALUD_INTENTOS x SALUD_ESPERA (10 x 3 s) y, si no contesta
#                  200, vuelta atras a la version anterior.
#  Cada reintento sale NUMERADO en el log ("reintento 2/3"): tres lineas
#  iguales no se distinguen de una repetida, y ademas se puede contar desde
#  fuera con `grep -c reintento /var/log/space-os/update.log`.
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
# ── AVISO 4 · el respaldo SALE del droplet, y el disco no se llena ─────────
#  El paso 3 hace tres cosas y no una: `pg_dump`, poda local y subida a Spaces.
#    · LOCAL  3 respaldos, podados por `respaldo.sh`. Antes no se podaba NUNCA:
#             el ensayo de F3.4 dejo diez dumps en siete minutos, y en una
#             instancia con datos de verdad son gigas por noche (defecto D4).
#    · REMOTO 30 dias, y los poda LA REGLA DE CICLO DE VIDA DEL BUCKET. Aqui no
#             hay ni un borrado remoto: un `rm` mal escrito en un script que
#             corre en todas las instancias es una forma elegante de perderlo
#             todo. Esa regla se configura una vez, a mano, en la cuenta.
#  Si la subida falla, el update SIGUE —el respaldo local ya existe y basta para
#  la vuelta atras— pero el log dice `RESPALDO REMOTO FALLIDO`. Que salga tambien
#  en el reporte de flota es F6.4, que todavia no existe.
#  La logica vive en `respaldo.sh`, al lado de este archivo, y se SOURCEA. Si no
#  esta, el update se para antes de tocar nada: actualizar sin respaldo fuera del
#  droplet y sin podar el disco no es lo que aqui se prometio.
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
#
# ── AVISO 5 · el log SALE del droplet, y por eso hay DOS logs ──────────────
#  El modelo prohibe entrar por ssh a la instancia de un owner, asi que una
#  actualizacion fallida hay que poder diagnosticarla desde fuera. De ahi que al
#  terminar —salga bien o mal— este script suba su registro a
#  `s3://<LOGS_BUCKET>/<instancia>/<AAAA-MM-DD-HHMM>.log`. Los 90 dias de
#  retencion los pone la REGLA DE CICLO DE VIDA DEL BUCKET, igual que en F3.7 y
#  por lo mismo: aqui no hay ni un borrado remoto.
#
#  Lo que NO se puede subir es `$LOG`, y esto es el corazon de la tarea. En
#  `update.log` cae, por `eco`, la salida CRUDA de las herramientas:
#    · el runner de migraciones — un error de Postgres arrastra la fila que lo
#      provoco ("Ya existe la llave (tenant_id, rfc)=(…)").
#    · `docker logs --tail 30` del contenedor nuevo (paso 7) — son los registros
#      de la APLICACION: rutas, cuerpos, correos, importes.
#    · `pg_dump`, `pg_restore`, `docker run` y la sonda de huella.
#  El criterio de aceptacion de F3.9 va en NEGATIVO —«ni un dato de negocio
#  aparece en el log»— y con eso dentro no se cumple. Nombres de tabla y conteos
#  son aceptables; cualquier fila, no.
#
#  Asi que hay dos archivos y una sola regla que los separa:
#    $LOG             todo, crudo, acumulado desde que nacio la instancia. Se
#                     queda en el droplet. Lo escriben `registrar` Y `eco`.
#    $LOG_PUBLICABLE  solo esta corrida, y SOLO las lineas que este script emite
#                     mas su codigo de salida. Lo escribe `registrar` y nadie
#                     mas. Es lo unico que viaja al bucket.
#  Filtrar no es perder: lo crudo sigue entero en el droplet para quien tenga
#  que entrar. Lo que cambia es que ya casi nunca hace falta entrar.
#
#  Los limites, escritos para que nadie los descubra tarde. Son seis, y
#  ninguno se disimula: un README que promete de mas es peor que uno corto.
#    · la subida cuelga de `salir()`, que es la unica puerta de salida del script
#      una vez tomado el candado. Si el proceso muere por una senal o por un
#      error no previsto, NO hay log en el bucket. Un `trap EXIT` parecia la
#      respuesta y no lo es: `respaldo.sh` hace `trap - EXIT INT TERM HUP` al
#      cerrar su subida (`respaldo_conf_limpiar`), asi que el trap se quedaria
#      desarmado justo en la segunda mitad del script — la mitad en la que las
#      cosas salen mal. Un trap que deja de existir a medias es peor que no
#      tenerlo, porque el README afirmaria algo falso.
#    · por esa puerta pasan SEIS de los siete codigos documentados, no los
#      siete: el 75 —ya habia otro update en marcha— lo devuelve el proceso
#      de FUERA del candado con un `exit` pelado, a proposito, y ese no
#      escribe ni sube nada.
#    · antes de sourcear `respaldo.sh` no hay CON QUE subir: el cliente de S3
#      sale de ahi, y eso se hace justo despues de leer $CONF. Se quedan en el
#      droplet TRES salidas y solo esas tres: falta $CONF y falta el propio
#      `respaldo.sh` —las dos lo DICEN en el log en vez de callarselo—, y falta
#      `flock`, que ademas sale antes del candado y por eso ni siquiera tiene
#      log publicable propio. Ojo con el porque: lo que falta ahi no son las
#      credenciales —esas vienen de $CONF—, son las FUNCIONES.
#    · una subida que FALLA no cambia el codigo de salida (ver `salir`), pero
#      una SENAL a media subida SI lo cambia: los `trap` de `respaldo.sh`
#      salen con 130/129/143. Esa ventana existia ya en el paso 3 y ahora
#      existe en TODAS las salidas, incluida la buena. Cerrarla exige tocar
#      `respaldo.sh`, que esta auditado: queda escrito, no arreglado.
#    · el `--dry-run` TAMBIEN manda su log, y es a proposito: es la corrida
#      obligatoria la primera vez en cada instancia, o sea justo la que alguien
#      quiere leer desde fuera para saber si quedo bien montada. No toca nada
#      igualmente: lo unico que sale es el relato de que no se hizo nada.
#    · el proceso de FUERA del candado —el que se encuentra otro update en
#      marcha y sale con 75— no escribe ni sube nada: el log publicable es de la
#      corrida que TIENE el candado, y ensuciarselo seria mezclar dos historias.
#      Esto ES cierto desde el 18/08 y antes no lo era: la variable que marca
#      "estoy dentro del candado" se EXPORTABA antes del `flock`, asi que el
#      proceso de fuera se quedaba con ella puesta y su linea de "ya hay otro
#      update en marcha" acababa dentro del archivo que la OTRA corrida sube
#      al bucket. Ahora se le pasa al hijo en la misma linea del `flock`.
# ============================================================================
set -Eeuo pipefail

# ─── Rutas. Se pueden mover SOLO para ensayar fuera de una instancia ───────
CONF="${SPACE_OS_CONF:-/etc/space-os/instancia.env}"
DIR_ESTADO="${SPACE_OS_DIR_ESTADO:-/var/lib/space-os}"
DIR_LOG="${SPACE_OS_DIR_LOG:-/var/log/space-os}"
CANDADO="${SPACE_OS_CANDADO:-/var/lock/space-os-update.lock}"
LOG="$DIR_LOG/update.log"
# El log que SALE del droplet, que NO es `$LOG`: ver AVISO 5. Se puede mover
# como las demas rutas, solo para ensayar fuera de una instancia.
LOG_PUBLICABLE="${SPACE_OS_LOG_PUBLICABLE:-$DIR_LOG/update-publicable.log}"
# El bucket de los LOGS no es el de los respaldos: 90 dias contra 30. Se
# declara aqui, y no con el resto de la configuracion, porque `salir()` puede
# dispararse antes de leer $CONF; si $CONF lo define, gana el suyo — se
# sourcea despues de esta linea.
LOGS_BUCKET="${LOGS_BUCKET:-space-os-logs}"

# ─── Codigos de salida, con nombre ─────────────────────────────────────────
EX_OK=0
EX_CONFIG=1
EX_MIGRACION=2
EX_HISTORIA=3
EX_VUELTA_OK=4
EX_VUELTA_FALLO=5
EX_OCUPADO=75

DRY_RUN=0
# `--simular-fallo-pull` existe para ENSAYAR la politica de reintentos en una
# instancia de verdad sin tener que cortarle la red al droplet. Falla el pull y
# nada mas: no llama a docker, asi que tampoco depende del registry.
SIMULAR_FALLO_PULL=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --simular-fallo-pull) SIMULAR_FALLO_PULL=1 ;;
    # Hasta la linea 109: uso, codigos de salida, la ventana de corte, las
    # claves de instancia.env y la politica de reintentos. Los AVISOS 1-4 no
    # salen en el --help a proposito: son para quien va a TOCAR el script, no
    # para quien lo corre. El corte se movio de 96 a 103 al entrar las claves
    # de Spaces (F3.7), a 109 con LOGS_BUCKET (F3.9) y a 113 el 19/08 al
    # documentar como se lee DATABASE_URL: un rango fijo caduca en cuanto la
    # cabecera crece, y las tres veces se descubrio tarde. Se remide leyendo, no
    # restando — y desde el 19/08 lo comprueba E73 por los dos extremos.
    -h|--help) sed -n '2,121p' "$0"; exit 0 ;;
    *) echo "update: argumento desconocido: $arg (usa --dry-run, --simular-fallo-pull o --help)" >&2; exit "$EX_CONFIG" ;;
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
  # Y al publicable, que es el que viaja al bucket. Solo dentro del candado: el
  # proceso de fuera no tiene que escribir en el log de la corrida que lo tiene.
  if [ "${SPACE_OS_UPDATE_EN_CANDADO:-}" = "1" ]; then printf '%s\n' "$linea" >>"$LOG_PUBLICABLE"; fi
}
# Para la salida de un comando: a la consola y al log LOCAL, nunca al publicable.
# Por aqui entra TODO lo que no puede salir del droplet —la salida cruda del
# runner, de `pg_dump`, de `pg_restore` y de `docker logs`—, y esa es justamente
# la linea que separa los dos archivos. Ver AVISO 5.
eco() { tee -a "$LOG"; }

# ─── El log que sale del droplet (F3.9) ────────────────────────────────────
# Sube SOLO `$LOG_PUBLICABLE`, nunca `$LOG`: ver AVISO 5. Reutiliza el cliente y
# la disciplina de credenciales de `respaldo.sh` (F3.7) en vez de repetirlas —la
# llave no viaja en `argv` ni aqui—, y por eso comprueba antes que ese archivo ya
# se haya sourceado. Ojo con el porque, que estuvo mal escrito: lo que falta si
# el update murio pronto NO son las credenciales —esas vienen de $CONF y ya
# estarian cargadas—, son las FUNCIONES. Por eso `respaldo.sh` se sourcea justo
# despues de $CONF, y por eso este caso ahora se DICE en vez de devolver 0 en
# silencio: un limite que no se lee se descubre tarde.
LOG_SUBIDO=0
subir_log_remoto() {
  local codigo="${1:-0}" instancia destino cliente resultado=0
  # Fuera del candado no hay log de esta corrida que subir.
  [ "${SPACE_OS_UPDATE_EN_CANDADO:-}" = "1" ] || return 0
  # Una sola subida por corrida, aunque `salir` se llamara dos veces.
  [ "$LOG_SUBIDO" = 0 ] || return 0
  LOG_SUBIDO=1
  # El codigo de salida es media respuesta del diagnostico: sin el, el log cuenta
  # que paso pero no con que se quedo el cron. La tarea lo pide expresamente.
  printf '%s  salida: %s\n' "$(date '+%Y-%m-%d %H:%M:%S%z')" "$codigo" >>"$LOG_PUBLICABLE"
  if ! declare -F respaldo_subir_s3cmd >/dev/null 2>&1; then
    # `${RESPALDO_SH:-…}` y no `$RESPALDO_SH` a secas: si el update murio antes
    # de leer $CONF esa variable todavia no existe, y bajo `set -u` este aviso
    # mataria al script en vez de dejarlo salir con su codigo.
    registrar "   log remoto: no hay con que subirlo. El cliente de S3 sale de ${RESPALDO_SH:-respaldo.sh}, que se sourcea justo despues de leer $CONF; si el update se paro antes de eso —o si ese archivo falta— el registro de esta corrida se queda en $LOG_PUBLICABLE y diagnosticarla exige entrar al servidor del owner."
    return 0
  fi
  if [ -z "${SPACES_KEY:-}" ] || [ -z "${SPACES_SECRET:-}" ] || [ -z "$LOGS_BUCKET" ]; then
    registrar "   log remoto NO CONFIGURADO: faltan SPACES_KEY/SPACES_SECRET (o LOGS_BUCKET). El registro de esta corrida se queda en $LOG_PUBLICABLE, o sea que diagnosticarla exige entrar al servidor del owner."
    return 0
  fi
  # Mismo criterio que el respaldo: sin prefijo no se sube, porque la RAIZ del
  # bucket es donde viven los logs de las demas instancias.
  instancia="$(respaldo_instancia)"
  if [ -z "$instancia" ]; then
    registrar "   log remoto: no hay INSTANCIA en la configuracion y el hostname salio vacio, asi que no se sabe a que prefijo del bucket subir. No se sube a la raiz."
    return 1
  fi
  destino="$(printf 's3://%s/%s/%s.log' "$LOGS_BUCKET" "$instancia" "$(date '+%Y-%m-%d-%H%M')")"
  cliente="$(respaldo_cliente)" || {
    registrar "   log remoto: no hay cliente de S3 en el PATH (ni \`s3cmd\` ni \`aws\`). Instala uno: \`apt-get install -y s3cmd\`."
    return 1
  }
  registrar "   log remoto -> $destino (por $cliente)"
  case "$cliente" in
    s3cmd) respaldo_subir_s3cmd "$LOG_PUBLICABLE" "$destino" || resultado=$? ;;
    aws)   respaldo_subir_aws   "$LOG_PUBLICABLE" "$destino" || resultado=$? ;;
  esac
  if [ "$resultado" -eq 0 ]; then
    registrar "   log remoto OK: $destino"
  else
    registrar "LOG REMOTO FALLIDO — el registro de esta corrida se quedo SOLO en este droplet ($LOG_PUBLICABLE). Para diagnosticar esta actualizacion hay que entrar al servidor, que es justo lo que este modelo evita. El motivo esta en la linea de arriba."
  fi
  return "$resultado"
}

salir() {
  local codigo="$1"
  shift || true
  if [ "$#" -gt 0 ]; then registrar "$@"; fi
  # El log sale del droplet SALGA BIEN O MAL, y `salir` es la unica puerta una
  # vez tomado el candado. El `|| true` no es descuido: una subida que falla no
  # puede cambiar el codigo con el que este script se despide, que es lo que el
  # cron mira y lo que distingue "la base pudo cambiar" de "no se toco nada".
  subir_log_remoto "$codigo" || true
  exit "$codigo"
}

# ─── El candado, antes que nada ────────────────────────────────────────────
# `flock -n` no espera: si hay otro update dentro, este se va. `-E 75` le da a
# ese caso un codigo propio para no confundirlo con un fallo del update.
if [ "${SPACE_OS_UPDATE_EN_CANDADO:-}" != "1" ]; then
  if ! command -v flock >/dev/null 2>&1; then
    salir "$EX_CONFIG" "ERROR update: falta \`flock\` (paquete util-linux). Sin candado no se corre: dos updates a la vez pueden migrar la misma base en paralelo."
  fi
  codigo_candado=0
  # La marca va en la MISMA linea del `flock`, no en un `export` de antes.
  # Con el `export`, este proceso —el de FUERA— se quedaba tambien con la
  # variable a 1, y entonces su `registrar` de aqui abajo cumplia el guard de
  # la bitacora y escribia en `$LOG_PUBLICABLE`… que es el de la corrida que SI
  # tiene el candado. Esa linea viajaba al bucket dentro del objeto de la otra
  # corrida: dos historias mezcladas, que es justo lo que este diseno evita.
  # Un prefijo de asignacion solo entra en el entorno del comando que lanza
  # —`flock` es un binario, no una funcion— y el hijo lo hereda igual. E59.
  SPACE_OS_UPDATE_EN_CANDADO=1 flock -n -E "$EX_OCUPADO" "$CANDADO" "$0" "$@" || codigo_candado=$?
  if [ "$codigo_candado" -eq "$EX_OCUPADO" ]; then
    registrar "update: ya hay otro update en marcha (candado $CANDADO). Este no hace nada."
  fi
  exit "$codigo_candado"
fi

# ─── El log de ESTA corrida, en limpio ─────────────────────────────────────
# `$LOG` se acumula desde que la instancia nacio; el publicable es solo esta
# corrida, y por eso se vacia AQUI —ya dentro del candado, para no vaciarle el
# suyo a un update que este a media faena—. Subir el acumulado seria mandar al
# bucket, cada noche, todo lo que la instancia ha registrado desde siempre.
: >"$LOG_PUBLICABLE"

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

# `respaldo.sh` se SOURCEA: trae la subida a Spaces y la poda local (AVISO 4),
# y tambien el cliente con el que `salir()` manda el log al bucket (AVISO 5).
# Se resuelve al lado de este archivo —en una instancia los dos viven en
# /opt/space-os— y la variable de entorno existe para poder ensayarlo fuera.
# Si falta, se para AQUI: antes del pull, antes del respaldo y antes de la base.
#
# Y va JUSTO DESPUES de $CONF, ni antes ni mas abajo, por dos razones medidas:
#   · antes no puede ir: `respaldo.sh` deriva SPACES_ENDPOINT de SPACES_REGION
#     EN EL MOMENTO de sourcearse, asi que una instancia con SPACES_REGION=sfo3
#     en su configuracion acabaria hablando con el endpoint de nyc3.
#   · mas abajo tampoco: sourcearlo al final del bloque de comprobaciones
#     dejaba DOCE `salir "$EX_CONFIG"` por encima suyo sin nada con que subir
#     —`subir_log_remoto` se rendia en su `declare -F`, y ademas en silencio—, y
#     esos doce son precisamente los fallos de una instancia mal aprovisionada:
#     la clase que uno mas quiere diagnosticar sin entrar al servidor del owner.
#     Desde aqui suben NUEVE de esos doce. Los tres que siguen sin poder son los
#     que no tienen con que: falta `flock` (que ademas cae fuera del candado y no
#     escribe ni el publicable), falta el propio $CONF, y falta este mismo
#     archivo. Esos tres lo DICEN. "Salga bien o mal" no admitia doce
#     excepciones; tres que son imposibles por definicion, y escritas, si. E60.
RESPALDO_SH="${SPACE_OS_RESPALDO_SH:-$(dirname "$0")/respaldo.sh}"
[ -f "$RESPALDO_SH" ] || salir "$EX_CONFIG" "ERROR update: falta $RESPALDO_SH. Es donde viven la subida del respaldo a Spaces y la poda del disco; sin el, la instancia se actualizaria sin respaldo fuera del droplet y llenando el disco. Nada se toco."
# shellcheck disable=SC1090
. "$RESPALDO_SH"

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
# Una espera por reintento del pull, y el numero de reintentos sale de cuantas
# haya: "1 5 30" son tres reintentos. Vacio = ninguno.
PULL_ESPERAS="${PULL_ESPERAS:-1 5 30}"
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
# UN SOLO parseo de la URL de conexion, y de el cuelgan sus DOS consumidores:
# la linea que se PUBLICA (`destino_de_url`, primera de todo log que viaja al
# bucket desde F3.9) y el `--dbname` que llega a ARGV (`PG_URL_SEGURA`, visible
# con `ps` para cualquier proceso del droplet). Hasta el 19/08 eran dos
# recortes distintos a 36 lineas uno del otro, y cada uno estaba mal a su
# manera: el del log quitaba la consulta ANTES de cortar por el ultimo `@`, asi
# que una clave con `?` decapitaba la cadena y publicaba `spaces:cl`; el de
# argv cortaba por el PRIMER `@`, y con eso dejaba media contrasena en `ps` y
# una URL que no conecta. Ojo con el porque, que este comentario tuvo AL REVES
# hasta el 19/08: cortar por el primer `@` SI es lo que hace libpq —medido
# contra `psql` 16, `postgresql://spaces:p@ssw0rd@host/spaces` se queja de
# «could not translate host name "ssw0rd@host"»—. La regla implementada, la del
# ULTIMO `@`, es la de WHATWG y la de `pg-connection-string`, o sea la del
# parser de la app y del runner de migraciones. Y esa discrepancia entre los dos
# clientes NO es un detalle: es exactamente lo que obliga a sacar la clave de la
# URL y mandarla por el entorno, en vez de confiar en que los dos recorten
# igual. Dos implementaciones del mismo recorte se separan otra vez al
# siguiente cambio; por eso ahora hay una.
#
# Las reglas, que son las de un parser de URL y no las de un `sed`:
#   · usuario y clave se separan del host por el ULTIMO `@`, no por el primero;
#   · la clave puede llevar `@`, `/`, `?`, `#`, `%XX` o barra invertida, puede
#     estar ausente, y puede no haber ni usuario ni `@` ninguno;
#   · el usuario NO puede llevar `/`, `?` ni `#` sin codificar, y el host tiene
#     que parecer un host: eso es lo que distingue "se entendio la cadena" de
#     "se le dio un tijeretazo";
#   · y la CONSULTA tambien puede llevar credencial: `?password=` y
#     `?sslpassword=` son parametros de libpq y hay que separarlos igual que el
#     `userinfo`. Los demas parametros de la consulta se conservan INTACTOS —ver
#     `quitar_credencial_de_consulta`, abajo—.
# Si algo de eso no cuadra, FALLA CERRADO: devuelve 1 y no se publica NADA de
# esa cadena, porque lo que no se entiende bien puede ser la contrasena entera.
# Cortar de mas esconde el host y se diagnostica peor; cortar de menos manda la
# llave de la base a un objeto de un bucket. Se elige lo primero. Mismo
# criterio —y mismas palabras— que `destinoSeguro()` en
# `scripts/migrar.mjs:225-232`, que alli se puede escribir con `new URL()`.
#
# Queda una ambiguedad que ninguna regla resuelve: una URL SIN credencial cuya
# CONSULTA lleve un `@` (`…/spaces?application_name=space-os@demo`, que libpq
# acepta) es indistinguible de una con clave rara, y se lee como si tuviera
# credencial. Lo que pasa despues depende de si la URL lleva PUERTO, y hasta el
# 19/08 aqui y en el README se afirmaba solo la mitad buena («se para con
# salida 1»):
#   · SIN puerto (`…/spaces?opt=a@b`): lo que queda delante del `@` lleva `/` y
#     `?`, no pasa por usuario, se falla cerrado y el update se para con 1.
#   · CON puerto (`…:5433/spaces?opt=a@b`): `localhost` cuela como usuario y `b`
#     cuela como host. NO se para: publica un `base=b` falso y muere cuatro
#     pasos mas adelante en el respaldo, como `BACKUP VACIO`. Un fallo de
#     PARSEO disfrazado de fallo de RESPALDO manda a una persona a mirar el
#     sitio equivocado; por eso ese mensaje dice ahora que se mire el `base=`
#     antes que `pg_dump`.
# Cerrar el caso con puerto exige distinguir "usuario" de "host" sin poder, y
# queda fuera de alcance a proposito. Lo fija E78: si alguien lo cambia, se
# entera.
URL_ESQUEMA=''
URL_USUARIO=''
URL_CLAVE_CRUDA=''
URL_HAY_CLAVE=0
URL_DESTINO=''
URL_DESTINO_COMPLETO=''
# Lo que sale de la CONSULTA: la parte que si puede ir a argv, y las dos
# credenciales que libpq admite ahi dentro.
URL_DESTINO_SIN_CLAVE=''
URL_CONSULTA_CLAVE=''
URL_HAY_CONSULTA_CLAVE=0
URL_CONSULTA_SSLCLAVE=''
URL_HAY_CONSULTA_SSLCLAVE=0

# De `host[:puerto][/base][?consulta]` quita SOLO los parametros que llevan
# credencial, y deja el resto de la consulta byte a byte como estaba.
#
# Cuales llevan credencial: `password` —la contrasena de Postgres— y
# `sslpassword` —la frase de paso de la llave del certificado de cliente—. Son
# los dos unicos parametros de libpq cuyo VALOR es un secreto. `passfile` y
# `sslkey` son RUTAS a un archivo, no el secreto, y quitarlas cambiaria como se
# conecta.
#
# Y lo que NO se toca importa mas que lo que se quita: `sslmode`, `sslrootcert`,
# `options`, `application_name`, `connect_timeout` o `target_session_attrs`
# deciden COMO se conecta. Quitar la consulta entera —la solucion facil— dejaria
# sin poder actualizarse a instancias que hoy funcionan, y eso es peor que la
# fuga que se cierra. Lo fija E77, con la clave EN MEDIO de los otros seis.
#
# Si no aparece ningun parametro de credencial la cadena NO se reconstruye:
# vuelve tal cual entro. Asi el caso normal —la inmensa mayoria de las
# instancias, que no llevan `password=` en la consulta— no puede romperse por
# un error al volver a pegar los `&`.
quitar_credencial_de_consulta() {
  local completo="$1" base consulta par nombre resto nueva=''
  URL_DESTINO_SIN_CLAVE="$completo"
  URL_CONSULTA_CLAVE=''; URL_HAY_CONSULTA_CLAVE=0
  URL_CONSULTA_SSLCLAVE=''; URL_HAY_CONSULTA_SSLCLAVE=0
  case "$completo" in *'?'*) ;; *) return 0 ;; esac
  base="${completo%%'?'*}"
  consulta="${completo#*'?'}"
  resto="$consulta"
  while [ -n "$resto" ]; do
    par="${resto%%&*}"
    case "$resto" in *'&'*) resto="${resto#*&}" ;; *) resto='' ;; esac
    nombre=''
    case "$par" in *=*) nombre="${par%%=*}" ;; esac
    # Los nombres van EXACTAMENTE como los escribe libpq, en minusculas y sin
    # tolerancia: `?PASSWORD=` en mayusculas no es un parametro de conexion —
    # libpq lo rechaza con «invalid URI query parameter»—, asi que esa URL no ha
    # funcionado nunca en ninguna instancia y aqui no se le inventa un
    # significado. Limite conocido y aceptado: en ese caso el parametro SI viaja
    # en argv, y el update muere en el respaldo con el mensaje del propio libpq.
    case "$nombre" in
      password)    URL_HAY_CONSULTA_CLAVE=1;    URL_CONSULTA_CLAVE="${par#*=}";    continue ;;
      sslpassword) URL_HAY_CONSULTA_SSLCLAVE=1; URL_CONSULTA_SSLCLAVE="${par#*=}"; continue ;;
    esac
    if [ -z "$nueva" ]; then nueva="$par"; else nueva="$nueva&$par"; fi
  done
  if [ "$URL_HAY_CONSULTA_CLAVE" = 1 ] || [ "$URL_HAY_CONSULTA_SSLCLAVE" = 1 ]; then
    if [ -n "$nueva" ]; then URL_DESTINO_SIN_CLAVE="$base?$nueva"; else URL_DESTINO_SIN_CLAVE="$base"; fi
  fi
  return 0
}
partir_url() {
  local url="$1" resto credencial usuario destino
  URL_ESQUEMA=''; URL_USUARIO=''; URL_CLAVE_CRUDA=''; URL_HAY_CLAVE=0
  URL_DESTINO=''; URL_DESTINO_COMPLETO=''
  quitar_credencial_de_consulta ''
  # Sin `esquema://` no es una URL: puede ser una cadena `clave=valor` de libpq,
  # que lleva la contrasena en mitad del texto y no tiene nada que recortar.
  case "$url" in *://*) ;; *) return 1 ;; esac
  URL_ESQUEMA="${url%%://*}"
  case "$URL_ESQUEMA" in ''|*[!a-zA-Z0-9+.-]*) URL_ESQUEMA=''; return 1 ;; esac
  resto="${url#*://}"
  case "$resto" in
    *@*)
      # `%@*` quita el sufijo MAS CORTO que casa con `@*`: corta por el ULTIMO
      # `@`. `##*@` se queda con lo que va detras de ese mismo `@`.
      credencial="${resto%@*}"
      URL_DESTINO_COMPLETO="${resto##*@}"
      usuario="${credencial%%:*}"
      case "$credencial" in *:*) URL_HAY_CLAVE=1; URL_CLAVE_CRUDA="${credencial#*:}" ;; esac
      # Un usuario con `/`, `?` o `#` significa que ese `@` no separaba ninguna
      # credencial, asi que no se sabe donde empieza el host ni si lo que se
      # tomo por clave lo es. No se adivina: no se publica.
      case "$usuario" in ''|*[!a-zA-Z0-9._~%+-]*) URL_ESQUEMA=''; URL_CLAVE_CRUDA=''; URL_HAY_CLAVE=0; URL_DESTINO_COMPLETO=''; return 1 ;; esac
      URL_USUARIO="$usuario"
      ;;
    *) URL_DESTINO_COMPLETO="$resto" ;;
  esac
  # `host[:puerto][/base]`, ya sin consulta ni fragmento: esto es lo unico de la
  # cadena que se puede publicar.
  destino="${URL_DESTINO_COMPLETO%%[?#]*}"
  if ! printf '%s' "$destino" | grep -Eq '^(\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9._~%+-]+)(:[0-9]+)?(/[^/?#]*)?$'; then
    URL_ESQUEMA=''; URL_USUARIO=''; URL_CLAVE_CRUDA=''; URL_HAY_CLAVE=0; URL_DESTINO_COMPLETO=''
    return 1
  fi
  URL_DESTINO="$destino"
  # La credencial tambien puede venir en la consulta, y se separa AQUI: en el
  # unico parseo, para que no vuelvan a existir dos recortes que se
  # desincronizan al siguiente cambio.
  quitar_credencial_de_consulta "$URL_DESTINO_COMPLETO"
  return 0
}

# `host:puerto/base` de una URL de conexion, SIN credenciales — este valor se
# imprime, y es la primera linea del log que viaja al bucket. Se llama siempre
# dentro de `$(…)`, o sea en un subshell: las globales de `partir_url` no se
# escapan de ahi. Lo fijan E62 a E72.
destino_de_url() {
  if partir_url "$1"; then printf '%s' "$URL_DESTINO"; else printf '%s' '(url no parseable)'; fi
}

# Percent-decoding: en una URL un '%' literal va como %25, asi que convertir
# cada '%' en '\x' y pasarlo por `printf '%b'` es exacto. La barra invertida se
# DUPLICA antes —`%b` la leeria como escape y corromperia la clave—, y con eso
# desaparece la excepcion que antes dejaba la URL entera en argv "porque
# decodificarla podria corromperla": una clave visible en `ps` ya no es una
# salida aceptable.
decodificar_porciento() {
  local s
  case "$1" in
    *%*) s="${1//\\/\\\\}"; printf '%b' "${s//%/\\x}" ;;
    *)   printf '%s' "$1" ;;
  esac
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
# red, asi que se parte: usuario y destino en argv, la clave por PGPASSWORD.
#
# El recorte es el MISMO que el del log —`partir_url`, arriba—, y no una copia:
# cuando eran dos, uno cortaba por el ultimo `@` y el otro por el primero, y el
# de argv era el peor de los dos. Medido en `argv` real antes de unificarlos:
# de `spaces:p@ssw0rd@localhost:5433/spaces` salia
# `--dbname=postgresql://spaces@ssw0rd@localhost:5433/spaces` con PGPASSWORD=`p`
# —media contrasena en `ps` y una URL que libpq tampoco entiende—, y de
# `spaces:pa/ss@…` salia la URL ENTERA, con la clave dentro, porque el guard
# `[^@/]+@` ni dejaba entrar al bloque.
#
# Y hasta el 19/08 quedaba la otra mitad: el `userinfo` se desarmaba pero la
# CONSULTA se pasaba entera, asi que
# `postgresql://spaces@host:5433/spaces?password=secreto` viajaba a argv con la
# contrasena dentro. No es una forma inventada —libpq la acepta, medido con
# `psql` 16— y ademas es la que GANA: con una clave en el `userinfo` y otra en
# `?password=`, libpq y `pg-connection-string` 2.14.0 usan las dos la de la
# consulta (medido contra un Postgres real: con `userinfo` mala y consulta
# buena la conexion entra; al reves, «password authentication failed»). Por eso
# la de la consulta pisa a la del `userinfo` tambien aqui: elegir la otra
# arreglaria la fuga a cambio de un respaldo que ya no corre.
#
# `PGPASSWORD` es la de MENOR precedencia de las tres —userinfo, consulta y
# entorno—: solo la mira libpq cuando la URL no trae ninguna. Por eso hay que
# quitarlas de la URL: no basta con exportar la buena.
PG_URL_SEGURA="$DATABASE_URL"
PG_CLAVE=""
# `reescribir` no es lo mismo que "hay clave": una consulta con `?password=` y el
# valor VACIO tambien obliga a reescribir. Si se decidiera mirando `$PG_CLAVE`,
# `postgresql://spaces:SECRETO@host/db?password=` acabaria con PG_CLAVE vacia —la
# consulta pisa al userinfo, y esta vacia— y la URL ENTERA, con SECRETO dentro,
# pasaria a argv. Medido al escribir esto. Lo fija E79.
reescribir=0
if partir_url "$DATABASE_URL"; then
  if [ "$URL_HAY_CLAVE" = 1 ] && [ -n "$URL_CLAVE_CRUDA" ]; then
    PG_CLAVE="$(decodificar_porciento "$URL_CLAVE_CRUDA")"
    reescribir=1
  fi
  # La de la consulta manda sobre la del `userinfo`, como en los dos clientes.
  if [ "$URL_HAY_CONSULTA_CLAVE" = 1 ]; then
    PG_CLAVE="$(decodificar_porciento "$URL_CONSULTA_CLAVE")"
    reescribir=1
  fi
  # `sslpassword` —la frase de paso de la llave del certificado de cliente— es
  # credencial igual y sale de la URL igual, pero NO hay por donde reenviarla:
  # libpq no tiene variable de entorno para ella. Medido el 19/08 sobre el
  # binario de `postgres:16-alpine`: dentro de `libpq.so.5` estan `PGSSLMODE`,
  # `PGSSLKEY`, `PGSSLCERT` y `PGSSLROOTCERT`, y `PGSSLPASSWORD` **no aparece ni
  # una vez**. Este bloque se escribio primero usandola —es el error facil:
  # parece que tiene que existir, y "funciona" porque una variable que nadie lee
  # tampoco estorba—. Asi que se DESCARTA, y queda dicho en el log: si la llave
  # del cliente esta cifrada, `pg_dump` va a pedir la frase por una consola que
  # no existe, el respaldo fallara y el update se parara en BACKUP VACIO **sin
  # tocar nada** — que es el lado bueno de equivocarse. La salida para esa
  # instancia es dejar esa llave sin cifrar, que es lo que necesita cualquier
  # proceso desatendido. El aviso NO dice el valor: solo que estaba.
  if [ "$URL_HAY_CONSULTA_SSLCLAVE" = 1 ]; then
    registrar "AVISO update: DATABASE_URL trae \`sslpassword\` en la consulta. Se quita de la URL —en argv seria visible con \`ps\` para cualquier proceso del droplet— y NO se puede reenviar: PGSSLPASSWORD no existe en libpq 16 (medido sobre libpq.so.5). Si la llave del certificado de cliente esta cifrada, el respaldo va a fallar y el update se parara antes de tocar nada; la salida es dejar esa llave sin cifrar."
    reescribir=1
  fi
  # La URL solo se REESCRIBE si habia algo que quitar. Si no habia credencial
  # en ningun sitio (peer, trust o .pgpass) pasa tal cual, byte a byte: no hay
  # forma de estropear la consulta de una instancia que hoy funciona.
  if [ "$reescribir" = 1 ]; then
    PG_URL_SEGURA="$URL_ESQUEMA://${URL_USUARIO:+$URL_USUARIO@}$URL_DESTINO_SIN_CLAVE"
  fi
else
  # Falla CERRADO. La alternativa —pasarla entera a `--dbname`— es exactamente
  # la fuga que esta tarea quita, y encima no funcionaria: si aqui no se pudo
  # separar la clave, libpq tampoco va a poder.
  salir "$EX_CONFIG" "ERROR update: no se puede interpretar DATABASE_URL como URL de conexion; base=(url no parseable). No se publica ni un trozo de esa cadena —lo que no se entiende puede ser la contrasena— y sin separarla no se puede respaldar sin dejarla en argv, visible con \`ps\` para cualquier proceso del droplet. Nada se toco. La forma esperada es esquema://[usuario[:clave]@]host[:puerto]/base con la clave PERCENT-ENCODED: %40 por @, %2F por /, %3F por ? y %5C por la barra invertida. Sin codificar cada cliente se rompe con un caracter distinto —libpq corta por el PRIMER @ y no admite / en la clave; el parser de la app y del runner no admite / ? ni #— y este archivo, ademas, lo sourcea bash. Revisa DATABASE_URL en $CONF o en $ENV_APP."
fi

# `pg_dump`/`pg_restore` siempre por aqui: un solo sitio decide como viaja la
# clave. `$binario` se pasa como argumento para respetar PG_DUMP/PG_RESTORE.
#
# Las dos formas cortas de escribir esto estan las dos MAL:
#   · `env PGPASSWORD="$PG_CLAVE" "$binario" …` deja la asignacion en el ARGV
#     DE `env`, o sea otra vez la contrasena en `ps` — justo la fuga que este
#     bloque existe para cerrar. El prefijo de asignacion de bash no: entra en el
#     entorno del hijo y no aparece en ninguna linea de comandos. Se escribio con
#     `env` mientras se hacia este cambio y el arnes NO lo vio: los dobles
#     reciben su propio argv, no el del proceso que los lanza.
#   · un `PGPASSWORD="$PG_CLAVE"` incondicional "por si acaso" tampoco: una
#     variable VACIA no es lo mismo que no definirla —libpq leeria una
#     contrasena vacia en vez de caer a `.pgpass`— y ahi se pierden las
#     instancias que se autentican por `peer`, `trust` o `.pgpass`.
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

# ─── El pull, con reintentos y espera creciente ────────────────────────────
# La red de un droplet parpadea y un registry devuelve un 500 de vez en cuando;
# eso no puede dejar a una instancia sin actualizar. Y el pull es el ultimo
# sitio donde rendirse sale GRATIS: aqui todavia no hay respaldo, ni contenedor
# parado, ni una sola sentencia contra la base. Por eso los reintentos viven en
# este paso y no mas abajo — abajo, en las migraciones, el limite es CERO.
pull_una_vez() {
  if [ "$SIMULAR_FALLO_PULL" = 1 ]; then
    registrar "   simulacion: el pull falla a proposito (--simular-fallo-pull); ni se llama a docker."
    return 1
  fi
  docker pull "$IMAGEN" 2>&1 | eco
}

pull_con_reintentos() {
  local esperas espera i=0 n
  read -r -a esperas <<<"$PULL_ESPERAS"
  n=${#esperas[@]}
  if pull_una_vez; then return 0; fi
  while [ "$i" -lt "$n" ]; do
    espera="${esperas[$i]}"
    i=$((i + 1))
    registrar "1 · el pull no llego; reintento $i/$n dentro de $espera s"
    sleep "$espera"
    if pull_una_vez; then
      registrar "1 · pull OK en el reintento $i/$n"
      return 0
    fi
  done
  return 1
}

registrar "1 · pull $IMAGEN"
if ! pull_con_reintentos; then
  # "Se queda como estaba" es literal, y se comprueba contando llamadas en
  # `pruebas-update.sh` (E33/E34): ni pg_dump, ni runner, ni `docker run`.
  salir "$EX_CONFIG" "ERROR update: fallo el \`docker pull\` de $IMAGEN, y tampoco llego en los intentos siguientes (esperas de ${PULL_ESPERAS:-ninguna} s). La instancia se queda EXACTAMENTE como estaba: no se respaldo, no se migro y no se toco el contenedor."
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
  # El `base=` va DELANTE de "revisa pg_dump" a proposito. Una URL ambigua —una
  # consulta con un `@` dentro— no se para: se recorta mal, apunta a un host
  # inventado y el respaldo muere aqui. Sin esta frase, un fallo de PARSEO se
  # lee como un fallo de RESPALDO y manda a mirar el sitio equivocado.
  salir "$EX_CONFIG" "BACKUP VACIO — abortado. El archivo de 0 bytes se borro para que no se confunda con un respaldo bueno. No se toco ni la base ni el contenedor. Mira primero base=$(destino_de_url "$DATABASE_URL"): si esa NO es la base de esta instancia, lo que fallo fue interpretar DATABASE_URL —no el respaldo— y hay que revisar la URL en $CONF. Si si lo es, revisa $PG_DUMP contra ella."
fi
registrar "   respaldo de $(wc -c <"$BK") bytes"

# La poda va DESPUES de comprobar que el dump nuevo es bueno: si se podara antes,
# un `pg_dump` que luego falla habria tirado un respaldo viejo a cambio de nada.
# Y el de esta corrida esta entre los que se conservan, que es lo que la vuelta
# atras necesita dentro de los proximos minutos. Esta ultima frase era FALSA
# hasta el 18/08 y por eso vale la pena dejarla escrita: la poda ordenaba por
# NOMBRE, asi que un `spaces_x.dump` cualquiera en el directorio la convertia en
# "borra el dump que acabas de hacer". Ahora ordena por la fecha del archivo
# (`respaldo.sh`, `respaldo_local_podar`) y la frase se sostiene.
#
# Va en un `if !` y no como llamada suelta, y eso NO es estilo: una llamada
# suelta corre con el `set -e` de este script activo dentro de la funcion, asi
# que un `rm` que fallara —directorio de solo lectura, un archivo con el bit
# inmutable— mataria el update AQUI, entre el respaldo y las migraciones, con un
# codigo de salida a secas y sin una linea que lo explicara. Llenar el disco es
# un problema de manana; no actualizar es uno de hoy.
if ! respaldo_local_podar "$DIR_RESPALDOS"; then
  registrar "   AVISO: la poda de $DIR_RESPALDOS no se pudo completar. El update SIGUE; el disco hay que mirarlo."
fi

# La subida NO puede detener el update: el respaldo local ya existe y con el se
# vuelve atras. Pero tampoco puede pasar desapercibida — una instancia que lleva
# semanas sin subir nada es exactamente la que pierde los datos el dia que el
# droplet muere. Por eso: se sigue, y se escribe la frase que se busca con grep.
if ! respaldo_remoto_subir "$BK"; then
  registrar "RESPALDO REMOTO FALLIDO — el dump se quedo SOLO en este droplet ($BK). El update SIGUE porque con el respaldo local se puede volver atras, pero si esta maquina desaparece, este respaldo desaparece con ella. El motivo esta en la linea de arriba."
fi

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
