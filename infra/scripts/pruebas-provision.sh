#!/usr/bin/env bash
# ============================================================================
#  pruebas-provision.sh — el arnes de `provision-instancia.sh`.
# ----------------------------------------------------------------------------
#  POR QUE EXISTE, y esta medido:
#
#  `update.sh` (119 KB) tiene `pruebas-update.sh` (126 KB, mas grande que el
#  propio guion) y `pruebas-vuelta-atras-real.sh`. `provision-instancia.sh`
#  (36 KB) no tenia NINGUNO, y `pruebas-update.sh` no lo menciona ni una vez.
#
#  Era el unico guion grande sin arnes, y es el que CREA LAS MAQUINAS DE LOS
#  CLIENTES. El 2026-09-07 aparecieron SEIS defectos en un solo dia (31-36) al
#  recorrer el primer alta real. La diferencia no es casual: los de `update.sh`
#  los caza su arnes antes de produccion; estos los cazo un droplet cobrandose.
#
#  Los seis estan aqui abajo como escenarios. No se trata de que no vuelvan por
#  buena voluntad: se trata de que si vuelven, esto se pone rojo.
#
#  Uso:
#    bash infra/scripts/pruebas-provision.sh
#
#  NO sale a la red, NO habla con DigitalOcean, NO toca ninguna maquina y NO
#  gasta un centimo. Monta dobles POSIX de `ssh`, `doctl` y `curl` en un PATH
#  propio y observa que se les pide. Eso es un criterio de aceptacion, no un
#  detalle: un arnes de aprovisionamiento que crease droplets seria peor que no
#  tener arnes.
# ============================================================================
set -uo pipefail

# La entrada estandar se CIERRA para todo el arnes, y no es cosmetico. El doble
# de `ssh` drena stdin (`cat`) para no dejar colgado al que le manda un cuerpo
# por heredoc; si hereda una entrada que nadie va a cerrar --una tuberia, la
# consola de un runner-- ese `cat` se queda esperando para siempre y el arnes
# se cuelga SIN imprimir una sola linea. Medido el 2026-09-07: 600 s sin salida
# y ninguna pista de donde.
exec </dev/null

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
GUION="${GUION_PROVISION:-$RAIZ/infra/scripts/provision-instancia.sh}"

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

# ─── Los dobles ─────────────────────────────────────────────────────────────
#
#  El doble de `ssh` es el que hace todo el trabajo, porque `provision` habla
#  con la maquina SIEMPRE por ahi: `remoto()` le pasa el comando remoto como
#  argumento, asi que basta mirarlo.
#
#  Y tiene que DRENAR STDIN cuando el comando trae un `cat >`: `remoto_escribir`
#  (`:228-232`) manda el archivo por la entrada estandar, y un doble que no lo
#  lee deja el guion colgado escribiendo en una tuberia que nadie vacia.
montar_dobles() {
  mkdir -p "$BIN"

  cat >"$BIN/ssh" <<'FIN'
#!/usr/bin/env bash
printf 'ssh %s\n' "$*" >>"$REG_LLAMADAS"
todo="$*"

# >>> EL ORDEN DE ESTE `case` ES LO QUE HACE FIEL AL DOBLE, y me morddio dos
# >>> veces al escribirlo. Los comandos remotos se SOLAPAN:
# >>>
# >>>   · el `curl` del bootstrap lleva DENTRO la cadena `BOOTSTRAP_TOKEN`
# >>>     (va en la cabecera), asi que un patron `*BOOTSTRAP_TOKEN*` puesto
# >>>     antes se come la peticion y devuelve un token donde el guion espera
# >>>     un codigo HTTP;
# >>>   · y `remoto_escribir /opt/space-os/update.sh` lleva la misma ruta que
# >>>     su EJECUCION, asi que `D_UPDATE_FALLA` tumbaba la ESCRITURA del
# >>>     archivo en vez de su arranque.
# >>>
# >>> Un doble que casa demasiado da rojos que no existen -- y por el mismo
# >>> mecanismo, verdes que tampoco. De lo mas especifico a lo mas general.

# 1 · Escribir un archivo. Va PRIMERO porque `install -m ... && cat >` puede
#     llevar cualquier ruta dentro, incluida la de update.sh. Y hay que drenar
#     stdin o `remoto_escribir` (`:228-232`) se queda colgado.
#
#     El CUERPO se GUARDA, no se tira. Hasta el 2026-09-11 iba a /dev/null, y
#     con eso el arnes sabia QUE se escribio un archivo pero no QUE llevaba
#     dentro -- un punto ciego que dejaba sin red la mitad del alta: el
#     `DATABASE_URL` de `app.env` (o sea CON QUE ROL se conecta la aplicacion) y
#     el `CANAL`. Se midio: cambiar el rol de la aplicacion por el de migracion
#     --el que lleva `bypassrls` y atraviesa la RLS entera-- ESCAPABA con 0
#     fallos. Mismo arreglo que el doble de `curl` en `pruebas-update.sh`, que
#     guarda el cuerpo que se postea por la misma razon: en `argv` solo se ve la
#     ruta del archivo.
case "$todo" in
  *"install -m"*"cat >"*)
    destino="${todo##*cat > \'}"
    destino="${destino%%\'*}"
    printf 'escrito %s\n' "$destino" >>"$REG_LLAMADAS"
    if [ -n "${DIR_ESCRITOS:-}" ]; then
      # El nombre se sanea porque el destino es una ruta absoluta. Y si algo
      # aqui fallara hay que SEGUIR drenando stdin: un doble que deja de leer
      # cuelga al guion en una tuberia que nadie vacia, que es el fallo de 600 s
      # sin salida documentado arriba.
      cat >"$DIR_ESCRITOS/$(printf '%s' "$destino" | tr -c 'A-Za-z0-9._-' '_')" 2>/dev/null || cat >/dev/null 2>&1
    else
      cat >/dev/null 2>&1
    fi
    exit 0
    ;;
esac

# 2 · Un ssh que no entra. Es el defecto 33: hasta el 07/09 esto se reportaba
#     como «la instancia no tiene BOOTSTRAP_TOKEN».
if [ "${D_SSH_FALLA:-0}" = "1" ]; then
  cat >/dev/null 2>&1
  echo "root@host: Permission denied (publickey)." >&2
  exit 255
fi

case "$todo" in
# 3 · El POST del bootstrap. ANTES del patron del token, ver el aviso.
  *"api/bootstrap/"*)
    # El cuerpo se REGISTRA en vez de tirarse. Hasta A3.1 iba a /dev/null, y con
    # eso el arnes no podia comprobar QUE manda el alta -- solo que llamaba. Lo
    # que se retiro el 07/09 es precisamente un campo del cuerpo.
    printf 'cuerpo-bootstrap %s
' "$(cat)" >>"$REG_LLAMADAS"
    printf '%s' "${D_CODIGO_BOOT:-201}"
    ;;
# 4 · La comprobacion del certificado.
  *"spaces-dooh/login/"*)
    printf '%s' "${D_CODIGO_LOGIN:-200}"
    ;;
# 5 · La LECTURA del token del `app.env` de la instancia.
  *"sed -n"*BOOTSTRAP_TOKEN*)
    printf '%s\n' "${D_TOKEN_ARRANQUE-un-token-de-arranque}"
    ;;
# 6 · El arranque de la aplicacion (defecto 35). Solo la EJECUCION: la
#     escritura ya salio por el caso 1.
#
#     Y OJO CON LA FORMA DEL PATRON, que es la tercera vez que me equivoco en
#     el mismo sitio: `$todo` es el argv COMPLETO
#     (`-o StrictHostKeyChecking=... root@ip /opt/space-os/update.sh`), no solo
#     el comando remoto. Una coincidencia exacta no casa nunca, y el escenario
#     35b daba verde sin haber probado nada. El patron pide la ruta al FINAL y
#     precedida de un espacio: asi no casa la escritura, que la deja entre
#     comillas.
  *" /opt/space-os/update.sh")
    echo "  update: doble"
    [ "${D_UPDATE_FALLA:-0}" = "1" ] && exit 1
    ;;
esac
exit 0
FIN

  cat >"$BIN/doctl" <<'FIN'
#!/usr/bin/env bash
printf 'doctl %s\n' "$*" >>"$REG_LLAMADAS"
case "$*" in
  *"droplet get"*) echo "203.0.113.10" ;;   # RFC 5737: no existe ni puede
esac
exit 0
FIN

# `curl` local: el guion no lo usa directamente —siempre por ssh— pero el
# doble existe para que un `curl` nuevo NO salga a internet sin que nadie se
# entere. Si alguien lo añade, aparece en el registro de llamadas.
  cat >"$BIN/curl" <<'FIN'
#!/usr/bin/env bash
printf 'curl %s\n' "$*" >>"$REG_LLAMADAS"
printf '%s' "${D_CODIGO_LOGIN:-200}"
exit 0
FIN

  cat >"$BIN/sleep" <<'FIN'
#!/usr/bin/env bash
exit 0
FIN

  chmod +x "$BIN"/*
}

preparar() {
  RAIZ_TMP="$(mktemp -d)"
  BIN="$RAIZ_TMP/bin"
  REG_LLAMADAS="$RAIZ_TMP/llamadas"
  SALIDA="$RAIZ_TMP/salida"
  # Donde el doble de `ssh` deja el CONTENIDO de cada archivo que el alta manda
  # al servidor, un archivo por destino y con el nombre saneado.
  DIR_ESCRITOS="$RAIZ_TMP/escritos"
  mkdir -p "$DIR_ESCRITOS"
  : >"$REG_LLAMADAS"
  export REG_LLAMADAS DIR_ESCRITOS
  montar_dobles
  RUTA_ANTES="$PATH"
  PATH="$BIN:$PATH"
  unset D_SSH_FALLA D_CODIGO_LOGIN D_CODIGO_BOOT D_UPDATE_FALLA D_TOKEN_ARRANQUE
  # Desde el 2026-09-11 `provision-instancia.sh` SOURCEA `base-instancia.sh` —lo
  # que crea la base de datos, escrito UNA vez para los dos caminos de alta— y
  # aborta si no lo encuentra al lado. Los mutantes de abajo corren una COPIA
  # del guion en /tmp, donde ese archivo NO esta: sin esta linea, todos los
  # escenarios de todos los mutantes moririan por el mismo motivo --el guion
  # parandose por falta del archivo-- y "muerde" dejaria de significar nada.
  # Mismo mecanismo y mismo motivo que `SPACE_OS_RESPALDO_SH` en
  # `pruebas-update.sh:494-497`; `BASE_MUT` permite, ademas, mutar el propio
  # archivo sourceado.
  export SPACE_OS_BASE_INSTANCIA_SH="${BASE_MUT:-$RAIZ/infra/scripts/base-instancia.sh}"
}

limpiar() {
  PATH="$RUTA_ANTES"
  rm -rf "$RAIZ_TMP"
}

# Corre el guion y guarda codigo y salida.
#
#   correr [VAR=valor | -u VAR ...] -- <argumentos del guion>
#
# El entorno va por `env` y NO por un subshell, y esa es la diferencia entre un
# arnes que sirve y uno decorativo: con las aserciones dentro de `( ... )` los
# contadores se quedan en el subshell, y el arnes **imprime los fallos y sale
# 0**. Es literalmente el defecto 34 que estas pruebas existen para cazar, y lo
# cometi aqui en el primer intento.
#
# `2>&1` a proposito: la mitad de lo que hay que comprobar son mensajes de
# error, y un arnes que solo mire stdout no ve el defecto 32 ni el 33.
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
# Por regex, y hace falta: `provision` ESCRIBE `/opt/space-os/update.sh` y luego
# lo EJECUTA, asi que un `grep -F` de esa ruta casa con las dos cosas. Con eso,
# el escenario 35 daba verde aunque nadie arrancara nada -- lo delato el mutante.
hubo_regex() { if grep -qE -- "$1" "$REG_LLAMADAS"; then bien; else mal "ninguna llamada casa con: $1"; fi; }

# ─── Y sobre el CONTENIDO de lo que se escribio en la instancia ─────────────
#  Estos predicados existen desde el 2026-09-11 y abren una clase entera que
#  antes era invisible: el alta manda siete archivos al servidor por la entrada
#  estandar de `ssh`, y hasta hoy el arnes solo podia afirmar que los mandaba.
#  Lo que va DENTRO de `app.env` es, entre otras cosas, con que rol de Postgres
#  se conecta la aplicacion -- o sea el aislamiento entre organizaciones (R2).
ruta_escrita() { printf '%s/%s' "$DIR_ESCRITOS" "$(printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '_')"; }

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

# Por AUSENCIA, y por eso comprueba PRIMERO que el archivo exista: una
# comprobacion de que algo NO aparece en un archivo que nadie escribio pasa
# sola, y pasaria justo el dia en que el alta dejara de escribirlo.
escrito_calla() {
  local f; f="$(ruta_escrita "$1")"
  if [ ! -f "$f" ]; then mal "no se escribio $1: la comprobacion por ausencia habria pasado sola"
  elif grep -qF -- "$2" "$f"; then mal "$1 NO deberia llevar: $2"
  else bien; fi
}

IP=203.0.113.10          # RFC 5737 — direccion de documentacion, no existe
DOM=prueba.ejemplo.com   # RFC 2606 — dominio reservado, no existe


# ============================================================================
#  DEFECTO 31 · el registro se exigia a los modos que no tocan la imagen
# ============================================================================
#  Obligaba al operador a volcar los TRES tokens al entorno de su shell para
#  emitir un certificado que no necesita ninguno.
escenario '31 · --emitir-certificado NO exige REGISTRY ni REGISTRY_TOKEN'
preparar
correr -u REGISTRY -u REGISTRY_TOKEN CERTBOT_EMAIL=x@ejemplo.com -- \
  --host "$IP" --dominio "$DOM" --emitir-certificado --confirmar
codigo_es 0
calla 'falta REGISTRY'
hubo 'certbot certonly'
limpiar

escenario '31b · --bootstrap tampoco los exige'
preparar
correr -u REGISTRY -u REGISTRY_TOKEN -- \
  --host "$IP" --dominio "$DOM" --instancia p --email a@ejemplo.com --bootstrap --confirmar
codigo_es 0
calla 'falta REGISTRY'
dice 'bootstrap 201'
limpiar

# ============================================================================
#  DEFECTO 32 · CERTBOT_EMAIL, y que se pare ANTES de tocar nada
# ============================================================================
escenario '32 · sin CERTBOT_EMAIL se para ANTES de llamar a certbot, y lo dice'
preparar
correr -u CERTBOT_EMAIL REGISTRY=registro.ejemplo/x REGISTRY_TOKEN=t -- \
  --host "$IP" --dominio "$DOM" --emitir-certificado --confirmar
codigo_no_es 0
dice 'falta CERTBOT_EMAIL'
# Lo que importa no es el mensaje: es que NO se haya pedido un certificado. Un
# intento fallido consume cuota de Let's Encrypt (cinco por hora y dominio).
no_hubo 'certbot certonly'
limpiar

# ============================================================================
#  DEFECTO 33 · un ssh caido NO es un token ausente
# ============================================================================
escenario '33 · un ssh que no entra NO se reporta como BOOTSTRAP_TOKEN ausente'
preparar
correr D_SSH_FALLA=1 -- \
  --host "$IP" --dominio "$DOM" --instancia p --email a@ejemplo.com --bootstrap --confirmar
codigo_no_es 0
# El mensaje viejo mandaba a buscar un token que estaba perfectamente escrito.
calla 'la instancia no tiene BOOTSTRAP_TOKEN'
dice 'no se pudo leer'
dice 'Permission denied'
limpiar

escenario '33b · un token de verdad AUSENTE si se reporta como tal'
preparar
correr D_TOKEN_ARRANQUE= -- \
  --host "$IP" --dominio "$DOM" --instancia p --email a@ejemplo.com --bootstrap --confirmar
codigo_no_es 0
dice 'no tiene BOOTSTRAP_TOKEN'
limpiar

# ============================================================================
#  DEFECTO 34 · la comprobacion del certificado COMPARA
# ============================================================================
#  Hasta el 07/09 imprimia «Esperado: login 200» y salia 0 SIEMPRE. En su
#  primer uso real dijo `login 502` y `success` en la misma pantalla.
escenario '34 · un login distinto de 200 sale con ERROR'
preparar
correr CERTBOT_EMAIL=x@ejemplo.com D_CODIGO_LOGIN=502 -- \
  --host "$IP" --dominio "$DOM" --emitir-certificado --confirmar
codigo_no_es 0
dice 'login 502'
dice 'NO responde'
# Y el 502 tiene diagnostico propio, porque es el caso que paso de verdad.
dice 'update.sh'
limpiar

escenario '34b · con 200 sigue saliendo bien'
preparar
correr CERTBOT_EMAIL=x@ejemplo.com D_CODIGO_LOGIN=200 -- \
  --host "$IP" --dominio "$DOM" --emitir-certificado --confirmar
codigo_es 0
dice 'login 200'
limpiar

# ============================================================================
#  DEFECTO 35 · la instancia no puede quedarse muerta hasta las 4:17
# ============================================================================
escenario '35 · el aprovisionamiento ARRANCA la aplicacion, no espera al cron'
preparar
correr REGISTRY=registro.ejemplo/x REGISTRY_TOKEN=t -- \
  --host "$IP" --dominio "$DOM" --instancia p --confirmar
hubo_regex '^ssh .* /opt/space-os/update\.sh$'
dice 'Levantando la aplicacion'
limpiar

escenario '35b · y si el arranque falla, el alta NO se aborta: la maquina existe'
preparar
correr REGISTRY=registro.ejemplo/x REGISTRY_TOKEN=t D_UPDATE_FALLA=1 -- \
  --host "$IP" --dominio "$DOM" --instancia p --confirmar
codigo_es 0
dice 'AVISO'
# El aviso tiene que decir que la maquina SI esta lista, o alguien la borrara
# pensando que el alta fallo -- y borrar una instancia buena cuesta mas que
# arrancarla a mano.
dice 'aprovisionamiento SI termino'
limpiar

# ============================================================================
#  DEFECTO 36 · el bootstrap afirmaba que la organizacion existia
# ============================================================================
#  Con un 404 o un 500 --donde curl sale 0 igual-- decia «La puerta ya se cerro
#  sola: existe una organizacion» SIN que existiera ninguna, y dejaba al
#  operador con una contrasena en pantalla que no servia para nada.
escenario '36 · un bootstrap 404 NO afirma que la organizacion existe'
preparar
correr D_CODIGO_BOOT=404 -- \
  --host "$IP" --dominio "$DOM" --instancia p --email a@ejemplo.com --bootstrap --confirmar
codigo_no_es 0
calla 'La puerta ya se cerro sola'
dice 'NO se creo'
# Y lo mas importante para quien esta delante: que no crea que ya tiene cuenta.
dice 'NO HAY NINGUNA CUENTA'
limpiar

escenario '36b · un 500 tampoco, y manda al log de la aplicacion'
preparar
correr D_CODIGO_BOOT=500 -- \
  --host "$IP" --dominio "$DOM" --instancia p --email a@ejemplo.com --bootstrap --confirmar
codigo_no_es 0
calla 'La puerta ya se cerro sola'
dice 'docker logs'
limpiar

escenario '36c · un 000 dice que se puede repetir, porque no se creo nada'
preparar
correr D_CODIGO_BOOT=000 -- \
  --host "$IP" --dominio "$DOM" --instancia p --email a@ejemplo.com --bootstrap --confirmar
codigo_no_es 0
dice 'repite este mismo comando'
limpiar

# ============================================================================
#  A3.1 · el alta ya no produce NINGUNA contrasena
# ============================================================================
#  Es la razon entera por la que el alta no podia ser desatendida: habia que
#  estar delante para leer la clave de la pantalla y hacersela llegar al Dueño.
#
#  >>> Esta comprobacion es por AUSENCIA, y esas envejecen mal: pasan solas el
#  >>> dia que alguien renombra la cadena. Por eso son DOS -- que no salga
#  >>> ninguna clave, y que el cuerpo del POST no lleve `password` -- y por eso
#  >>> llevan mutante propio abajo.
escenario 'A3.1 · el bootstrap no imprime ninguna clave'
preparar
correr D_CODIGO_BOOT=201 --   --host "$IP" --dominio "$DOM" --instancia p --email a@ejemplo.com --bootstrap --confirmar
codigo_es 0
calla 'clave:'
dice 'entra con Google'
limpiar

escenario 'A3.1b · y el cuerpo del POST no lleva password'
preparar
correr D_CODIGO_BOOT=201 --   --host "$IP" --dominio "$DOM" --instancia p --email a@ejemplo.com --bootstrap --confirmar
codigo_es 0
# Contra el cuerpo REAL que viajo, no contra lo que se imprime en pantalla: son
# dos cosas distintas y confundirlas es como se dan por buenas las dos.
hubo 'cuerpo-bootstrap'
no_hubo '"password"'
hubo '"email":"a@ejemplo.com"'
limpiar

escenario '36d · con 201 SI lo afirma, y sale bien'
preparar
correr D_CODIGO_BOOT=201 -- \
  --host "$IP" --dominio "$DOM" --instancia p --email a@ejemplo.com --bootstrap --confirmar
codigo_es 0
dice 'La puerta ya se cerro sola'
limpiar

# ============================================================================
#  Lo GLOBAL sobre el propio arnes, y los privilegios con los que nace la base
# ============================================================================
#  Las dos primeras no son de cortesia. Un arnes de aprovisionamiento que se
#  saliera a la red crearia droplets cada vez que alguien corre las pruebas, y
#  uno que no intercepta nada da verde sin haber probado nada.
#
#  Las siete siguientes son nuevas del 2026-09-11 y nacen de un agujero MEDIDO:
#  al extraer lo que crea la base de datos a `base-instancia.sh` se muto ese
#  archivo para ver si este arnes lo cazaba, y NO lo cazaba. Cinco mutantes
#  escapaban con 0 fallos --entre ellos quitarle `nobypassrls` al rol de la
#  aplicacion-- porque estos escenarios comprueban el FLUJO (que llamadas se
#  hacen y como se reportan los errores) y nadie comprobaba el CONTENIDO del
#  SQL. El registro de llamadas ya lo tenia delante: solo faltaba mirarlo.
escenario 'GLOBAL · el arnes intercepta, nada salio de los dobles, y la base nace con los privilegios que aislan'
preparar
correr REGISTRY=registro.ejemplo/x REGISTRY_TOKEN=t -- \
  --host "$IP" --dominio "$DOM" --instancia p --confirmar
if [ -s "$REG_LLAMADAS" ]; then bien; else mal "no se registro ni una llamada: el arnes no intercepta"; fi
# Las direcciones de todos los escenarios son de documentacion (RFC 5737 y
# RFC 2606): no existen ni pueden existir.
no_hubo 'digitalocean.com'
no_hubo 'space-os.io'

# >>> ESTA ES LA COMPROBACION MAS IMPORTANTE DE ESTE ARCHIVO, y conviene decir
# >>> por que esta aqui: el aislamiento entre organizaciones se apoya en la RLS
# >>> de Postgres, y `nobypassrls` es lo UNICO que impide que el rol de la
# >>> aplicacion la atraviese. Un privilegio que se olvide NO DA ERROR --
# >>> `zonas-de-riesgo.md` (R2) lo clasifica en rojo por eso mismo: la consulta
# >>> contesta igual, con filas de otras empresas o con cero en silencio, y la
# >>> instancia parece sana. Hasta hoy esa palabra no la miraba NINGUNA prueba:
# >>> lo unico que la sostenia era estar escrita bien en los dos guiones de
# >>> alta a la vez, y desde hoy esta escrita una sola (`base-instancia.sh`).
hubo 'noinherit nobypassrls'
# Y que tampoco gane privilegios por el otro lado: el rol de la aplicacion no
# crea bases ni roles.
hubo 'nosuperuser nocreatedb nocreaterole'
# El de MIGRACION si atraviesa la RLS, y tambien a proposito: `db/schema.sql`
# pone RLS con FORCE, que aplica INCLUSO AL DUENO, asi que sin esto el `pg_dump`
# que `update.sh` hace ANTES de migrar sale vacio y el update aborta. Ese rol no
# lo usa la aplicacion jamas: solo migra y respalda.
hubo 'noinherit bypassrls'
# La base es del migrador: todas las migraciones tienen que correr con el mismo
# dueno o un `alter` sobre una tabla ajena falla (hallazgo H1 del 24/08).
hubo 'owner spaces_migrador'
# El esquema base sale de la imagen y va ANTES de las migraciones: sin ese paso
# la primera se estrella contra una base vacia con `relation "public.clientes"
# does not exist` (medido el 2026-09-01).
hubo 'cat /app/db/schema.sql'
# Y se aplica con el rol MIGRADOR, que es el unico con DDL, parando en el primer
# error: a medias es peor que no aplicado.
hubo '-U spaces_migrador -d spaces -v ON_ERROR_STOP=1 -f /tmp/space-os-schema.sql'
# `--instalacion-nueva` lo pasa el ALTA y nunca `update.sh`: es lo que le dice
# al runner que esta base acaba de nacer y no es una rezagada.
hubo 'migrar.mjs --instalacion-nueva'
limpiar

# ============================================================================
#  CONTENIDO · cada rol en su archivo, y el canal en los dos  (2026-09-11)
# ============================================================================
#  La otra mitad de R2, y la mas silenciosa de las dos. El escenario de arriba
#  comprueba que la base NACE con los privilegios correctos; este comprueba que
#  la aplicacion se CONECTA con el rol correcto, que es el otro extremo de la
#  misma cadena y falla igual de callado:
#
#    · `app.env` lo lee la APLICACION (docker --env-file). Tiene que llevar la
#      URL de `spaces_app`, el rol `nobypassrls`.
#    · `instancia.env` lo lee el ACTUALIZADOR. Lleva la del migrador, que es
#      `bypassrls` porque tiene que respaldar y migrar.
#
#  Poner la del migrador en `app.env` deja la aplicacion corriendo con un rol
#  que ATRAVIESA LA RLS ENTERA: sirve, no da ningun error, y devuelve datos de
#  todas las organizaciones. Se midio el 2026-09-11 que ese mutante ESCAPABA con
#  0 fallos, porque el doble de `ssh` tiraba el cuerpo de los archivos.
#
#  Y se corre con CANAL=beta A PROPOSITO. Con el canal por omision este
#  escenario no podria ver nada: la plantilla ya trae `CANAL=estable`, asi que
#  un alta que no sustituyera nada daria el mismo texto que una que si. Con
#  `beta` --la desviacion consciente de un ensayo-- la sustitucion se ve o no
#  esta. Es exactamente la corrida en la que la deriva de `CANAL` habria
#  aparecido: el actualizador jalando `beta` y `/api/version` diciendo
#  `estable`.
escenario 'CONTENIDO · app.env lleva el rol de la aplicacion e instancia.env el del migrador, y el canal va en los dos'
preparar
correr REGISTRY=registro.ejemplo/x REGISTRY_TOKEN=t CANAL=beta -- \
  --host "$IP" --dominio "$DOM" --instancia p --confirmar
# >>> La aplicacion se conecta con SU rol, y esta es la comprobacion hermana de
# >>> `nobypassrls`: aquella mira con que privilegios nace el rol, y esta con
# >>> cual de los dos roles acaba hablando la aplicacion.
escrito_dice /etc/space-os/app.env 'DATABASE_URL=postgresql://spaces_app:'
# Y no se le acerca al otro. La plantilla no menciona `spaces_migrador` en
# ninguna parte, ni en un comentario, asi que esta ausencia es exacta.
escrito_calla /etc/space-os/app.env 'spaces_migrador'
# El canal, en los DOS archivos: es la deriva que cerro la tarea 10.
escrito_dice /etc/space-os/app.env 'CANAL=beta'
escrito_dice /etc/space-os/instancia.env 'CANAL=beta'
# El actualizador si usa el rol privilegiado: sin DDL no puede migrar, y sin
# `bypassrls` el pg_dump previo saldria vacio.
escrito_dice /etc/space-os/instancia.env 'DATABASE_URL=postgresql://spaces_migrador:'
escrito_dice /etc/space-os/instancia.env 'INSTANCIA=p'
# El dominio llega a las dos variables que lo necesitan, y no a medias: un
# `APP_URL` con el dominio de la plantilla manda los correos y los redirects de
# OAuth a otra parte.
escrito_dice /etc/space-os/app.env "APP_URL=https://$DOM"
escrito_dice /etc/space-os/app.env "GOOGLE_REDIRECT_URI=https://$DOM/spaces-dooh/api/auth/google/callback/"
# El token de arranque queda SUSTITUIDO de verdad. La plantilla lo trae vacio, y
# con el vacio el `--bootstrap` no puede crear la primera organizacion: el alta
# se queda sin Dueño y la puerta no se cierra sola.
escrito_casa /etc/space-os/app.env '^BOOTSTRAP_TOKEN=[0-9a-f]{64}$'
escrito_casa /etc/space-os/app.env '^FLOTA_TOKEN=[0-9a-f]{64}$'
limpiar

# ============================================================================
#  El candado de apt en `setup-droplet.sh`  (defecto 37, 2026-09-08)
# ============================================================================
#  Estas son ESTATICAS y no de ejecucion, a proposito: `setup-droplet.sh` corre
#  DENTRO del droplet, por `ssh root@host 'bash -s'`, asi que este arnes nunca
#  lo ejecuta -- solo ve que se manda. Lo unico que se puede afirmar aqui es la
#  forma del guion que se manda, y resulta que es exactamente donde estaba el
#  defecto.
#
#  Que paso: el alta de `g500` murio con codigo 100 a los 2 min 26 s, con el
#  droplet ya creado y cobrandose:
#
#    E: Could not get lock /var/lib/apt/lists/lock. It is held by process 9094
#
#  Dos causas encadenadas. `NEEDRESTART_MODE=a` reiniciaba `cloud-final.service`
#  --la fase final de cloud-init, que instala paquetes por su cuenta-- y el
#  `apt-get install` siguiente se encontraba el candado puesto. Y ninguna
#  llamada a apt esperaba: se rendian.
#
#  Es una CARRERA, que es lo que la hace peligrosa: `ensayo4` la gano el 07/09 y
#  `g500` la perdio el 08/09 con el mismo guion. Un fallo que aparece un dia de
#  cada diez no lo caza nadie mirando.
escenario '37 · ninguna llamada a apt se rinde ante el candado'
SETUP="$(dirname "${BASH_SOURCE[0]}")/setup-droplet.sh"

# Ni una sola invocacion cruda. La que se olvide es la que falla.
if grep -nE '^[[:space:]]*apt-get ' "$SETUP" >/dev/null; then
  mal "hay apt-get sin envoltorio: $(grep -cE '^[[:space:]]*apt-get ' "$SETUP") linea(s)"
else bien; fi

# El envoltorio existe y de verdad pide esperar. Anclado a la DEFINICION y no a
# «que la cadena aparezca en el archivo»: escrito asi, esta comprobacion pasaba
# con el envoltorio ya roto, porque la cadena sale tambien en el comentario que
# la explica. Lo cazo su mutante el 2026-09-08, y es la misma leccion de siempre
# aqui: una comprobacion por presencia de texto se queda verde sola.
if grep -qE '^[[:space:]]*apt_get\(\).*DPkg::Lock::Timeout' "$SETUP"; then bien; else
  mal "el envoltorio apt_get() no pasa DPkg::Lock::Timeout: apt se rendira igual"; fi

# Y no se vuelve a `a`, que es lo que reiniciaba cloud-final.
if grep -qE '^export NEEDRESTART_MODE=a[[:space:]]*$' "$SETUP"; then
  mal "NEEDRESTART_MODE=a reinicia cloud-final.service y le da el candado a cloud-init"
else bien; fi

# El menu interactivo sigue muerto: eso costo una hora el 03/09 y no se pierde.
if grep -qF 'NEEDRESTART_MODE' "$SETUP"; then bien; else
  mal "sin NEEDRESTART_MODE el upgrade abre el menu y se cuelga sin dar error"; fi
if grep -qF 'DEBIAN_FRONTEND=noninteractive' "$SETUP"; then bien; else
  mal "sin DEBIAN_FRONTEND=noninteractive un dialogo de apt cuelga el alta"; fi

printf '\n%s escenarios · %s comprobaciones · %s fallos\n' "$ESCENARIOS" "$COMPROBACIONES" "$FALLOS"
[ "$FALLOS" -eq 0 ] || exit 1

# ============================================================================
#  MUTANTES · que estos escenarios MUERDAN
# ----------------------------------------------------------------------------
#  Un arnes en verde no demuestra nada por si solo: demuestra que hoy no falla.
#  Lo que hay que demostrar es que si el arreglo se deshace, esto se pone rojo.
#  Cada mutante DESHACE uno de los seis arreglos del 2026-09-07 y comprueba que
#  su escenario lo caza.
#
#  Y ya se gano su sitio antes de existir: al escribirlo aparecio que la
#  asercion del 35 era demasiado laxa --un `grep -F` de la ruta de `update.sh`
#  casaba con ESCRIBIRLO, no solo con ejecutarlo--, asi que ese escenario daba
#  verde sin haber probado nada. Un mutante que escapa es un agujero en las
#  PRUEBAS, no en el codigo.
#
#    bash infra/scripts/pruebas-provision.sh --mutantes
# ============================================================================
if [ "${1:-}" = '--mutantes' ]; then
  MUT_TOTAL=0
  MUT_FALLOS=0
  BASE_ORIG="$RAIZ/infra/scripts/base-instancia.sh"

  # ─── Donde se crea la copia, que es la mitad de que esto sirva ────────────
  #  AL LADO del guion, nunca en /tmp, y no es una preferencia de orden:
  #  `provision-instancia.sh` resuelve TODO lo que manda al servidor contra
  #  `RAIZ="$(dirname "$0")/../.."`. Con la copia en /tmp, RAIZ sale `/` y el
  #  guion muere con «falta //infra/env/app.env.example» ANTES de hacer nada.
  #  O sea que CUALQUIER mutante daba rojo --incluido uno que no cambia ningun
  #  comportamiento-- y la barrida decia «0 escapan» sin haber probado nada.
  #
  #  >>> ESTE FALSO VERDE TUVO DOS CAUSAS Y SE ARREGLO EN DOS VECES, y conviene
  #  >>> que quede escrito porque la primera vez se dio por cerrado entero:
  #  >>>   1. la copia no encontraba `base-instancia.sh` al lado (arreglado con
  #  >>>      `SPACE_OS_BASE_INSTANCIA_SH`, en `preparar()`);
  #  >>>   2. y aunque lo encontrara, seguia muriendo por `RAIZ` -- esto.
  #  >>> Los commits de la primera afirmaron que quedaba resuelto. No lo estaba.
  #  >>> Por eso existe el CENTINELA de abajo: para que la proxima vez lo diga
  #  >>> el arnes y no una persona leyendo.
  #
  #  Si una corrida se interrumpe puede quedar un `.mutante-*.sh` en
  #  `infra/scripts/`: es basura y se puede borrar sin mirar.
  copia_al_lado() { mktemp "$RAIZ/infra/scripts/.mutante-XXXXXX.sh"; }

  # Corre el arnes entero contra un mutante y devuelve cuantas comprobaciones
  # quedaron en rojo. Se lee del resumen y no del codigo de salida, porque «se
  # puso rojo» y «murio por otra cosa» tienen que poder distinguirse.
  rojas_con() {
    local cual="$1" copia="$2" resumen
    if [ "$cual" = provision ]; then
      resumen="$(GUION_PROVISION="$copia" bash "$0" 2>/dev/null | tail -n1)"
    else
      resumen="$(BASE_MUT="$copia" bash "$0" 2>/dev/null | tail -n1)"
    fi
    case "$resumen" in
      *comprobaciones*fallos) printf '%s' "$resumen" | awk '{print $(NF-1)}' ;;
      *) printf '' ;;   # el arnes no llego ni a imprimir el resumen
    esac
  }

  probar_mutante()      { probar_mutante_en provision "$1" "$2"; }
  probar_mutante_base() { probar_mutante_en base      "$1" "$2"; }

  probar_mutante_en() {
    local cual="$1" desc="$2" expresion="$3" objetivo copia rojas
    if [ "$cual" = provision ]; then objetivo="$GUION"; else objetivo="$BASE_ORIG"; fi
    MUT_TOTAL=$((MUT_TOTAL + 1))
    copia="$(copia_al_lado)"
    sed "$expresion" "$objetivo" >"$copia"
    # Un mutante que no cambia nada no prueba nada, y casi siempre significa que
    # el texto que buscaba la expresion ya no esta: la expresion se quedo vieja.
    if cmp -s "$copia" "$objetivo"; then
      printf '   NO APLICADO (la expresion no casa): %s\n' "$desc" >&2
      MUT_FALLOS=$((MUT_FALLOS + 1)); rm -f "$copia"; return
    fi
    # Y uno que no compila tampoco: moriria por la sintaxis y no por el sabotaje.
    if ! bash -n "$copia" 2>/dev/null; then
      printf '   INVALIDO (bash -n no lo acepta): %s\n' "$desc" >&2
      MUT_FALLOS=$((MUT_FALLOS + 1)); rm -f "$copia"; return
    fi
    chmod +x "$copia"
    # La llamada recursiva va SIN argumentos, asi que corre solo los escenarios
    # y no vuelve a entrar aqui.
    rojas="$(rojas_con "$cual" "$copia")"
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
  #  El unico «mutante» que TIENE que escapar. Es el guion tal cual con un
  #  comentario de mas al final: no cambia un solo comportamiento, asi que un
  #  arnes que discrimine tiene que darle 0 rojas. Si muere, la barrida esta
  #  matando a todos por el mismo motivo --por donde vive la copia, por un
  #  archivo que no encuentra, por lo que sea-- y todos los «muerde» de abajo
  #  son humo. Dos veces ha pasado ya; la tercera la dice esto.
  #
  #  Un comentario al final es la mutacion inocua mas estable que hay: no
  #  depende de que ninguna linea del guion siga escrita como hoy.
  probar_centinela() {
    local copia rojas
    MUT_TOTAL=$((MUT_TOTAL + 1))
    copia="$(copia_al_lado)"
    { cat "$GUION"; printf '# centinela de la barrida de mutantes: no cambia nada.\n'; } >"$copia"
    chmod +x "$copia"
    rojas="$(rojas_con provision "$copia")"
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

  # 31 · volver a exigir el registro a todos los modos.
  probar_mutante 'exigir REGISTRY tambien al certificado y al bootstrap' \
    's@if \[\[ "\$EMITIR_CERT" -eq 0 && "\$BOOTSTRAP" -eq 0 \]\]; then@if true; then@'

  # 32 · dejar pasar un CERTBOT_EMAIL vacio, que es lo que dejaba a certbot
  #      esperando una cuenta que nadie puede teclear.
  probar_mutante 'dejar pasar un CERTBOT_EMAIL vacio' \
    's@\[\[ -n "\$CERTBOT_EMAIL" \]\] ||@[[ 1 -eq 1 ]] ||@'

  # 33 · quitar el `!`: con eso un ssh caido vuelve a caer en la rama del token
  #      ausente, que es EXACTAMENTE el comportamiento de antes del arreglo.
  probar_mutante 'un ssh caido vuelve a reportarse como token ausente' \
    's@if ! TOKEN_ARRANQUE=@if TOKEN_ARRANQUE=@'

  # 34 · devolver la comprobacion decorativa del certificado.
  probar_mutante 'el certificado vuelve a dar por bueno cualquier codigo' \
    's@if \[\[ "\$CODIGO_LOGIN" != "200" \]\]; then@if false; then@'

  # 35 · dejar la instancia muerta hasta las 4:17.
  probar_mutante 'no arrancar la aplicacion y esperar al cron' \
    's@if remoto "/opt/space-os/update.sh"; then@if true; then@'

  # 36 · devolver la afirmacion falsa: «existe una organizacion» sin que exista.
  probar_mutante 'el bootstrap vuelve a afirmar que la organizacion existe' \
    's@if \[\[ "\$CODIGO_BOOT" != "201" \]\]; then@if false; then@'

  # A3.1 - las dos comprobaciones por AUSENCIA. Son las que mas facil se quedan
  # verdes solas --pasan el dia que alguien renombra la cadena que buscaban--,
  # asi que son las que mas falta les hace un mutante: si alguien devuelve la
  # contrasena al alta, tienen que ponerse rojas.
  probar_mutante 'el alta vuelve a imprimir una clave del Dueno' \
    's@La organizacion no lleva contrasena@    clave:    xxxx@'

  probar_mutante 'el cuerpo del bootstrap vuelve a llevar password' \
    's@"email":"$EMAIL_DUENO"}@"email":"$EMAIL_DUENO","password":"x"}@'

  # ─── Lo que se ESCRIBE en la instancia (2026-09-11) ───────────────────────
  #  El primero es el mas grave de todo este archivo: deja la APLICACION
  #  conectandose con el rol de migracion, que lleva `bypassrls` y atraviesa la
  #  RLS entera. La instancia sirve, no da un error, y devuelve datos de todas
  #  las organizaciones. Escapaba con 0 fallos hasta que el doble de `ssh`
  #  empezo a guardar el cuerpo de los archivos.
  probar_mutante 'la aplicacion se conecta con el rol de MIGRACION (atraviesa la RLS)' \
    's@DATABASE_URL=$(url_app "$CLAVE_APP")@DATABASE_URL=$(url_migrador "$CLAVE_MIGRADOR")@'

  #  Y el segundo deshace la deriva que la tarea 10 cerro: `CANAL` se queda sin
  #  sustituir y el panel de flota reporta un canal que no es el que la
  #  instancia sigue. Rompe la sustitucion en los DOS archivos y no solo en
  #  `app.env`, porque el texto del `sed` es el mismo en los dos sitios y una
  #  expresion no los distingue sin anclarse a la linea entera: da igual para lo
  #  que importa --que la comprobacion de `app.env` muerda-- y dice la verdad
  #  sobre lo que hace.
  probar_mutante 'el CANAL deja de sustituirse en los dos archivos' \
    's@s#\^CANAL=\.\*#CANAL=\$CANAL#@s#^CANAL_QUE_NO_EXISTE=.*#CANAL=$CANAL#@'

  # ============================================================================
  #  MUTANTES SOBRE `base-instancia.sh`  (2026-09-11)
  # ----------------------------------------------------------------------------
  #  Desde la tarea 10, lo que crea la base de datos NO vive en el guion: vive
  #  en el archivo que el guion sourcea, y lo comparten los dos caminos de alta.
  #  Una barrida que solo pudiera mutar el guion dejaria los privilegios de los
  #  dos roles de Postgres sin nadie que comprobara que sus comprobaciones
  #  muerden -- que es justo lo que este bloque existe para evitar. Mismo
  #  mecanismo de dos objetivos que `pruebas-update.sh:2963-2965` con
  #  `respaldo.sh`.
  #
  #  Los siete estaban medidos en el informe de la tarea y NO en el archivo, o
  #  sea que habia que teclearlos a mano. Un mutante que hay que teclear es un
  #  mutante que nadie vuelve a correr.
  # ============================================================================

  # >>> El de mas arriba de todos, aunque sea el mismo `sed` de una palabra: sin
  # >>> `nobypassrls` el rol de la APLICACION atraviesa la RLS, y eso no da
  # >>> error -- da datos de quien no toca.
  probar_mutante_base 'el rol de la aplicacion pierde nobypassrls (atraviesa la RLS)' \
    's/ noinherit nobypassrls"/ noinherit"/'

  probar_mutante_base 'el rol de la aplicacion gana createdb' \
    's/nosuperuser nocreatedb/nosuperuser createdb/'

  # El de migracion es el contrario: si NO atraviesa la RLS, el `pg_dump` que
  # `update.sh` hace antes de migrar sale vacio y el update aborta.
  probar_mutante_base 'el rol de migracion pierde bypassrls (el respaldo previo saldria vacio)' \
    's/ noinherit bypassrls"/ noinherit"/'

  probar_mutante_base 'la base nace con otro dueno' \
    's/create database %s owner %s/create database %s owner postgres --%s/'

  probar_mutante_base 'las migraciones pierden --instalacion-nueva' \
    's/ --instalacion-nueva"/"/'

  probar_mutante_base 'el esquema base sale de otra ruta de la imagen' \
    's#RUTA_ESQUEMA_EN_IMAGEN=/app/db/schema.sql#RUTA_ESQUEMA_EN_IMAGEN=/app/db/otro.sql#'

  probar_mutante_base 'el esquema se aplica sin ON_ERROR_STOP (a medias y sin decirlo)' \
    's/-v ON_ERROR_STOP=1 -f/-f/'

  printf '\n%s mutantes (el primero es el centinela) · %s mal\n' "$MUT_TOTAL" "$MUT_FALLOS"
  [ "$MUT_FALLOS" -eq 0 ] || exit 1
fi
