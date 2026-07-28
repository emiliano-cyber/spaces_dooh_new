-- ============================================================================
-- Renta del propietario capturada YA en la propuesta.
-- Continúa docs/adr/0001-contrato-incompleto-al-generar-campana.md
--
-- El ADR 0001 hizo que vender una pantalla sin contrato abriera un pendiente
-- (estatus INCOMPLETO). Eso hace visible el hueco, pero el costo sigue sin
-- conocerse hasta que alguien lo captura a mano, así que el margen de la campaña
-- sale inflado en el intervalo.
--
-- Con estos tres datos en el ítem de la propuesta —a quién se le paga, cuánto y
-- cada cuánto—, el contrato que nace con la campaña puede nacer COMPLETO: el
-- costo se conoce desde la venta y el calendario de pagos se genera solo.
-- Cuando no se capturan, el comportamiento es el de hoy (contrato INCOMPLETO).
--
-- La fecha de fin del contrato no se pide: sale del periodo vendido.
-- Aditiva e idempotente. Todo nullable: las propuestas existentes no cambian.
-- ============================================================================
begin;

alter table propuesta_items
  add column if not exists renta_monto        numeric,
  add column if not exists renta_periodicidad periodicidad_pago,
  add column if not exists renta_arrendador_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'propuesta_items'::regclass and conname = 'propuesta_items_renta_arrendador_fk'
  ) then
    alter table propuesta_items
      add constraint propuesta_items_renta_arrendador_fk
      foreign key (renta_arrendador_id) references arrendadores(id) on delete set null;
  end if;
end $$;

-- Un importe sin periodicidad no sirve para calcular el costo mensual, y una
-- periodicidad sin importe no sirve para nada: o van los dos, o ninguno.
alter table propuesta_items drop constraint if exists propuesta_items_renta_ck;
alter table propuesta_items add constraint propuesta_items_renta_ck check (
  (renta_monto is null and renta_periodicidad is null)
  or (renta_monto is not null and renta_periodicidad is not null and renta_monto >= 0)
);

comment on column propuesta_items.renta_monto is
  'Renta que se le paga al propietario por esta pantalla. Al generar la campaña pasa al contrato de arrendamiento (ADR 0001). NULL = se capturará después y el contrato nace INCOMPLETO.';
comment on column propuesta_items.renta_periodicidad is
  'Cada cuándo se paga esa renta (MENSUAL, ANUAL, …). Va siempre junto al importe.';
comment on column propuesta_items.renta_arrendador_id is
  'Propietario al que se le paga. Sin él el contrato no puede salir de INCOMPLETO (contrato_completo_ck).';

commit;

-- Verificación
select 'columnas' k, count(*)::text v
  from information_schema.columns
 where table_name = 'propuesta_items'
   and column_name in ('renta_monto', 'renta_periodicidad', 'renta_arrendador_id')
union all
select 'check_creado', coalesce((select conname from pg_constraint
  where conrelid = 'propuesta_items'::regclass and conname = 'propuesta_items_renta_ck'), '(FALTA)')
union all
select 'items_existentes_intactos', count(*)::text from propuesta_items where renta_monto is null;
