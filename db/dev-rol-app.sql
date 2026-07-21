-- ============================================================================
--  SOLO DESARROLLO — rol de aplicación restringido (`spaces_app`).
--  NO APLICAR EN PRODUCCIÓN: la contraseña está aquí en claro. En prod el rol de
--  la app es `spaces_user`, que ya existe y tiene su propia contraseña.
-- ----------------------------------------------------------------------------
--  Por qué existe: la app no debe conectar como superusuario, porque el
--  superusuario SALTA la RLS y entonces el aislamiento por tenant no se estaría
--  probando de verdad en local (pasaría todo y fallaría en prod).
--
--  Uso (contra el Postgres local de db/docker-compose.yml, como superusuario):
--    psql postgresql://spaces:spaces@localhost:5433/spaces -f db/dev-rol-app.sql
--    node scripts/apply-migration.mjs db/migrations/20260715_arr_m6_rol_restringido.sql
--
--  Después, en apps/web/.env.local:
--    DATABASE_URL=postgresql://spaces_app:spaces_app_dev@localhost:5433/spaces
--
--  Los GRANTs los da M6 (a los roles que existan); aquí solo se crea el rol.
--  Idempotente.
-- ============================================================================
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'spaces_app') then
    create role spaces_app login password 'spaces_app_dev' nosuperuser nobypassrls;
  end if;
end $$;

select rolname, rolsuper, rolbypassrls, rolcanlogin
  from pg_roles where rolname = 'spaces_app';
