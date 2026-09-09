-- ===========================================================================
--  E2 · Censo de la base puente — Plan_Migracion_Datos_g500.md seccion 4
--  Solo lectura. Se corre sobre `spaces_puente`, ya migrada a 78 + 1 de datos.
-- ===========================================================================
\pset pager off
\timing off

\echo ''
\echo '=== 0 · Las organizaciones, con su id ==='
select slug, id, creado_en::date from tenants order by slug;

\echo ''
\echo '=== 1 · Filas de g500 por tabla (y el total de la tabla, para dimensionar) ==='
with t as (select id from tenants where slug = 'g500')
select c.table_name,
       (xpath('/row/c/text()', query_to_xml(
          format('select count(*) as c from %I where tenant_id = %L', c.table_name, (select id from t)),
          false, true, '')))[1]::text::bigint as g500,
       (xpath('/row/c/text()', query_to_xml(
          format('select count(*) as c from %I', c.table_name),
          false, true, '')))[1]::text::bigint as total_tabla
  from information_schema.columns c
 where c.table_schema = 'public' and c.column_name = 'tenant_id'
 order by 2 desc, 1;

\echo ''
\echo '=== 2 · LA DERIVA: hijas cuyo tenant_id no coincide con el de su madre ==='
\echo '    (chequeo 1 y 6 a la vez. Cero filas = no hay deriva)'
with fks as (
  select src.relname as hija,
         tgt.relname as madre,
         (select attname from pg_attribute
           where attrelid = con.conrelid and attnum = con.conkey[1]) as col_hija,
         (select attname from pg_attribute
           where attrelid = con.confrelid and attnum = con.confkey[1]) as col_madre
    from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_class tgt on tgt.oid = con.confrelid
    join pg_namespace nsp on nsp.oid = src.relnamespace
   where con.contype = 'f'
     and nsp.nspname = 'public'
     and array_length(con.conkey, 1) = 1
     and exists (select 1 from pg_attribute a
                  where a.attrelid = con.conrelid  and a.attname = 'tenant_id' and a.attnum > 0)
     and exists (select 1 from pg_attribute a
                  where a.attrelid = con.confrelid and a.attname = 'tenant_id' and a.attnum > 0)
)
select hija, col_hija, madre, desajustes
  from (
    select hija, madre, col_hija,
           (xpath('/row/c/text()', query_to_xml(format(
              'select count(*) as c from %I h join %I m on m.%I = h.%I where h.tenant_id <> m.tenant_id',
              hija, madre, col_madre, col_hija), false, true, '')))[1]::text::bigint as desajustes
      from fks
  ) x
 where desajustes > 0
 order by desajustes desc, hija;

\echo ''
\echo '=== 3 · Modalidades de las pantallas de g500, por tenant de la modalidad ==='
\echo '    (donde el censo del 13/08 encontro las 15 mal etiquetadas)'
select tm.slug as tenant_de_la_modalidad, count(*) as modalidades
  from sitio_modalidades sm
  join sitios s   on s.id = sm.sitio_id
  join tenants ts on ts.id = s.tenant_id
  join tenants tm on tm.id = sm.tenant_id
 where ts.slug = 'g500'
 group by 1 order by 2 desc;

\echo ''
\echo '=== 4 · RFC repetidos dentro de g500 (las UNIQUE son por tenant) ==='
select 'arrendadores' as tabla, upper(btrim(rfc)) as rfc, count(*)
  from arrendadores where tenant_id = (select id from tenants where slug='g500')
   and rfc is not null and btrim(rfc) <> ''
 group by 1,2 having count(*) > 1
union all
select 'clientes', upper(btrim(rfc)), count(*)
  from clientes where tenant_id = (select id from tenants where slug='g500')
   and rfc is not null and btrim(rfc) <> ''
 group by 1,2 having count(*) > 1;

\echo ''
\echo '=== 5 · Folios: el contador de g500 frente al folio mas alto realmente usado ==='
select ambito, periodo, ultimo
  from folios_consecutivos
 where tenant_id = (select id from tenants where slug='g500')
 order by ambito, periodo;

\echo '--- folios realmente usados por g500, por tabla ---'
with t as (select id from tenants where slug='g500')
select c.table_name,
       (xpath('/row/c/text()', query_to_xml(format(
          'select count(*) as c from %I where tenant_id = %L and folio is not null', c.table_name, (select id from t)),
          false, true, '')))[1]::text::bigint as con_folio,
       (xpath('/row/m/text()', query_to_xml(format(
          'select max(folio) as m from %I where tenant_id = %L', c.table_name, (select id from t)),
          false, true, '')))[1]::text as folio_mas_alto
  from information_schema.columns c
 where c.table_schema='public' and c.column_name = 'folio'
 order by 1;

\echo ''
\echo '=== 6 · Huerfanos de persona: filas de g500 que apuntan a un usuario ==='
select 'incidencias.reportado_por_usuario' as columna,
       count(*) filter (where reportado_por_usuario is not null) as con_usuario, count(*) as filas
  from incidencias where tenant_id = (select id from tenants where slug='g500')
union all
select 'ordenes_trabajo.asignado_a',
       count(*) filter (where asignado_a is not null), count(*)
  from ordenes_trabajo where tenant_id = (select id from tenants where slug='g500')
union all
select 'ordenes_trabajo.supervisor',
       count(*) filter (where supervisor is not null), count(*)
  from ordenes_trabajo where tenant_id = (select id from tenants where slug='g500')
union all
select 'evidencias_ot.uploaded_by',
       count(*) filter (where uploaded_by is not null), count(*)
  from evidencias_ot where tenant_id = (select id from tenants where slug='g500')
union all
select 'acciones.usuario_id',
       count(*) filter (where usuario_id is not null), count(*)
  from acciones where tenant_id = (select id from tenants where slug='g500');

\echo ''
\echo '=== 7 · Los usuarios de g500 que NO viajan (para saber a quien invitar) ==='
select rol, count(*) from usuarios
 where tenant_id = (select id from tenants where slug='g500')
 group by rol order by rol;

\echo ''
\echo '=== 8 · Peso de las fotos: base64 en la base, no en bucket ==='
select count(*) as evidencias,
       count(*) filter (where foto_key is not null) as con_foto_key,
       pg_size_pretty(coalesce(sum(length(foto_url)),0)) as peso_base64
  from evidencias_ot where tenant_id = (select id from tenants where slug='g500');

\echo ''
\echo '=== 9 · Estado del registro de migraciones del puente ==='
select count(*) as aplicadas from schema_migrations;
