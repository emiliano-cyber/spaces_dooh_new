-- ============================================================================
-- Contrato incompleto · paso 2 de 2 — esquema, integridad y carga inicial.
-- Ver docs/adr/0001-contrato-incompleto-al-generar-campana.md
-- REQUIERE haber aplicado antes 20260727_contrato_incompleto_enum.sql.
--
-- Problema que resuelve: hoy se puede vender y facturar una pantalla sin que
-- exista constancia de qué se le paga a su propietario. El P&L la reporta con
-- costo de renta cero y el margen sale inflado. Al aplicar esta migración: 10 de
-- 16 sitios no tienen contrato y 8 de ellos ya están comprometidos en reservas.
--
-- La integridad NO se pierde al quitar los NOT NULL: se traslada de la columna a
-- una regla por estatus (contrato_completo_ck). Un contrato solo puede salir de
-- INCOMPLETO cuando tiene arrendador, importe, periodicidad y fecha de fin.
-- Aditivo e idempotente.
-- ============================================================================
begin;

-- ── 1. Columnas que un contrato incompleto todavía no puede tener ────────────
alter table contratos_arrendamiento
  alter column arrendador_id drop not null,
  alter column fecha_fin     drop not null,
  alter column monto_renta   drop not null,
  alter column periodicidad  drop not null;

-- `fecha_inicio` se mantiene obligatoria: sí se conoce desde el principio (es
-- cuando arranca el compromiso con el cliente), así que no hay razón para
-- relajarla.

-- ── 2. La integridad, ahora por estatus ──────────────────────────────────────
alter table contratos_arrendamiento drop constraint if exists contrato_completo_ck;
alter table contratos_arrendamiento add constraint contrato_completo_ck check (
  estatus = 'INCOMPLETO' or (
    arrendador_id is not null and
    fecha_fin     is not null and
    monto_renta   is not null and
    periodicidad  is not null
  )
);

comment on constraint contrato_completo_ck on contratos_arrendamiento is
  'Solo un contrato INCOMPLETO puede tener arrendador/importe/periodicidad/fin en NULL. Al completarlo y cambiar de estatus, el CHECK exige los cuatro.';

-- ── 3. Un solo contrato incompleto por sitio ─────────────────────────────────
-- Hace la generación automática idempotente desde la BD: reintentos o carreras
-- no pueden dejar dos pendientes del mismo sitio.
create unique index if not exists contratos_sitio_incompleto_uq
  on contratos_arrendamiento (sitio_id)
  where estatus = 'INCOMPLETO';

comment on index contratos_sitio_incompleto_uq is
  'Un sitio no puede tener dos contratos incompletos abiertos a la vez.';

-- ── 4. Carga inicial retroactiva ─────────────────────────────────────────────
-- Todo sitio sin NINGÚN contrato recibe su pendiente. Se excluyen los sitios que
-- ya tienen contrato en cualquier estado (incluido el histórico vencido), porque
-- ahí el dato existe y el pendiente sería ruido.
-- fecha_inicio = la reserva más antigua del sitio si ya está vendido; si no,
-- hoy. moneda = la de la organización dueña del sitio.
insert into contratos_arrendamiento
  (id, sitio_id, arrendador_id, fecha_inicio, fecha_fin, monto_renta, periodicidad,
   moneda, auto_renovable, estatus, tenant_id)
select
  gen_random_uuid(),
  s.id,
  null,
  coalesce((select min(r.fecha_inicio) from reservas r where r.sitio_id = s.id), current_date),
  null, null, null,
  coalesce((select t.moneda from tenants t where t.id = s.tenant_id), 'MXN'),
  false,
  'INCOMPLETO',
  s.tenant_id
from sitios s
where not exists (
  select 1 from contratos_arrendamiento c where c.sitio_id = s.id
)
on conflict do nothing;

commit;

-- Verificación
select 'contratos_incompletos' k, count(*)::text v
  from contratos_arrendamiento where estatus = 'INCOMPLETO'
union all
select 'sitios_sin_contrato_restantes', count(*)::text
  from sitios s where not exists (
    select 1 from contratos_arrendamiento c where c.sitio_id = s.id)
union all
select 'check_creado', coalesce((select conname from pg_constraint
  where conrelid = 'contratos_arrendamiento'::regclass
    and conname = 'contrato_completo_ck'), '(FALTA)')
union all
select 'indice_creado', coalesce((select indexname from pg_indexes
  where tablename = 'contratos_arrendamiento'
    and indexname = 'contratos_sitio_incompleto_uq'), '(FALTA)');
