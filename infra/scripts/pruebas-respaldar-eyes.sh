#!/usr/bin/env bash
# ============================================================================
#  pruebas-respaldar-eyes.sh — el arnes de `respaldar-eyes.sh`.
# ----------------------------------------------------------------------------
#  POR QUE EXISTE
#  --------------
#  Lo que prueba este arnes no es que funcione: es que **cuando falla, no
#  miente**. Es el mismo criterio de `pruebas-respaldo-diario.sh`, y las formas
#  de mentir de un guion de respaldo son siempre las mismas:
#
#    1. subir un archivo VACIO o CORTADO y decir OK — el peor: al restaurar no
#       hay nada, y el dia que se descubre es el dia que hacia falta;
#    2. borrar lo local porque "ya se subio" cuando la subida fallo;
#    3. salir con 0 cuando el respaldo no salio del droplet, que en un cron es
#       exactamente igual a no haber corrido;
#    4. y una propia de este guion: marcar un dia de fotos como subido cuando
#       no lo esta. Ese dia no se vuelve a intentar NUNCA, y el agujero queda
#       en medio del historial sin que nada lo diga.
#
#  Uso:
#    bash infra/scripts/pruebas-respaldar-eyes.sh
#
#  NO sale a la red, NO habla con Spaces, NO toca docker ni ninguna base. Monta
#  dobles POSIX de `docker` y `s3cmd` en un PATH propio y observa que se les
#  pide. Tarda segundos.
# ============================================================================
set -uo pipefail
exec </dev/null

AQUI="$(cd "$(dirname "$0")" && pwd)"
GUION="$AQUI/respaldar-eyes.sh"
[ -f "$GUION" ] || { echo "no encuentro $GUION"; exit 1; }

PASADAS=0
FALLIDAS=0
ok()    { PASADAS=$((PASADAS + 1)); printf '  ok    %s\n' "$1"; }
falla() { FALLIDAS=$((FALLIDAS + 1)); printf '  FALLA %s\n     %s\n' "$1" "$2"; }
afirmar() { if [ "$2" = "$3" ]; then ok "$1"; else falla "$1" "esperaba [$3], salio [$2]"; fi; }
contiene() { case "$2" in *"$3"*) ok "$1" ;; *) falla "$1" "no encontre [$3] en: $(printf '%s' "$2" | tr '\n' '|' | cut -c1-300)" ;; esac; }
no_contiene() { case "$2" in *"$3"*) falla "$1" "no deberia estar [$3]" ;; *) ok "$1" ;; esac; }

# ─── El escenario ───────────────────────────────────────────────────────────
#
# Cada prueba se monta entera: directorios, configuracion y dobles. Nada se
# reutiliza entre escenarios, que es lo que hace que un fallo se pueda leer
# solo.
montar() {
  RAIZ="$(mktemp -d)"
  export EYES_CONF="$RAIZ/eyes.env"
  export INSTANCIA_CONF="$RAIZ/instancia.env"
  export EYES_DIR="$RAIZ/eyes"
  export EYES_RESPALDOS="$RAIZ/respaldos"
  export LOG_EYES_RESPALDO="$RAIZ/respaldar-eyes.log"
  export SPACE_OS_RESPALDO_SH="$AQUI/respaldo.sh"
  mkdir -p "$EYES_DIR" "$RAIZ/bin"
  : > "$EYES_DIR/docker-compose.yml"
  printf 'DB_PASSWORD=secreta\n' > "$EYES_CONF"
  printf 'INSTANCIA=g500\nSPACES_KEY=llave\nSPACES_SECRET=secreto\nSPACES_BUCKET=respaldos\nSPACES_CLIENTE=s3cmd\n' > "$INSTANCIA_CONF"

  # Doble de `docker`: contesta a las tres cosas que el guion le pide.
  cat > "$RAIZ/bin/docker" <<'DOBLE'
#!/bin/sh
todo="$*"
case "$todo" in
  *mysqldump*)
    if [ "${DUMP_CORTADO:-0}" = "1" ]; then
      printf -- '-- MySQL dump 10.13\nCREATE TABLE a (b INT);\n'
    else
      printf -- '-- MySQL dump 10.13\nCREATE TABLE a (b INT);\n-- Dump completed on 2026-11-20\n'
    fi
    ;;
  *"ls -1 /app/storage/photos"*)  printf '%s\n' $DIAS_FOTOS ;;
  *tar*)                          printf 'paquete-falso-de-fotos' ;;
  *)                              exit 0 ;;
esac
DOBLE
  chmod +x "$RAIZ/bin/docker"

  # Doble de `s3cmd`: apunta lo que le piden y obedece a S3_FALLA.
  cat > "$RAIZ/bin/s3cmd" <<'DOBLE'
#!/bin/sh
for a in "$@"; do
  case "$a" in s3://*) printf '%s\n' "$a" >> "$SUBIDAS" ;; esac
done
[ "${S3_FALLA:-0}" = "1" ] && { echo "ERROR: 403 Forbidden"; exit 1; }
exit 0
DOBLE
  chmod +x "$RAIZ/bin/s3cmd"

  export SUBIDAS="$RAIZ/subidas.txt"
  : > "$SUBIDAS"
  export PATH="$RAIZ/bin:$PATH"
  export DIAS_FOTOS="2026-11-18 2026-11-19 $(date +%Y-%m-%d)"
  unset DUMP_CORTADO S3_FALLA 2>/dev/null || true
}

correr() { bash "$GUION" "$@" >/dev/null 2>&1; printf '%s' "$?"; }
log()    { cat "$LOG_EYES_RESPALDO" 2>/dev/null; }
subidas(){ cat "$SUBIDAS" 2>/dev/null; }

echo "pruebas-respaldar-eyes"

# ─── 1 · Un volcado cortado no se sube, y no se queda en el disco ──────────
echo "1 · el volcado cortado"
montar
export DUMP_CORTADO=1
CODIGO="$(correr)"
afirmar    "sale con 4 (volcado vacio)"            "$CODIGO" "4"
afirmar    "no subio nada"                          "$(subidas | wc -l | tr -d ' ')" "0"
afirmar    "no dejo el volcado a medias en disco"   "$(find "$EYES_RESPALDOS" -name 'space-eye-*.sql.gz' 2>/dev/null | wc -l | tr -d ' ')" "0"
contiene   "el log lo dice"                         "$(log)" "cortado"

# ─── 2 · El camino feliz ───────────────────────────────────────────────────
echo "2 · el camino feliz"
montar
CODIGO="$(correr)"
afirmar    "sale con 0"                             "$CODIGO" "0"
contiene   "subio la base al prefijo de la instancia" "$(subidas)" "s3://respaldos/g500/space-eye/space-eye-"
contiene   "subio las fotos del 18"                 "$(subidas)" "space-eye-fotos-2026-11-18.tar.gz"
contiene   "subio las fotos del 19"                 "$(subidas)" "space-eye-fotos-2026-11-19.tar.gz"
no_contiene "NO subio las fotos de hoy"             "$(subidas)" "space-eye-fotos-$(date +%Y-%m-%d)"
afirmar    "dejo marcados los dos dias"             "$(ls "$EYES_RESPALDOS/fotos-subidas" 2>/dev/null | wc -l | tr -d ' ')" "2"
afirmar    "borro los paquetes ya subidos"          "$(find "$EYES_RESPALDOS" -name 'space-eye-fotos-*.tar.gz' 2>/dev/null | wc -l | tr -d ' ')" "0"

# ─── 3 · La subida falla: nada se borra y nada se marca ────────────────────
echo "3 · la subida falla"
montar
export S3_FALLA=1
CODIGO="$(correr)"
afirmar    "sale con 5 (no salio del droplet)"      "$CODIGO" "5"
afirmar    "el volcado SIGUE en el disco"           "$(find "$EYES_RESPALDOS" -name 'space-eye-*.sql.gz' 2>/dev/null | wc -l | tr -d ' ')" "1"
afirmar    "NO marco ningun dia como subido"        "$(ls "$EYES_RESPALDOS/fotos-subidas" 2>/dev/null | wc -l | tr -d ' ')" "0"
afirmar    "y conserva los paquetes de fotos"       "$(find "$EYES_RESPALDOS" -name 'space-eye-fotos-*.tar.gz' 2>/dev/null | wc -l | tr -d ' ')" "2"

# ─── 4 · Un dia ya subido no se vuelve a subir ─────────────────────────────
echo "4 · lo que ya salio no vuelve a salir"
montar
mkdir -p "$EYES_RESPALDOS/fotos-subidas"
: > "$EYES_RESPALDOS/fotos-subidas/2026-11-18"
CODIGO="$(correr)"
afirmar    "sale con 0"                             "$CODIGO" "0"
no_contiene "no resubio el 18"                      "$(subidas)" "fotos-2026-11-18"
contiene   "si subio el 19"                         "$(subidas)" "fotos-2026-11-19"

# ─── 5 · Sin llaves: se dice, no se miente ─────────────────────────────────
echo "5 · sin respaldo remoto configurado"
montar
printf 'INSTANCIA=g500\n' > "$INSTANCIA_CONF"
CODIGO="$(correr)"
afirmar    "sale con 0 (lo local si se hizo)"       "$CODIGO" "0"
afirmar    "no subio nada"                          "$(subidas | wc -l | tr -d ' ')" "0"
contiene   "y lo dice con todas las letras"         "$(log)" "NO tiene respaldo fuera del droplet"
afirmar    "no marco dias"                          "$(ls "$EYES_RESPALDOS/fotos-subidas" 2>/dev/null | wc -l | tr -d ' ')" "0"

# ─── 6 · La poda deja los N mas recientes ──────────────────────────────────
echo "6 · la poda local"
montar
mkdir -p "$EYES_RESPALDOS"
for n in 1 2 3 4 5; do
  : > "$EYES_RESPALDOS/space-eye-2026010$n-000000.sql.gz"
  touch -d "2026-01-0$n" "$EYES_RESPALDOS/space-eye-2026010$n-000000.sql.gz" 2>/dev/null || true
done
RESPALDOS_LOCALES_EYES=3 correr >/dev/null
afirmar    "quedan 3 (los viejos se retiran)"       "$(find "$EYES_RESPALDOS" -maxdepth 1 -name 'space-eye-*.sql.gz' | wc -l | tr -d ' ')" "3"
afirmar    "y el mas viejo ya no esta"              "$(find "$EYES_RESPALDOS" -maxdepth 1 -name 'space-eye-20260101-*' | wc -l | tr -d ' ')" "0"

echo
printf '%s pasadas, %s fallidas\n' "$PASADAS" "$FALLIDAS"
[ "$FALLIDAS" -eq 0 ] || exit 1
