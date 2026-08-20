#!/usr/bin/env bash
# ============================================================================
#  pruebas-vuelta-atras-real.sh — la vuelta atras de `update.sh`, contra una
#  base de VERDAD.
# ----------------------------------------------------------------------------
#  `pruebas-update.sh` monta dobles y mira lo que el script PIDE: eso fija el
#  orden, los codigos y los mensajes, pero no puede responder a la unica
#  pregunta que decide si el arreglo de D1 se podia hacer — «¿basta el dump para
#  rehacer la base entera?». Esa se responde tirando el esquema de una base con
#  datos y mirando que vuelve. Aqui, contra Postgres.
#
#  Lo que demuestra, en este orden:
#    1. EL DEFECTO · `pg_restore --clean --if-exists` deja DENTRO los objetos que
#       creo el release fallido, porque no estan en el dump. La huella lo canta.
#    2. LA CONSECUENCIA · con una migracion no idempotente, ese release ya no se
#       puede volver a aplicar nunca: «relation ... already exists».
#    3. EL ARREGLO · con el esquema limpio vuelven esquema, datos, RLS, GRANTs y
#       privilegios por omision; la huella es otra vez la de antes; y el mismo
#       release se aplica sin quejarse.
#    4. LA APP SIGUE SIENDO LA APP · el rol restringido ve sus filas con el
#       tenant fijado, no ve nada sin el, no toca las de otro y NO puede apagar
#       la RLS. Restaurar sin esto seria restaurar el aislamiento a medias.
#
#  El SQL de la limpieza NO se copia: se EXTRAE de `update.sh`. Si alguien lo
#  cambia alli, esto prueba lo nuevo o falla en el sitio; una copia se habria
#  quedado vieja sin que nadie se enterara.
#
#  Uso (con el Postgres de `db/docker-compose.yml` levantado):
#    bash infra/scripts/pruebas-vuelta-atras-real.sh
#
#  Variables: PG_CONTENEDOR (spaces_db) · PG_SUPER (spaces) · PG_SUPER_CLAVE
#  (spaces) · BASE (d1_vuelta_atras_test).
#
#  NO se apunta a una base cualquiera: el nombre TIENE que acabar en `_test` o
#  `_e2e`, mismo guard que `apps/web/lib/test/db-e2e.ts`. La base `spaces` del
#  5433 tiene datos reales y aqui se hace `drop schema public cascade`.
# ============================================================================
set -uo pipefail

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
UPDATE_SH="$RAIZ/infra/scripts/update.sh"
CONTENEDOR="${PG_CONTENEDOR:-spaces_db}"
SUPER="${PG_SUPER:-spaces}"
SUPER_CLAVE="${PG_SUPER_CLAVE:-spaces}"
BASE="${BASE:-d1_vuelta_atras_test}"
ROL_APP="d1r_app_test"
ROL_APP_CLAVE="d1r_app"
ROL_MIG="d1r_mig_test"
ROL_MIG_CLAVE="d1r_mig"

COMPROBACIONES=0
FALLOS=0
bien() { COMPROBACIONES=$((COMPROBACIONES + 1)); printf '  ok   %s\n' "$1"; }
mal()  { COMPROBACIONES=$((COMPROBACIONES + 1)); FALLOS=$((FALLOS + 1)); printf '  ROJO %s\n' "$1"; }
igual() { if [ "$2" = "$3" ]; then bien "$1"; else mal "$1 — esperado [$3], real [$2]"; fi; }

# El guard, y va antes que nada. `recrearEsquema()` de las e2e se niega igual y
# por el mismo motivo: aqui dentro hay un `drop schema public cascade`.
case "$BASE" in
  *_test|*_e2e) ;;
  *) printf 'ABORTADO: BASE="%s" no acaba en _test ni _e2e. Este guion tira el esquema entero.\n' "$BASE" >&2; exit 1 ;;
esac
command -v docker >/dev/null 2>&1 || { echo 'ABORTADO: no hay docker en el PATH.' >&2; exit 1; }
docker exec "$CONTENEDOR" true >/dev/null 2>&1 || { printf 'ABORTADO: no responde el contenedor "%s".\n' "$CONTENEDOR" >&2; exit 1; }

sup()  { docker exec -e PGPASSWORD="$SUPER_CLAVE" -i "$CONTENEDOR" psql -X -q -v ON_ERROR_STOP=1 -U "$SUPER" -d "${1:-postgres}" -tA; }
mig()  { docker exec -e PGPASSWORD="$ROL_MIG_CLAVE" -i "$CONTENEDOR" psql -X -q -v ON_ERROR_STOP=1 -U "$ROL_MIG" -d "$BASE" -tA; }
app()  { docker exec -e PGPASSWORD="$ROL_APP_CLAVE" -i "$CONTENEDOR" psql -X -q -U "$ROL_APP" -d "$BASE" -tA; }

# La huella: el MISMO SQL que la sonda de `update.sh`, extraido de ella. Si la
# consulta cambia alli y aqui no, esto no mide lo que el script decide.
SQL_HUELLA="$(sed -n '/^  select coalesce(md5(string_agg(t, chr(10) order by t)), .vacia.) as h from (/,/^  ) s`$/p' "$UPDATE_SH" | sed 's/`$//')"
if ! printf '%s' "$SQL_HUELLA" | grep -q 'pg_policies'; then
  echo 'ABORTADO: no se pudo extraer de update.sh la consulta de la huella (busca SQL_ESQUEMA).' >&2; exit 1
fi
# El SQL de la limpieza, extraido del heredoc de `limpiar_esquema`.
SQL_LIMPIAR="$(sed -n '/<<.FIN_SQL_LIMPIAR./,/^FIN_SQL_LIMPIAR$/p' "$UPDATE_SH" | sed '1d;$d')"
if ! printf '%s' "$SQL_LIMPIAR" | grep -q 'drop schema public cascade'; then
  echo 'ABORTADO: no se pudo extraer de update.sh el SQL de limpieza (busca FIN_SQL_LIMPIAR).' >&2; exit 1
fi

huella() { printf '%s' "$SQL_HUELLA" | mig; }

# La migracion del release fallido: NO idempotente a proposito. Es la forma en
# que D1 deja una instancia atascada — la tabla sobrevive a la vuelta atras y el
# siguiente intento muere contra ella.
MIGRACION_FALLIDA="create table ensayo_marca_dos (id serial primary key, dato text);
alter table tenants add column ensayo_columna text;
insert into schema_migrations (archivo, checksum) values ('20260821_ensayo_marca_dos.sql','xyz');"

printf '\n── preparando %s en %s ─────────────────────────────\n' "$BASE" "$CONTENEDOR"
sup postgres <<SQL >/dev/null
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname='$ROL_MIG') then
    create role $ROL_MIG login password '$ROL_MIG_CLAVE' nosuperuser bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname='$ROL_APP') then
    create role $ROL_APP login password '$ROL_APP_CLAVE' nosuperuser nobypassrls;
  end if;
end \$\$;
SQL
sup postgres <<SQL >/dev/null
drop database if exists $BASE;
create database $BASE owner $ROL_MIG;
SQL
# `pgcrypto` la crea `db/schema.sql` con el rol de las migraciones, que es como
# nace una instancia: desde Postgres 13 es una extension CONFIABLE, asi que el
# dueno de la base puede instalarla y queda a su nombre. Instalarla aqui como
# superusuario cambiaria el ensayo entero — medido: con la extension a nombre de
# otro rol, el `pg_restore --clean` de HOY muere en su primera sentencia
# («must be owner of extension pgcrypto»), `--single-transaction` lo revierte
# todo y no se restaura NADA. Eso es otro defecto, no D1.
mig <"$RAIZ/db/schema.sql" >/dev/null 2>&1
mig <"$RAIZ/db/migrations/20260812_schema_migrations.sql" >/dev/null 2>&1
mig <<SQL >/dev/null
grant usage on schema public to $ROL_APP;
grant select, insert, update, delete on all tables in schema public to $ROL_APP;
grant usage, select on all sequences in schema public to $ROL_APP;
alter default privileges in schema public grant select, insert, update, delete on tables to $ROL_APP;
alter default privileges in schema public grant usage, select on sequences to $ROL_APP;
insert into tenants (slug, nombre) values ('uno','Uno'), ('dos','Dos') on conflict do nothing;
do \$\$
declare t record;
begin
  for t in select id from tenants loop
    perform set_config('app.tenant_id', t.id::text, true);
    if not exists (select 1 from config_negocio c where c.tenant_id=t.id) then
      insert into config_negocio (tenant_id, moneda) values (t.id, 'MXN');
    end if;
  end loop;
end \$\$;
insert into schema_migrations (archivo, checksum)
  values ('20260812_schema_migrations.sql','abc') on conflict do nothing;
SQL

UNO="$(printf "select id from tenants where slug='uno';" | mig)"
DOS="$(printf "select id from tenants where slug='dos';" | mig)"
HUELLA_ANTES="$(huella)"
MIGRACIONES_ANTES="$(printf 'select count(*) from schema_migrations;' | mig)"
printf 'huella antes de migrar: %s · %s migraciones registradas\n' "$HUELLA_ANTES" "$MIGRACIONES_ANTES"

DUMP=/tmp/d1-vuelta-atras.dump
docker exec -e PGPASSWORD="$ROL_MIG_CLAVE" "$CONTENEDOR" \
  pg_dump -h localhost -p 5432 -U "$ROL_MIG" -d "$BASE" --format=custom --file="$DUMP" >/dev/null 2>&1
if [ "$(docker exec "$CONTENEDOR" sh -c "[ -s $DUMP ] && echo si || echo no")" = si ]; then
  bien 'el respaldo se tomo y no esta vacio'
else
  mal 'el respaldo salio vacio: sin el no hay nada que medir'; exit 1
fi

# ── 1 · EL DEFECTO, tal y como esta hoy ────────────────────────────────────
printf '\n── 1 · lo que hace `pg_restore --clean --if-exists` a secas (el defecto D1)\n'
printf '%s\n' "$MIGRACION_FALLIDA" | mig >/dev/null
HUELLA_MIGRADA="$(huella)"
if [ "$HUELLA_MIGRADA" != "$HUELLA_ANTES" ]; then bien 'la migracion del release cambio la huella'; else mal 'la migracion no cambio la huella: el ensayo no mide nada'; fi
docker exec -e PGPASSWORD="$ROL_MIG_CLAVE" "$CONTENEDOR" \
  pg_restore -h localhost -p 5432 -U "$ROL_MIG" -d "$BASE" --clean --if-exists --single-transaction "$DUMP" >/dev/null 2>&1
CODIGO_HOY=$?
# Que la restauracion de hoy SALGA BIEN es parte de la prueba: si fallara, lo
# que sigue mediria "no se restauro nada" en vez de D1. Paso una vez, con la
# extension a nombre de otro rol, y el ensayo parecia correcto igualmente.
igual 'la restauracion de hoy sale BIEN (0): lo que sigue no es un fallo disfrazado' "$CODIGO_HOY" '0'
igual 'la tabla del release fallido SOBREVIVE a la restauracion de hoy' \
  "$(printf "select (to_regclass('public.ensayo_marca_dos') is not null)::text;" | mig)" 'true'
igual 'y NO queda registrada en schema_migrations (el registro si volvio)' \
  "$(printf "select exists(select 1 from schema_migrations where archivo='20260821_ensayo_marca_dos.sql')::text;" | mig)" 'false'
if [ "$(huella)" != "$HUELLA_ANTES" ]; then
  bien 'la huella tras restaurar NO es la de antes: la base no volvio como estaba'
else
  mal 'la huella coincide: el defecto D1 no se reprodujo'
fi

# ── 2 · LA CONSECUENCIA · ese release ya no se puede volver a aplicar ──────
printf '\n── 2 · el mismo release, otra vez, sobre la base "restaurada"\n'
SEGUNDO="$(printf '%s\n' "$MIGRACION_FALLIDA" | mig 2>&1)"
case "$SEGUNDO" in
  *'already exists'*) bien 'el segundo intento muere con «already exists»: la instancia queda atascada' ;;
  *) mal "se esperaba «already exists» al reaplicar y salio: $SEGUNDO" ;;
esac

# ── 3 · EL ARREGLO · el MISMO SQL de limpieza que corre `update.sh` ────────
printf '\n── 3 · el arreglo: esquema limpio y restaurar encima\n'
printf '%s\n' "$SQL_LIMPIAR" | mig >/dev/null 2>&1
igual 'tras la limpieza no queda ni una tabla en public' \
  "$(printf "select count(*)::text from information_schema.tables where table_schema='public';" | mig)" '0'
docker exec -e PGPASSWORD="$ROL_MIG_CLAVE" "$CONTENEDOR" \
  pg_restore -h localhost -p 5432 -U "$ROL_MIG" -d "$BASE" --clean --if-exists --single-transaction "$DUMP" >/dev/null 2>&1
CODIGO_LIMPIO=$?
igual 'la restauracion sobre el esquema limpio sale bien' "$CODIGO_LIMPIO" '0'
igual 'la tabla del release fallido YA NO esta' \
  "$(printf "select (to_regclass('public.ensayo_marca_dos') is not null)::text;" | mig)" 'false'
igual 'ni su columna' \
  "$(printf "select exists(select 1 from information_schema.columns where table_name='tenants' and column_name='ensayo_columna')::text;" | mig)" 'false'
igual 'el registro de migraciones vuelve a las de antes' "$(printf 'select count(*)::text from schema_migrations;' | mig)" "$MIGRACIONES_ANTES"
igual 'LA HUELLA ES OTRA VEZ LA DE ANTES DE MIGRAR' "$(huella)" "$HUELLA_ANTES"

# Lo que el `drop schema` se lleva por delante y el dump tiene que devolver.
igual 'vuelve la extension pgcrypto (el drop schema se la lleva)' \
  "$(printf "select exists(select 1 from pg_extension where extname='pgcrypto')::text;" | mig)" 'true'
igual 'y funciona: gen_random_uuid() responde' \
  "$(printf 'select (gen_random_uuid() is not null)::text;' | mig)" 'true'
igual 'vuelven las politicas de RLS' \
  "$(printf "select (count(*) > 0)::text from pg_policies where schemaname='public';" | mig)" 'true'
igual 'vuelve el force row level security de config_negocio' \
  "$(printf "select relforcerowsecurity::text from pg_class where relname='config_negocio';" | mig)" 'true'
igual 'vuelven los GRANT del rol de la aplicacion' \
  "$(printf "select (count(*) > 0)::text from information_schema.role_table_grants where grantee='$ROL_APP';" | mig)" 'true'
igual 'vuelven los privilegios por omision (alter default privileges)' \
  "$(printf "select count(*)::text from pg_default_acl d join pg_namespace n on n.oid=d.defaclnamespace where n.nspname='public';" | mig)" '2'
igual 'el esquema public conserva su dueno de antes' \
  "$(printf "select pg_get_userbyid(nspowner) from pg_namespace where nspname='public';" | mig)" 'pg_database_owner'
igual 'el rol de la aplicacion sigue existiendo (vive en el servidor, no en el esquema)' \
  "$(printf "select exists(select 1 from pg_roles where rolname='$ROL_APP')::text;" | sup postgres)" 'true'

# ── 4 · LA APP, con su rol restringido, despues de todo esto ───────────────
printf '\n── 4 · la aplicacion sigue viendo lo suyo y solo lo suyo\n'
igual 'sin tenant fijado no ve ni una fila' \
  "$(printf 'begin; select count(*)::text from config_negocio; commit;' | app | tail -n1)" '0'
igual 'con SU tenant ve su fila, y es la suya' \
  "$(printf "begin; set local app.tenant_id = '$UNO'; select (count(*) = 1 and bool_and(tenant_id = '$UNO'))::text from config_negocio; commit;" | app | tail -n1)" 'true'
igual 'no puede escribir en las filas de otro tenant' \
  "$(printf "begin; set local app.tenant_id = '$UNO'; update config_negocio set moneda='XXX' where tenant_id='$DOS'; select count(*)::text from config_negocio where moneda='XXX'; rollback;" | app | tail -n1)" '0'
case "$(printf 'alter table config_negocio disable row level security;' | app 2>&1)" in
  *'must be owner'*) bien 'NO puede desactivar la RLS' ;;
  *) mal 'el rol restringido pudo desactivar la RLS despues de restaurar' ;;
esac
case "$(printf 'drop policy tenant_isolation on config_negocio;' | app 2>&1)" in
  *'must be owner'*) bien 'NO puede tirar la politica de aislamiento' ;;
  *) mal 'el rol restringido pudo tirar la politica despues de restaurar' ;;
esac

# ── 5 · LO QUE HOY ES IMPOSIBLE · el mismo release, otra vez ───────────────
printf '\n── 5 · y el release descartado se puede volver a aplicar\n'
REAPLICADO="$(printf '%s\n' "$MIGRACION_FALLIDA" | mig 2>&1)"
case "$REAPLICADO" in
  *'already exists'*) mal "el release sigue sin poder reaplicarse: $REAPLICADO" ;;
  *) bien 'el release se aplica otra vez sin quejarse: la instancia ya no queda atascada' ;;
esac

printf '\n── limpieza ────────────────────────────────────────────\n'
docker exec "$CONTENEDOR" rm -f "$DUMP" >/dev/null 2>&1
sup postgres <<SQL >/dev/null
drop database if exists $BASE;
SQL
printf 'base %s destruida\n' "$BASE"

printf '\n%s comprobaciones · %s rojas\n' "$COMPROBACIONES" "$FALLOS"
[ "$FALLOS" -eq 0 ] || exit 1
