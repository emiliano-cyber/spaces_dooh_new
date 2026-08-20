-- ============================================================================
--  Los GRANT del rol de aplicación dejan de depender de una lista blanca.
-- ----------------------------------------------------------------------------
--  MEDIDO el 2026-08-20 (ROJO-3 del re-ensayo de la Fase 4):
--
--    · `20260715_arr_m6_rol_restringido.sql:21` concede a `spaces_app` y `:38`
--      a `spaces_user`, los dos guardados por EXISTENCIA del rol;
--    · otras once migraciones repiten el patrón con
--      `foreach r in array array['spaces_user','spaces_app']`;
--    · trece archivos de `db/migrations/` nombran el rol.
--
--  El modo de fallo no da error: si el rol NO existía cuando la migración
--  corrió, el bloque entero es un no-op, el runner registra la migración como
--  aplicada y NO vuelve a intentarlo nunca. El rol se crea después y queda sin
--  un solo permiso. La aplicación conecta y cada consulta muere con
--  `permission denied` — ruidoso para la instancia, silencioso para el alta que
--  lo causó. Con un nombre fuera de la lista, lo mismo desde el minuto cero.
--
--  Esta migración es la ÚNICA que repara una instancia ya nacida, porque viaja
--  con el código y se aplica al actualizarse. Es la vía B de la decisión del
--  2026-08-20; la vía A es el candado de `scripts/migrar.mjs`, que se niega a
--  aplicar nada si el rol no existe. Las dos porque protegen momentos
--  distintos: el candado, el alta; esta, todas las actualizaciones posteriores.
--
--  ─── El nombre es UNO en toda la flota ────────────────────────────────────
--
--  `spaces_app`, decidido el 2026-08-20. Lo propio de cada instancia es la
--  CONTRASEÑA, no el nombre: un nombre por instancia es justo lo que hace que
--  las trece migraciones no concedan nada. Las trece siguen sin tocarse —son
--  zona R3, ya aplicadas— y no hace falta: esta concede lo mismo, sin guard.
--
--  ─── Lo que esto NO hace, a propósito ─────────────────────────────────────
--
--  · NO crea el rol. Crear credenciales es provisión de entorno, no migración:
--    el .sql viaja en el repo y se aplica en todos lados. Mismo criterio, y por
--    el mismo motivo, que `20260715_arr_m6_rol_restringido.sql:7-11`.
--  · NO le da `BYPASSRLS` ni `SUPERUSER`. El rol de la app RESPETA la RLS: es
--    el invariante R2 y una migración de GRANT es exactamente donde se colaría.
--  · NO concede a `spaces_user`. Si una instancia todavía corre con ese nombre,
--    esta migración ABORTA y no la deja actualizarse a medias. Es deliberado y
--    tiene tarjeta humana: normalizar el rol a `spaces_app` antes de tomar un
--    release con esta migración.
--
--  Idempotente: solo `grant`, ni un `revoke`. Aplicarla dos veces no cambia una
--  sola fila de `information_schema.role_table_grants`.
-- ============================================================================

begin;

-- ─── 1. Guard: el rol tiene que existir ────────────────────────────────────
-- Fail-closed, misma doctrina que el runner. Sin esto volveríamos al no-op
-- silencioso que este archivo viene a cerrar: conceder a un rol ausente no es
-- un error de Postgres, es una migración que no hizo nada y lo dio por bueno.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'spaces_app') then
    raise exception using message =
      'No existe el rol de aplicacion "spaces_app". Esta migracion concede sus permisos y sin el rol no concederia nada, en silencio. Crealo antes (plantilla: db/dev-rol-app.sql; en una instancia real la contrasena es propia de ella) y repite la actualizacion.';
  end if;
end $$;

-- ─── 2. Los permisos, sin condiciones ──────────────────────────────────────
grant usage on schema public to spaces_app;
grant select, insert, update, delete on all tables in schema public to spaces_app;
grant usage, select on all sequences in schema public to spaces_app;

-- Y las que se creen DESPUÉS. Sin esto el arreglo dura una versión: la próxima
-- migración que cree una tabla vuelve a dejar al rol fuera.
alter default privileges in schema public
  grant select, insert, update, delete on tables to spaces_app;
alter default privileges in schema public
  grant usage, select on sequences to spaces_app;

-- ─── 3. ASSERT: el rol trabaja, y sigue sin poder saltarse la RLS ──────────
-- Se comprueba lo que la migración PROMETE, no lo que ejecutó: que el rol tenga
-- de verdad `usage` sobre el esquema y DML sobre una tabla concreta del núcleo.
do $$
begin
  if not has_schema_privilege('spaces_app', 'public', 'usage') then
    raise exception 'spaces_app se quedo sin USAGE sobre el esquema public';
  end if;
  if not has_table_privilege('spaces_app', 'tenants', 'select')
     or not has_table_privilege('spaces_app', 'tenants', 'insert') then
    raise exception 'spaces_app se quedo sin DML sobre tenants';
  end if;
  -- El invariante R2. Si alguien "arreglara" un permission denied dandole
  -- BYPASSRLS, el aislamiento entre organizaciones desapareceria sin un error.
  if exists (select 1 from pg_roles
              where rolname = 'spaces_app' and (rolbypassrls or rolsuper)) then
    raise exception 'spaces_app tiene BYPASSRLS o SUPERUSER: la RLS dejaria de aislar';
  end if;
end $$;

commit;

-- ─── Verificación ──────────────────────────────────────────────────────────
select rolname, rolsuper, rolbypassrls, rolcanlogin
  from pg_roles where rolname = 'spaces_app';
select count(*) as tablas_con_dml
  from information_schema.role_table_grants
 where grantee = 'spaces_app' and privilege_type = 'SELECT';

-- ─── ROLLBACK ──────────────────────────────────────────────────────────────
-- ⚠️ Deshacer esto deja a la aplicación sin poder leer su propia base.
--
--   revoke select, insert, update, delete on all tables in schema public from spaces_app;
--   revoke usage, select on all sequences in schema public from spaces_app;
--   alter default privileges in schema public
--     revoke select, insert, update, delete on tables from spaces_app;
--   alter default privileges in schema public
--     revoke usage, select on sequences from spaces_app;
