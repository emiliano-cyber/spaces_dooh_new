-- ========================================================================
--  El costo de una orden de trabajo pasa a ser CONFIGURABLE y POR TIPO.
-- ------------------------------------------------------------------------
--  Hasta hoy vivía en una constante de `apps/web/lib/data/derive.ts:254`:
--
--      const COSTO_OPERATIVO_POR_OT = 1500
--      // Parámetro de demo; en producción vendría de ConfigNegocio o por tipo de OT.
--
--  Su propio comentario decía lo que le faltaba. Entretanto, el margen que
--  enseña la aplicación —dashboard del dueño, P&L por campaña y los reportes
--  de rentabilidad nuevos— cobraba lo mismo por montar una lona que por una
--  inspección, e igual para las cinco organizaciones.
--
--  La columna va en `config_negocio`, que es UNA FILA POR TENANT (ADR 0011),
--  así que cada organización captura sus importes sin tocar los de las demás.
--  Antes del ADR 0011 esa fila era global y esto habría sido justo lo
--  contrario: un ajuste de dinero compartido por todo el mundo.
--
--  ─── Por qué el DEFAULT es `{}` y no los nueve importes ─────────────────
--  Porque el respaldo por tipo vive en el código
--  (`apps/web/lib/costos-ot.ts` → `COSTOS_OT_RESPALDO`) y sembrarlo también
--  aquí lo pondría en DOS sitios. El día que el negocio cambie el importe de
--  respaldo, toda la flota lo arrastraría quemado en su fila y seguiría
--  cobrando el viejo sin que nada lo dijera. `{}` significa exactamente «esta
--  organización no ha configurado nada», y la regla de lectura es una sola.
--
--  Efecto sobre las cifras: NINGUNO. Todos los respaldos valen 1500, que es
--  lo que costaba cualquier OT ayer. Un cambio de esquema que además mueva el
--  margen es imposible de verificar — no se sabría si la diferencia es el
--  cambio o un fallo.
--
--  Compatibilidad hacia atrás: una instancia con código rezagado ignora la
--  columna y sigue usando su constante, así que la migración se puede aplicar
--  antes de desplegar. Transaccional e idempotente.
-- ========================================================================
begin;

-- 1) La columna. `if not exists` para poder reaplicar sin error.
alter table config_negocio
  add column if not exists costos_ot jsonb not null default '{}'::jsonb;

-- 2) El CHECK de forma: tiene que ser un OBJETO jsonb, no un arreglo ni un
--    escalar. Sin esto, un `'[]'` o un `'3'` entraría y el lector lo trataría
--    como «sin configurar» en silencio — el modo de fallo que este repo
--    persigue: no da error, solo miente.
--
--    Va en un `do` porque `add constraint` no admite `if not exists`, y
--    repetirlo a secas rompe la reaplicación.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'config_negocio_costos_ot_objeto_ck'
       and conrelid = 'config_negocio'::regclass
  ) then
    alter table config_negocio
      add constraint config_negocio_costos_ot_objeto_ck
      check (jsonb_typeof(costos_ot) = 'object');
  end if;
end $$;

comment on column config_negocio.costos_ot is
  'Costo de mano de obra por TIPO de orden de trabajo, {TIPO_OT: importe}. '
  'Objeto vacio = sin configurar: el importe lo pone COSTOS_OT_RESPALDO en '
  'apps/web/lib/costos-ot.ts. Un tipo ausente cae al respaldo, nunca a 0.';

-- 3) Comprobación: la columna existe, es jsonb, no admite null y su default
--    es el objeto vacío. Aborta nombrando lo que no cuadre, en vez de dejar
--    la migración registrada como aplicada sobre un esquema a medias.
do $$
declare t text; nulos boolean; def text;
begin
  select data_type, is_nullable = 'YES', column_default
    into t, nulos, def
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'config_negocio'
     and column_name = 'costos_ot';

  if t is null then
    raise exception 'config_negocio.costos_ot no existe despues de la migracion';
  end if;
  if t <> 'jsonb' then
    raise exception 'config_negocio.costos_ot deberia ser jsonb y es %', t;
  end if;
  if nulos then
    raise exception 'config_negocio.costos_ot admite null: un costo ausente debe ser {}, no null';
  end if;
  if def is null or def not like '%''{}''%' then
    raise exception 'config_negocio.costos_ot no tiene el default {}: %', coalesce(def, '(ninguno)');
  end if;
end $$;

commit;
