-- @tipo: esquema
-- ============================================================================
--  VALLAS-ESQUINA · LA PARED DOBLA DESPUÉS DE UNA VALLA (20/11). Zona ROJA R3.
--  APROBADA POR EL DUEÑO SOLO PARA LOCAL el 20/11; cualquier otra base la
--  aplica una persona.
-- ----------------------------------------------------------------------------
--  Pedido del dueño: «recuerda que hay vallas que están en esquinas y doblan a
--  la derecha o izquierda, para que se muestre». El plano
--  (`lib/vallas/plano.ts`) dibujaba cada cara como una fila recta.
--
--  Una columna en `vallas`: `dobla` = después de ESTA valla la pared da
--  vuelta, hacia 'izquierda' o 'derecha'. NULL = sigue recta (lo de antes).
--  Va en la valla y no en el sitio porque el quiebre cae ENTRE dos cuadros
--  concretos de una cara, y el orden de la cara ya lo da la valla.
--
--  El CHECK lleva nombre (`vallas_dobla_ck`) y se crea solo si no existe: así
--  la migración es idempotente aunque se corra dos veces.
--
--  ═══ LO QUE NO HACE ═══════════════════════════════════════════════════════
--  · No toca `db/schema.sql`, ni dinero, ni reservas, ni la RLS (la columna
--    hereda la de `vallas`, fail-closed + FORCE).
--  · No rellena nada: NULL en toda valla anterior = «no dobla», el plano de
--    antes.
--
--  Vuelta atrás: la versión anterior no lee la columna; la ignora.
--
--  POSTGRESQL 14: nada posterior. Transaccional e idempotente.
-- ============================================================================

begin;

alter table vallas add column if not exists dobla text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'vallas_dobla_ck'
                  and conrelid = 'vallas'::regclass) then
    alter table vallas add constraint vallas_dobla_ck
      check (dobla is null or dobla in ('izquierda','derecha'));
  end if;
end $$;

comment on column vallas.dobla is
  'VALLAS-ESQUINA (20/11). Despues de esta valla la pared dobla: izquierda o derecha. NULL = sigue recta. El plano parte la cara en tramos en cada quiebre.';

commit;

select 'columna dobla en vallas (deberia ser 1)' k, count(*)::text v
  from information_schema.columns
 where table_name = 'vallas'
   and column_name = 'dobla'
union all
select 'check vallas_dobla_ck (deberia ser 1)', count(*)::text
  from pg_constraint
 where conname = 'vallas_dobla_ck';
