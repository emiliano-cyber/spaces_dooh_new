-- ============================================================================
--  Calendario de renta: realinear las cuotas que desbordó el mes corto.
--
--  `avanzarPeriodo` (JS) avanzaba el vencimiento con `Date.setMonth`, que
--  DESBORDA en los meses cortos: del 29 de enero + 1 mes sale el 1 de marzo, no
--  el 28 de febrero. Consecuencias sobre el calendario ya generado:
--
--    · febrero se queda SIN cuota — un periodo entero desaparece;
--    · a partir de ahí todos los vencimientos caen el día 1 en vez del 29.
--
--  Afecta solo a las cadencias en MESES con ancla en día 29, 30 o 31 (y a ANUAL
--  con ancla 29 de febrero). Las cadencias en días son exactas.
--
--  Ver el ADR 0007. El código ya no genera así: `periodoDeIndice` ancla cada
--  vencimiento al inicio del contrato en vez de acumular. Esta migración arregla
--  lo YA generado; sin ella, los contratos vivos conservan el calendario torcido
--  porque nada lo regenera salvo que alguien edite el contrato.
--
--  PROPIEDADES
--
--  · Idempotente. Repara comparando el calendario guardado con el correcto; tras
--    la primera pasada no hay diferencia y no hace nada.
--  · No toca NUNCA una cuota PAGADO. Es un hecho consumado, con su fecha de pago
--    y sus adjuntos.
--  · Se salta —y REPORTA— los contratos que no puede reparar sin destruir algo:
--    los que tienen una cuota PAGADO en una fecha que no existe en el calendario
--    correcto, y los que tienen una cuota impaga con factura, comprobante u
--    observaciones fuera de sitio. Es preferible dejar cinco contratos para
--    revisión manual a borrar en silencio el comprobante que alguien subió.
--  · No modifica el esquema. Revertirla es restaurar el backup de pagos_renta;
--    ver «Cómo revertir» en el ADR.
-- ============================================================================

begin;

-- ─── 1. El calendario CORRECTO de cada contrato ─────────────────────────────
-- La suma va ANCLADA al inicio (`inicio + k meses`), nunca acumulada sobre el
-- vencimiento anterior. La diferencia es exactamente el bug:
--
--   acumulado:  29-ene → 28-feb → 28-mar → 28-abr…   (el día 28 se queda pegado)
--   anclado:    29-ene → 28-feb → 29-mar → 29-abr…   (febrero se ajusta, y basta)
--
-- Es también la razón por la que NO sirve `generate_series(inicio, fin,
-- interval '1 month')`: generate_series acumula, así que arrastra el recorte del
-- mes corto para siempre. Se genera el índice y se suma sobre el ancla.
create temporary table _cal_correcto on commit drop as
with contrato as (
  select c.id, c.tenant_id, c.fecha_inicio, c.fecha_fin, c.monto_renta,
         case c.periodicidad
           when 'MENSUAL' then 1 when 'BIMESTRAL' then 2 when 'TRIMESTRAL' then 3
           when 'SEMESTRAL' then 6 when 'ANUAL' then 12
         end as meses
    from contratos_arrendamiento c
   where c.fecha_fin is not null
     and c.monto_renta is not null
     and c.periodicidad in ('MENSUAL','BIMESTRAL','TRIMESTRAL','SEMESTRAL','ANUAL')
)
select c.id as contrato_id, c.tenant_id, c.monto_renta,
       to_char((c.fecha_inicio + (k * c.meses || ' months')::interval)::date, 'YYYY-MM-DD') as periodo
  from contrato c
  -- Cota del índice: meses completos entre inicio y fin, dividido por la
  -- cadencia. El `+ 1` cubre el redondeo y el WHERE recorta lo que sobre.
  cross join lateral generate_series(
    0,
    ((extract(year from age(c.fecha_fin, c.fecha_inicio))::int * 12
      + extract(month from age(c.fecha_fin, c.fecha_inicio))::int) / c.meses) + 1
  ) as k
 where (c.fecha_inicio + (k * c.meses || ' months')::interval)::date <= c.fecha_fin;

create index on _cal_correcto (contrato_id, periodo);

-- ─── 2. Contratos cuyo calendario guardado NO es el correcto ────────────────
-- Se compara el CONJUNTO de vencimientos, en los dos sentidos: sobra alguno o
-- falta alguno. No se filtra por «ancla >= 29» —eso es la causa, no el síntoma—
-- para que la migración también alcance cualquier calendario torcido por otra
-- vía y no dependa de que el diagnóstico sea completo.
-- Las dos mitades van en subconsultas con nombre y no encadenadas: `except` y
-- `union` tienen la misma precedencia y asocian por la izquierda, así que
-- escribirlas seguidas compararía otra cosa.
create temporary table _desalineado on commit drop as
select contrato_id from (
  -- Vencimientos que el contrato debería tener y no están.
  select contrato_id, periodo from _cal_correcto
  except
  select contrato_id, periodo from pagos_renta
) faltan
union
select contrato_id from (
  -- Vencimientos guardados que el calendario correcto no contempla.
  select p.contrato_id, p.periodo from pagos_renta p
   where p.contrato_id in (select contrato_id from _cal_correcto)
  except
  select contrato_id, periodo from _cal_correcto
) sobran;

-- ─── 3. Los que NO se pueden reparar sin destruir información ───────────────
create temporary table _bloqueado on commit drop as
select p.contrato_id,
       count(*) filter (where p.estatus = 'PAGADO') as pagadas_fuera_de_sitio,
       count(*) filter (where p.estatus <> 'PAGADO') as impagas_con_papeles
  from pagos_renta p
 where p.contrato_id in (select contrato_id from _desalineado)
   -- Cuotas que el calendario correcto NO contempla: las que habría que quitar.
   and not exists (
     select 1 from _cal_correcto x
      where x.contrato_id = p.contrato_id and x.periodo = p.periodo
   )
   and (
     -- Un pago real en una fecha que ya no existe: reordenar alrededor de él
     -- daría un calendario incoherente. Lo mira una persona.
     p.estatus = 'PAGADO'
     -- Papeles colgados de una cuota impaga: borrarla los tiraría.
     or p.factura_url is not null
     or p.comprobante_url is not null
     or p.observaciones is not null
   )
 group by p.contrato_id;

-- ─── 4. Reparación ──────────────────────────────────────────────────────────
-- Quitar las cuotas impagas y sin papeles que el calendario correcto no
-- contempla. Nada referencia a `pagos_renta` (no hay FKs hacia ella), así que
-- borrar una cuota no arrastra nada más.
delete from pagos_renta p
 where p.contrato_id in (select contrato_id from _desalineado)
   and p.contrato_id not in (select contrato_id from _bloqueado)
   and p.estatus <> 'PAGADO'
   and p.factura_url is null
   and p.comprobante_url is null
   and p.observaciones is null
   and not exists (
     select 1 from _cal_correcto x
      where x.contrato_id = p.contrato_id and x.periodo = p.periodo
   );

-- Y crear las que faltan. El importe sale del CONTRATO, que es la fuente: la
-- cuota es una proyección suya. El estatus se deriva de la fecha igual que en
-- `generarCalendarioEnTx` — VENCIDO si el vencimiento ya pasó, PENDIENTE si no—
-- y nunca PAGADO: esta migración no inventa pagos.
insert into pagos_renta (contrato_id, tenant_id, periodo, monto, estatus)
select x.contrato_id, x.tenant_id, x.periodo, x.monto_renta,
       (case when x.periodo::date < current_date then 'VENCIDO' else 'PENDIENTE' end)::est_pago_renta
  from _cal_correcto x
 where x.contrato_id in (select contrato_id from _desalineado)
   and x.contrato_id not in (select contrato_id from _bloqueado)
   and not exists (
     select 1 from pagos_renta p
      where p.contrato_id = x.contrato_id and p.periodo = x.periodo
   )
on conflict (contrato_id, periodo) do nothing;

-- ─── 5. Reporte ─────────────────────────────────────────────────────────────
do $$
declare
  n_desalineados int;
  n_bloqueados   int;
  fila           record;
begin
  select count(*) into n_desalineados from _desalineado;
  select count(*) into n_bloqueados   from _bloqueado;

  raise notice 'Calendarios desalineados encontrados: %', n_desalineados;
  raise notice 'Reparados: %', n_desalineados - n_bloqueados;
  raise notice 'Sin tocar (requieren revision manual): %', n_bloqueados;

  for fila in
    select b.contrato_id, b.pagadas_fuera_de_sitio, b.impagas_con_papeles,
           c.fecha_inicio, c.fecha_fin, c.periodicidad
      from _bloqueado b join contratos_arrendamiento c on c.id = b.contrato_id
  loop
    raise notice
      '  contrato % (% % .. %): % cuota(s) PAGADA(s) fuera del calendario correcto, % impaga(s) con papeles',
      fila.contrato_id, fila.periodicidad, fila.fecha_inicio, fila.fecha_fin,
      fila.pagadas_fuera_de_sitio, fila.impagas_con_papeles;
  end loop;
end $$;

commit;
