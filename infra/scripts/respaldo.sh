#!/usr/bin/env bash
# ============================================================================
#  respaldo.sh — el respaldo SALE del droplet, y el disco no se llena.
# ----------------------------------------------------------------------------
#  Se instala junto a `update.sh` (/opt/space-os/respaldo.sh) y `update.sh` lo
#  SOURCEA: no es un programa aparte que se lance por su cuenta en cada corrida.
#  Tambien se puede llamar a mano, que es lo que hace falta el dia que alguien
#  quiera subir un dump suelto o podar un directorio sin actualizar nada.
#
#  Uso a mano:
#    /opt/space-os/respaldo.sh subir   /var/lib/space-os/respaldos/spaces_x.dump
#    /opt/space-os/respaldo.sh podar   /var/lib/space-os/respaldos [3]
#    /opt/space-os/respaldo.sh destino          # imprime a donde subiria hoy
#
# ── POR QUE EXISTE ─────────────────────────────────────────────────────────
#  `update.sh` hace un `pg_dump -Fc` antes de migrar y lo deja en el disco de la
#  propia instancia. Eso sirve para la vuelta atras de un release malo, que es su
#  trabajo, pero NO sirve para nada si el droplet desaparece — y ese escenario es
#  MAS probable con el modelo de instancias, no menos: son muchos droplets
#  pequenos en vez de uno cuidado. Un respaldo que vive solo en la maquina que
#  puede morir es un respaldo de mentira.
#
# ── LA ASIMETRIA DE LA RETENCION, QUE ES DELIBERADA ────────────────────────
#    LOCAL  · 3 respaldos, y los poda ESTE script.
#    REMOTO · 30 dias, y los poda LA REGLA DE CICLO DE VIDA DEL BUCKET.
#
#  Aqui NO hay ni un solo borrado remoto, y no es un olvido: un `rm` mal escrito
#  en un script que corre en TODAS las instancias es una forma elegante de
#  perderlo todo a la vez. Borrar lo viejo del bucket es configuracion de la
#  cuenta —se hace una vez, la revisa una persona y no viaja en cada release—.
#  El arnes lo comprueba (E41): ninguna llamada de este script borra en el bucket.
#
#  Y la poda local tampoco es un `rm` con glob: `find -maxdepth 1 -type f -name
#  'spaces_*.dump'`, ordenado por la FECHA DEL ARCHIVO —no por su nombre: ver el
#  comentario de `respaldo_local_podar`—, y se retiran los mas viejos dejando
#  los N mas recientes. Nunca menos de 1, nunca subdirectorios, nunca un archivo
#  que no case con el patron.
#
# ── CONFIGURACION (en /etc/space-os/instancia.env, 0600 y de root) ─────────
#    SPACES_KEY      llave de acceso de Spaces. NUNCA la llave maestra de la
#    SPACES_SECRET   cuenta.
#
#  ── OJO CON EL ALCANCE DE LA LLAVE: el plan pide algo que DO no da ────────
#  F3.7 dice «una llave por instancia con permiso solo sobre SU prefijo». Las
#  llaves de DigitalOcean Spaces se limitan POR BUCKET, no por prefijo. Con un
#  bucket compartido, la llave de cualquier instancia puede leer y borrar los
#  respaldos de TODAS -- que es justo lo que la frase queria evitar.
#
#  DECISION DEL 2026-08-27: se arranca con UN BUCKET COMPARTIDO y prefijos.
#  Hoy hay una sola instancia, asi que esa propiedad no protege de nada
#  todavia. NO ES UN DESCUIDO Y TIENE DISPARADOR: se decide ANTES de dar de
#  alta el primer owner (F5.7), y la salida conocida es un bucket por
#  instancia -- ahi una llave con alcance de bucket SI es una llave por
#  instancia. Mientras haya una sola, probar el mecanismo vale mas que la
#  propiedad.
#    SPACES_BUCKET   por omision `space-os-respaldos`
#    SPACES_REGION   por omision `nyc3` (decide el endpoint)
#    SPACES_ENDPOINT por omision https://<region>.digitaloceanspaces.com
#    SPACES_CLIENTE  auto|s3cmd|aws. `auto` prefiere s3cmd si esta instalado
#    INSTANCIA       el prefijo dentro del bucket. Si falta, se usa el hostname
#    RESPALDOS_LOCALES  cuantos dumps se conservan en el disco (3)
#
#  Sin SPACES_KEY/SPACES_SECRET no se sube nada y se escribe en el log que esa
#  instancia NO tiene respaldo fuera del droplet. No es un error: es una
#  instancia sin respaldo remoto configurado, y conviene que se lea asi.
#
#  Ruta remota, tal cual la fija el plan (F3.7):
#    s3://<bucket>/<instancia>/<AAAA-MM-DD-HHMM>.dump
#
# ── LAS CREDENCIALES NO VIAJAN EN `argv` ───────────────────────────────────
#  `s3cmd --access_key=… --secret_key=…` deja las dos visibles en `ps` para
#  cualquier usuario de la maquina. Mismo problema que tenia la contrasena de
#  Postgres en `update.sh`, y misma solucion: por otro camino. Con `s3cmd`, un
#  archivo de configuracion temporal en 0600 que se borra al terminar y tambien
#  si el script muere por una senal (`trap`, ver `respaldo_conf_limpiar`); con la
#  CLI de AWS, variables de entorno del propio proceso.
#
# ── `gsutil` NO ────────────────────────────────────────────────────────────
#  Es el cliente de Google Cloud Storage y no habla con Spaces. El plan lo avisa
#  expresamente porque es un error facil de cometer leyendo por encima.
# ============================================================================

# `registrar` y `eco` los trae `update.sh`. Cuando este archivo se ejecuta solo,
# no hay ninguna de las dos: se definen equivalentes minimas en vez de suponer.
if ! declare -F registrar >/dev/null 2>&1; then
  registrar() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S%z')" "$*"; }
fi
if ! declare -F eco >/dev/null 2>&1; then
  eco() { cat; }
fi

SPACES_KEY="${SPACES_KEY:-}"
SPACES_SECRET="${SPACES_SECRET:-}"
SPACES_BUCKET="${SPACES_BUCKET:-space-os-respaldos}"
SPACES_REGION="${SPACES_REGION:-nyc3}"
SPACES_ENDPOINT="${SPACES_ENDPOINT:-https://$SPACES_REGION.digitaloceanspaces.com}"
SPACES_CLIENTE="${SPACES_CLIENTE:-auto}"
INSTANCIA="${INSTANCIA:-}"
RESPALDOS_LOCALES="${RESPALDOS_LOCALES:-3}"

# ─── El prefijo dentro del bucket ──────────────────────────────────────────
# Es lo UNICO que separa los respaldos de dos owners mientras el bucket sea
# compartido: con llaves de alcance de bucket, equivocarse aqui NO da 403 --
# escribe encima del sitio de otra instancia y nadie se entera. El dia que sea
# un bucket por instancia, el 403 vuelve a ser la red de seguridad.
respaldo_instancia() {
  local nombre="$INSTANCIA"
  if [ -z "$nombre" ]; then
    nombre="$(hostname -s 2>/dev/null || true)"
  fi
  printf '%s' "$nombre"
}

# Imprime la ruta remota completa. Falla (y no imprime) si no hay prefijo: subir
# a la RAIZ del bucket seria escribir en el sitio de otra instancia.
respaldo_destino_remoto() {
  local instancia
  instancia="$(respaldo_instancia)"
  [ -n "$instancia" ] || return 1
  printf 's3://%s/%s/%s.dump' "$SPACES_BUCKET" "$instancia" "$(date '+%Y-%m-%d-%H%M')"
}

respaldo_remoto_configurado() {
  [ -n "$SPACES_KEY" ] && [ -n "$SPACES_SECRET" ] && [ -n "$SPACES_BUCKET" ]
}

# Imprime `s3cmd` o `aws`. Falla si no hay ninguno de los dos en el PATH.
respaldo_cliente() {
  case "$SPACES_CLIENTE" in
    s3cmd|aws)
      command -v "$SPACES_CLIENTE" >/dev/null 2>&1 || return 1
      printf '%s' "$SPACES_CLIENTE" ;;
    auto)
      if command -v s3cmd >/dev/null 2>&1; then
        printf 's3cmd'
      elif command -v aws >/dev/null 2>&1; then
        printf 'aws'
      else
        return 1
      fi ;;
    *) return 1 ;;
  esac
}

# El archivo de configuracion de `s3cmd`, apuntado a Spaces. Va por STDOUT para
# que quien lo escriba controle los permisos ANTES de que tenga nada dentro.
respaldo_config_s3cmd() {
  local anfitrion="${SPACES_ENDPOINT#https://}"
  anfitrion="${anfitrion#http://}"
  cat <<FIN
[default]
access_key = $SPACES_KEY
secret_key = $SPACES_SECRET
host_base = $anfitrion
host_bucket = %(bucket)s.$anfitrion
use_https = True
signature_v2 = False
FIN
}

# Borra el temporal con la llave dentro y, si vino por una senal, se lleva el
# script con ella. Existe porque `rm -f "$conf"` al final de la funcion SOLO
# corre si el flujo llega ahi: con un SIGTERM a media subida —un `systemctl
# stop`, el `docker stop` de quien actualiza, la sesion de ssh que se corta— el
# archivo con el secreto sobrevivia. Medido: sobrevivia. Atenuante: `mktemp` lo
# crea en 0600 y en el droplet esto corre como root, asi que el residuo solo lo
# lee root; aun asi, un secreto que se queda en el disco por accidente es un
# secreto que se queda.
#
# El `trap -` de dentro devuelve el shell como estaba. Hoy `update.sh` no pone
# ningun `trap` propio; si algun dia pone uno, este quitarlo hay que revisarlo.
#
# Reparto de trabajo entre los cuatro `trap`, medido y no supuesto (18/08): bash
# ejecuta el de EXIT TAMBIEN cuando lo mata una senal, asi que **el borrado ya lo
# garantiza EXIT por si solo**. Los de TERM/INT/HUP no estan por duplicar eso:
# estan por la linea de log y por el codigo de salida elegido, que sin ellos
# serian silencio. Por eso el arnes comprueba las dos cosas por separado —y por
# eso el primer mutante de «quitar el trap» ESCAPABA—.
respaldo_conf_limpiar() {
  local conf="${1:-}" senal="${2:-}"
  if [ -n "$conf" ]; then rm -f "$conf"; fi
  trap - EXIT INT TERM HUP
  if [ -n "$senal" ]; then
    registrar "   respaldo remoto: $senal a media subida. El temporal con la llave de Spaces se borro. La subida queda a medias y NO se reintenta: la vuelta atras se hace con el respaldo local, que sigue en su sitio."
    case "$senal" in
      INT) exit 130 ;;
      HUP) exit 129 ;;
      *)   exit 143 ;;
    esac
  fi
}

respaldo_subir_s3cmd() {
  local archivo="$1" destino="$2" conf codigo=0
  # 0600 ANTES de escribir el secreto dentro, no despues: entre el `cat` y el
  # `chmod` habria una ventana con la llave legible por cualquiera.
  conf="$(mktemp)"
  chmod 600 "$conf"
  # Y el `trap` ANTES de escribirlo, por lo mismo: a partir de la linea de abajo
  # hay un archivo con la llave de Spaces dentro, y tiene que morir pase lo que
  # pase. Lo caza E51.
  trap 'respaldo_conf_limpiar "$conf"' EXIT
  trap 'respaldo_conf_limpiar "$conf" TERM' TERM
  trap 'respaldo_conf_limpiar "$conf" INT' INT
  trap 'respaldo_conf_limpiar "$conf" HUP' HUP
  respaldo_config_s3cmd >"$conf"
  s3cmd --config="$conf" put "$archivo" "$destino" 2>&1 | eco
  codigo=${PIPESTATUS[0]}
  respaldo_conf_limpiar "$conf"
  return "$codigo"
}

respaldo_subir_aws() {
  local archivo="$1" destino="$2" codigo=0
  # La CLI de AWS lee las credenciales del ENTORNO, que tampoco es `argv`. El
  # `--endpoint-url` es lo unico que la hace hablar con Spaces en vez de con AWS.
  AWS_ACCESS_KEY_ID="$SPACES_KEY" AWS_SECRET_ACCESS_KEY="$SPACES_SECRET" AWS_DEFAULT_REGION="$SPACES_REGION" aws s3 cp "$archivo" "$destino" --endpoint-url "$SPACES_ENDPOINT" 2>&1 | eco
  codigo=${PIPESTATUS[0]}
  return "$codigo"
}

# Sube un respaldo. Devuelve:
#   0  se subio, O no hay respaldo remoto configurado (y se dijo en el log)
#   1  estaba configurado y NO se pudo subir
# Quien llama decide que hacer con el 1. `update.sh` decide que el update SIGUE:
# el respaldo local ya existe y basta para la vuelta atras.
respaldo_remoto_subir() {
  local archivo="$1" destino cliente resultado=0
  if ! respaldo_remoto_configurado; then
    registrar "   respaldo remoto NO CONFIGURADO: faltan SPACES_KEY/SPACES_SECRET. Esta instancia NO tiene respaldo fuera del droplet: si la maquina desaparece, el dump desaparece con ella."
    return 0
  fi
  if [ ! -s "$archivo" ]; then
    registrar "   respaldo remoto: $archivo no existe o esta vacio; no se sube nada."
    return 1
  fi
  destino="$(respaldo_destino_remoto)" || {
    registrar "   respaldo remoto: no hay INSTANCIA en la configuracion y el hostname salio vacio, asi que no se sabe a que prefijo del bucket subir. No se sube a la raiz: ahi viven los respaldos de otras instancias."
    return 1
  }
  cliente="$(respaldo_cliente)" || {
    registrar "   respaldo remoto: no hay cliente de S3 en el PATH (ni \`s3cmd\` ni \`aws\`, y SPACES_CLIENTE=$SPACES_CLIENTE). Instala uno: \`apt-get install -y s3cmd\`."
    return 1
  }
  registrar "   respaldo remoto -> $destino (por $cliente)"
  case "$cliente" in
    s3cmd) respaldo_subir_s3cmd "$archivo" "$destino" || resultado=$? ;;
    aws)   respaldo_subir_aws   "$archivo" "$destino" || resultado=$? ;;
  esac
  if [ "$resultado" -eq 0 ]; then
    registrar "   respaldo remoto OK: $destino"
  fi
  # El codigo se PROPAGA. Tragarselo aqui seria decidir en silencio algo que
  # decide quien llama, y ademas dejaria la subida fallida sin una sola linea.
  return "$resultado"
}

# ─── La poda LOCAL. La remota no existe: es regla del bucket ───────────────
# Cierra la segunda mitad de D4 (ensayo de F3.4): el directorio de respaldos no
# se podaba NUNCA. En el ensayo quedaron diez dumps en siete minutos; en una
# instancia con datos de verdad son gigas por noche hasta llenar el disco.
respaldo_local_podar() {
  local dir="$1" cuantos="${2:-$RESPALDOS_LOCALES}" archivo total sobran i=0 retirados=0
  local -a dumps=()
  [ -d "$dir" ] || return 0
  case "$cuantos" in
    ''|*[!0-9]*)
      registrar "   AVISO poda: RESPALDOS_LOCALES='$cuantos' no es un numero; no se poda nada."
      return 0 ;;
  esac
  # Nunca 0. Con 0 se borraria el respaldo de ESTA corrida, que es justo el que
  # la vuelta atras necesita dentro de los proximos minutos.
  if [ "$cuantos" -lt 1 ]; then
    registrar "   AVISO poda: RESPALDOS_LOCALES=$cuantos dejaria cero respaldos, incluido el de esta corrida. No se poda nada."
    return 0
  fi
  # Por `find -type f` y por patron: ni subdirectorios, ni archivos que no sean
  # un dump nuestro.
  #
  # Y ordenado por ANTIGUEDAD REAL (`mtime`), no por nombre. Ordenar por nombre
  # parecia lo mismo —el nombre lleva la fecha— y NO lo es: `sort` ordena la
  # ruta, asi que cualquier dump con otro nombre —`spaces_x.dump`, el que la
  # cabecera de este mismo archivo documenta para el uso a mano— ordena
  # DESPUES de `spaces_2026…` y pasa por "de los mas recientes". El que sobra
  # resultaba ser entonces el de ESTA corrida, y borrarlo encadena todo lo demas:
  # la subida se salta (no hay archivo), el log dice RESPALDO REMOTO FALLIDO sin
  # que haya fallado ninguna subida, y si el release sale malo el `pg_restore` de
  # la vuelta atras (`update.sh` paso 7a) apunta a un archivo que ya no esta.
  # Lo caza E49; E40 no lo veia porque solo sembraba nombres con formato de fecha.
  #
  # El desempate por ruta (`-k2`) es para que dos dumps del mismo instante se
  # ordenen igual en dos corridas seguidas. `-printf` es de GNU find (el droplet
  # es Ubuntu); donde no exista, la lista sale vacia y no se poda nada —se llena
  # el disco, que entre los dos fallos posibles es el que no pierde datos.
  #
  # `if` y no `[ … ] && …`: un `&&` cuyo lado izquierdo sale falso deja el cuerpo
  # del bucle con codigo != 0, y bajo el `set -e` de quien sourcea esto eso es
  # una salida, no una iteracion que no hizo nada.
  while IFS= read -r archivo; do
    if [ -n "$archivo" ]; then dumps+=("$archivo"); fi
  done < <(find "$dir" -maxdepth 1 -type f -name 'spaces_*.dump' -printf '%T@\t%p\n' 2>/dev/null | sort -k1,1n -k2 | cut -f2-)
  total=${#dumps[@]}
  [ "$total" -gt "$cuantos" ] || return 0
  sobran=$((total - cuantos))
  for archivo in "${dumps[@]}"; do
    [ "$i" -lt "$sobran" ] || break
    i=$((i + 1))
    if rm -f "$archivo"; then
      retirados=$((retirados + 1))
    else
      registrar "   AVISO poda: no se pudo retirar $archivo."
    fi
  done
  # Se cuenta lo RETIRADO, no lo que se iba a retirar. Con los `rm` fallando
  # —directorio de solo lectura, bit inmutable— quedaban los 6 dumps y esta
  # linea afirmaba "3 retirados, quedan los 3 mas recientes": lo contrario de lo
  # ocurrido, y en la unica linea que alguien lee para saber si el disco baja.
  if [ "$retirados" -eq "$sobran" ]; then
    registrar "   poda local: $retirados respaldo(s) retirados, quedan los $cuantos mas recientes en $dir. Lo del bucket lo poda la regla de ciclo de vida (30 dias), no este script."
  else
    registrar "   poda local: se querian retirar $sobran y solo se retiraron $retirados; quedan $((total - retirados)) en $dir, no $cuantos. El motivo esta en los AVISO de arriba."
    # El fallo parcial sale por el codigo de retorno: es lo que hace que el
    # `if !` con el que `update.sh` llama a esta funcion sirva de algo. El update
    # SIGUE igual (llenar el disco es un problema de manana), pero queda escrito.
    return 1
  fi
}

# ─── Ejecutado a mano, no sourceado ────────────────────────────────────────
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  set -uo pipefail
  case "${1:-}" in
    subir)
      [ -n "${2:-}" ] || { echo "respaldo: falta el archivo. Uso: $0 subir <archivo.dump>" >&2; exit 1; }
      respaldo_remoto_subir "$2" ;;
    podar)
      [ -n "${2:-}" ] || { echo "respaldo: falta el directorio. Uso: $0 podar <directorio> [cuantos]" >&2; exit 1; }
      respaldo_local_podar "$2" "${3:-}" ;;
    destino)
      respaldo_destino_remoto && printf '\n' ;;
    *)
      sed -n '2,15p' "$0"
      exit 1 ;;
  esac
fi
