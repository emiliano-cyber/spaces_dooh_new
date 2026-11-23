-- @tipo: esquema
-- ============================================================================
--  PROP-MARCA · LA MARCA DE UNA PROPUESTA (20/11). Zona ROJA R3.
--  APROBADA POR EL DUEÑO SOLO PARA LOCAL el 20/11; cualquier otra base la
--  aplica una persona.
-- ----------------------------------------------------------------------------
--  Pedido del dueño: «la validación de la competencia también debe estar al
--  crear la propuesta, con las lógicas que ya están dentro». La regla de
--  competencia de marcas (`lib/vallas/reglas/competencia-marcas.ts`) compara
--  MARCAS, y la propuesta no tenía ninguna: solo `campanas.marca` existía.
--
--  El dueño eligió un campo «Marca» nuevo en la propuesta, OPCIONAL:
--   · vacío (NULL) = cuenta el nombre del cliente, igual que en campañas
--     (`coalesce(nullif(btrim(c.marca),''), cl.nombre)` en
--     `contextoParaVerificar`, `lib/server/vallas-repo.ts`);
--   · pasa a `campanas.marca` al generar la campaña desde la propuesta.
--
--  Texto libre y sin catálogo, como `campanas.marca`: la regla normaliza
--  («Coca-Cola» = «coca cola»), así que no hace falta una tabla de marcas.
--  La longitud (120) la acota el servidor (zod), no un CHECK: así una
--  decisión de cambiarla no exige otra migración.
--
--  ═══ LO QUE NO HACE ═══════════════════════════════════════════════════════
--  · No toca `db/schema.sql`, ni importes, ni snapshots, ni estatus.
--  · No rellena nada: NULL en toda propuesta anterior, que es exactamente «usa
--    el cliente» — el comportamiento de antes.
--
--  Vuelta atrás: la versión anterior no lee la columna; la ignora.
--
--  POSTGRESQL 14: nada posterior. Transaccional e idempotente.
-- ============================================================================

begin;

alter table propuestas add column if not exists marca text;

comment on column propuestas.marca is
  'PROP-MARCA (20/11). Marca que se anuncia, para la regla de competencia de marcas de Vallas. NULL o vacia = cuenta el nombre del cliente. Pasa a campanas.marca al generar la campana.';

commit;

select 'columna marca en propuestas (deberia ser 1)' k, count(*)::text v
  from information_schema.columns
 where table_name = 'propuestas'
   and column_name = 'marca';
