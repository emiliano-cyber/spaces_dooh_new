#!/usr/bin/env bash
# ============================================================================
#  respaldar-eyes.sh — los datos de Space Eye SALEN del droplet todos los dias.
# ----------------------------------------------------------------------------
#  Se instala en /opt/space-os/respaldar-eyes.sh, al lado de `update-eyes.sh`, y
#  lo lanza el cron. Hace tres cosas: volcar la base, empaquetar las fotos del
#  dia y subir las dos cosas fuera. No actualiza nada y no toca el contenedor de
#  la API.
#
#  Uso:
#    /opt/space-os/respaldar-eyes.sh
#    /opt/space-os/respaldar-eyes.sh --solo-base      (sin fotos, para una prueba)
#    EYES_CONF=/etc/space-os/otra.env /opt/space-os/respaldar-eyes.sh
#
#  Codigos de salida (los mira el cron, y los lee una persona en el log):
#    0  respaldo hecho. Si la instancia no tiene respaldo remoto configurado,
#       se dice en el log y NO es un error: lo local si se hizo.
#    1  configuracion: falta un archivo o una variable. No se toco nada.
#    4  VOLCADO VACIO O CORTADO: no se subio nada.
#    5  el volcado esta bien pero NO salio del droplet. Lo local se conserva.
#
# ── POR QUE EXISTE ─────────────────────────────────────────────────────────
#  `update-eyes.sh` respalda la base ANTES DE MIGRAR y deja el .sql.gz en
#  `/var/backups/space-os/eyes`, del mismo droplet. Eso sirve para deshacer un
#  release malo, que es su trabajo. Para sobrevivir a la perdida de la maquina
#  no sirve de nada, y ademas solo corre cuando hay version nueva: es la misma
#  trampa que `respaldo-diario.sh` ya documento para Postgres el 22-sep-2026
#  («la frecuencia de tus respaldos la decide el ritmo de los releases»).
#
#  Y hay algo peor, que es lo que de verdad trae este guion: **las fotos no las
#  respalda nadie**. 1.1 GB el 2-nov-2026 en el volumen `space-eyes_fotos`, y
#  el mysqldump de `update-eyes.sh` no las toca. Esas fotos son la evidencia de
#  cada campana que se le cobro a un cliente: el catalogo de creativos, la
#  prueba de que el anuncio salio, la foto de la pantalla apagada. La base sin
#  las fotos es un indice de cosas que ya no existen.
#
# ── POR QUE LAS FOTOS VAN POR DIA Y NO ENTERAS ─────────────────────────────
#  Una foto no cambia NUNCA despues de escribirse, y viven repartidas por fecha
#  (`storage/photos/AAAA-MM-DD/<equipo>/<uuid>.jpg`). Asi que el dia que ya
#  salio del droplet no tiene por que volver a salir: se sube un paquete POR
#  DIA, y cada corrida sube solo los dias que falten.
#
#  Eso cambia el coste de «respaldar las fotos» de 1.1 GB diarios a unas
#  decenas de MB, que es la diferencia entre un respaldo que se deja encendido
#  y uno que alguien apaga en cuanto ve la factura. Restaurar sigue siendo
#  trivial: bajar todos los paquetes y descomprimirlos en el mismo sitio.
#
#  Lo que YA SALIO se recuerda con un archivo vacio por dia en
#  `$EYES_RESPALDOS/fotos-subidas/`. No se pregunta al bucket: una lista remota
#  en cada corrida es una llamada que puede fallar, y el dia que falle el guion
#  resubiria todo. El marcador se escribe DESPUES de que la subida diga que si.
#
#  EL DIA DE HOY NO SE SUBE, y no es un descuido: todavia estan llegando fotos.
#  Se sube cuando sea ayer y este completo.
#
# ── LO QUE ESTE GUION NO HACE ──────────────────────────────────────────────
#  No borra NADA en el bucket. Igual que `respaldo.sh`, la retencion remota es
#  una regla de ciclo de vida de la cuenta, que configura una persona una vez;
#  un `rm` remoto dentro de un guion que corre en todas las instancias es una
#  forma elegante de perderlo todo a la vez.
# ============================================================================
set -uo pipefail

EX_CONFIG=1
EX_VACIO=4
EX_REMOTO=5

EYES_CONF="${EYES_CONF:-/etc/space-os/eyes.env}"
INSTANCIA_CONF="${INSTANCIA_CONF:-/etc/space-os/instancia.env}"
EYES_DIR="${EYES_DIR:-/opt/space-os/eyes}"
EYES_RESPALDOS="${EYES_RESPALDOS:-/var/backups/space-os/eyes}"
RESPALDOS_LOCALES_EYES="${RESPALDOS_LOCALES_EYES:-3}"
PROYECTO=space-eyes
LOG="${LOG_EYES_RESPALDO:-/var/log/space-os/respaldar-eyes.log}"

mkdir -p "$(dirname "$LOG")" 2>/dev/null || LOG=/dev/null
# Igual que en `respaldo-diario.sh`: sin log no se para. Un respaldo que no
# corre porque no pudo escribir su bitacora es el peor cambio posible aqui.
registrar() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S%z')" "$*" | tee -a "$LOG"; }
eco() { tee -a "$LOG"; }
salir() { local codigo="$1"; shift; registrar "$*"; exit "$codigo"; }

SOLO_BASE=0
case "${1:-}" in
  '') ;;
  --solo-base) SOLO_BASE=1 ;;
  -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
  *) printf 'respaldar-eyes: no entiendo `%s`. Usa --help.\n' "$1" >&2; exit "$EX_CONFIG" ;;
esac

# Lee CLAVE=valor de un archivo SIN ejecutarlo, igual que `update-eyes.sh`:
# eyes.env es formato de docker y no se le hace `source`, que ejecutaria lo que
# trajera.
leer() {
  local clave="$1" archivo="$2"
  [[ -f "$archivo" ]] || return 0
  sed -n "s/^${clave}=//p" "$archivo" | tail -1 | sed 's/^"\(.*\)"$/\1/'
}

# ─── 0 · Configuracion ──────────────────────────────────────────────────────
[[ -f "$EYES_CONF" ]] || salir "$EX_CONFIG" "ERROR respaldar-eyes: no existe $EYES_CONF. Sin el no se sabe ni la clave de la base ni a que instancia pertenece esto."
[[ -f "$EYES_DIR/docker-compose.yml" ]] || salir "$EX_CONFIG" "ERROR respaldar-eyes: falta $EYES_DIR/docker-compose.yml. Esta instancia no tiene pila de Space Eye."

CLAVE_DB="$(leer DB_PASSWORD "$EYES_CONF")"
[[ -n "$CLAVE_DB" ]] || salir "$EX_CONFIG" "ERROR respaldar-eyes: falta DB_PASSWORD en $EYES_CONF."

# El prefijo del bucket y las llaves salen de la configuracion de la INSTANCIA,
# la misma que usa el respaldo de Postgres: un solo sitio donde cambiarlas.
# shellcheck disable=SC1090
[[ -f "$INSTANCIA_CONF" ]] && . "$INSTANCIA_CONF"

# `respaldo.sh` lee las SPACES_* EN EL MOMENTO de sourcearse, asi que va
# DESPUES de la configuracion. Mismo motivo que en `respaldo-diario.sh`.
RESPALDO_SH="${SPACE_OS_RESPALDO_SH:-$(dirname "$0")/respaldo.sh}"
[[ -f "$RESPALDO_SH" ]] || salir "$EX_CONFIG" "ERROR respaldar-eyes: falta $RESPALDO_SH. Ahi viven la subida y la poda, y no se reimplementan aqui: el manejo de la llave de Spaces vive en UN solo sitio."
# shellcheck disable=SC1090
. "$RESPALDO_SH"

C=(docker compose -p "$PROYECTO" -f "$EYES_DIR/docker-compose.yml" --env-file "$EYES_CONF")
mkdir -p "$EYES_RESPALDOS" && chmod 700 "$EYES_RESPALDOS"

# ─── Subir ──────────────────────────────────────────────────────────────────
#
# El destino se arma aqui y no con `respaldo_destino_remoto`, que nombra los
# dumps de Postgres (`<fecha>.dump`) y no sabe de Space Eye. Lo que SI se
# reusa es quien sube: ahi vive el manejo de la llave, y duplicarlo seria
# duplicar la parte peligrosa.
subir() {
  local archivo="$1" nombre="$2" instancia cliente destino
  if ! respaldo_remoto_configurado; then
    registrar "   respaldo remoto NO CONFIGURADO (faltan SPACES_KEY/SPACES_SECRET/SPACES_BUCKET). Space Eye de esta instancia NO tiene respaldo fuera del droplet: si la maquina desaparece, esto desaparece con ella."
    return 2
  fi
  [[ -s "$archivo" ]] || { registrar "   $archivo no existe o esta vacio; no se sube."; return 1; }
  instancia="$(respaldo_instancia)" || instancia=""
  [[ -n "$instancia" ]] || { registrar "   no hay INSTANCIA en la configuracion y el hostname salio vacio: no se sabe a que prefijo del bucket subir, y a la raiz no se sube (ahi viven los respaldos de otras instancias)."; return 1; }
  cliente="$(respaldo_cliente)" || { registrar "   no hay cliente de S3 en el PATH (ni s3cmd ni aws). Instala uno: apt-get install -y s3cmd"; return 1; }
  destino="s3://$SPACES_BUCKET/$instancia/space-eye/$nombre"
  registrar "   -> $destino (por $cliente)"
  case "$cliente" in
    s3cmd) respaldo_subir_s3cmd "$archivo" "$destino" || return 1 ;;
    aws)   respaldo_subir_aws   "$archivo" "$destino" || return 1 ;;
  esac
  registrar "   OK: $destino"
  return 0
}

CODIGO=0
SIN_REMOTO=0

# ─── 1 · La base ────────────────────────────────────────────────────────────
VOLCADO="$EYES_RESPALDOS/space-eye-$(date +%Y%m%d-%H%M%S).sql.gz"
registrar "volcando la base de Space Eye"
"${C[@]}" exec -T mysql sh -c 'mysqldump -h127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --no-tablespaces space_eye 2>/dev/null' | gzip > "$VOLCADO"

# La misma comprobacion que `update-eyes.sh`: un volcado cortado pesa y parece
# bueno. `mysqldump` escribe esa linea al final y solo si termino.
if [[ "$(zcat "$VOLCADO" 2>/dev/null | tail -1)" != *"Dump completed"* ]]; then
  rm -f "$VOLCADO"
  salir "$EX_VACIO" "ERROR respaldar-eyes: el volcado salio cortado o vacio. No se subio nada, y el archivo a medias se borro para que nadie lo confunda con un respaldo bueno."
fi
registrar "   $(du -h "$VOLCADO" | cut -f1)  $VOLCADO"
subir "$VOLCADO" "$(basename "$VOLCADO")"
case $? in
  0) ;;
  2) SIN_REMOTO=1 ;;
  *) CODIGO="$EX_REMOTO" ;;
esac

# ─── 2 · Las fotos, un paquete por dia ──────────────────────────────────────
if [[ "$SOLO_BASE" -eq 0 && "$SIN_REMOTO" -eq 0 ]]; then
  MARCAS="$EYES_RESPALDOS/fotos-subidas"
  mkdir -p "$MARCAS"
  HOY="$(date +%Y-%m-%d)"

  # Los dias que hay, preguntandoselo al contenedor: las fotos viven en un
  # volumen de docker y desde el host no hay ruta.
  DIAS="$("${C[@]}" run --rm --no-deps -T api sh -c 'ls -1 /app/storage/photos 2>/dev/null' | tr -d '\r' | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' | sort)"

  if [[ -z "$DIAS" ]]; then
    registrar "fotos: no hay ningun dia en /app/storage/photos (instancia nueva, o las fotos van a Spaces y no al disco)."
  else
    PENDIENTES=0
    for DIA in $DIAS; do
      # Hoy no: todavia estan llegando fotos. Se sube cuando sea ayer.
      [[ "$DIA" == "$HOY" ]] && continue
      [[ -e "$MARCAS/$DIA" ]] && continue
      PENDIENTES=$((PENDIENTES + 1))
      PAQUETE="$EYES_RESPALDOS/space-eye-fotos-$DIA.tar.gz"
      registrar "fotos del $DIA"
      if ! "${C[@]}" run --rm --no-deps -T api tar -czf - -C /app/storage/photos "$DIA" > "$PAQUETE" 2>/dev/null; then
        registrar "   no se pudo empaquetar el $DIA; se intentara en la siguiente corrida."
        rm -f "$PAQUETE"
        CODIGO="$EX_REMOTO"
        continue
      fi
      [[ -s "$PAQUETE" ]] || { registrar "   el paquete del $DIA salio vacio; no se sube."; rm -f "$PAQUETE"; continue; }
      registrar "   $(du -h "$PAQUETE" | cut -f1)  $PAQUETE"
      if subir "$PAQUETE" "$(basename "$PAQUETE")"; then
        # El marcador DESPUES de que la subida diga que si, nunca antes.
        : > "$MARCAS/$DIA"
        rm -f "$PAQUETE"
      else
        CODIGO="$EX_REMOTO"
        registrar "   el $DIA se queda pendiente: se reintenta manana."
      fi
    done
    [[ "$PENDIENTES" -eq 0 ]] && registrar "fotos: nada pendiente, todos los dias cerrados ya estaban fuera."
  fi
fi

# ─── 3 · Poda local ─────────────────────────────────────────────────────────
#
# Se poda aqui y no con `respaldo_local_podar`: esa funcion lleva el patron
# `spaces_*.dump` FIJO dentro (`respaldo.sh:301`), asi que con los volcados de
# Space Eye no encontraria ninguno y el disco se llenaria sin que nada lo
# dijera. Se deja como esta: es codigo desplegado en todas las instancias y con
# su propio arnes, y tocarlo por esto seria arriesgar el respaldo de Postgres
# para ahorrarse quince lineas.
#
# Mismas reglas que alla, que son las que importan: solo archivos, solo este
# directorio, solo este patron, ordenados por la FECHA DEL ARCHIVO y no por el
# nombre, y nunca se baja de uno.
#
# Los paquetes de fotos NO se podan: los que quedan en disco son justo los que
# no consiguieron salir, y borrarlos seria perder ese dia.
podar_volcados() {
  local cuantos="$RESPALDOS_LOCALES_EYES" archivo retirados=0 i=0 total
  local -a vols=()
  case "$cuantos" in ''|*[!0-9]*) registrar "   AVISO poda: RESPALDOS_LOCALES_EYES='$cuantos' no es un numero; no se poda nada."; return 0 ;; esac
  [[ "$cuantos" -lt 1 ]] && { registrar "   AVISO poda: dejaria cero respaldos, incluido el de esta corrida. No se poda nada."; return 0; }
  while IFS= read -r archivo; do
    [[ -n "$archivo" ]] && vols+=("$archivo")
  done < <(find "$EYES_RESPALDOS" -maxdepth 1 -type f -name 'space-eye-*.sql.gz' -printf '%T@	%p
' 2>/dev/null | sort -k1,1n -k2 | cut -f2-)
  total="${#vols[@]}"
  [[ "$total" -le "$cuantos" ]] && return 0
  for archivo in "${vols[@]}"; do
    i=$((i + 1))
    [[ "$i" -gt $((total - cuantos)) ]] && break
    rm -f "$archivo" && retirados=$((retirados + 1))
  done
  [[ "$retirados" -gt 0 ]] && registrar "   poda local: $retirados volcado(s) viejo(s) retirado(s), quedan $cuantos."
  return 0
}
podar_volcados

if [[ "$CODIGO" -eq "$EX_REMOTO" ]]; then
  salir "$EX_REMOTO" "RESPALDO REMOTO FALLIDO — algo se quedo SOLO en este droplet, y ahi sigue: no se borra. Si esta maquina desaparece, eso desaparece con ella. El motivo esta mas arriba; si dice 403, es permiso de la llave sobre ESE bucket y se arregla en el panel, no aqui."
fi
if [[ "$SIN_REMOTO" -eq 1 ]]; then
  registrar "respaldo local hecho. SIN respaldo remoto: esta instancia sigue con todo en un solo disco."
  exit 0
fi
registrar "respaldo de Space Eye hecho."
exit 0
