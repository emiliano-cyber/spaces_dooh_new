-- ============================================================================
-- Cobro de campañas en parcialidades.
-- Diseño en docs/diseno-cobro-en-parcialidades.md
--
-- Hasta ahora una campaña se cobraba una sola vez: una factura por el total y
-- una cobranza con plazo de 60/90/120 días. No había forma de pactar
-- mensualidades, que es lo normal en contratos anuales.
--
-- Modelo: UNA factura con N parcialidades. No una factura por cuota, porque:
--   · `facturas_campana_uq` (auditoría A-1) impide dos facturas por campaña, y
--     ese guardarraíl contra duplicar dinero no se toca.
--   · Es como funciona el CFDI: se factura una vez y se paga en parcialidades.
--   · `cobranzas.factura_id` nunca fue único, así que la tabla ya lo admitía.
--
-- Las tres columnas son NULLABLE a propósito: una cobranza sin `numero` sigue
-- significando "cobro único, importe = el de la factura", así que el histórico
-- existente sigue siendo válido sin reescribirlo.
-- Aditiva e idempotente.
-- ============================================================================
begin;

alter table cobranzas
  add column if not exists numero       int,      -- 1..N dentro de su factura
  add column if not exists total_cuotas int,
  add column if not exists monto        numeric;  -- importe DE ESTA parcialidad

comment on column cobranzas.numero is
  'Nº de parcialidad dentro de la factura (1..total_cuotas). NULL = cobro único (histórico).';
comment on column cobranzas.monto is
  'Importe de ESTA parcialidad. NULL = cobro único y el importe es el de la factura. La suma de las parcialidades debe cuadrar con facturas.monto (se garantiza en la transacción que las crea).';

-- Una factura no puede tener dos veces la misma cuota. Parcial porque las
-- cobranzas de cobro único llevan `numero` en NULL y no deben chocar entre sí.
create unique index if not exists cobranzas_factura_cuota_uq
  on cobranzas (factura_id, numero) where numero is not null;

-- Una parcialidad de importe cero o negativo no es cobrable.
alter table cobranzas drop constraint if exists cobranzas_monto_ck;
alter table cobranzas add constraint cobranzas_monto_ck
  check (monto is null or monto > 0);

-- Coherencia entre las tres: o es cobro único (las tres en NULL) o es
-- parcialidad completa (las tres con valor, y el nº dentro del rango).
alter table cobranzas drop constraint if exists cobranzas_parcialidad_ck;
alter table cobranzas add constraint cobranzas_parcialidad_ck check (
  (numero is null and total_cuotas is null and monto is null)
  or (numero is not null and total_cuotas is not null and monto is not null
      and numero >= 1 and numero <= total_cuotas and total_cuotas >= 1)
);

commit;

-- Verificación
select 'columnas_nuevas' k, count(*)::text v
  from information_schema.columns
 where table_name = 'cobranzas' and column_name in ('numero', 'total_cuotas', 'monto')
union all
select 'indice_cuota', coalesce((select indexname from pg_indexes
  where tablename = 'cobranzas' and indexname = 'cobranzas_factura_cuota_uq'), '(FALTA)')
union all
select 'cobranzas_historicas_intactas', count(*)::text from cobranzas where numero is null
union all
-- Debe ser 0: ninguna factura existente puede quedar descuadrada por esto.
select 'facturas_descuadradas', count(*)::text from (
  select c.factura_id
    from cobranzas c where c.numero is not null
   group by c.factura_id, c.factura_id
  having sum(c.monto) <> (select f.monto from facturas f where f.id = c.factura_id)
) x;
