-- ============================================================================
-- A-1 (endurecimiento): garantizar la unicidad de dinero con DETECCIÓN previa.
--
-- La migración 20260724_unicidad_carreras.sql ya creó los índices únicos, pero
-- confiaba en que no hubiera duplicados: si los hubiera, la creación fallaba con
-- un unique_violation crudo, sin decir CUÁLES. Este cierre añade lo que pedía la
-- auditoría A-1:
--   1) DETECTA duplicados existentes con un SELECT agrupado y ABORTA con la lista
--      de llaves ofensoras (NO borra datos: la deduplicación es decisión humana).
--   2) Deja el índice de campanas.propuesta_id como PARCIAL explícito
--      (WHERE propuesta_id IS NOT NULL): propuesta_id es nullable (campañas que no
--      nacen de propuesta) y los NULL no deben competir. Es equivalente al índice
--      plano en semántica de Postgres, pero deja la intención por escrito.
--
-- Append-only e idempotente. No edita migraciones previas.
-- ============================================================================
begin;

-- 1) DETECCIÓN + ABORTO (sin borrar nada). Si hay duplicados reales, la
--    migración se detiene con la lista de llaves para deduplicar a mano.
do $$
declare dup text;
begin
  select string_agg(campana_id::text || ' (×' || c || ')', ', ')
    into dup
    from (
      select campana_id, count(*) c
        from facturas
       group by campana_id
      having count(*) > 1
    ) x;
  if dup is not null then
    raise exception 'A-1 ABORTA: hay facturas duplicadas por campana_id -> %. Deduplica antes de correr esta migración.', dup;
  end if;

  select string_agg(propuesta_id::text || ' (×' || c || ')', ', ')
    into dup
    from (
      select propuesta_id, count(*) c
        from campanas
       where propuesta_id is not null
       group by propuesta_id
      having count(*) > 1
    ) x;
  if dup is not null then
    raise exception 'A-1 ABORTA: hay campañas duplicadas por propuesta_id -> %. Deduplica antes de correr esta migración.', dup;
  end if;
end $$;

-- 2) Una factura por campaña (facturas.campana_id es NOT NULL).
create unique index if not exists facturas_campana_uq on facturas (campana_id);

-- 3) Una campaña por propuesta, PARCIAL: solo cuando propuesta_id no es NULL.
--    Reemplaza el índice plano por el parcial explícito (misma semántica).
drop index if exists campanas_propuesta_uq;
create unique index campanas_propuesta_uq
    on campanas (propuesta_id)
 where propuesta_id is not null;

commit;
