-- ============================================================================
-- Arrendadores Fase 1 · M6 — Rol de aplicación restringido + GRANTs.
-- La app NO debe conectar como superusuario (que salta RLS). En prod ya se usa
-- `spaces_user` (NOSUPERUSER/NOBYPASSRLS). En dev se crea `spaces_app` con el
-- mismo perfil y se le otorga el DML necesario.
--   • spaces_app (dev): DML sobre TODO el esquema (es el rol de la app en dev).
--   • spaces_user (prod, si existe): DML sobre las tablas NUEVAS del módulo
--     (predios, arrendador_razon_social); las demás ya las tenía.
-- Tras aplicar en dev: apuntar apps/web/.env.local DATABASE_URL a spaces_app.
-- Idempotente.
-- ============================================================================
begin;

-- Rol restringido de DEV (no existe en prod; ahí se usa spaces_user).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'spaces_app') then
    create role spaces_app login password 'spaces_app_dev' nosuperuser nobypassrls;
  end if;
end $$;

-- spaces_app (dev): acceso DML completo al esquema de la app.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'spaces_app') then
    grant usage on schema public to spaces_app;
    grant select, insert, update, delete on all tables in schema public to spaces_app;
    grant usage, select on all sequences in schema public to spaces_app;
    -- Tablas/secuencias futuras.
    alter default privileges in schema public
      grant select, insert, update, delete on tables to spaces_app;
    alter default privileges in schema public
      grant usage, select on sequences to spaces_app;
  end if;
end $$;

-- spaces_user (prod): asegurar DML sobre las tablas NUEVAS del módulo.
do $$
declare t text;
begin
  if exists (select 1 from pg_roles where rolname = 'spaces_user') then
    grant usage on schema public to spaces_user;
    foreach t in array array['predios','arrendador_razon_social',
                             'contratos_arrendamiento','pagos_renta','arrendadores','sitios'] loop
      execute format('grant select, insert, update, delete on %I to spaces_user', t);
    end loop;
  end if;
end $$;

commit;

-- Verificación
select rolname, rolsuper, rolbypassrls, rolcanlogin
  from pg_roles where rolname in ('spaces_app','spaces_user','spaces') order by rolname;
