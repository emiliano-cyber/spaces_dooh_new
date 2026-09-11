#!/usr/bin/env bash
# ============================================================================
#  provision-instancia.sh — deja una instancia de owner lista, salvo el DNS.
# ----------------------------------------------------------------------------
#  Se corre DESDE LA MAQUINA DEL OPERADOR, no dentro del droplet. Todo lo que
#  toca el servidor pasa por una sola funcion, `remoto()`, y esa funcion es
#  tambien la que respeta `--dry-run`. Un solo camino: si `--dry-run` funciona
#  en un paso, funciona en todos.
#
#  Uso:
#    provision-instancia.sh --host <ip|dns> --dominio <dominio> --instancia <nombre> --dry-run
#    provision-instancia.sh --host <ip|dns> --dominio <dominio> --instancia <nombre> --confirmar
#    provision-instancia.sh --host <ip|dns> --dominio <dominio> --emitir-certificado --confirmar
#    provision-instancia.sh --host <ip|dns> --dominio <dominio> --instancia <nombre> \
#                           --email <correo-del-dueno> --bootstrap --confirmar
#
#  NADA se ejecuta sin `--confirmar`. Sin esa bandera el script se comporta
#  como `--dry-run` aunque no se pida: aprovisionar es crear una base y un
#  usuario Dueño, y el modo por defecto de algo asi es «cuentame que harias».
#
#  ─── El alta de un owner NO es insertar una fila ───────────────────────────
#  Es aprovisionar una instancia entera: su droplet, su base, su dominio. Si
#  alguien vuelve a buscar aqui un `INSERT INTO tenants`, esta en el modelo
#  equivocado — el que murio el 2026-08-12.
#
#  ─── Lo que este script NO hace, y es deliberado ───────────────────────────
#   · NO toca el DNS del owner. La zona es suya; AS OOH no entra ahi. El script
#     se DETIENE y entrega la instruccion para que la ponga el owner.
#   · NO instala el canal `beta`. Una instancia de owner sigue `estable`
#     siempre: el invariante 13 dice que nada llega a un owner sin pasar antes
#     por el banco de pruebas.
#   · NO deja credenciales en disco del operador ni en el historial: el token
#     de arranque y la clave del Dueño se imprimen UNA VEZ.
#
#  ─── Los dos modos de servidor, y por que estan los dos ────────────────────
#  Todavia no esta decidido en que cuenta de DigitalOcean nacen las instancias
#  (§8.3 del plan). En vez de esperar, el script lleva los dos caminos:
#
#    --crear-droplet   lo crea con `doctl` en la cuenta ya configurada
#    --host <ip|dns>   usa un servidor que ya existe (el caso «cuenta del owner»)
#
#  Lo que NO se decide aqui es cual es el de por defecto: no hay ninguno. Hay
#  que elegir uno en cada corrida, a proposito.
# ============================================================================
set -euo pipefail

# ─── Codigos de salida ──────────────────────────────────────────────────────
EX_USO=64        # argumentos mal
EX_ENTORNO=1     # falta una herramienta o una plantilla
EX_REMOTO=2      # el servidor contesto mal

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TPL_APP="$RAIZ/infra/env/app.env.example"
TPL_INST="$RAIZ/infra/env/instancia.env.example"
TPL_NGINX="$RAIZ/infra/nginx/instancia.conf.tpl"

# ─── Lo que crea la base de datos se SOURCEA, no se copia ───────────────────
# `base-instancia.sh` es la UNICA definicion de los dos roles de Postgres, de
# la base, del esquema y de las migraciones. La comparte con
# `instalar-hijo.sh`, que hace el mismo alta desde dentro de la maquina del
# cliente: escrita una vez, un arreglo de privilegios llega a los dos caminos o
# a ninguno. Mismo patron que `update.sh` con `respaldo.sh` (`update.sh:209`) y
# por el mismo motivo, dicho ahi: lo que se copia, deriva.
#
# Si no esta al lado, se PARA aqui y lo dice, antes de tocar el servidor:
# seguir a medias significaria crear los roles con lo que este guion se
# acuerde, que es exactamente lo que ese archivo existe para que nadie vuelva a
# hacer. La variable de entorno es para los mutantes del arnes, que corren una
# copia de este guion en otro directorio (`pruebas-provision.sh`).
BASE_INSTANCIA_SH="${SPACE_OS_BASE_INSTANCIA_SH:-$(dirname "${BASH_SOURCE[0]}")/base-instancia.sh}"
if [[ ! -f "$BASE_INSTANCIA_SH" ]]; then
  echo "provision: falta $BASE_INSTANCIA_SH, que trae lo que crea la base de datos." >&2
  echo "           No se sigue sin el: los roles de Postgres se definen ahi una" >&2
  echo "           sola vez, y un rol con el privilegio equivocado no da error." >&2
  exit "$EX_ENTORNO"
fi
# shellcheck source=base-instancia.sh
. "$BASE_INSTANCIA_SH"

HOST=""
DOMINIO=""
INSTANCIA=""
EMAIL_DUENO=""
CREAR_DROPLET=0
CONFIRMAR=0
EMITIR_CERT=0
BOOTSTRAP=0
# Region y tamano solo se usan con --crear-droplet. Se dejan como variables de
# entorno y sin valor por defecto quemado: son decisiones de cuenta, no del
# script.
DO_REGION="${DO_REGION:-}"
DO_TAMANO="${DO_TAMANO:-}"
# Las claves SSH que se meten EN EL DROPLET al crearlo (ids o fingerprints,
# separados por coma). DigitalOcean NO anade solas las claves de la cuenta: un
# droplet nace unicamente con las que se le pasan aqui. Sin esto la maquina nace
# con contrasena de root por correo y el paso 2 --que es un `ssh`-- muere con el
# droplet ya creado y cobrandose. Se listan con `doctl compute ssh-key list`.
DO_SSH_KEYS="${DO_SSH_KEYS:-}"
# El correo de la cuenta de Let's Encrypt. En una maquina recien creada NO hay
# cuenta, y `certbot -n` no puede preguntarla: sin esto el certificado falla en la
# PRIMERA instancia de cada droplet, o sea en todas. De quien es ese correo es una
# DECISION --si es del owner, los avisos de caducidad le llegan a el y AS OOH no se
# entera; si es de AS OOH, se entera quien renueva-- asi que entra por entorno y el
# guion para si falta, en vez de inventarse uno.
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
DO_IMAGEN="${DO_IMAGEN:-ubuntu-22-04-x64}"

# El registro de imagenes, por ENTORNO y no por argumento, por dos motivos
# distintos: el token no debe aparecer en `ps` ni en el historial, y el nombre
# del registro no se quema en un archivo versionado (regla de CLAUDE.md).
# Desde el 2026-09-01 el alta MIGRA con la imagen, asi que hacen falta ya aqui.
REGISTRY="${REGISTRY:-}"
REGISTRY_TOKEN="${REGISTRY_TOKEN:-}"
IMAGEN_NOMBRE="${IMAGEN_NOMBRE:-space-os}"
# `estable` por omision: una instancia de owner NUNCA sigue `beta` (invariante
# 13). CANAL=beta se usa para un ENSAYO en un droplet desechable, y eso es una
# desviacion consciente del runbook.
CANAL="${CANAL:-estable}"

uso() { sed -n '2,44p' "$0"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)                HOST="${2:-}"; shift 2 ;;
    --dominio)             DOMINIO="${2:-}"; shift 2 ;;
    --instancia)           INSTANCIA="${2:-}"; shift 2 ;;
    --email)               EMAIL_DUENO="${2:-}"; shift 2 ;;
    --crear-droplet)       CREAR_DROPLET=1; shift ;;
    --confirmar)           CONFIRMAR=1; shift ;;
    --dry-run)             CONFIRMAR=0; shift ;;
    --emitir-certificado)  EMITIR_CERT=1; shift ;;
    --bootstrap)           BOOTSTRAP=1; shift ;;
    -h|--ayuda|--help)     uso; exit 0 ;;
    *) echo "provision: argumento desconocido: $1" >&2; uso >&2; exit "$EX_USO" ;;
  esac
done

# ─── Validacion ─────────────────────────────────────────────────────────────
[[ -n "$DOMINIO" ]] || { echo "provision: falta --dominio" >&2; exit "$EX_USO"; }

if [[ "$CREAR_DROPLET" -eq 1 && -n "$HOST" ]]; then
  echo "provision: --crear-droplet y --host se excluyen. Elige uno." >&2
  exit "$EX_USO"
fi
if [[ "$CREAR_DROPLET" -eq 0 && -z "$HOST" ]]; then
  echo "provision: hace falta --host <ip|dns> o --crear-droplet." >&2
  echo "           No hay modo por defecto: en que cuenta nacen las instancias" >&2
  echo "           sigue sin decidirse (§8.3)." >&2
  exit "$EX_USO"
fi

# Sin registro no hay imagen, y sin imagen no hay migraciones ni aplicacion. Se
# comprueba AQUI y no al usarlo: fallar despues de crear el droplet y la base
# deja media instancia hecha.
#
# Pero SOLO en los modos que usan la imagen. `--emitir-certificado` y
# `--bootstrap` no la tocan, y exigirsela tenia un coste que no se veia: obligaba
# al operador a volcar los TRES tokens al entorno de su shell para emitir un
# certificado que no necesita ninguno. Medido el 2026-09-07: los dos ultimos
# pasos del runbook fallaban con un mensaje sobre el registro, que manda a mirar
# al sitio equivocado.
if [[ "$EMITIR_CERT" -eq 0 && "$BOOTSTRAP" -eq 0 ]]; then
  if [[ -z "$REGISTRY" ]]; then
    echo "provision: falta REGISTRY (p. ej. registry.digitalocean.com/<nombre>)." >&2
    echo "           Va por entorno, no por argumento: no se quema en el repo." >&2
    echo "           Plantilla: infra/env/ejecutor.env.example" >&2
    exit "$EX_USO"
  fi
  # El token solo hace falta para EJECUTAR. En simulacion se muestra el login sin
  # credencial, que es justo lo que hay que poder revisar sin tener secretos.
  if [[ "$CONFIRMAR" -eq 1 && -z "$REGISTRY_TOKEN" ]]; then
    echo "provision: falta REGISTRY_TOKEN (de SOLO LECTURA) para bajar la imagen." >&2
    exit "$EX_USO"
  fi
fi

# El dominio se valida de verdad: un dominio con un espacio o una barra acaba
# dentro de un `sed` y de un `server_name`, y el sintoma aparece mucho despues,
# cuando nginx no arranca.
if ! [[ "$DOMINIO" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]; then
  echo "provision: --dominio '$DOMINIO' no parece un dominio." >&2
  exit "$EX_USO"
fi

# ─── El unico camino que toca el servidor ───────────────────────────────────
DRY_ETIQUETA="[SIMULACION]"
[[ "$CONFIRMAR" -eq 1 ]] && DRY_ETIQUETA=""

IMAGEN="$(imagen_instancia "$REGISTRY" "$IMAGEN_NOMBRE" "$CANAL")"

# Entra al registro DESDE EL SERVIDOR. El token viaja por la entrada estandar de
# ssh y nunca como argumento: en `ps` de la instancia solo se ve `docker login`.
# Misma disciplina que `release.yml:241-242`.
registro_login() {
  local host="${REGISTRY%%/*}"
  if [[ "$CONFIRMAR" -ne 1 ]]; then
    printf '%s ssh root@%s docker login %s (token por stdin)
'       "$DRY_ETIQUETA" "${HOST:-<pendiente>}" "$host"
    return 0
  fi
  printf '%s' "$REGISTRY_TOKEN"     | ssh -o StrictHostKeyChecking=accept-new "root@$HOST"         "TOK=\$(cat); printf '%s' \"\$TOK\" | docker login '$host' --username \"\$TOK\" --password-stdin" >/dev/null
}

paso() { printf '\n── %s\n' "$*"; }

# Ejecuta un comando EN EL SERVIDOR. Sin --confirmar, solo lo imprime.
#
# Todo pasa por aqui a proposito. La alternativa —un `if $DRY_RUN` en cada
# sitio— es donde se cuela el paso que si se ejecuta: basta olvidar uno.
# Espera a que la maquina nueva acepte ssh. `doctl ... --wait` espera a que el
# droplet este ACTIVE, y active NO quiere decir que sshd escuche: sigue
# arrancando. Medido el 2026-09-03 en el ensayo de F5.6:
#
#   -- Base del servidor (Docker, nginx, certbot, ufw)
#   ssh: connect to host 157.245.143.158 port 22: Connection refused
#
# `Connection refused` no es la llave --eso seria `Permission denied
# (publickey)`--: es que todavia no hay nadie escuchando. Y el alta se planta con
# el droplet YA creado y cobrandose.
#
# Con techo a proposito: un bucle sin limite deja el alta colgada sin decir nada,
# que es el defecto 18 con otra cara.
esperar_ssh() {
  local host="$1" intentos="${ESPERAS_SSH:-40}" i=1
  while [[ "$i" -le "$intentos" ]]; do
    if ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 -o BatchMode=yes            "root@$host" true 2>/dev/null; then
      echo "  ssh responde (intento $i)"
      return 0
    fi
    sleep 5
    i=$((i + 1))
  done
  echo "provision: $host no acepto ssh tras $((intentos * 5))s." >&2
  echo "           El droplet EXISTE y se esta cobrando. No repitas el alta con" >&2
  echo "           --crear-droplet: crearias un segundo. Sigue con --host $host" >&2
  echo "           o borralo a proposito con: doctl compute droplet delete <id>" >&2
  exit "$EX_REMOTO"
}

remoto() {
  if [[ "$CONFIRMAR" -eq 1 ]]; then
    ssh -o StrictHostKeyChecking=accept-new "root@$HOST" "$@"
  else
    printf '%s ssh root@%s %s\n' "$DRY_ETIQUETA" "${HOST:-<pendiente>}" "$*"
  fi
}

# Manda un archivo al servidor por la entrada estandar: NO por argv, porque
# argv es visible en `ps` para cualquier usuario de la maquina y estos archivos
# llevan la clave de la base y los tokens.
remoto_escribir() {
  local destino="$1" modo="${2:-600}"
  if [[ "$CONFIRMAR" -eq 1 ]]; then
    ssh -o StrictHostKeyChecking=accept-new "root@$HOST" \
      "install -m $modo /dev/null '$destino' && cat > '$destino'"
  else
    cat >/dev/null
    printf '%s escribir %s (modo %s) por stdin\n' "$DRY_ETIQUETA" "$destino" "$modo"
  fi
}

local_requiere() {
  command -v "$1" >/dev/null 2>&1 || { echo "provision: falta '$1' en esta maquina" >&2; exit "$EX_ENTORNO"; }
}

# ─── Secretos: hex y nada mas ───────────────────────────────────────────────
# Hexadecimal a proposito, y no una clave "fuerte" con simbolos. La cadena de
# conexion se percent-encodea mal con facilidad —cada cliente se rompe con un
# caracter distinto, medido el 19/08— y ademas `update.sh` hace `source` de
# `instancia.env` en bash. Con hex no hay nada que escapar en ningun eslabon, y
# 32 bytes de entropia sobran.
secreto() {
  if [[ "$CONFIRMAR" -eq 1 ]]; then
    openssl rand -hex 32
  else
    echo "__SECRETO_SIMULADO__"
  fi
}

# ============================================================================
#  MODO C · --emitir-certificado   (se corre CUANDO el owner ya apunto su DNS)
# ============================================================================
if [[ "$EMITIR_CERT" -eq 1 ]]; then
  [[ -n "$CERTBOT_EMAIL" ]] || {
    echo "provision: falta CERTBOT_EMAIL en el entorno." >&2
    echo "           Es la cuenta de Let's Encrypt que recibe los avisos de" >&2
    echo "           caducidad. Una maquina nueva no tiene cuenta y certbot -n" >&2
    echo "           no puede preguntarla." >&2
    exit "$EX_USO"
  }
  paso "Emitiendo certificado para $DOMINIO"

  # HTTP-01 por webroot y NO `--nginx`: el reto lo sirve el vhost de solo-HTTP
  # que ya quedo instalado, asi que nginx no se toca mientras tanto. Con
  # `--nginx`, certbot reescribe la configuracion por su cuenta y deja de
  # parecerse a la plantilla versionada.
  #
  # `--webroot` tampoco necesita parar nginx, que es lo que obliga
  # `--standalone` y lo que convierte una renovacion en una caida.
  remoto "certbot certonly --webroot -w /var/www/html -n --agree-tos --no-eff-email \
    -m '$CERTBOT_EMAIL' -d '$DOMINIO'"

  paso "Instalando el vhost con TLS"
  # Hasta aqui el sitio era solo HTTP. Ahora si existe el certificado, asi que
  # se puede instalar la plantilla completa: nginx NO ARRANCA si apunta a un
  # `fullchain.pem` que no existe, y por eso este paso va despues y no antes.
  [[ -f "$TPL_NGINX" ]] || { echo "provision: falta $TPL_NGINX" >&2; exit "$EX_ENTORNO"; }
  sed "s/__DOMINIO__/$DOMINIO/g" "$TPL_NGINX" \
    | remoto_escribir "/etc/nginx/sites-available/$DOMINIO" 644
  remoto "ln -sfn '/etc/nginx/sites-available/$DOMINIO' '/etc/nginx/sites-enabled/$DOMINIO'"
  remoto "nginx -t && systemctl reload nginx"

  paso "Comprobacion"
  # Se COMPARA, no se imprime lo esperado y se sale 0. Hasta el 2026-09-07 esto
  # hacia `echo "Esperado: login 200"; exit 0`, y en el primer uso real dijo
  # `login 502` y `Finished with result: success` en la misma pantalla. Una
  # comprobacion que no compara no es una comprobacion: es una linea de log que
  # da permiso para seguir.
  if [[ "$CONFIRMAR" -ne 1 ]]; then
    printf '%s ssh root@%s curl https://%s/spaces-dooh/login/ (esperando 200)\n' \
      "$DRY_ETIQUETA" "${HOST:-<pendiente>}" "$DOMINIO"
    exit 0
  fi
  CODIGO_LOGIN="$(remoto "curl -s -o /dev/null -w '%{http_code}' 'https://$DOMINIO/spaces-dooh/login/'" || true)"
  echo "login $CODIGO_LOGIN"
  if [[ "$CODIGO_LOGIN" != "200" ]]; then
    echo "" >&2
    echo "provision: el certificado esta puesto y nginx sirve, pero la aplicacion" >&2
    echo "           NO responde (esperado 200, recibido '$CODIGO_LOGIN')." >&2
    echo "" >&2
    if [[ "$CODIGO_LOGIN" == "502" ]]; then
      echo "           Un 502 con el certificado bien casi siempre es lo mismo: el" >&2
      echo "           contenedor no esta levantado. El aprovisionamiento instala" >&2
      echo "           'update.sh' y su cron, y es el cron quien lo arranca --a las" >&2
      echo "           4:17. Para no esperar a la madrugada:" >&2
      echo "" >&2
      echo "             ssh root@$HOST /opt/space-os/update.sh" >&2
      echo "" >&2
      echo "           Y ojo con QUE clave usas: si la instancia la creo el panel," >&2
      echo "           solo entra la de 'altas'." >&2
    else
      echo "           Mira el log de la instancia antes de seguir con --bootstrap:" >&2
      echo "             ssh root@$HOST 'docker logs --tail 50 space-os'" >&2
    fi
    exit "$EX_REMOTO"
  fi
  exit 0
fi

# ============================================================================
#  MODO D · --bootstrap   (la primera organizacion y su Dueño)
# ============================================================================
if [[ "$BOOTSTRAP" -eq 1 ]]; then
  paso "Creando la primera organizacion de $DOMINIO"

  [[ -n "$INSTANCIA" ]] || { echo "provision: --bootstrap necesita --instancia <nombre de la organizacion>" >&2; exit "$EX_USO"; }
  # El correo del Dueño es un PARAMETRO y no un marcador de posicion, y desde
  # A3.1 importa MAS que antes: ya no hay clave que entregarle, asi que ese
  # correo ES su forma de entrar. Tiene que ser la cuenta de Google con la que
  # va a iniciar sesion. Un `CAMBIAME@...` crea una organizacion a la que no
  # puede entrar nadie, y la puerta del bootstrap se cierra sola detras.
  [[ -n "$EMAIL_DUENO" ]] || { echo "provision: --bootstrap necesita --email <correo del Dueño>" >&2; exit "$EX_USO"; }
  [[ "$EMAIL_DUENO" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || {
    echo "provision: --email '$EMAIL_DUENO' no parece un correo." >&2; exit "$EX_USO"; }

  # El token se lee del `app.env` del propio servidor y no se pide por
  # argumento: asi no acaba en el historial de la consola del operador.
  #
  # Un `ssh` caido NO es un token ausente, y hasta el 2026-09-07 se reportaba
  # como tal: el `|| true` se comia el fallo y el mensaje mandaba a buscar un
  # token que estaba perfectamente escrito. Se distinguen los dos casos.
  if [[ "$CONFIRMAR" -eq 1 ]]; then
    if ! TOKEN_ARRANQUE="$(remoto "sed -n 's/^BOOTSTRAP_TOKEN=//p' /etc/space-os/app.env")"; then
      echo "provision: no se pudo leer /etc/space-os/app.env en $HOST por ssh." >&2
      echo "           Esto NO dice nada del BOOTSTRAP_TOKEN: no se llego a mirar." >&2
      echo "" >&2
      echo "           Si el mensaje de arriba es 'Permission denied (publickey)':" >&2
      echo "           la instancia solo acepta las claves que se le inyectaron al" >&2
      echo "           crearla (DO_SSH_KEYS). Si la creo el panel, esa es la de" >&2
      echo "           'altas' y NO la de 'padre', asi que este guion hay que" >&2
      echo "           correrlo como 'altas':" >&2
      echo "" >&2
      echo "             systemd-run --uid=altas --gid=altas \\" >&2
      echo "               --property=EnvironmentFile=/etc/space-os/ejecutor.env \\" >&2
      echo "               --wait --pipe $0 <los mismos argumentos>" >&2
      exit "$EX_REMOTO"
    fi
    if [[ -z "$TOKEN_ARRANQUE" ]]; then
      echo "provision: la instancia no tiene BOOTSTRAP_TOKEN." >&2
      echo "           Se leyo el archivo y la clave no esta: o ya se arranco --y" >&2
      echo "           entonces la puerta esta cerrada sola-- o el" >&2
      echo "           aprovisionamiento no llego a escribirlo." >&2
      exit "$EX_REMOTO"
    fi
  else
    TOKEN_ARRANQUE="$(remoto "sed -n 's/^BOOTSTRAP_TOKEN=//p' /etc/space-os/app.env" || true)"
  fi

  # ─── A3.1 · aqui ya no se genera ninguna contrasena ──────────────────────
  # Hasta el 2026-09-07 esto hacia `CLAVE_DUENO="$(secreto)"` y la imprimia. Esa
  # clave era el motivo por el que el alta NO PODIA ser desatendida: habia que
  # estar delante para leerla y hacersela llegar al Dueño. Y mientras tanto se
  # quedaba en el historial de quien corriera el comando.
  #
  # Ahora el Dueño entra con Google (ADR 0028) y la propia aplicacion le enseña
  # sus codigos de recuperacion la primera vez. No hay nada que entregar, asi
  # que no hay que estar delante.
  echo ""
  echo "  La organizacion no lleva contrasena: el Dueño entra con Google."
  echo "    dominio:  https://$DOMINIO/spaces-dooh/login/"
  echo "    correo:   $EMAIL_DUENO   <-- tiene que ser su cuenta de Google"
  echo ""
  echo "  La primera vez que entre, la aplicacion le enseñara sus codigos de"
  echo "  recuperacion y le pedira que ponga su propia contrasena. Esa"
  echo "  contrasena NO sirve para entrar: sirve para autorizar cambios."
  echo ""

  if [[ "$CONFIRMAR" -ne 1 ]]; then
    printf '%s ssh root@%s curl -X POST http://127.0.0.1:3000/spaces-dooh/api/bootstrap/ (esperando 201)\n' \
      "$DRY_ETIQUETA" "${HOST:-<pendiente>}"
    echo ""
    echo "  $DRY_ETIQUETA no se creo ninguna organizacion."
    exit 0
  fi

  # La llamada va DESDE EL PROPIO SERVIDOR, por loopback: el token de arranque
  # no tiene por que cruzar internet, y asi funciona aunque el DNS todavia no
  # haya propagado.
  #
  # Se CAPTURA el codigo y se compara. Hasta el 2026-09-07 esto imprimia
  # "Esperado: bootstrap 201" y salia 0 SIEMPRE, y era peor que la comprobacion
  # del certificado: con un 404 o un 500 --curl sale 0 igual-- el guion afirmaba
  # «La puerta ya se cerro sola: existe una organizacion» sin que existiera
  # ninguna. Que el intento del 07/09 muriera con salida 7 fue casualidad:
  # `set -euo pipefail` y curl saliendo 7 por no poder conectar.
  set +e
  CODIGO_BOOT="$(remoto "curl -s -o /dev/null -w '%{http_code}' \
    -X POST http://127.0.0.1:3000/spaces-dooh/api/bootstrap/ \
    -H 'Content-Type: application/json' \
    -H \"x-bootstrap-token: \$(sed -n 's/^BOOTSTRAP_TOKEN=//p' /etc/space-os/app.env)\" \
    --data-binary @-" <<JSON
{"organizacion":"$INSTANCIA","nombre":"Dueno","email":"$EMAIL_DUENO"}
JSON
)"
  set -e

  echo "bootstrap $CODIGO_BOOT"
  if [[ "$CODIGO_BOOT" != "201" ]]; then
    echo "" >&2
    echo "provision: la organizacion NO se creo (esperado 201, recibido '$CODIGO_BOOT')." >&2
    echo "           NO HAY NINGUNA CUENTA: ese correo todavia no puede entrar." >&2
    echo "" >&2
    case "$CODIGO_BOOT" in
      000)
        echo "           Un '000' es que nadie contesto: la aplicacion no esta" >&2
        echo "           levantada. Arrancala y repite este mismo comando --la" >&2
        echo "           puerta sigue abierta porque no se creo nada:" >&2
        echo "" >&2
        echo "             ssh root@$HOST /opt/space-os/update.sh" >&2
        ;;
      404)
        echo "           Un 404 significa UNA de dos cosas, y la ruta devuelve lo" >&2
        echo "           mismo para las dos a proposito: o ya existe una" >&2
        echo "           organizacion --y entonces esto ya se hizo y no hay que" >&2
        echo "           repetirlo-- o el token de arranque no coincide." >&2
        ;;
      400)
        echo "           Un 400 con este guion al dia casi siempre es lo mismo:" >&2
        echo "           la instancia corre una version ANTERIOR al 2026-09-07 y" >&2
        echo "           todavia espera una contrasena en el cuerpo. Actualizala:" >&2
        echo "             ssh root@$HOST /opt/space-os/update.sh" >&2
        ;;
      503)
        echo "           Un 503 es que la instancia no tiene Google configurado, y" >&2
        echo "           el Dueño entra SOLO con Google: sin eso naceria una" >&2
        echo "           organizacion a la que no puede entrar nadie. Faltan" >&2
        echo "           GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en su .env, con" >&2
        echo "           GOOGLE_OAUTH distinto de 0, y la URI de retorno de este" >&2
        echo "           dominio registrada en la consola de Google." >&2
        ;;
      *)
        echo "           Mira el log de la aplicacion:" >&2
        echo "             ssh root@$HOST 'docker logs --tail 50 space-os'" >&2
        ;;
    esac
    exit "$EX_REMOTO"
  fi

  echo ""
  echo "  La puerta ya se cerro sola: existe una organizacion, asi que"
  echo "  /api/bootstrap responde 404 desde ahora, con token o sin el."
  exit 0
fi

# ============================================================================
#  MODO A/B · aprovisionar
# ============================================================================
[[ -n "$INSTANCIA" ]] || { echo "provision: falta --instancia <nombre>" >&2; exit "$EX_USO"; }
# Se comprueba TODO lo que se va a enviar antes de tocar el servidor. Un
# archivo que falte a mitad deja la instancia con la base creada, el entorno
# escrito y el actualizador incompleto — el peor sitio para pararse, porque
# parece hecha.
for t in "$TPL_APP" "$TPL_INST" "$TPL_NGINX" \
         "$RAIZ/infra/scripts/update.sh" "$RAIZ/infra/scripts/respaldo.sh" \
         "$RAIZ/scripts/migrar.mjs"; do
  [[ -f "$t" ]] || { echo "provision: falta $t" >&2; exit "$EX_ENTORNO"; }
done
local_requiere sed
[[ "$CONFIRMAR" -eq 1 ]] && local_requiere ssh

if [[ "$CONFIRMAR" -eq 0 ]]; then
  echo ""
  echo "  ############################################################"
  echo "  #  SIMULACION. No se toca nada.                            #"
  echo "  #  Para ejecutarlo de verdad, repite con --confirmar.      #"
  echo "  ############################################################"
fi

# ─── 1 · El servidor ────────────────────────────────────────────────────────
if [[ "$CREAR_DROPLET" -eq 1 ]]; then
  paso "Creando el droplet"
  local_requiere doctl
  [[ -n "$DO_REGION" && -n "$DO_TAMANO" ]] || {
    echo "provision: con --crear-droplet hacen falta DO_REGION y DO_TAMANO en el entorno." >&2
    echo "           No tienen valor por defecto a proposito: son decisiones de cuenta." >&2
    exit "$EX_USO"
  }
  # Y la clave, que se comprueba AQUI y no despues: descubrirlo tras el `create`
  # deja una maquina existiendo y cobrandose a la que no se puede entrar.
  [[ -n "$DO_SSH_KEYS" ]] || {
    echo "provision: con --crear-droplet hace falta DO_SSH_KEYS en el entorno." >&2
    echo "           Son las claves que van DENTRO del droplet al crearlo:" >&2
    echo "           DigitalOcean no anade las de la cuenta por su cuenta, y el" >&2
    echo "           paso 2 entra por ssh. Listalas con: doctl compute ssh-key list" >&2
    exit "$EX_USO"
  }
  if [[ "$CONFIRMAR" -eq 1 ]]; then
    doctl compute droplet create "$INSTANCIA" \
      --region "$DO_REGION" --size "$DO_TAMANO" --image "$DO_IMAGEN" \
      --ssh-keys "$DO_SSH_KEYS" --wait
    HOST="$(doctl compute droplet get "$INSTANCIA" --format PublicIPv4 --no-header)"
    echo "  droplet creado: $HOST"
    esperar_ssh "$HOST"
  else
    echo "$DRY_ETIQUETA doctl compute droplet create $INSTANCIA --region $DO_REGION --size $DO_TAMANO --image $DO_IMAGEN --ssh-keys $DO_SSH_KEYS --wait"
    HOST="<ip-del-droplet-nuevo>"
  fi

  paso "Base del servidor (Docker, nginx, certbot, ufw)"
  remoto "bash -s" < "$RAIZ/infra/scripts/setup-droplet.sh"
fi

# ─── 2 · Base de datos: DOS roles ───────────────────────────────────────────
paso "Base de datos"
CLAVE_APP="$(secreto)"
CLAVE_MIGRADOR="$(secreto)"
URL_MIGRADOR="$(url_migrador "$CLAVE_MIGRADOR")"

# El QUE y el POR QUE de estas tres sentencias —que el rol de la aplicacion es
# `nobypassrls` y el de migracion `bypassrls`, y por que cada uno— vive en
# `base-instancia.sh`, que es donde estan definidas. Aqui solo esta el COMO
# llegan a esta maquina: por `remoto()`, o sea por ssh.
#
# Las recetas salen SIN el `;` final a proposito, y aqui no se le pone: un
# `psql -c` no lo necesita. Quien manda el mismo SQL por la entrada estandar
# (`instalar-hijo.sh`) lo anade al enviarlo — el terminador es cosa del canal,
# no de la sentencia.
aplicar_sql_superusuario() {
  remoto "sudo -u postgres psql -v ON_ERROR_STOP=1 -c \"$1\""
}
aplicar_sql_superusuario "$(sql_crear_rol_app "$CLAVE_APP")"
aplicar_sql_superusuario "$(sql_crear_rol_migrador "$CLAVE_MIGRADOR")"
aplicar_sql_superusuario "$(sql_crear_base)"

# ─── 3 · Esquema y migraciones ──────────────────────────────────────────────
# La receta —el orden, el esquema base antes de las migraciones, y por que— vive
# en `base-instancia.sh`. Aqui solo esta el COMO: cada linea se manda por ssh.
#
# Antes esto hacia `cd /var/www/Spaces && node scripts/migrar.mjs`: un repo
# clonado y un Node que una instancia NO TIENE -- es el sentido de que exista la
# imagen. Ahora migra con la MISMA imagen que va a correr, que es tambien la que
# lleva las migraciones dentro. Mismo idioma que `update.sh:1324-1330`.
paso "Esquema y migraciones"
registro_login
remoto "docker pull '$IMAGEN'"
remoto "$(cmd_volcar_esquema "$IMAGEN")"
# `PGPASSWORD` va delante del comando y NO dentro de la receta: la clave viaja
# por el entorno del proceso remoto, no en el argv de `psql`.
remoto "PGPASSWORD='$CLAVE_MIGRADOR' $(cmd_aplicar_esquema)"
remoto "$(cmd_limpiar_esquema)"

remoto "$(cmd_migrar_instalacion_nueva "$IMAGEN" "$URL_MIGRADOR")"

# ─── 4 · Los dos archivos de entorno ────────────────────────────────────────
paso "Entorno"
TOKEN_ARRANQUE="$(secreto)"
TOKEN_FLOTA="$(secreto)"

remoto "mkdir -p /etc/space-os"

# `app.env`. Se parte de la plantilla versionada para que los COMENTARIOS
# viajen al servidor: quien abra este archivo dentro de seis meses necesita
# leer por que `COOKIE_DOMAIN` no esta, no solo que no esta.
#
# `CANAL` va tambien aqui, y esta linea es la deriva que este refactor cerro:
# hasta el 2026-09-11 este guion escribia `CANAL` solo en `instancia.env` y
# `instalar-hijo.sh` lo escribia en los dos. El que tenia razon es el
# instalador, y no es opinion: la aplicacion lo lee de SU entorno
# (`apps/web/app/api/version/route.ts:105-113`), que sale de `app.env` por
# `docker --env-file` (`update.sh:97,2007`), y la plantilla lo dice donde lo
# declara («repetido a proposito», `infra/env/app.env.example:149-156`). No se
# notaba porque la plantilla ya trae `estable` y este guion tambien usa
# `estable` por omision: la unica corrida en que divergian era un ensayo con
# CANAL=beta, donde `/api/version` habria dicho `estable` mientras el
# actualizador jalaba `beta`.
sed \
  -e "s#^APP_URL=.*#APP_URL=https://$DOMINIO#" \
  -e "s#^DATABASE_URL=.*#DATABASE_URL=$(url_app "$CLAVE_APP")#" \
  -e "s#^GOOGLE_REDIRECT_URI=.*#GOOGLE_REDIRECT_URI=https://$DOMINIO/spaces-dooh/api/auth/google/callback/#" \
  -e "s#^BOOTSTRAP_TOKEN=.*#BOOTSTRAP_TOKEN=$TOKEN_ARRANQUE#" \
  -e "s#^FLOTA_TOKEN=.*#FLOTA_TOKEN=$TOKEN_FLOTA#" \
  -e "s#^CANAL=.*#CANAL=$CANAL#" \
  "$TPL_APP" | remoto_escribir /etc/space-os/app.env 600

# `instancia.env`. Desde el 2026-09-01 `REGISTRY`, `REGISTRY_TOKEN` y `CANAL`
# se escriben de verdad: la decision del registro se tomo el 31/08 y sin
# credencial una instancia no puede bajar la imagen de un registro privado.
sed \
  -e "s#^INSTANCIA=.*#INSTANCIA=$INSTANCIA#" \
  -e "s#^DATABASE_URL=.*#DATABASE_URL=$URL_MIGRADOR#"   -e "s#^REGISTRY=.*#REGISTRY=$REGISTRY#"   -e "s#^REGISTRY_TOKEN=.*#REGISTRY_TOKEN=$REGISTRY_TOKEN#"   -e "s#^CANAL=.*#CANAL=$CANAL#" \
  "$TPL_INST" | remoto_escribir /etc/space-os/instancia.env 600

# ─── 5 · nginx, TODAVIA SIN certificado ─────────────────────────────────────
paso "nginx (solo HTTP por ahora)"
# El vhost completo apunta a `/etc/letsencrypt/live/$DOMINIO/fullchain.pem`, y
# nginx NO ARRANCA si ese archivo no existe. Como el certificado no se puede
# emitir hasta que el owner apunte su DNS, aqui se instala un vhost minimo de
# solo HTTP que sirve el reto de ACME. El completo entra con
# `--emitir-certificado`.
remoto "mkdir -p /var/www/html/.well-known/acme-challenge"
remoto_escribir "/etc/nginx/sites-available/$DOMINIO" 644 <<NGINX
# Provisional: solo sirve el reto de ACME hasta que exista el certificado.
# Lo sustituye instancia.conf.tpl al correr --emitir-certificado.
server {
  listen 80;
  listen [::]:80;
  server_name $DOMINIO;
  location /.well-known/acme-challenge/ { root /var/www/html; }
  location / { return 503 "instancia en aprovisionamiento\n"; }
}
NGINX
remoto "ln -sfn '/etc/nginx/sites-available/$DOMINIO' '/etc/nginx/sites-enabled/$DOMINIO'"
remoto "nginx -t && systemctl reload nginx"

# ─── 6 · El actualizador y su cron ──────────────────────────────────────────
paso "Actualizador"
remoto "mkdir -p /opt/space-os /var/log/space-os"
remoto_escribir /opt/space-os/update.sh 750 < "$RAIZ/infra/scripts/update.sh"
# `respaldo.sh` NO es opcional, y olvidarlo no da un aviso: da una instancia
# rota en silencio. `update.sh:579-582` lo busca AL LADO SUYO y **aborta con
# EX_CONFIG si no esta** —«sin el, la instancia se actualizaria sin respaldo
# fuera del droplet y llenando el disco»—, asi que una instancia recien
# aprovisionada fallaria en CADA corrida del cron, de madrugada y sin que nadie
# mire. Se detecto al escribir el ADR 0022, no al probar el script.
remoto_escribir /opt/space-os/respaldo.sh 750 < "$RAIZ/infra/scripts/respaldo.sh"
remoto_escribir /opt/space-os/migrar.mjs 640 < "$RAIZ/scripts/migrar.mjs"
remoto_escribir /etc/cron.d/space-os-update 644 <<'CRON'
# La instancia se actualiza SOLA. El padre no entra por ssh a desplegar.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
17 4 * * * root /opt/space-os/update.sh >> /var/log/space-os/cron.log 2>&1
CRON

# ─── 6b · Levantar la aplicacion, sin esperar al cron ───────────────────────
# El cron de arriba arranca el contenedor a las 4:17. Hasta el 2026-09-07 eso era
# lo UNICO que lo arrancaba, asi que una instancia recien aprovisionada quedaba
# muerta hasta la madrugada siguiente. En el primer alta real eso costo una
# confusion entera: `login` daba 502 y el `--bootstrap` daba `000`, y ninguno de
# los dos decia que simplemente no habia nada levantado.
#
# Y no habia razon tecnica para esperar: `update.sh` comprueba la salud contra
# `http://127.0.0.1:3000` (`update.sh:750`), asi que NO necesita ni el DNS ni el
# certificado. Se arranca aqui, que es lo que se hizo a mano y funciono.
#
# Si falla NO se aborta: la maquina ya existe y esta aprovisionada, y el estado
# resultante es exactamente el de antes de este cambio. Se dice en voz alta y se
# sigue -- abortar aqui convertiria una instancia buena en un alta fallida.
paso "Levantando la aplicacion"
if remoto "/opt/space-os/update.sh"; then
  echo "  la instancia ya sirve: no hay que esperar al cron de las 4:17"
else
  echo "" >&2
  echo "  AVISO: el aprovisionamiento SI termino y la maquina esta lista, pero la" >&2
  echo "         aplicacion no quedo levantada. El cron lo reintentara a las 4:17." >&2
  echo "         Para no esperar, mira que paso:" >&2
  echo "           ssh root@$HOST 'tail -40 /var/log/space-os/update-publicable.log'" >&2
fi

# ─── 7 · Alto. El DNS lo pone el owner ──────────────────────────────────────
cat <<FIN

╔══════════════════════════════════════════════════════════════════════╗
║  APROVISIONAMIENTO HECHO — Y AQUI SE PARA A PROPOSITO                ║
╚══════════════════════════════════════════════════════════════════════╝

  Lo que falta NO lo hacemos nosotros. Se le pide al owner:

      Apunta  $DOMINIO  a  ${HOST}
      con un registro A en TU propio DNS.

  La zona del owner es suya y AS OOH no entra en ella. No es una
  formalidad: es la parte de «soberana» que se puede comprobar.

  Cuando el owner confirme que ya apunta, y SOLO entonces:

      $0 --host ${HOST} --dominio $DOMINIO --emitir-certificado --confirmar
      $0 --host ${HOST} --dominio $DOMINIO --instancia $INSTANCIA \
         --email <correo-del-dueno> --bootstrap --confirmar

  Antes de que el DNS resuelva, el certificado FALLA — y Let's Encrypt
  solo permite cinco intentos por hora. Comprueba primero:

      dig +short $DOMINIO      # tiene que devolver ${HOST}

FIN
