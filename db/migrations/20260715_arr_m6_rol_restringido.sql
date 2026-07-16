-- ============================================================================
-- Arrendadores Fase 1 · M6 — GRANTs para el rol de aplicación restringido.
-- La app NO debe conectar como superusuario (que salta RLS):
--   • prod: `spaces_user` (NOSUPERUSER/NOBYPASSRLS), ya existente.
--   • dev:  `spaces_app`, que se crea aparte con `db/dev-rol-app.sql`.
--
-- Esta migración NO crea ningún rol de login. Antes sí lo hacía —con una
-- contraseña de dev escrita aquí— y eso habría plantado en PRODUCCIÓN un usuario
-- de base de datos con contraseña conocida y DML sobre todo el esquema. Crear
-- credenciales es provisión de entorno, no migración de esquema: el .sql viaja
-- en el repo y se aplica en todos lados.
--
-- Aquí solo se otorgan permisos, a los roles que YA existan (guardado por
-- existencia, así que en prod el bloque de dev es un no-op y viceversa).
-- Idempotente.
-- ============================================================================
begin;

-- spaces_app (dev, si se creó con db/dev-rol-app.sql): DML del esquema de la app.
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

-- spaces_user (prod): asegurar DML sobre las tablas NUEVAS del módulo. Las demás
-- ya las tenía. Sin esto, la app en prod da "permission denied" al leer predios.
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

-- Verificación: ningún rol nuevo debe aparecer por culpa de esta migración.
select rolname, rolsuper, rolbypassrls, rolcanlogin
  from pg_roles where rolname in ('spaces_app','spaces_user','spaces') order by rolname;
