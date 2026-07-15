-- ============================================================================
-- Arrendadores Fase 1 · M3 — Enum canónico de periodicidad de pago.
-- Reconcilia la lista de la propuesta con la granularidad de derive.ts.
-- Normaliza los datos existentes (había 'mensual' en minúscula por el seed) y
-- convierte contratos_arrendamiento.periodicidad de text -> enum.
-- Equivalente mensual: SEMANAL ×30/7 · CATORCENAL ×30/14 · QUINCENAL ×2 ·
--   MENSUAL ×1 · BIMESTRAL ÷2 · TRIMESTRAL ÷3 · SEMESTRAL ÷6 · ANUAL ÷12.
-- Idempotente.
-- ============================================================================
begin;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'periodicidad_pago') then
    create type periodicidad_pago as enum
      ('SEMANAL','CATORCENAL','QUINCENAL','MENSUAL','BIMESTRAL','TRIMESTRAL','SEMESTRAL','ANUAL');
    comment on type periodicidad_pago is
      'Periodicidad de pago de renta. Equiv. mensual: SEMANAL x30/7, CATORCENAL x30/14, QUINCENAL x2, MENSUAL x1, BIMESTRAL /2, TRIMESTRAL /3, SEMESTRAL /6, ANUAL /12.';
  end if;
end $$;

-- Convertir la columna solo si aún es text (idempotente).
do $$
declare
  tipo text;
begin
  select data_type into tipo from information_schema.columns
   where table_name='contratos_arrendamiento' and column_name='periodicidad';
  if tipo <> 'USER-DEFINED' then
    -- Normalizar datos existentes a etiqueta canónica en mayúsculas.
    update contratos_arrendamiento set periodicidad = upper(trim(periodicidad))
     where periodicidad is not null;
    -- Cualquier valor fuera del enum se detecta aquí (falla ruidosa = dato malo).
    alter table contratos_arrendamiento alter column periodicidad drop default;
    alter table contratos_arrendamiento
      alter column periodicidad type periodicidad_pago using periodicidad::periodicidad_pago;
    alter table contratos_arrendamiento alter column periodicidad set default 'MENSUAL';
  end if;
end $$;

commit;

-- Verificación
select 'tipo_columna' k, data_type v from information_schema.columns
  where table_name='contratos_arrendamiento' and column_name='periodicidad'
union all
select 'enum_labels', string_agg(enumlabel, ',' order by enumsortorder)
  from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='periodicidad_pago'
union all
select 'valores_en_uso', string_agg(distinct periodicidad::text, ',') from contratos_arrendamiento;
