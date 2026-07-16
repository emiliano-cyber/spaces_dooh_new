-- ============================================================================
-- Arrendadores Fase 1 · M4 — Backfill de datos (transaccional, idempotente).
-- Introduce `predios` sobre los datos existentes:
--   1) Un predio por cada sitio que participa en arrendamiento (tiene contrato o
--      renta directa) y aún no tiene predio. Se liga el sitio al predio.
--   2) Repunta contratos_arrendamiento.predio_id desde el predio del sitio.
--   3) Convierte la renta directa del sitio (renta_arrendador/periodicidad_renta)
--      en un contrato del predio, SOLO si ese predio aún no tiene contrato.
-- No se toca sitio_id (se conserva por compatibilidad; la nueva fuente es predio).
-- No se borran los campos directos del sitio (deprecación sin DROP en esta fase).
-- Respaldo previo: migration-backup/spaces_dev_pre_m4_20260715.sql
-- Idempotente: re-ejecutar no duplica (guardas por predio_id / existencia de contrato).
-- ============================================================================
begin;

do $$
declare
  r        record;
  v_predio uuid;
  v_per    periodicidad_pago;
  v_moneda text;
begin
  -- ── Paso 1: crear predio por sitio con arrendamiento (sin predio aún) ───────
  for r in
    select s.id as sitio_id, s.tenant_id,
           coalesce(s.arrendador_id, c.arrendador_id) as arrendador_id,
           coalesce(nullif(trim(s.direccion_predio),''), nullif(trim(s.nombre),''),
                    s.clave_interna, 'Predio '||left(s.id::text,8)) as nombre,
           coalesce(s.direccion_predio, s.direccion, s.direccion_comercial) as direccion,
           s.lat, s.lng,
           coalesce(s.tipo_estructura, s.tipo_medio::text) as tipo_ubicacion,
           (c.id is not null) as tiene_contrato
      from sitios s
      left join lateral (
        select id, arrendador_id from contratos_arrendamiento c2
         where c2.sitio_id = s.id order by creado_en desc limit 1
      ) c on true
     where s.predio_id is null
       and (c.id is not null or s.renta_arrendador is not null)
       and coalesce(s.arrendador_id, c.arrendador_id) is not null
  loop
    insert into predios (tenant_id, arrendador_id, nombre, direccion, lat, lng, tipo_ubicacion, estado)
    values (r.tenant_id, r.arrendador_id, r.nombre, r.direccion, r.lat, r.lng, r.tipo_ubicacion,
            case when r.tiene_contrato then 'OCUPADO' else 'DISPONIBLE' end::estado_predio)
    returning id into v_predio;

    update sitios set predio_id = v_predio where id = r.sitio_id;
  end loop;

  -- ── Paso 2: repuntar contratos al predio de su sitio (robusto/idempotente) ──
  update contratos_arrendamiento c
     set predio_id = s.predio_id
    from sitios s
   where c.sitio_id = s.id
     and c.predio_id is null
     and s.predio_id is not null;

  -- ── Paso 3: renta directa del sitio → contrato del predio (si no hay ya) ────
  for r in
    select s.id as sitio_id, s.predio_id, s.tenant_id, s.arrendador_id,
           s.renta_arrendador, s.periodicidad_renta
      from sitios s
     where s.renta_arrendador is not null
       and s.predio_id is not null
       and s.arrendador_id is not null
       and not exists (select 1 from contratos_arrendamiento c where c.predio_id = s.predio_id)
  loop
    v_per := case upper(coalesce(nullif(trim(r.periodicidad_renta),''),'MENSUAL'))
               when 'SEMANAL'    then 'SEMANAL'
               when 'CATORCENAL' then 'CATORCENAL'
               when 'QUINCENAL'  then 'QUINCENAL'
               when 'MENSUAL'    then 'MENSUAL'
               when 'BIMESTRAL'  then 'BIMESTRAL'
               when 'TRIMESTRAL' then 'TRIMESTRAL'
               when 'SEMESTRAL'  then 'SEMESTRAL'
               when 'ANUAL'      then 'ANUAL'
               else 'MENSUAL'
             end::periodicidad_pago;

    select coalesce(moneda,'MXN') into v_moneda from tenants where id = r.tenant_id;

    insert into contratos_arrendamiento
      (sitio_id, predio_id, arrendador_id, tenant_id, fecha_inicio, fecha_fin,
       monto_renta, periodicidad, moneda, estatus, motivo_cancelacion)
    values
      (r.sitio_id, r.predio_id, r.arrendador_id, r.tenant_id,
       current_date, (current_date + interval '1 year')::date,
       r.renta_arrendador, v_per, v_moneda, 'VIGENTE'::est_contrato,
       'Migrado de renta directa del sitio (M4).');
  end loop;
end $$;

commit;

-- Verificación
select 'predios_creados'      k, count(*)::text v from predios
union all
select 'sitios_con_predio',      count(*)::text from sitios where predio_id is not null
union all
select 'contratos_sin_predio',   count(*)::text from contratos_arrendamiento where predio_id is null
union all
select 'contratos_total',        count(*)::text from contratos_arrendamiento
union all
select 'renta_directa_sin_contrato', count(*)::text from sitios s
  where s.renta_arrendador is not null and s.predio_id is not null
    and not exists (select 1 from contratos_arrendamiento c where c.predio_id = s.predio_id);
