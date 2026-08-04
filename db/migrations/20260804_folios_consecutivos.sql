-- ============================================================================
-- Folios consecutivos: se acabaron los folios duplicados.
--
-- Los folios se acuñaban con bytes aleatorios sobre espacios diminutos. El de
-- campaña era fecha + 3 dígitos = 1.000 por día: por la paradoja del cumpleaños
-- la probabilidad de repetir supera el 50% a las ~37 campañas del mismo día, y
-- como `campanas.folio` es UNIQUE, el INSERT falla y el vendedor ve en pantalla
-- `duplicate key value violates unique constraint "campanas_folio_key"`.
-- Reventó en pruebas con cinco campañas.
--
-- Esta tabla guarda el último número por (ámbito, periodo). El UPSERT que la
-- incrementa es atómico: dos reservas simultáneas se serializan en la fila y
-- reciben números distintos.
--
-- Es GLOBAL, sin tenant_id, a propósito: las restricciones UNIQUE de `folio`
-- son globales, así que un contador por tenant dejaría que dos organizaciones
-- acuñaran el mismo `OT-2026-0001` y el choque volvería por otra puerta. El
-- folio de campaña lleva el prefijo del tenant (RGB…), que es su identidad; el
-- número solo garantiza unicidad. Por eso tampoco lleva RLS: no contiene datos
-- de negocio, solo un entero por ámbito.
--
-- Aditiva e idempotente. No reescribe ningún folio ya emitido.
-- ============================================================================
begin;

create table if not exists folios_consecutivos (
  ambito   text    not null,
  periodo  text    not null,          -- '20260804' (día) o '2026' (año)
  ultimo   integer not null default 0,
  primary key (ambito, periodo)
);

comment on table folios_consecutivos is
  'Contador de folios por ámbito y periodo. Sustituye a los folios aleatorios, que colisionaban contra las restricciones UNIQUE de folio.';

-- Arranca cada contador por encima de lo ya emitido, para que un folio nuevo
-- no choque con uno viejo que ya ocupaba ese número por casualidad. Solo siembra
-- lo que falte: correr esto dos veces no mueve un contador ya avanzado.
insert into folios_consecutivos (ambito, periodo, ultimo)
select 'campana', to_char(creado_en, 'YYYYMMDD'), count(*)
  from campanas where folio is not null group by 1, 2
on conflict (ambito, periodo) do nothing;

insert into folios_consecutivos (ambito, periodo, ultimo)
select 'propuesta', to_char(creado_en, 'YYYY'), count(*)
  from propuestas where folio is not null group by 1, 2
on conflict (ambito, periodo) do nothing;

insert into folios_consecutivos (ambito, periodo, ultimo)
select 'ot', to_char(creado_en, 'YYYY'), count(*)
  from ordenes_trabajo where folio is not null group by 1, 2
on conflict (ambito, periodo) do nothing;

insert into folios_consecutivos (ambito, periodo, ultimo)
select 'oc', to_char(creado_en, 'YYYY'), count(*)
  from ordenes_compra where folio is not null group by 1, 2
on conflict (ambito, periodo) do nothing;

insert into folios_consecutivos (ambito, periodo, ultimo)
select 'oi', to_char(creado_en, 'YYYY'), count(*)
  from ordenes_impresion where folio is not null group by 1, 2
on conflict (ambito, periodo) do nothing;

commit;

-- Verificación
select ambito, periodo, ultimo from folios_consecutivos order by ambito, periodo;
