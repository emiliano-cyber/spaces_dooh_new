-- ========================================================================
--  El DEFAULT de tenant_id se retira: un insert sin tenant debe TRONAR.
--  Ese default (db/schema.sql:615) es lo que ha etiquetado como RGB filas de
--  otras organizaciones cuando alguien olvidaba fijar el tenant.
--  `config_negocio` ya nació sin él a propósito (db/schema.sql:626+, ADR
--  0011); esto extiende ese criterio a las 23 tablas del bucle.
--
--  Se recorre el CATÁLOGO y no una lista copiada a mano: producción tiene
--  tablas que schema.sql no trae (db-e2e.ts:100-118 lo documenta), y una
--  lista se queda vieja el día que alguien añada una tabla.
--
--  Compatibilidad: ninguna versión del código depende del default —todos los
--  repos pasan tenant_id explícito—, así que una instancia rezagada sigue
--  funcionando igual. Transaccional e idempotente.
-- ========================================================================
begin;

-- 1) Guard: no se quita el default donde sea lo único que sostiene la
--    columna. Si aparece una así, aborta nombrándola.
do $$
declare faltan text;
begin
  select string_agg(c.relname, ', ') into faltan
    from pg_attrdef d
    join pg_class c on c.oid = d.adrelid
    join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname='public' and a.attname='tenant_id' and a.attnotnull = false;
  if faltan is not null then
    raise exception 'Estas tablas tienen tenant_id con DEFAULT y SIN NOT NULL: %. Ponles NOT NULL antes.', faltan;
  end if;
end $$;

-- 2) Quitar el default de todas las que lo tengan.
do $$
declare t text;
begin
  for t in
    select c.relname from pg_attrdef d
      join pg_class c on c.oid=d.adrelid
      join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
      join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and a.attname='tenant_id'
  loop
    execute format('alter table %I alter column tenant_id drop default', t);
  end loop;
end $$;

-- 3) ASSERT: no queda ni uno.
do $$
begin
  if exists (select 1 from pg_attrdef d
               join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
               join pg_class c on c.oid=d.adrelid
               join pg_namespace n on n.oid=c.relnamespace
              where n.nspname='public' and a.attname='tenant_id')
  then raise exception 'Quedaron columnas tenant_id con DEFAULT'; end if;
end $$;

commit;

-- Verificación (debe devolver 0 filas):
--   select c.relname from pg_attrdef d join pg_class c on c.oid=d.adrelid
--     join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
--    where a.attname='tenant_id';
--
-- ROLLBACK de emergencia (REINTRODUCE LA DERIVA — pensarlo dos veces):
--   do $$ declare t text; def uuid; begin
--     select id into def from tenants where slug='rgb';
--     foreach t in array array['usuarios','sitios','clientes','propuestas',
--       'propuesta_items','ordenes_compra','campanas','creatividades','reservas',
--       'ordenes_trabajo','evidencias_ot','ordenes_impresion','facturas',
--       'cobranzas','arrendadores','contratos_arrendamiento','pagos_renta',
--       'incidencias','notificaciones','acciones','sitio_modalidades','predios',
--       'arrendador_razon_social'] loop
--       execute format('alter table %I alter column tenant_id set default %L', t, def);
--     end loop; end $$;
