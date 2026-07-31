-- ============================================================================
-- Calendario de pagos para los contratos que nunca lo tuvieron.
--
-- El calendario se genera al crear o editar un contrato, pero los contratos
-- anteriores a esa lógica se quedaron sin cuotas: en producción había 2
-- contratos vigentes de 10 000/mes y CERO filas en pagos_renta. Efecto visible:
-- la pantalla de pagos de renta salía vacía y no había forma de saber qué toca
-- pagar ni cuándo, aunque el contrato existiera.
--
-- Genera las cuotas dentro de la vigencia de cada contrato activo que no tenga
-- ninguna. Los periodos ya vencidos quedan VENCIDO y el resto PENDIENTE — igual
-- que la lógica de la app (generarCalendarioEnTx). NUNCA marca PAGADO: eso solo
-- ocurre cuando alguien registra el pago.
--
-- Solo toca contratos SIN cuotas: no reescribe historiales existentes.
-- Aditiva e idempotente (ON CONFLICT sobre contrato_id+periodo).
-- ============================================================================
begin;

insert into pagos_renta (contrato_id, tenant_id, periodo, monto, estatus)
select c.id,
       c.tenant_id,
       d::date,
       c.monto_renta,
       (case when d::date < current_date then 'VENCIDO' else 'PENDIENTE' end)::est_pago_renta
  from contratos_arrendamiento c
  cross join lateral generate_series(
    c.fecha_inicio::timestamp,
    c.fecha_fin::timestamp,
    (case c.periodicidad::text
       when 'SEMANAL'    then '7 days'
       when 'CATORCENAL' then '14 days'
       when 'QUINCENAL'  then '15 days'
       when 'MENSUAL'    then '1 month'
       when 'BIMESTRAL'  then '2 months'
       when 'TRIMESTRAL' then '3 months'
       when 'SEMESTRAL'  then '6 months'
       when 'ANUAL'      then '1 year'
     end)::interval
  ) d
 where c.estatus in ('VIGENTE', 'POR_VENCER', 'RENOVADO')
   and c.monto_renta  is not null
   and c.periodicidad is not null
   and c.fecha_fin    is not null
   and c.fecha_fin >= c.fecha_inicio
   -- Solo los que no tienen NINGUNA cuota: si ya hay historial, no se toca.
   and not exists (select 1 from pagos_renta p where p.contrato_id = c.id)
on conflict (contrato_id, periodo) do nothing;

commit;

-- Verificación
select 'contratos_activos' k, count(*)::text v
  from contratos_arrendamiento
 where estatus in ('VIGENTE', 'POR_VENCER', 'RENOVADO') and monto_renta is not null
union all
select 'contratos_activos_sin_cuotas', count(*)::text
  from contratos_arrendamiento c
 where c.estatus in ('VIGENTE', 'POR_VENCER', 'RENOVADO') and c.monto_renta is not null
   and c.fecha_fin is not null
   and not exists (select 1 from pagos_renta p where p.contrato_id = c.id)
union all
select 'cuotas_totales', count(*)::text from pagos_renta
union all
select 'cuotas_marcadas_pagadas', count(*)::text from pagos_renta where estatus = 'PAGADO';
