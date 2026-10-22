-- @tipo: esquema
-- ============================================================================
--  Pantallas y lugares PROPIOS: sin renta, sin arrendador, sin contrato.
-- ----------------------------------------------------------------------------
--  Pedido del dueño el 2026-10-22: «que los dueños añadan pantallas o lugares
--  propios para que no sea renta mensual, sino ya solo se pongan los gastos de
--  luz y operaciones». Forma aprobada ese día (v0.12.3).
--
--  Hasta hoy TODO el inventario giraba alrededor del contrato de arrendamiento:
--  el alta exige arrendador y abre un contrato, y sin contrato completo una
--  pantalla no se puede reservar ni vender (`exigirContratoCompleto`, ADR 0003).
--  Una pantalla propia no tiene a quién pagarle: su costo es la luz
--  (`consumos_energia`, que ya cuelga de la pantalla o del predio sin contrato)
--  y la operación (las OT), que ya no dependían de la renta.
--
--  SOLO AGREGA, y relaja una restricción:
--   · `sitios.propio`  — la pantalla es de la organización. Es la que manda para
--     vender (el guard la da por cubierta) y para el costo (espacio = 0).
--   · `predios.propio` — el LUGAR es de la organización (un predio con varias
--     pantallas propias). Sus pantallas se marcan `propio` al colgarlas.
--   · `predios.arrendador_id` deja de ser NOT NULL, con un CHECK: o el predio es
--     propio, o tiene arrendador. Ninguna fila existente cambia: todas tienen
--     arrendador hoy, y `propio` nace en false.
--
--  Vuelta atrás: la versión anterior lee estas tablas sin las columnas nuevas;
--  una pantalla propia se le vería «sin contrato» (no vendible), que es lo
--  correcto para quien no sabe qué es «propia». El único estado que la versión
--  vieja no entendería es un predio sin arrendador, y solo existe si alguien dio
--  de alta un lugar propio con la nueva.
--
--  PostgreSQL 14: nada de 15. Idempotente.
-- ============================================================================

begin;

alter table sitios  add column if not exists propio boolean not null default false;
alter table predios add column if not exists propio boolean not null default false;

alter table predios alter column arrendador_id drop not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'predios_propio_o_arrendador_ck'
                  and conrelid = 'predios'::regclass) then
    alter table predios add constraint predios_propio_o_arrendador_ck
      check (propio or arrendador_id is not null);
  end if;
end $$;

comment on column sitios.propio is
  'v0.12.3. La pantalla es de la organización: sin renta, sin arrendador y sin contrato. Se vende sin contrato (exigirContratoCompleto la da por cubierta) y su costo de espacio es 0; su costo real es luz (consumos_energia) + operación (OT).';
comment on column predios.propio is
  'v0.12.3. El lugar es de la organización. Puede no tener arrendador (predios_propio_o_arrendador_ck). Sus pantallas se marcan sitios.propio al colgarlas.';

commit;

-- ─── Comprobación ────────────────────────────────────────────────────────────
select 'columnas propio (2)' k, count(*)::text v
  from information_schema.columns
 where (table_name, column_name) in (('sitios','propio'), ('predios','propio'))
union all
select 'predios.arrendador_id admite null (YES)', is_nullable
  from information_schema.columns where table_name = 'predios' and column_name = 'arrendador_id'
union all
select 'pantallas propias (nace en 0)', count(*)::text from sitios where propio;
