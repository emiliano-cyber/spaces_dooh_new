#!/usr/bin/env bash
# ============================================================================
#  pruebas-respaldo-diario.sh — el arnes de `respaldo-diario.sh`.
# ----------------------------------------------------------------------------
#  POR QUE EXISTE
#  --------------
#  `respaldo-diario.sh` es el guion que saca los datos de la instancia de su
#  propio droplet TODOS LOS DIAS, sin depender de que salga una version nueva.
#  Lo que prueba este arnes no es que funcione: es que **cuando falla, no
#  miente**. Las tres formas de mentir de un guion de respaldo son, en orden de
#  gravedad:
#
#    1. subir un archivo VACIO y decir OK  -- el peor: al restaurar no hay nada,
#       y el dia que se descubre es el dia que hacia falta;
#    2. borrar el dump local porque "ya se subio" cuando la subida fallo;
#    3. salir con 0 cuando el respaldo no salio del droplet, que en un cron es
#       exactamente igual a no haber corrido.
#
#  Cada una tiene su escenario aqui abajo.
#
#  Uso:
#    bash infra/scripts/pruebas-respaldo-diario.sh
#
#  NO sale a la red, NO habla con DigitalOcean Spaces, NO toca ninguna base de
#  datos y NO toca ningun servidor. Monta dobles POSIX de `pg_dump`, `s3cmd` y
#  `hostname` en un PATH propio y observa que se les pide. Eso es criterio de
#  aceptacion, no un detalle.
#
#  Y TARDA SEGUNDOS, a proposito. `pruebas-update.sh` tarda 15 minutos y eso
#  hoy es un problema real de este repositorio: un arnes que nadie corre porque
#  no cabe en la cabeza de una tarde no defiende nada. Aqui no hay barrido de
#  mutantes ni contenedores; los dobles son cuatro lineas cada uno.
# ============================================================================
set -uo pipefail

# La entrada estandar se CIERRA para todo el arnes. Mismo motivo que en
# `pruebas-provision.sh:33`: un doble que drene stdin con un `cat` y herede una
# entrada que nadie cierra deja el arnes colgado sin imprimir una linea.
exec </dev/null

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
GUION="${GUION_RESPALDO_DIARIO:-$RAIZ/infra/scripts/respaldo-diario.sh}"
# Sobreescribible SOLO para poder mutarlo: R7 y R12 leen este archivo, y sin una
# forma de apuntarlos a una copia no hay manera de demostrar que muerden sin
# tocar el `update.sh` de verdad, que esta desplegado. Copiar el arnes a /tmp no
# vale: `RAIZ` sale de `dirname $0`, asi que la copia pierde todo lo demas y los
# 46 fallos de alrededor tapan el unico que importa.
UPDATE_SH="${GUION_UPDATE:-$RAIZ/infra/scripts/update.sh}"
CONEXION_SH="$RAIZ/infra/scripts/conexion-pg.sh"

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

# La contrasena de mentira. Se elige un literal inconfundible y no una cadena
# cualquiera PORQUE la comprobacion que importa es por AUSENCIA: que no aparezca
# en el argv de `pg_dump` ni en el log. Con una contrasena como `secreto` un
# `grep` daria falsos positivos contra cualquier prosa del guion.
CLAVE='CLAVEQUENODEBESALIR'

# ─── Los dobles ─────────────────────────────────────────────────────────────
montar_dobles() {
  mkdir -p "$BIN"

  # `pg_dump`. Apunta DOS lineas por llamada y esa separacion es el corazon del
  # escenario R7: una con el argv y otra con las variables de entorno PG*. Si la
  # contrasena viajara en argv apareceria en la primera, que es justo lo que
  # `ps` enseña a cualquier usuario del droplet.
  cat >"$BIN/pg_dump" <<'FIN'
#!/usr/bin/env bash
printf 'pg_dump-argv %s\n' "$*" >>"$REG_LLAMADAS"
printf 'pg_dump-env PGPASSWORD=%s PGSSLMODE=%s PGAPPNAME=%s\n' \
  "${PGPASSWORD-(sin definir)}" "${PGSSLMODE-(sin definir)}" "${PGAPPNAME-(sin definir)}" >>"$REG_LLAMADAS"
destino=''
for a in "$@"; do
  case "$a" in --file=*) destino="${a#--file=}" ;; esac
done
if [ -n "$destino" ]; then
  # `D_DUMP_BYTES` decide el tamano. Con 0 se crea el archivo VACIO, que es
  # exactamente lo que hace un `pg_dump` que muere a media conexion y el caso
  # que el guion tiene que cazar.
  if [ "${D_DUMP_BYTES:-64}" -gt 0 ]; then
    head -c "${D_DUMP_BYTES:-64}" /dev/zero >"$destino"
  else
    : >"$destino"
  fi
fi
exit "${D_DUMP_CODIGO:-0}"
FIN

  # `s3cmd`. El unico cliente de S3 que se monta: si el guion intentara usar
  # `aws` no lo encontraria y el escenario lo diria.
  cat >"$BIN/s3cmd" <<'FIN'
#!/usr/bin/env bash
printf 's3cmd %s\n' "$*" >>"$REG_LLAMADAS"
if [ "${D_S3_CODIGO:-0}" != "0" ]; then
  echo "ERROR: S3 error: 403 (AccessDenied): Access Denied"
  exit "${D_S3_CODIGO}"
fi
echo "upload: OK"
exit 0
FIN

  # `hostname` da el prefijo del bucket cuando no hay `INSTANCIA`. Se dobla para
  # que el nombre de la maquina de quien corre las pruebas no entre en el
  # resultado: sin esto, el arnes pasa o falla segun el portatil.
  cat >"$BIN/hostname" <<'FIN'
#!/usr/bin/env bash
echo 'instancia-de-prueba'
FIN

  chmod +x "$BIN"/*
}

preparar() {
  RAIZ_TMP="$(mktemp -d)"
  BIN="$RAIZ_TMP/bin"
  REG_LLAMADAS="$RAIZ_TMP/llamadas"
  SALIDA="$RAIZ_TMP/salida"
  CONF="$RAIZ_TMP/instancia.env"
  DIR_ESTADO="$RAIZ_TMP/estado"
  DIR_LOG="$RAIZ_TMP/log"
  DIR_RESPALDOS="$DIR_ESTADO/respaldos"
  mkdir -p "$DIR_ESTADO" "$DIR_LOG"
  : >"$REG_LLAMADAS"
  export REG_LLAMADAS
  montar_dobles
  RUTA_ANTES="$PATH"
  PATH="$BIN:$PATH"
  unset D_DUMP_BYTES D_DUMP_CODIGO D_S3_CODIGO

  # La configuracion de la instancia, tal cual la lee el guion: el mismo archivo
  # que `update.sh` sourcea en su `:841`.
  cat >"$CONF" <<FIN
DATABASE_URL=postgresql://spaces:$CLAVE@127.0.0.1:5432/spaces
SPACES_KEY=llave-de-mentira
SPACES_SECRET=secreto-de-mentira
SPACES_BUCKET=bucket-de-mentira
SPACES_REGION=region0
INSTANCIA=instancia-de-prueba
FIN

  export SPACE_OS_CONF="$CONF"
  export SPACE_OS_DIR_ESTADO="$DIR_ESTADO"
  export SPACE_OS_DIR_LOG="$DIR_LOG"
  export SPACE_OS_RESPALDO_SH="$RAIZ/infra/scripts/respaldo.sh"
  export SPACE_OS_CONEXION_PG_SH="$CONEXION_SH"
}

limpiar() {
  PATH="$RUTA_ANTES"
  rm -rf "$RAIZ_TMP"
}

# Corre el guion y guarda codigo y salida.
#
#   correr [VAR=valor | -u VAR ...] -- <argumentos del guion>
#
# El entorno va por `env` y NO por un subshell: con las aserciones dentro de
# `( … )` los contadores se quedarian en el subshell y el arnes imprimiria los
# fallos saliendo con 0. Es el defecto 34 de `pruebas-provision.sh:253-258`,
# escrito aqui para no repetirlo.
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
codigo_es() { if [ "$CODIGO" = "$1" ]; then bien; else mal "codigo esperado $1, real $CODIGO"; fi; }
codigo_no_es() { if [ "$CODIGO" != "$1" ]; then bien; else mal "el codigo NO deberia ser $1"; fi; }
dice() { if grep -qF -- "$1" "$SALIDA"; then bien; else mal "la salida no dice: $1"; fi; }
calla() { if grep -qF -- "$1" "$SALIDA"; then mal "la salida NO deberia decir: $1"; else bien; fi; }
hubo() { if grep -qF -- "$1" "$REG_LLAMADAS"; then bien; else mal "no se llamo: $1"; fi; }
no_hubo() { if grep -qF -- "$1" "$REG_LLAMADAS"; then mal "no deberia haberse llamado: $1"; else bien; fi; }
hubo_regex() { if grep -qE -- "$1" "$REG_LLAMADAS"; then bien; else mal "ninguna llamada casa con: $1"; fi; }

# Cuantos dumps quedan en el directorio de respaldos.
dumps_son() {
  local n
  n="$(find "$DIR_RESPALDOS" -maxdepth 1 -type f -name 'spaces_*.dump' 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$n" = "$1" ]; then bien; else mal "esperaba $1 dump(s) en disco, hay $n"; fi
}

# ============================================================================
#  R1 · EL CAMINO FELIZ
# ============================================================================
escenario 'R1 · hace el dump, lo sube y poda — y las tres cosas se leen en el log'
preparar
correr --
codigo_es 0
hubo 'pg_dump-argv'
hubo_regex 's3cmd .*put .*spaces_.*\.dump'
dice 'respaldo remoto OK'
dumps_son 1
limpiar

escenario 'R1b · el dump va al directorio de respaldos de la instancia, con formato custom'
preparar
correr --
hubo '--format=custom'
hubo_regex 'pg_dump-argv .*--file=.*/respaldos/spaces_[0-9]{8}_[0-9]{6}\.dump'
limpiar

escenario 'R1c · la ruta remota lleva el prefijo de la instancia, nunca la raiz del bucket'
preparar
correr --
hubo_regex 's3://bucket-de-mentira/instancia-de-prueba/[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4}\.dump'
limpiar

# ============================================================================
#  R2 · DUMP DE 0 BYTES — el escenario que mas importa
# ----------------------------------------------------------------------------
#  Subir un respaldo vacio es PEOR que no subir ninguno: el bucket queda con un
#  objeto de la fecha correcta y el tamano equivocado, y nadie vuelve a mirar.
#  Criterio copiado de `update.sh:2337-2348`, que lo borra y aborta.
# ============================================================================
escenario 'R2 · dump de 0 bytes: aborta, NO sube nada y BORRA el archivo vacio'
preparar
correr D_DUMP_BYTES=0 --
codigo_no_es 0
dice 'BACKUP VACIO'
# Lo que de verdad se comprueba: que no se llamo al cliente de S3. Un mensaje
# bonito con la subida hecha seria el fallo entero.
no_hubo 's3cmd'
# Y que el archivo vacio no se queda: en un `ls` del directorio parece un
# respaldo mas, y el dia que alguien restaure a mano bajo presion elegiria el
# mas reciente, que seria el vacio.
dumps_son 0
limpiar

escenario 'R2b · pg_dump que sale con codigo != 0 tambien aborta y no sube'
preparar
correr D_DUMP_CODIGO=1 --
codigo_no_es 0
dice 'BACKUP VACIO'
no_hubo 's3cmd'
dumps_son 0
limpiar

# ============================================================================
#  R3 · SIN CREDENCIALES DE SPACES — se dice, y NO es un error
# ----------------------------------------------------------------------------
#  Mismo criterio que `respaldo.sh:229-232` ya tiene hoy: una instancia sin
#  respaldo remoto configurado no es una instancia rota, es una instancia sin
#  respaldo remoto, y conviene que el log se lea asi. DEMO es exactamente ese
#  caso y no tiene sentido que su cron mande un error cada noche.
# ============================================================================
escenario 'R3 · sin SPACES_KEY/SPACES_SECRET: lo dice, sale 0, y el dump local queda'
preparar
# Se reescribe la configuracion sin las dos claves, que es como nace hoy una
# instancia a la que nadie le puso respaldo remoto.
cat >"$CONF" <<FIN
DATABASE_URL=postgresql://spaces:$CLAVE@127.0.0.1:5432/spaces
INSTANCIA=instancia-de-prueba
FIN
correr --
codigo_es 0
dice 'respaldo remoto NO CONFIGURADO'
no_hubo 's3cmd'
# El dump local SI se hizo: sin respaldo remoto sigue habiendo vuelta atras.
dumps_son 1
limpiar

# ============================================================================
#  R4 · LA SUBIDA FALLA (403) — se dice, el dump local SE CONSERVA, y sale != 0
# ----------------------------------------------------------------------------
#  Aqui este guion se SEPARA de `update.sh` a proposito, y es la decision de
#  diseno que mas vale la pena dejar escrita. Para `update.sh` una subida
#  fallida no para el update: el respaldo local basta para la vuelta atras y no
#  actualizar es un problema mayor. Para ESTE guion, sacar los datos del droplet
#  es lo UNICO que hace: si la subida falla, el guion fallo, y tiene que salir
#  con codigo != 0 o el cron lo dara por bueno todas las noches.
#
#  El 403 no es hipotetico: es el que da HOY la llave de g500 contra el bucket
#  de logs (`docs/evidencias/11-g500-sin-respaldo-programado.md`).
# ============================================================================
escenario 'R4 · subida 403: se dice, sale != 0, y el dump local NO se borra'
preparar
correr D_S3_CODIGO=1 --
codigo_no_es 0
dice 'RESPALDO REMOTO FALLIDO'
hubo 's3cmd'
# La comprobacion que importa: lo unico que quedaba de esos datos fuera de la
# base es ese archivo. Borrarlo "porque el respaldo fallo" seria destruir la
# copia buena por no tener la remota.
dumps_son 1
limpiar

# ============================================================================
#  R5 · LA PODA LOCAL
# ============================================================================
escenario 'R5 · deja los 3 mas recientes y el de esta corrida esta entre ellos'
preparar
mkdir -p "$DIR_RESPALDOS"
for i in 1 2 3 4 5; do
  printf 'viejo' >"$DIR_RESPALDOS/spaces_2026010${i}_000000.dump"
done
correr --
codigo_es 0
dumps_son 3
# El de esta corrida es de hoy, asi que su nombre empieza por el ano en curso.
if find "$DIR_RESPALDOS" -maxdepth 1 -name "spaces_$(date +%Y%m%d)_*.dump" | grep -q .; then bien
else mal 'la poda se llevo el dump de ESTA corrida'; fi
limpiar

# ============================================================================
#  R6 · LA CONTRASENA NO VIAJA EN `argv`
# ----------------------------------------------------------------------------
#  Es la propiedad por la que `update.sh` deriva `PG_ENV`/`PG_BANDERAS` de
#  `DATABASE_URL` en vez de pasar `--dbname="$DATABASE_URL"` (`update.sh:1644`
#  y siguientes). Un guion de respaldo que la perdiera reabriria la fuga en la
#  otra mitad del sistema, y ademas cada noche.
# ============================================================================
escenario 'R6 · la contrasena va por el entorno, NO en el argv de pg_dump'
preparar
correr --
# En argv van las piezas estructurales y NADA mas.
hubo_regex 'pg_dump-argv .*-h 127\.0\.0\.1'
hubo_regex 'pg_dump-argv .*-p 5432'
hubo_regex 'pg_dump-argv .*-U spaces'
hubo_regex 'pg_dump-argv .*-d spaces'
# Y la contrasena llega, pero por el entorno.
hubo "pg_dump-env PGPASSWORD=$CLAVE"
if grep -F 'pg_dump-argv' "$REG_LLAMADAS" | grep -qF "$CLAVE"; then
  mal "la contrasena aparece en el argv de pg_dump: visible con \`ps\` para cualquier usuario del droplet"
else bien; fi
# Tampoco en el log, que es lo que viaja al bucket de logs.
calla "$CLAVE"
limpiar

escenario 'R6b · un parametro de conexion soportado se reenvia por su variable PG*'
preparar
cat >"$CONF" <<FIN
DATABASE_URL=postgresql://spaces:$CLAVE@127.0.0.1:5432/spaces?sslmode=require
SPACES_KEY=llave-de-mentira
SPACES_SECRET=secreto-de-mentira
SPACES_BUCKET=bucket-de-mentira
INSTANCIA=instancia-de-prueba
FIN
correr --
codigo_es 0
hubo 'PGSSLMODE=require'
limpiar

escenario 'R6c · DATABASE_URL no parseable: se para ANTES del dump y no publica la cadena'
preparar
cat >"$CONF" <<FIN
DATABASE_URL=esto-no-es-una-url-con-$CLAVE-dentro
INSTANCIA=instancia-de-prueba
FIN
correr --
codigo_no_es 0
# La afirmacion POSITIVA va primero y no sobra: sin ella este escenario entero
# pasa solo. Con el guion ausente el codigo tambien es != 0 y tampoco se llama a
# nadie, o sea que las tres comprobaciones de abajo daban verde en la corrida
# roja. Una prueba que pasa cuando lo que prueba no existe no prueba nada.
dice 'no se puede interpretar DATABASE_URL'
no_hubo 'pg_dump-argv'
no_hubo 's3cmd'
# Lo que no se entiende puede ser la contrasena, asi que no se publica ni un
# trozo. Mismo criterio que `update.sh:1712`.
calla "$CLAVE"
limpiar

# ============================================================================
#  R7 · EL GUARD DE DERIVA — las dos copias de la derivacion siguen iguales
# ----------------------------------------------------------------------------
#  ⚠️ LEE ESTO ANTES DE TOCAR NADA DE LOS DOS ARCHIVOS.
#
#  `conexion-pg.sh` es HOY una SEGUNDA COPIA de seis funciones que viven tambien
#  dentro de `update.sh`. No es un descuido y esta explicado en la cabecera de
#  `conexion-pg.sh`: `update.sh` esta desplegado en produccion y su arnes tarda
#  15 minutos, asi que hacerle sourcear el archivo nuevo es un cambio que tiene
#  que hacer alguien que pueda correr ese arnes entero.
#
#  Mientras tanto la deuda es real, y el riesgo de una deuda asi NO es tenerla:
#  es que se pudra en silencio. Alguien arregla un fallo de percent-encoding en
#  `update.sh` —ha pasado tres veces seguidas, ver `update.sh:1449-1466`— y la
#  copia del respaldo diario se queda con el fallo, sin que nada lo diga.
#
#  Este escenario convierte esa deriva silenciosa en un rojo. Compara los
#  CUERPOS de las funciones, no los comentarios de alrededor: los comentarios de
#  `update.sh` hablan de "el update" y los de aqui no, y obligarlos a ser
#  identicos haria que el guard se desactivara al primer roce.
# ============================================================================
cuerpo_funcion() {
  awk -v f="$2" '$0==f"() {"{p=1} p{print} p&&$0=="}"{exit}' "$1"
}

escenario 'R7 · conexion-pg.sh y update.sh comparten las seis funciones LETRA POR LETRA'
for f in env_de_parametro clasificar_consulta partir_url destino_de_url decodificar_porciento correr_pg; do
  a="$(cuerpo_funcion "$UPDATE_SH" "$f")"
  b="$(cuerpo_funcion "$CONEXION_SH" "$f")"
  if [ -z "$a" ]; then
    mal "no se pudo extraer \`$f\` de update.sh: el guard dejaria de comprobar nada"
  elif [ -z "$b" ]; then
    mal "no se pudo extraer \`$f\` de conexion-pg.sh"
  elif [ "$a" = "$b" ]; then
    bien
  else
    mal "\`$f\` YA NO ES IGUAL en update.sh y en conexion-pg.sh. Alguien arreglo una de las dos copias. Copia el cuerpo bueno a la otra (o, mejor, cierra la deuda haciendo que update.sh sourcee conexion-pg.sh, que exige correr pruebas-update.sh entero)."
  fi
done

# ============================================================================
#  R9 · LOS DOS MONTAJES — `SPACE_OS_CONF` manda sobre el valor por omision
# ----------------------------------------------------------------------------
#  Decision del dueno (22/09): **el respaldo diario es de TODAS las instancias**,
#  no solo de las que tienen datos reales. Y los dos montajes que existen hoy no
#  se configuran igual:
#
#    · g500 es ESTANDAR  -> /etc/space-os/instancia.env,      base `spaces`
#    · DEMO vive DENTRO DEL PADRE -> SPACE_OS_CONF=/etc/space-os/demo-instancia.env,
#                                    base `spaces_demo`
#
#  Si el guion ignorara `SPACE_OS_CONF`, en el PADRE leeria la configuracion
#  equivocada y respaldaria la base equivocada — sin dar ningun error, porque
#  las dos existen en esa maquina. Es un error real: costo media hora el 22/09.
#  Mismo criterio que `update.sh:430`.
# ============================================================================
escenario 'R9 · con SPACE_OS_CONF se respalda la base de ESE archivo, no la de por omision'
preparar
# El montaje de DEMO: otro archivo, otra base, y sin credenciales de Spaces
# (DEMO hoy no las tiene, medido el 22/09).
CONF_DEMO="$RAIZ_TMP/demo-instancia.env"
cat >"$CONF_DEMO" <<FIN
DATABASE_URL=postgresql://spaces:$CLAVE@127.0.0.1:5432/spaces_demo
INSTANCIA=demo
FIN
correr SPACE_OS_CONF="$CONF_DEMO" --
codigo_es 0
# La comprobacion que importa: la base es la de DEMO, no la `spaces` que sigue
# estando en el archivo por omision del escenario.
hubo_regex 'pg_dump-argv .*-d spaces_demo'
no_hubo '-d spaces '
# Y DEMO, sin credenciales, no es un error: dump local, poda, y se dice.
dice 'respaldo remoto NO CONFIGURADO'
dumps_son 1
limpiar

escenario 'R9b · el valor por omision sigue siendo el del montaje estandar'
# No se ejecuta nada: se lee el guion. Un guion que cayera a otra ruta se
# llevaria por delante a g500, que es el montaje estandar y el que tiene los
# datos reales.
#
# ⚠️ ANCLADOS A `^CONF=`, y hace falta. Nacieron como `grep -qF` sueltos y los
# dos literales aparecen en COMENTARIOS de este guion (`:12`, `:58-60`, `:95`),
# asi que casaban con la prosa. Demostrado el 22/09: cambiando `:115` a
# `/etc/space-os/otra-cosa.env` el arnes daba 0 fallos -- justo el mutante
# contra el que este escenario dice defender. Y no lo salva `preparar()`, que
# exporta SPACE_OS_CONF siempre: la rama por omision NO se ejecuta nunca, asi
# que leer el guion es lo unico que queda.
if grep -qE '^CONF="\$\{SPACE_OS_CONF:-' "$GUION"; then bien
else mal 'el guion no respeta SPACE_OS_CONF: en el PADRE leeria la configuracion de la instancia equivocada'; fi
if grep -qE '^CONF=.*:-/etc/space-os/instancia\.env\}"$' "$GUION"; then bien
else mal 'el guion no cae a /etc/space-os/instancia.env, que es el montaje estandar de g500 -- el que tiene los datos reales'; fi

# ============================================================================
#  R11 · `DIR_RESPALDOS` SE PUEDE FIJAR DESDE LA PROPIA CONFIGURACION
# ----------------------------------------------------------------------------
#  Esta es la propiedad de la que depende el arreglo del PADRE, y por eso tiene
#  prueba propia en vez de quedarse en prosa de una tarjeta.
#
#  EL PROBLEMA: en el PADRE hay DOS escritores en /var/lib/space-os/respaldos --
#  el respaldo diario de DEMO y el `update.sh` de DEMO (`/etc/cron.d/space-os-demo`,
#  04:31, que lleva `SPACE_OS_CONF` y nada mas). La poda deja 3 por fecha mire de
#  que base sean, asi que DEMO se come los respaldos del PADRE.
#
#  POR QUE SE ARREGLA CON `DIR_RESPALDOS` Y NO CON `SPACE_OS_DIR_ESTADO`:
#  `DIR_RESPALDOS` se deriva DESPUES de sourcear la configuracion --en este guion
#  (`:187`, con el source en `:150`) y en `update.sh` (`:911`, source en `:841`)--
#  asi que una linea dentro de `demo-instancia.env` la honran LOS DOS guiones.
#  `SPACE_OS_DIR_ESTADO` se lee ANTES del source (`:116` aqui, `:431` alli): en la
#  configuracion no serviria de nada, solo funciona como variable de entorno, y
#  entonces hay que acordarse de ponerla en cada linea de cron de cada guion --
#  dos variables acopladas que solo une la prosa. Esto ata el directorio a
#  `SPACE_OS_CONF`, que es la unica que ya no se puede olvidar: sin ella la base
#  es la equivocada y se nota enseguida.
# ============================================================================
escenario 'R11 · DIR_RESPALDOS desde el archivo de configuracion manda sobre el valor derivado'
preparar
OTRO="$RAIZ_TMP/estado-demo/respaldos"
cat >"$CONF" <<FIN
DATABASE_URL=postgresql://spaces:$CLAVE@127.0.0.1:5432/spaces_demo
INSTANCIA=demo
DIR_RESPALDOS=$OTRO
FIN
correr --
codigo_es 0
# El dump esta donde dice la configuracion...
if find "$OTRO" -maxdepth 1 -type f -name 'spaces_*.dump' 2>/dev/null | grep -q .; then bien
else mal "el dump no esta en el DIR_RESPALDOS de la configuracion ($OTRO)"; fi
# ...y NO en el directorio por omision, que es el del PADRE. Esta es la
# comprobacion que importa: la otra puede pasar escribiendo en los dos sitios.
if find "$DIR_RESPALDOS" -maxdepth 1 -type f -name 'spaces_*.dump' 2>/dev/null | grep -q .; then
  mal "el dump TAMBIEN cayo en el directorio por omision: en el PADRE eso es podar los respaldos de la otra instancia"
else bien; fi
hubo_regex 'pg_dump-argv .*--file='"$OTRO"'/spaces_'
limpiar

# ============================================================================
#  R12 · EL INVARIANTE DE `update.sh` DEL QUE DEPENDE TODO EL ARREGLO DEL PADRE
# ----------------------------------------------------------------------------
#  ESTE ESCENARIO NO PRUEBA ESTE GUION. Vigila una linea de OTRO archivo, y es
#  deliberado.
#
#  El arreglo del PADRE --que DEMO deje de comerse los respaldos del PADRE-- es
#  una sola linea dentro de `demo-instancia.env`:
#
#      DIR_RESPALDOS=/var/lib/space-os/demo/respaldos
#
#  y funciona SOLO porque `update.sh` deriva `DIR_RESPALDOS` DESPUES de sourcear
#  esa configuracion. Si alguien sube esa linea por encima del `. "$CONF"` --un
#  reordenado inocente mientras toca otra cosa-- el valor del archivo deja de
#  tener efecto, `update.sh` de DEMO vuelve a escribir y podar en el directorio
#  del PADRE, y NO HAY NINGUNA SEÑAL: no falla nada, no hay error, y la nota de
#  boveda sigue diciendo que esta cerrado. Se descubriria el dia que hiciera
#  falta un respaldo del PADRE y no estuviera.
#
#  Es un invariante MEDIDO EN EL CODIGO Y NUNCA EJECUTADO --`update.sh` tiene su
#  propio arnes de 15 minutos y esta rama lo declara intocable-- asi que lo unico
#  que se puede hacer aqui es que un reordenado se ponga rojo. Cuesta un segundo.
#
#  NO toca `update.sh`: solo lo lee.
# ============================================================================
escenario 'R12 · update.sh deriva DIR_RESPALDOS DESPUES de sourcear la configuracion'
n_src="$(grep -nE '^\. "\$CONF"' "$UPDATE_SH" | head -1 | cut -d: -f1)"
n_dir="$(grep -nE '^DIR_RESPALDOS=' "$UPDATE_SH" | head -1 | cut -d: -f1)"
if [ -z "$n_src" ]; then
  mal 'no se encuentra `. "$CONF"` a principio de linea en update.sh: el guard no puede comprobar nada'
elif [ -z "$n_dir" ]; then
  mal 'no se encuentra `DIR_RESPALDOS=` a principio de linea en update.sh'
elif [ "$n_dir" -gt "$n_src" ]; then
  bien
else
  mal "update.sh deriva DIR_RESPALDOS en la linea $n_dir, ANTES de sourcear \$CONF en la $n_src. Con eso, el DIR_RESPALDOS que se pone en demo-instancia.env deja de tener efecto y el update.sh de DEMO vuelve a escribir y podar en los respaldos del PADRE, en silencio. Ver la tarjeta 12, paso B1b."
fi

# ============================================================================
#  R8 · LO QUE ESTE GUION NO PUEDE HACER NUNCA
# ============================================================================
escenario 'R8 · no habla con ningun servidor ni toca update.sh'
preparar
correr --
no_hubo 'ssh'
no_hubo 'doctl'
if grep -qE '\bssh\b|\bdoctl\b|\bcertbot\b' "$GUION"; then
  mal 'el guion menciona ssh/doctl/certbot: un respaldo que entra a maquinas no es un respaldo'
else bien; fi
# El respaldo diario corre en la instancia y no sabe nada del PADRE ni del
# registro de imagenes: si apareciera un `docker pull` aqui, este guion habria
# dejado de ser un respaldo para ser medio update.
if grep -qE '\bdocker\b' "$GUION"; then
  mal 'el guion menciona docker: el respaldo no actualiza nada'
else bien; fi
limpiar

# ============================================================================
#  R10 · LOS PERMISOS DEL RESPALDO
# ----------------------------------------------------------------------------
#  ⚠️ ESTE ESCENARIO LEE EL GUION EN VEZ DE EJECUTARLO, Y HAY QUE DECIR POR QUE.
#
#  Lo correcto seria correrlo y mirar los permisos del archivo. **No se puede
#  aqui**: en Git Bash sobre Windows `umask` y `chmod` no se reflejan en `stat`
#  -- medido el 22/09, un `(umask 077; touch f)` da 644 y un `chmod 600` tambien.
#  O sea que la prueba buena daria VERDE con el guion arreglado Y con el guion
#  roto, que es la peor clase de prueba: la que solo sirve para tranquilizar.
#
#  Asi que se comprueba lo unico que aqui se puede comprobar de verdad --que las
#  lineas estan-- y LA COMPROBACION REAL VIVE EN LA TARJETA 12, contra el
#  droplet, con un `ls -l` cuya salida esperada esta escrita.
#
#  Que importa: un dump es la base ENTERA, sin RLS, sin tenant y sin sesion. Con
#  el umask 022 de root nace en 0644, legible por cualquier usuario local del
#  droplet -- incluido el que corre la aplicacion.
# ============================================================================
escenario 'R10 · el guion restringe permisos del directorio y del dump (leido, no ejecutado)'
if grep -qE '^umask 077' "$GUION"; then bien
else mal 'no hay `umask 077`: el dump naceria 0644, legible por cualquier usuario del droplet'; fi
if grep -qE '^chmod 700 "\$DIR_RESPALDOS"' "$GUION"; then bien
else mal 'no se restringe el directorio de respaldos, que ya existe en 0755 creado por update.sh'; fi
if grep -qE '^chmod 600 "\$BK"' "$GUION"; then bien
else mal 'no se restringe el dump: lo crea pg_dump, no este guion, asi que el umask no basta'; fi
# Y EL ORDEN, que la primera version tenia mal: con `umask 077` ANTES del
# `mkdir -p`, los PADRES que falten nacen 0700 de root y los servicios que
# corren como otro usuario (`flota`, `altas`) no pueden atravesar el directorio
# de estado. Endurecer de mas y tumbar otro servicio no es seguridad, es averia.
# ⚠️ ANCLADOS A PRINCIPIO DE LINEA (`^`), y no es cosmetica: sin el ancla estos
# dos `grep` casan tambien los COMENTARIOS. Se demostro el 22/09 -- un comentario
# con el literal `mkdir -p "$DIR_RESPALDOS"` encima, el `umask` movido delante
# del `mkdir` de verdad, y el arnes daba 0 fallos CON EL BUG PUESTO. El guard que
# se anadio para que un bug real no volviera se dejaba burlar por una linea de
# prosa. Hoy no pasaba por pura suerte: el comentario de `respaldo-diario.sh:211`
# menciona `mkdir -p` pero sin la variable entrecomillada.
n_mkdir="$(grep -nE '^mkdir -p "\$DIR_RESPALDOS"' "$GUION" | head -1 | cut -d: -f1)"
n_umask="$(grep -nE '^umask 077' "$GUION" | head -1 | cut -d: -f1)"
if [ -n "$n_mkdir" ] && [ -n "$n_umask" ] && [ "$n_mkdir" -lt "$n_umask" ]; then bien
else mal "el \`umask 077\` (linea ${n_umask:-?}) tiene que ir DESPUES del \`mkdir -p\` (linea ${n_mkdir:-?}): si no, los directorios padre nacen 0700 y \`flota\`/\`altas\` no pueden atravesarlos"; fi

printf '\n%s escenarios · %s comprobaciones · %s fallos\n' "$ESCENARIOS" "$COMPROBACIONES" "$FALLOS"
[ "$FALLOS" -eq 0 ] || exit 1
