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
case "$todo" in
  *"install -m"*"cat >"*)
    cat >/dev/null 2>&1
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
    cat >/dev/null 2>&1
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
  : >"$REG_LLAMADAS"
  export REG_LLAMADAS
  montar_dobles
  RUTA_ANTES="$PATH"
  PATH="$BIN:$PATH"
  unset D_SSH_FALLA D_CODIGO_LOGIN D_CODIGO_BOOT D_UPDATE_FALLA D_TOKEN_ARRANQUE
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
# Y lo mas importante para quien esta delante con una clave en pantalla:
dice 'NO SIRVE'
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

escenario '36d · con 201 SI lo afirma, y sale bien'
preparar
correr D_CODIGO_BOOT=201 -- \
  --host "$IP" --dominio "$DOM" --instancia p --email a@ejemplo.com --bootstrap --confirmar
codigo_es 0
dice 'La puerta ya se cerro sola'
limpiar

# ============================================================================
#  Y dos afirmaciones GLOBALES sobre el propio arnes
# ============================================================================
#  No son de cortesia. Un arnes de aprovisionamiento que se saliera a la red
#  crearia droplets cada vez que alguien corre las pruebas, y uno que no
#  intercepta nada da verde sin haber probado nada.
escenario 'GLOBAL · el arnes intercepta, y nada salio de los dobles'
preparar
correr REGISTRY=registro.ejemplo/x REGISTRY_TOKEN=t -- \
  --host "$IP" --dominio "$DOM" --instancia p --confirmar
if [ -s "$REG_LLAMADAS" ]; then bien; else mal "no se registro ni una llamada: el arnes no intercepta"; fi
# Las direcciones de todos los escenarios son de documentacion (RFC 5737 y
# RFC 2606): no existen ni pueden existir.
no_hubo 'digitalocean.com'
no_hubo 'space-os.io'
limpiar

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

  probar_mutante() {
    local desc="$1" expresion="$2" tmp
    MUT_TOTAL=$((MUT_TOTAL + 1))
    tmp="$(mktemp)"
    sed "$expresion" "$GUION" >"$tmp"
    # Un mutante que no cambia nada no prueba nada, y casi siempre significa que
    # el texto que buscaba la expresion ya no esta: la expresion se quedo vieja.
    if cmp -s "$tmp" "$GUION"; then
      printf '   NO APLICADO (la expresion no casa): %s\n' "$desc" >&2
      MUT_FALLOS=$((MUT_FALLOS + 1))
      rm -f "$tmp"
      return
    fi
    chmod +x "$tmp"
    # La llamada recursiva va SIN argumentos, asi que corre solo los escenarios
    # y no vuelve a entrar aqui.
    if GUION_PROVISION="$tmp" bash "$0" >/dev/null 2>&1; then
      printf '   ESCAPA: %s\n' "$desc" >&2
      MUT_FALLOS=$((MUT_FALLOS + 1))
    else
      printf '   muerde: %s\n' "$desc"
    fi
    rm -f "$tmp"
  }

  printf '\n── mutantes\n'

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

  printf '\n%s mutantes · %s escapan\n' "$MUT_TOTAL" "$MUT_FALLOS"
  [ "$MUT_FALLOS" -eq 0 ] || exit 1
fi
