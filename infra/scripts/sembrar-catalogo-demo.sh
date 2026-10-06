#!/usr/bin/env bash
# ============================================================================
#  sembrar-catalogo-demo.sh — siembra el catálogo de la demostración en una
#  base del PADRE, con respaldo previo. Lo corre UNA PERSONA en el servidor.
# ----------------------------------------------------------------------------
#  Uso, desde el clon del repositorio en el PADRE y ya con `git pull` hecho:
#
#    cd /var/www/Spaces
#    sudo bash infra/scripts/sembrar-catalogo-demo.sh <base> [--con-guion]
#
#    <base>        spaces_demo  (el contenedor DEMO del 3001)
#                  spaces_prod  (la aplicación del PADRE)
#    --con-guion   antes del catálogo corre también `semilla-demo.mjs`, el
#                  guion de rentabilidad (Tlalpan vs Santa Mónica y las razones
#                  sociales que emiten los comprobantes)
#    --deshacer    vuelta atrás: borra SOLO lo sembrado por el catálogo (lo
#                  `CAT-`), en una transacción. No siembra nada
#
#  Pide la contraseña de los usuarios demo por teclado, sin eco: no pasa por
#  `argv` ni queda en el historial de la consola.
#
#  ─── Por qué así ──────────────────────────────────────────────────────────
#  · La URL es la de `spaces_migrador`, que vive en
#    `/etc/space-os/demo-instancia.env` (0600 de root, de ahí el `sudo`). Los
#    roles son del servidor entero, así que para `spaces_prod` se cambia solo el
#    nombre de la base — el mismo procedimiento que el diario del 01/10 deja
#    para migrar el PADRE. `spaces_app` no sirve: es el rol de la aplicación,
#    sujeto a RLS y sin permiso para crear la organización.
#  · El respaldo va ANTES y con `conexion-pg.sh`, que separa la contraseña de la
#    URL para que `pg_dump` no la deje en `argv` (visible con `ps`).
#  · La semilla es idempotente: correr este guion dos veces no duplica nada.
#
#  ─── Vuelta atrás ─────────────────────────────────────────────────────────
#  `--deshacer` borra lo `CAT-` y nada más. NO se restaura el `pg_dump` como
#  vuelta atrás normal: `pg_restore --clean` emite `DROP EXTENSION pgcrypto`,
#  que es de `postgres` y no de `spaces_migrador`, y la restauración muere
#  entera. El respaldo se queda para un desastre, restaurado por alguien con
#  el rol `postgres`.
# ============================================================================
set -Eeuo pipefail

BASE="${1:-}"
CON_GUION="${2:-}"
CONF="${SPACE_OS_CONF:-/etc/space-os/demo-instancia.env}"
DIR_RESPALDOS="${DIR_RESPALDOS:-/var/lib/space-os/respaldos-semilla}"
ORG="${ORG:-demo-rentabilidad}"

case "$BASE" in
  spaces_demo|spaces_prod) ;;
  *) echo "uso: sudo bash infra/scripts/sembrar-catalogo-demo.sh <spaces_demo|spaces_prod> [--con-guion]" >&2; exit 1 ;;
esac
DESHACER=""
case "$CON_GUION" in
  ''|--con-guion) ;;
  --deshacer) DESHACER=1; CON_GUION="" ;;
  *) echo "opcion desconocida: $CON_GUION" >&2; exit 1 ;;
esac

[ -f scripts/semilla-catalogo-demo.mjs ] || { echo "ERROR: corre esto desde la raiz del repositorio (/var/www/Spaces), con git pull hecho." >&2; exit 1; }
[ -r "$CONF" ] || { echo "ERROR: no se puede leer $CONF (hace falta sudo)." >&2; exit 1; }
command -v node >/dev/null || { echo "ERROR: no hay node en el PATH." >&2; exit 1; }
command -v pg_dump >/dev/null || { echo "ERROR: no hay pg_dump en el PATH." >&2; exit 1; }

URL_DEMO="$(grep '^DATABASE_URL=' "$CONF" | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
[ -n "$URL_DEMO" ] || { echo "ERROR: $CONF no trae DATABASE_URL." >&2; exit 1; }
# Solo se cambia el nombre de la base, y solo si la URL apunta a spaces_demo:
# si algún día la URL cambia de forma, mejor parar que sembrar en otra base.
case "$URL_DEMO" in
  */spaces_demo|*/spaces_demo\?*) ;;
  *) echo "ERROR: la DATABASE_URL de $CONF no termina en /spaces_demo; no se adivina a que base apunta." >&2; exit 1 ;;
esac
export DATABASE_URL="${URL_DEMO/\/spaces_demo/\/$BASE}"

if [ -n "$DESHACER" ]; then
  read -r -p "Esto borra el catalogo CAT- de '$ORG' en $BASE. Escribe el nombre de la base para seguir: " OK
  [ "$OK" = "$BASE" ] || { echo "No coincide. Nada se toco." >&2; exit 1; }
  node scripts/semilla-catalogo-demo.mjs --deshacer --org="$ORG"
  exit $?
fi

echo "== 1 · lo que se va a sembrar (no toca la base)"
node scripts/semilla-catalogo-demo.mjs --resumen --org="$ORG"

read -rs -p "Contrasena para los 8 usuarios demo (10+ caracteres): " SEMILLA_CLAVE; echo
read -rs -p "Repitela: " OTRA; echo
[ "$SEMILLA_CLAVE" = "$OTRA" ] || { echo "ERROR: no coinciden. Nada se toco." >&2; exit 1; }
[ "${#SEMILLA_CLAVE}" -ge 10 ] || { echo "ERROR: tiene que tener 10 caracteres o mas. Nada se toco." >&2; exit 1; }
export SEMILLA_CLAVE

echo "== 2 · respaldo de $BASE antes de sembrar"
. infra/scripts/conexion-pg.sh
pg_derivar_conexion "$DATABASE_URL" || { echo "ERROR: $PG_ERROR" >&2; exit 1; }
umask 077
mkdir -p "$DIR_RESPALDOS"
BK="$DIR_RESPALDOS/${BASE}_antes_catalogo_$(date +%Y%m%d_%H%M%S).dump"
correr_pg pg_dump --format=custom --file="$BK"
echo "   respaldo: $BK ($(stat -c %s "$BK") bytes)"

if [ "$CON_GUION" = --con-guion ]; then
  echo "== 3a · el guion de rentabilidad (semilla-demo.mjs)"
  node scripts/semilla-demo.mjs --org="$ORG" --trimestres=4
fi

echo "== 3 · el catalogo"
node scripts/semilla-catalogo-demo.mjs --org="$ORG"

cat <<FIN

== HECHO en $BASE.
   Entra con cualquiera de los 8 correos *@catalogo.invalid y la contrasena que pusiste.

   Vuelta atras (borra solo lo sembrado por el catalogo):
     sudo bash infra/scripts/sembrar-catalogo-demo.sh $BASE --deshacer
   Respaldo completo de antes, para un desastre (restaurarlo exige el rol postgres):
     $BK
FIN
