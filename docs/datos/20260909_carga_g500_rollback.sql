-- ===========================================================================
--  VUELTA ATRAS de la carga de g500 · 2026-09-09
--  Pareja de: 20260909_carga_g500_*.sql  (ver 20260909_carga_g500.md)
--
--  ── QUE DESHACE, EXACTAMENTE ──────────────────────────────────────────────
--  Las 541 filas de negocio que metio la carga. Borrar por tenant es seguro
--  AQUI y solo aqui, porque la propia carga se negaba a correr si la instancia
--  ya tenia una sola pantalla de g500 (guard 2): todo lo que hay de esta
--  organizacion entro con ella.
--
--  ── QUE **NO** DESHACE, Y HAY QUE SABERLO ANTES DE CORRERLO ───────────────
--  1. `config_negocio`. La carga hizo un UPDATE sobre la fila que la instancia
--     ya tenia; sus valores anteriores no estan aqui porque no se inventan. La
--     tarjeta de E4 los captura ANTES de cargar: se restauran de esa captura.
--  2. `folios_consecutivos`. La carga hizo `greatest(...)`, y eso no se puede
--     des-mezclar. Misma respuesta: la captura previa de la tarjeta.
--
--  Para esos dos, y para cualquier caso raro, la vuelta atras COMPLETA es el
--  respaldo `pg_dump` que la tarjeta manda hacer antes de nada.
--
--  ── ORDEN ─────────────────────────────────────────────────────────────────
--  Es el inverso exacto de la carga. Un borrado en el orden equivocado choca
--  contra las claves ajenas.
--
--  Transaccional: o se deshace entero, o no se deshace.
-- ===========================================================================
\set ON_ERROR_STOP on

begin;

do $$
declare destino uuid; n int;
begin
  select id into destino from tenants where slug = 'g500';
  if destino is null then
    raise exception 'No hay organizacion con slug g500 en esta instancia.';
  end if;
  select count(*) into n from sitios where tenant_id = destino;
  raise notice 'Se van a borrar los datos de g500. Pantallas ahora: %.', n;
end $$;

-- 'acciones' no se borra: no se cargo (es append-only, ver la cabecera de la carga).
delete from notificaciones          where tenant_id = (select id from tenants where slug='g500');
delete from cobranzas               where tenant_id = (select id from tenants where slug='g500');
delete from facturas                where tenant_id = (select id from tenants where slug='g500');
delete from evidencias_ot           where tenant_id = (select id from tenants where slug='g500');
delete from ordenes_trabajo         where tenant_id = (select id from tenants where slug='g500');
delete from ordenes_compra          where tenant_id = (select id from tenants where slug='g500');
delete from creatividades           where tenant_id = (select id from tenants where slug='g500');
delete from reservas                where tenant_id = (select id from tenants where slug='g500');
delete from campanas                where tenant_id = (select id from tenants where slug='g500');
delete from propuesta_items         where tenant_id = (select id from tenants where slug='g500');
delete from propuestas              where tenant_id = (select id from tenants where slug='g500');
delete from pagos_renta             where tenant_id = (select id from tenants where slug='g500');
delete from contratos_arrendamiento where tenant_id = (select id from tenants where slug='g500');
delete from arrendador_razon_social where tenant_id = (select id from tenants where slug='g500');
delete from sitio_modalidades       where tenant_id = (select id from tenants where slug='g500');
delete from sitios                  where tenant_id = (select id from tenants where slug='g500');
delete from predios                 where tenant_id = (select id from tenants where slug='g500');
delete from arrendadores            where tenant_id = (select id from tenants where slug='g500');
delete from clientes                where tenant_id = (select id from tenants where slug='g500');

-- Comprobacion: no puede quedar ni una fila de negocio de esta organizacion.
do $$
declare destino uuid; t text; n int; total int := 0;
begin
  select id into destino from tenants where slug = 'g500';
  foreach t in array array['clientes','arrendadores','predios','sitios','sitio_modalidades',
                           'arrendador_razon_social','contratos_arrendamiento','pagos_renta',
                           'propuestas','propuesta_items','campanas','reservas','creatividades',
                           'ordenes_compra','ordenes_trabajo','evidencias_ot','facturas',
                           'cobranzas','notificaciones']
  -- Sin `acciones`: la bitacora de esta instancia es suya y no se cuenta aqui.
  loop
    execute format('select count(*) from public.%I where tenant_id = $1', t) into n using destino;
    total := total + n;
  end loop;
  if total <> 0 then
    raise exception 'Quedan % filas de g500 despues del borrado', total;
  end if;
  raise notice 'VUELTA ATRAS OK · 0 filas de negocio de g500. Recuerda config_negocio y folios_consecutivos: van de la captura previa.';
end $$;

commit;
