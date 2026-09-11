#!/usr/bin/env bash
# ============================================================================
#  base-instancia.sh — la base de datos de una instancia, escrita UNA vez.
# ----------------------------------------------------------------------------
#  QUE ES
#  Las recetas de Postgres que comparten los DOS caminos de alta de una
#  instancia: lo que crea los dos roles, lo que crea la base, lo que aplica el
#  esquema base y lo que corre las migraciones. Nada mas. Este archivo se
#  SOURCEA; no se ejecuta y no hace nada por si solo.
#
#    infra/scripts/provision-instancia.sh   nosotros creamos el servidor del
#                                           cliente y empujamos por ssh
#    infra/scripts/instalar-hijo.sh         el cliente pone su droplet y corre
#                                           el instalador DENTRO de la maquina
#
#  POR QUE EXISTE — el fallo que lo motivo, medido
#  Esto estuvo escrito DOS veces. `instalar-hijo.sh` nacio copiando el bloque
#  de base de datos de `provision-instancia.sh`, y la deriva empezo en ese
#  mismo commit: `CANAL` acabo escrito en `app.env` en un guion y no en el otro
#  (la aplicacion lo lee de ahi para poder decirlo en `/api/version`,
#  `apps/web/app/api/version/route.ts:105-113`).
#
#  Lo que hace inaceptable esa duplicacion no es la estetica: es el modo de
#  fallo. `vault/06-Operacion/zonas-de-riesgo.md` (R2) clasifica el aislamiento
#  entre organizaciones como ROJO precisamente porque NO DA ERROR — una
#  consulta devuelve filas de otra empresa, o cero en silencio. El rol de la
#  aplicacion se crea `nobypassrls`, y esa palabra es lo unico que impide que
#  la aplicacion atraviese la RLS. El dia que alguien corrija un privilegio en
#  un archivo y se olvide del otro, las instancias del otro camino naceran con
#  el privilegio viejo y NADA fallara: serviran datos de quien no toca. En este
#  repositorio ya paso dos veces por otra via (`43f9284`).
#
#  Escrito una sola vez, ese arreglo llega a los dos caminos o a ninguno.
#
#  COMO ESTA ESCRITO — las dos reglas que no se rompen
#   1. AQUI NO SE EJECUTA NADA: estas funciones devuelven TEXTO. Quien lo
#      ejecuta es el guion que las sourcea, por SU camino — `remoto()` por ssh
#      en uno, un shell de la propia maquina en el otro. Este archivo no sabe
#      ni pregunta si la maquina es local o remota, y no debe llegar a
#      saberlo: esa es la UNICA diferencia real entre los dos caminos, y
#      meterla aqui volveria a atarlos, que es lo contrario de lo que este
#      archivo busca.
#   2. Todo lo que cambia entra por PARAMETRO. Ninguna funcion lee una
#      variable global de su llamador (`$CONFIRMAR`, `$HOST`, `$REGISTRY`,
#      `$CLAVE_APP`...). Es lo que las hace servir a los dos sin que ninguno
#      tenga que parecerse al otro, y lo que impide que se vuelvan a acoplar
#      sin que nadie lo note.
#
#  Y una consecuencia de la regla 1 que conviene decir en voz alta: las
#  sentencias SQL salen SIN el `;` final. No es un olvido — un `psql -c` no lo
#  necesita y el mismo SQL por la entrada estandar SI, asi que el terminador es
#  cosa del canal y lo pone cada guion al enviarlo.
# ============================================================================

# ─── Los nombres, que no son parametros ─────────────────────────────────────
# No entran por argumento a proposito: `update.sh` y `respaldo.sh` los tienen
# escritos tal cual (`update.sh:79-85`), asi que una instancia con otros
# nombres no la sabria actualizar ni respaldar nadie. Son parte del contrato,
# no una preferencia de quien da el alta.
PG_ROL_APP=spaces_app
PG_ROL_MIGRADOR=spaces_migrador
PG_BASE=spaces
# La aplicacion, el migrador y el respaldo hablan con Postgres por TCP contra
# la propia maquina: el contenedor no ve el socket unix de la maquina anfitriona.
PG_HOST=127.0.0.1
PG_PUERTO=5432
# El esquema base viaja DENTRO de la imagen, y se vuelca a un archivo temporal
# de la maquina para poder pasarselo a `psql -f`.
RUTA_ESQUEMA_EN_IMAGEN=/app/db/schema.sql
RUTA_ESQUEMA_TMP=/tmp/space-os-schema.sql

# Envuelve un valor en comillas simples para que un shell lo reciba como TEXTO
# literal, escapando las comillas simples que el valor traiga. Hace falta
# porque estas recetas son LINEAS DE SHELL: sin esto, un valor con un espacio o
# una comilla —el nombre del registro y las claves entran por entorno— deja de
# ser un dato y pasa a ser parte del comando.
citar() {
  local valor="${1-}" comilla="'"
  printf "%s%s%s" "$comilla" "${valor//$comilla/$comilla\\$comilla$comilla}" "$comilla"
}

# ============================================================================
#  Los dos roles y la base
# ----------------------------------------------------------------------------
#  Son DOS roles, y la diferencia entre ellos es el aislamiento entero. Este
#  comentario vivia duplicado en `provision-instancia.sh`; vive aqui porque es
#  el porque de las tres sentencias de abajo, y el porque tiene que estar donde
#  esta la definicion o se queda viejo en la copia.
# ============================================================================

# El rol de la APLICACION. Es `nosuperuser` **y `nobypassrls`**, y las dos
# palabras hacen falta: un rol que atraviesa la RLS funciona perfectamente y
# sin aislamiento, que es la peor combinacion posible porque no da ningun
# error. Este es el rol con el que la aplicacion atiende a la gente, asi que es
# el que NUNCA puede saltarse la RLS.
sql_crear_rol_app() {
  local clave="${1:?base-instancia: sql_crear_rol_app necesita la clave del rol}"
  printf "create role %s login password %s nosuperuser nocreatedb nocreaterole noinherit nobypassrls" \
    "$PG_ROL_APP" "$(citar "$clave")"
}

# El rol de MIGRACION, con contrasena y por TCP. Por que existe y no se usa
# `postgres` por socket, que era lo de antes: las migraciones corren DENTRO de
# un contenedor efimero, y ahi dentro `/var/run/postgresql` NO EXISTE. Montarlo
# tampoco bastaria -- sin usuario en la URL, libpq usa el del SISTEMA, que en el
# contenedor es `node` y no `postgres`, asi que la autenticacion *peer* falla
# igual. Un rol con contrasena por 127.0.0.1 es la unica de las tres salidas que
# no obliga a ponerle contrasena al superusuario ni a dejar Node en la maquina.
#
# `bypassrls` — la palabra da miedo, asi que aqui esta el porque, MEDIDO el
# 2026-09-01 al convertir DEMO:
#
#   pg_dump: ERROR: query would be affected by row-level security policy
#            for table "acciones"
#
# `db/schema.sql` pone RLS con FORCE, que aplica INCLUSO AL DUENO de la tabla. Un
# rol normal que sea dueno ve CERO filas, asi que el `pg_dump` que `update.sh`
# hace ANTES de migrar sale vacio y el update ABORTA. Sin esto, la primera
# actualizacion de cada instancia se para en seco.
#
# Un respaldo PARCIAL seria peor que ninguno: el rol que respalda tiene que ver
# todas las filas. Antes no se notaba porque las tablas eran de `postgres`, que
# es superusuario y se salta la RLS por definicion.
#
# EL AISLAMIENTO NO SE TOCA. El que no puede saltarse la RLS es el rol de la
# APLICACION, y se sigue creando con `nobypassrls` EXPLICITO arriba. Este rol no
# lo usa la aplicacion jamas: solo migra y respalda.
sql_crear_rol_migrador() {
  local clave="${1:?base-instancia: sql_crear_rol_migrador necesita la clave del rol}"
  printf "create role %s login password %s nosuperuser nocreaterole noinherit bypassrls" \
    "$PG_ROL_MIGRADOR" "$(citar "$clave")"
}

# La base es DUENA del migrador a proposito: las migraciones crean objetos, y
# que todas corran siempre con el mismo dueno hace que el `alter default
# privileges` de `20260820_grants_rol_app.sql` -- escrito SIN `for role` -- se
# comporte igual siempre. Es el hallazgo H1 del 24/08.
sql_crear_base() {
  printf "create database %s owner %s" "$PG_BASE" "$PG_ROL_MIGRADOR"
}

# Las dos cadenas de conexion, que son DOS porque son dos roles: la de la
# aplicacion va a `app.env` y la del migrador a `instancia.env`
# (`update.sh:79-85`). Van por TCP y con contrasena porque un contenedor no ve
# el socket unix de la maquina anfitriona.
#
# La clave es HEX en los dos guiones, y por eso no hace falta percent-encodear
# nada. No es un detalle: `update.sh` SOURCEA `instancia.env` en bash y libpq
# corta la URL por el PRIMER `@`, asi que cada eslabon se rompe con un caracter
# distinto (medido el 19/08). Con hex no hay nada que escapar en ninguno.
url_conexion() {
  local rol="${1:?base-instancia: url_conexion necesita el rol}"
  local clave="${2:?base-instancia: url_conexion necesita la clave}"
  printf "postgresql://%s:%s@%s:%s/%s" "$rol" "$clave" "$PG_HOST" "$PG_PUERTO" "$PG_BASE"
}
url_app()      { url_conexion "$PG_ROL_APP"      "${1:?base-instancia: url_app necesita la clave del rol de la aplicacion}"; }
url_migrador() { url_conexion "$PG_ROL_MIGRADOR" "${1:?base-instancia: url_migrador necesita la clave del rol migrador}"; }

# La imagen que va a correr la instancia. El alta MIGRA con la misma imagen que
# despues sirve —es la que lleva las migraciones dentro—, asi que esta
# referencia la comparten el paso de esquema, el de migraciones y `update.sh`.
imagen_instancia() {
  local registro="${1-}" nombre="${2-}" canal="${3-}"
  printf "%s/%s:%s" "$registro" "$nombre" "$canal"
}

# ============================================================================
#  Esquema base y migraciones
# ----------------------------------------------------------------------------
#  El ORDEN es parte de la receta: primero el esquema base, despues las
#  migraciones. El paso del esquema no existia, y sin el la primera migracion
#  se estrellaba contra una base vacia con `relation "public.clientes" does not
#  exist` — medido el 2026-09-01 corriendo el runner de la imagen contra una
#  base recien creada.
#
#  `schema.sql` NO es idempotente (28 `create table` y uno solo con `if not
#  exists`), asi que no puede aplicarlo el runner a ciegas en cada corrida: es
#  del alta, y solo del alta. Y se aplica como el rol MIGRADOR y no como
#  `postgres` a proposito: las migraciones que vienen despues ALTERAN estas
#  tablas, y un `alter` sobre una tabla de otro dueno falla. Mismo dueno para
#  todo el esquema, siempre.
#
#  Los dos pasos van con el rol de MIGRACION y nunca con el de la aplicacion:
#  el de la aplicacion no tiene DDL, a proposito.
# ============================================================================

# Vuelca el esquema base de la imagen a un archivo de la maquina. Lleva una
# REDIRECCION dentro, y por eso estas recetas son lineas de shell y no listas
# de argumentos: una redireccion no cabe en un argv — la interpreta un shell o
# no ocurre.
cmd_volcar_esquema() {
  local imagen="${1:?base-instancia: cmd_volcar_esquema necesita la imagen}"
  printf "docker run --rm %s cat %s > %s" "$(citar "$imagen")" "$RUTA_ESQUEMA_EN_IMAGEN" "$RUTA_ESQUEMA_TMP"
}

# Aplica ese esquema con el rol migrador. La clave NO va aqui: se pasa por el
# ENTORNO (`PGPASSWORD`) desde quien ejecuta, que es lo que la mantiene fuera
# del argv de `psql` — en argv la ve cualquier otro usuario de la maquina con
# un `ps` mientras el proceso corre.
cmd_aplicar_esquema() {
  printf "psql -h %s -U %s -d %s -v ON_ERROR_STOP=1 -f %s" \
    "$PG_HOST" "$PG_ROL_MIGRADOR" "$PG_BASE" "$RUTA_ESQUEMA_TMP"
}

# El esquema volcado no se queda en el disco: es el `db/schema.sql` completo y
# no tiene nada que hacer en `/tmp` despues de aplicarse.
cmd_limpiar_esquema() {
  printf "rm -f %s" "$RUTA_ESQUEMA_TMP"
}

# `--instalacion-nueva` lo pasa el ALTA y nunca `update.sh` (`update.sh:1511`
# llama al runner sin banderas): el runner se verifica a si mismo y aborta si no
# puede distinguir una base nueva de una rezagada, y esa distincion solo la sabe
# quien acaba de crear la base. El orden de las migraciones no es lexicografico puro — el mapa
# de excepciones vive en `scripts/migrar.mjs:61` y se declara una sola vez.
# `DATABASE_URL` entra al contenedor como VARIABLE DE ENTORNO (`--env`), que es
# de donde la lee el runner (`scripts/migrar.mjs:344-355`): no se le pasa como
# argumento a `migrar.mjs`, donde quedaria en el argv del proceso de node
# dentro del contenedor y en cualquier log que imprima su linea de comandos.
cmd_migrar_instalacion_nueva() {
  local imagen="${1:?base-instancia: cmd_migrar_instalacion_nueva necesita la imagen}"
  local url="${2:?base-instancia: cmd_migrar_instalacion_nueva necesita la URL del migrador}"
  printf "docker run --rm --network host --env DATABASE_URL=%s %s node scripts/migrar.mjs --instalacion-nueva" \
    "$(citar "$url")" "$(citar "$imagen")"
}
