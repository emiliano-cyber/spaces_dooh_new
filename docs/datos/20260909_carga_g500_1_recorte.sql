-- ===========================================================================
--  E3 · Recorte de g500 en el esquema `expo` de la base puente.
--  Se ejecuta EN LA BASE PUENTE. No produce nada que se cargue directamente:
--  de aqui sale, por pg_dump, el .sql que viaja.
-- ===========================================================================
\set ON_ERROR_STOP on
drop schema if exists expo cascade;
create schema expo;

-- El tenant de origen, una sola vez.
create table expo._origen as select id from tenants where slug = 'g500';

-- ─── Tablas que se recortan por tenant_id ──────────────────────────────────
create table expo.clientes                as select * from clientes                where tenant_id = (select id from expo._origen);
create table expo.arrendadores            as select * from arrendadores            where tenant_id = (select id from expo._origen);
create table expo.predios                 as select * from predios                 where tenant_id = (select id from expo._origen);
create table expo.sitios                  as select * from sitios                  where tenant_id = (select id from expo._origen);
create table expo.arrendador_razon_social as select * from arrendador_razon_social where tenant_id = (select id from expo._origen);
create table expo.contratos_arrendamiento as select * from contratos_arrendamiento where tenant_id = (select id from expo._origen);
create table expo.pagos_renta             as select * from pagos_renta             where tenant_id = (select id from expo._origen);
create table expo.propuestas              as select * from propuestas              where tenant_id = (select id from expo._origen);
create table expo.propuesta_items         as select * from propuesta_items         where tenant_id = (select id from expo._origen);
create table expo.campanas                as select * from campanas                where tenant_id = (select id from expo._origen);
create table expo.reservas                as select * from reservas                where tenant_id = (select id from expo._origen);
create table expo.creatividades           as select * from creatividades           where tenant_id = (select id from expo._origen);
create table expo.ordenes_compra          as select * from ordenes_compra          where tenant_id = (select id from expo._origen);
create table expo.ordenes_trabajo         as select * from ordenes_trabajo         where tenant_id = (select id from expo._origen);
create table expo.evidencias_ot           as select * from evidencias_ot           where tenant_id = (select id from expo._origen);
create table expo.facturas                as select * from facturas                where tenant_id = (select id from expo._origen);
create table expo.cobranzas               as select * from cobranzas               where tenant_id = (select id from expo._origen);
create table expo.notificaciones          as select * from notificaciones          where tenant_id = (select id from expo._origen);

-- ─── `acciones` NO viaja · decidido por Emiliano el 2026-09-09 ─────────────
-- La bitacora tiene un trigger BEFORE DELETE OR UPDATE que la hace append-only
-- (`trg_acciones_append_only`). Cargarla dejaria la operacion sin marcha atras
-- en el sitio: no se podria borrar para repetir, y la unica salida ante un
-- fallo posterior seria restaurar el respaldo entero.
--
-- Se deja fuera con el contenido delante: de sus 175 filas, la inmensa mayoria
-- son entradas de `Sistema` y del usuario `DEMO` -- incluida una que dice
-- "Limpieza de residuos de demo (INC-05)". Es el rastro de la etapa de pruebas,
-- no historia de negocio. Y sus autores tampoco viajan.

-- ─── EL RESCATE · sitio_modalidades va por su MADRE, no por su etiqueta ────
-- Las 12 modalidades de las pantallas de g500 estan etiquetadas `rgb` por la
-- deriva del DEFAULT que retiro 20260812_sin_default_tenant.sql. Filtrarlas por
-- tenant_id devolveria CERO filas y las pantallas llegarian sin un solo precio,
-- sin dar ningun error. El criterio es la clave ajena, que es un hecho.
create table expo.sitio_modalidades as
  select * from sitio_modalidades
   where sitio_id in (select id from expo.sitios);

-- ─── Las personas no viajan: se anulan las columnas que las nombran ────────
update expo.evidencias_ot  set uploaded_by = null where uploaded_by is not null;
update expo.ordenes_trabajo set asignado_a = null, supervisor = null;

-- ─── Los contadores de folio y la configuracion, aparte ───────────────────
create table expo.folios_consecutivos as select * from folios_consecutivos;
create table expo.config_negocio      as select * from config_negocio where tenant_id = (select id from expo._origen);

-- ─── El IVA vuelve al 16 % · decidido por Emiliano el 2026-09-09 ───────────
-- La configuracion de g500 en el droplet viejo trae `iva_tasas = {15}`, y la
-- instancia nueva nace con {16}. El 15 era un valor de la etapa de pruebas de
-- julio: 16 es el IVA general vigente. Se fija aqui, y no se deja "que gane el
-- destino", para que el resultado sea el mismo tenga la instancia su fila de
-- configuracion creada o no. Toca el calculo de cualquier factura nueva, asi
-- que se decidio antes de generar el archivo y no despues de cargarlo.
update expo.config_negocio set iva_tasas = '{16}';

-- ─── Guards: si algo de esto falla, el recorte esta mal y no debe salir ────
do $$
declare n int; total int := 0; t text;
begin
  -- 1) las 12 modalidades tienen que estar
  select count(*) into n from expo.sitio_modalidades;
  if n <> 12 then raise exception 'RESCATE MAL: se esperaban 12 modalidades y hay %', n; end if;

  -- 2) ninguna fila puede quedar apuntando a un usuario
  select count(*) into n from expo.evidencias_ot where uploaded_by is not null;
  if n > 0 then raise exception 'quedan % evidencias con uploaded_by', n; end if;

  -- 3) ningun contrato puede depender de una razon social que no viaja
  select count(*) into n from expo.contratos_arrendamiento where razon_social_id is not null;
  if n > 0 then raise exception '% contratos apuntan a arrendador_razon_social y esa tabla viaja vacia', n; end if;

  -- 4) el total tiene que ser el del censo
  for t in select table_name from information_schema.tables
            where table_schema='expo' and table_name not in ('_origen','folios_consecutivos','config_negocio')
  loop
    execute format('select count(*) from expo.%I', t) into n;
    total := total + n;
  end loop;
  raise notice 'Filas recortadas (sin folios ni config): %', total;
  -- 541 filas de datos + 1 de config_negocio. El censo conto 717 porque incluia
  -- las 175 de la bitacora, que ya no viaja. Los 8 contadores de folio no se
  -- cuentan como filas de g500: son de la instancia entera.
  if total <> 541 then raise exception 'TOTAL INESPERADO: % (se esperaban 541)', total; end if;
end $$;

select 'recorte listo' as estado,
       (select count(*) from expo.sitio_modalidades) as modalidades_rescatadas,
       (select count(*) from expo.folios_consecutivos) as contadores,
       (select count(*) from expo.config_negocio) as config;
