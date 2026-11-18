-- @tipo: esquema
-- ============================================================================
--  ADR 0048 · LA MONEDA ES DE LA INSTANCIA, SE ELIGE AL NACER Y NO SE CAMBIA.
-- ----------------------------------------------------------------------------
--  APROBADA POR EL DUEÑO EL 02/11 (R3 + R4, dinero). Su decisión, literal en
--  sustancia: la moneda de una instancia (MXN o USD) se elige al crearla y
--  después NO se puede cambiar, por seguridad. Las que ya existen se quedan en
--  MXN.
--
--  ═══ POR QUÉ NO SE PUEDE CAMBIAR ════════════════════════════════════════
--
--  Los importes guardados —contratos, propuestas, cobranza— NO llevan moneda
--  propia: son números. La moneda con la que se leen es la de la instancia.
--  Cambiarla volvería «$10,000 MXN» en «$10,000 USD» sin convertir nada: el
--  mismo número, otra divisa, unas veinte veces más caro, y ningún error.
--
--  ═══ DÓNDE VIVE ════════════════════════════════════════════════════════
--
--  Hay DOS columnas con el nombre, y las dos nacieron como «moneda estándar
--  por organización»:
--
--    · `tenants.moneda` (`db/schema.sql:594`, default 'MXN'). Es la FUENTE: la
--      leen los repos para estampar campañas, facturas y contratos
--      (`campanas-repo.ts`, `finanzas-repo.ts`, `contratos-sitio.ts`), y la
--      lee la app para formatear (`lib/server/moneda-instancia.ts`).
--    · `config_negocio.moneda` (`db/schema.sql:110`). Desde aquí es un ESPEJO
--      de la de su organización: se copia al insertar y no se puede cambiar.
--      Hacía falta porque `config-repo.ts:obtenerConfigRow()` crea la fila
--      perezosamente con los DEFAULT —o sea en 'MXN'— y en una instancia USD
--      habría nacido mintiendo.
--
--  Las columnas `moneda` de campanas/facturas/contratos (default 'PEN', luego
--  'MXN') NO se tocan: son almacén histórico.
--
--  ═══ LO QUE HACE ════════════════════════════════════════════════════════
--
--   0. COMPRUEBA antes de restringir. Si alguna organización tiene una moneda
--      que no es MXN ni USD, o si hay dos monedas en la misma instancia, PARA
--      con un mensaje que dice qué hacer. No corrige nada a ciegas: decidir
--      en qué moneda está una organización es justo la decisión que esta
--      migración protege.
--   1. Alinea `config_negocio.moneda` con la de su organización (es el
--      espejo; hasta hoy nadie lo leía para pintar nada, así que alinearlo no
--      cambia ninguna pantalla). Cuenta las filas que tocó.
--   2. CHECK (moneda in ('MXN','USD')) en las dos tablas.
--   3. Trigger que IMPIDE el UPDATE de `moneda` en las dos tablas cuando el
--      valor cambia. Reescribir el MISMO valor sí pasa —lo hacen los upserts
--      de `scripts/semilla-demo.mjs` y de las cargas de `docs/datos/`—: lo
--      que se protege es el cambio, no la escritura.
--   4. Trigger que impide que una organización NUEVA nazca en otra moneda que
--      las que ya hay: una moneda por INSTANCIA, que es lo que hace correcto
--      que la app la guarde en un valor de módulo (`lib/i18n/dinero.ts`).
--   5. Trigger que copia la moneda de la organización a su `config_negocio`
--      al insertarla, venga lo que venga en el INSERT.
--
--  El trigger se dispara para todos los roles, incluido el dueño de la tabla
--  y un superusuario: no es una regla de permisos, es una regla del dato. La
--  única forma de saltarlo es deshabilitarlo a propósito (y quien puede hacer
--  eso es quien hace una corrección en `docs/datos/`, con rollback, que es
--  exactamente el camino que debe tener un cambio así).
--
--  ═══ LO QUE NO HACE ═════════════════════════════════════════════════════
--
--  · No toca `db/schema.sql`, ni ningún importe, ni las columnas `moneda` de
--    campanas/facturas/contratos.
--  · No elige moneda por nadie: una base con datos fuera de MXN/USD la para.
--
--  Vuelta atrás: la versión anterior de la app no escribe `moneda` en ninguna
--  de las dos tablas salvo `PATCH /api/config`, que con esto recibiría un
--  error de la base si intentara CAMBIARLA. Quitar las restricciones a mano:
--    drop trigger trg_tenants_moneda_inmutable on tenants;
--    drop trigger trg_tenants_moneda_unica on tenants;
--    drop trigger trg_config_negocio_moneda_inmutable on config_negocio;
--    drop trigger trg_config_negocio_moneda_espejo on config_negocio;
--    alter table tenants drop constraint tenants_moneda_ck;
--    alter table config_negocio drop constraint config_negocio_moneda_ck;
--
--  POSTGRESQL 14: nada posterior. Transaccional e idempotente.
-- ============================================================================

begin;

-- ─── 0 · Comprobar ANTES de restringir ──────────────────────────────────────
do $$
declare
  fuera   text;
  monedas text;
begin
  select string_agg(distinct coalesce(moneda, '(nula)'), ', ' order by coalesce(moneda, '(nula)'))
    into fuera
    from tenants
   where moneda is null or moneda not in ('MXN', 'USD');
  if fuera is not null then
    raise exception using
      message = format('ADR 0048: hay organizaciones con una moneda que no es MXN ni USD: %s', fuera),
      hint    = 'Decide en que moneda esta cada una y corrigela con una correccion de datos en docs/datos/ (con su rollback) ANTES de aplicar esta migracion. No se corrige sola a proposito.';
  end if;

  select string_agg(distinct moneda, ', ' order by moneda) into monedas from tenants;
  if (select count(distinct moneda) from tenants) > 1 then
    raise exception using
      message = format('ADR 0048: esta instancia tiene organizaciones en mas de una moneda: %s', monedas),
      hint    = 'Una instancia trabaja en UNA moneda. Hay que decidir cual y corregir las demas en docs/datos/ antes de aplicar esta migracion.';
  end if;
end $$;

-- ─── 1 · El espejo se alinea con su organización ────────────────────────────
do $$
declare n int;
begin
  update config_negocio c
     set moneda = t.moneda
    from tenants t
   where t.id = c.tenant_id
     and c.moneda is distinct from t.moneda;
  get diagnostics n = row_count;
  raise notice 'ADR 0048 · config_negocio.moneda alineadas con su organizacion=%', n;
end $$;

-- ─── 2 · Solo MXN o USD ─────────────────────────────────────────────────────
alter table tenants drop constraint if exists tenants_moneda_ck;
alter table tenants add  constraint tenants_moneda_ck check (moneda in ('MXN', 'USD'));

alter table config_negocio drop constraint if exists config_negocio_moneda_ck;
alter table config_negocio add  constraint config_negocio_moneda_ck check (moneda in ('MXN', 'USD'));

-- ─── 3 · Inmutable una vez creada la fila ───────────────────────────────────
create or replace function moneda_inmutable()
  returns trigger
  language plpgsql
as $$
begin
  if new.moneda is distinct from old.moneda then
    raise exception using
      errcode = 'check_violation',
      message = format('La moneda de la instancia no se puede cambiar (%s -> %s): los importes guardados no llevan moneda propia y cambiarla los reinterpretaria sin convertirlos (ADR 0048).',
                       old.moneda, new.moneda);
  end if;
  return new;
end $$;

drop trigger if exists trg_tenants_moneda_inmutable on tenants;
create trigger trg_tenants_moneda_inmutable
  before update of moneda on tenants
  for each row execute function moneda_inmutable();

drop trigger if exists trg_config_negocio_moneda_inmutable on config_negocio;
create trigger trg_config_negocio_moneda_inmutable
  before update of moneda on config_negocio
  for each row execute function moneda_inmutable();

-- ─── 4 · Una moneda por instancia ───────────────────────────────────────────
create or replace function tenants_moneda_unica()
  returns trigger
  language plpgsql
as $$
declare otra text;
begin
  -- Serializa las altas: dos organizaciones naciendo a la vez en una base
  -- vacía, una en MXN y otra en USD, no se verían la una a la otra.
  perform pg_advisory_xact_lock(hashtext('adr0048_tenants_moneda'));
  select moneda into otra from tenants where moneda is distinct from new.moneda limit 1;
  if found then
    raise exception using
      errcode = 'check_violation',
      message = format('Esta instancia trabaja en %s: una organizacion nueva no puede nacer en %s (ADR 0048).', otra, new.moneda);
  end if;
  return new;
end $$;

drop trigger if exists trg_tenants_moneda_unica on tenants;
create trigger trg_tenants_moneda_unica
  before insert on tenants
  for each row execute function tenants_moneda_unica();

-- ─── 5 · config_negocio copia la de su organización al nacer ────────────────
create or replace function config_negocio_moneda_espejo()
  returns trigger
  language plpgsql
as $$
begin
  select t.moneda into new.moneda from tenants t where t.id = new.tenant_id;
  return new;
end $$;

drop trigger if exists trg_config_negocio_moneda_espejo on config_negocio;
create trigger trg_config_negocio_moneda_espejo
  before insert on config_negocio
  for each row execute function config_negocio_moneda_espejo();

comment on column tenants.moneda is
  'ADR 0048 (02/11). Moneda de la INSTANCIA: MXN o USD, la misma para todas sus organizaciones. Se elige al crear la primera (POST /api/bootstrap) y no se puede cambiar.';
comment on column config_negocio.moneda is
  'ADR 0048 (02/11). Espejo de tenants.moneda: se copia al insertar y no se puede cambiar.';

commit;

select 'organizaciones fuera de MXN/USD (deberia ser 0)' k, count(*)::text v
  from tenants where moneda not in ('MXN', 'USD')
union all
select 'config_negocio distinta de su organizacion (deberia ser 0)', count(*)::text
  from config_negocio c join tenants t on t.id = c.tenant_id where c.moneda is distinct from t.moneda
union all
select 'triggers de moneda (deberia ser 4)', count(*)::text
  from pg_trigger
 where tgname in ('trg_tenants_moneda_inmutable', 'trg_tenants_moneda_unica',
                  'trg_config_negocio_moneda_inmutable', 'trg_config_negocio_moneda_espejo');
