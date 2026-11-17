-- ========================================================================
--  La probabilidad de cierre por etapa del CRM la fija CADA INSTANCIA.
-- ------------------------------------------------------------------------
--  ADR 0051, pregunta 3. Hasta hoy era una constante del código
--  (`apps/web/lib/crm.ts` → `PROBABILIDAD_POR_ETAPA`: 10 · 25 · 50 · 75 ·
--  100 · 0) marcada como provisional. El dueño decidió el 17/11 que la fije
--  cada instancia, y aprobó esta forma el mismo día.
--
--  La columna va en `config_negocio`, UNA FILA POR TENANT (ADR 0011), igual
--  que `costos_ot`, y por la misma razón el DEFAULT es `{}` y no los cuatro
--  números: el respaldo vive en el código, y sembrarlo aquí lo pondría en DOS
--  sitios. `{}` significa «esta organización no ha configurado nada».
--
--  Solo se guardan las etapas ABIERTAS (CONTACTO, NECESIDAD, COTIZANDO,
--  NEGOCIANDO): GANADA es 100 y PERDIDA 0 siempre. Lo garantiza el saneo al
--  leer y al escribir (`sanearProbabilidades`), no un CHECK: un CHECK sobre las
--  claves de un jsonb haría fallar a una instancia con código rezagado.
--
--  Efecto sobre las cifras: NINGUNO al aplicarla. Con `{}`, la tabla efectiva
--  es la de fábrica, la de ayer. No toca dinero: la probabilidad solo pondera
--  el embudo en pantalla.
--
--  Compatibilidad hacia atrás: el código de antes ignora la columna, así que se
--  puede aplicar antes de desplegar. Transaccional e idempotente.
-- ========================================================================
begin;

-- 1) La columna. `if not exists` para poder reaplicar sin error.
alter table config_negocio
  add column if not exists crm_probabilidades jsonb not null default '{}'::jsonb;

-- 2) El CHECK de forma: un OBJETO jsonb, no un arreglo ni un escalar. Sin esto,
--    un '[]' o un '3' entraría y el lector lo trataría como «sin configurar» en
--    silencio. En un `do` porque `add constraint` no admite `if not exists`.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'config_negocio_crm_probabilidades_objeto_ck'
       and conrelid = 'config_negocio'::regclass
  ) then
    alter table config_negocio
      add constraint config_negocio_crm_probabilidades_objeto_ck
      check (jsonb_typeof(crm_probabilidades) = 'object');
  end if;
end $$;

comment on column config_negocio.crm_probabilidades is
  'Probabilidad de cierre por etapa ABIERTA del CRM, {ETAPA: 0..100}. '
  'Objeto vacio = sin configurar: manda PROBABILIDAD_POR_ETAPA de '
  'apps/web/lib/crm.ts. GANADA (100) y PERDIDA (0) no se configuran.';

-- 3) Comprobación: existe, es jsonb, no admite null y su default es {}.
do $$
declare t text; nulos boolean; def text;
begin
  select data_type, is_nullable = 'YES', column_default
    into t, nulos, def
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'config_negocio'
     and column_name = 'crm_probabilidades';

  if t is null then
    raise exception 'config_negocio.crm_probabilidades no existe despues de la migracion';
  end if;
  if t <> 'jsonb' then
    raise exception 'config_negocio.crm_probabilidades deberia ser jsonb y es %', t;
  end if;
  if nulos then
    raise exception 'config_negocio.crm_probabilidades admite null: sin configurar es {}, no null';
  end if;
  if def is null or def not like '%''{}''%' then
    raise exception 'config_negocio.crm_probabilidades no tiene el default {}: %', coalesce(def, '(ninguno)');
  end if;
end $$;

commit;
