-- @tipo: esquema
-- ============================================================================
--  ADR 0049 · EL IDIOMA DE LOS DOCUMENTOS ES DE LA INSTANCIA, SE ELIGE AL
--  NACER Y NO SE CAMBIA.
-- ----------------------------------------------------------------------------
--  APROBADA POR EL DUEÑO EL 03/11 (R3, migración; y firmas). Su decisión,
--  literal: «el idioma de papeles y contratos es fijo al crearse la app en cada
--  server, pero el idioma de lo demás se debe poder configurar por usuario y
--  navegador». Esta migración es la primera mitad; la segunda (la preferencia
--  por usuario) es otra tarea y no toca esta columna.
--
--  ═══ POR QUÉ NO SE PUEDE CAMBIAR ════════════════════════════════════════
--
--  El contrato se CONGELA y se sella con SHA-256 (`firmas-repo.ts`). Para
--  saber si una firma sigue valiendo, la aplicación REGENERA el texto con los
--  datos de hoy y compara hashes. Si el idioma de la instancia cambiara, el
--  texto regenerado saldría en el idioma nuevo, no coincidiría con el que se
--  firmó, y TODAS las firmas de la instancia aparecerían «alteradas» de golpe,
--  sin que nadie tocara ningún contrato. Es el mismo motivo que hace inmutable
--  la moneda (ADR 0048), aplicado al texto.
--
--  ═══ DÓNDE VIVE ════════════════════════════════════════════════════════
--
--  `tenants.idioma_documentos`, junto a `tenants.moneda` (ADR 0048), y con las
--  mismas reglas: es de la INSTANCIA —todas sus organizaciones lo comparten—,
--  lo elige el bootstrap y lo heredan las demás. No hay espejo en
--  `config_negocio`: a diferencia de la moneda, nunca hubo ahí una columna de
--  idioma que alinear.
--
--  El nombre dice «documentos» a propósito: NO es el idioma de la interfaz.
--  La interfaz sigue a la persona (cookie / navegador / preferencia).
--
--  ═══ LO QUE HACE ════════════════════════════════════════════════════════
--
--   1. Añade la columna, `not null default 'es'`. TODA instancia que ya
--      existe (g500, DEMO) queda en español: su contrato es el de siempre,
--      byte a byte, y sus firmas se cotejan igual que ayer.
--   2. CHECK (idioma_documentos in ('es','en','it')).
--   3. Trigger que IMPIDE el UPDATE cuando el valor cambia (reescribir el
--      mismo pasa, como con la moneda: los upserts de las semillas y de
--      `docs/datos/` lo hacen).
--   4. Trigger que impide que una organización NUEVA nazca con otro idioma
--      que las que ya hay: uno por INSTANCIA.
--
--  Los triggers se disparan para todos los roles, incluido el superusuario: es
--  una regla del dato, no de permisos. Saltarla exige deshabilitarlos a
--  propósito, en una corrección de `docs/datos/` con rollback — y además
--  decidir qué pasa con los contratos ya firmados (ver ADR 0049).
--
--  ═══ LO QUE NO HACE ═════════════════════════════════════════════════════
--
--  · No toca `db/schema.sql`, ni la moneda, ni ningún contrato congelado.
--  · No elige idioma por nadie: lo que ya existe es español porque es lo único
--    que existía (el contrato solo se redactaba en español hasta hoy).
--
--  Vuelta atrás: la versión anterior de la app no lee ni escribe esta columna
--  (el INSERT de `tenants` no la nombra y toma el DEFAULT). Quitarla a mano:
--    drop trigger trg_tenants_idioma_documentos_inmutable on tenants;
--    drop trigger trg_tenants_idioma_documentos_unico on tenants;
--    alter table tenants drop column idioma_documentos;
--
--  POSTGRESQL 14: nada posterior. Transaccional e idempotente.
-- ============================================================================

begin;

-- ─── 1 · La columna: español para todo lo que ya existe ─────────────────────
alter table tenants add column if not exists idioma_documentos text not null default 'es';

-- ─── 2 · Solo es, en o it ───────────────────────────────────────────────────
alter table tenants drop constraint if exists tenants_idioma_documentos_ck;
alter table tenants add  constraint tenants_idioma_documentos_ck
  check (idioma_documentos in ('es', 'en', 'it'));

-- ─── 3 · Inmutable una vez creada la fila ───────────────────────────────────
create or replace function idioma_documentos_inmutable()
  returns trigger
  language plpgsql
as $$
begin
  if new.idioma_documentos is distinct from old.idioma_documentos then
    raise exception using
      errcode = 'check_violation',
      message = format('El idioma de los documentos de la instancia no se puede cambiar (%s -> %s): los contratos firmados se cotejan regenerando su texto, y en otro idioma todas sus firmas aparecerian alteradas (ADR 0049).',
                       old.idioma_documentos, new.idioma_documentos);
  end if;
  return new;
end $$;

drop trigger if exists trg_tenants_idioma_documentos_inmutable on tenants;
create trigger trg_tenants_idioma_documentos_inmutable
  before update of idioma_documentos on tenants
  for each row execute function idioma_documentos_inmutable();

-- ─── 4 · Un idioma de documentos por instancia ──────────────────────────────
create or replace function tenants_idioma_documentos_unico()
  returns trigger
  language plpgsql
as $$
declare otro text;
begin
  -- Serializa las altas, igual que la moneda: dos organizaciones naciendo a
  -- la vez en una base vacía, cada una en un idioma, no se verían.
  perform pg_advisory_xact_lock(hashtext('adr0049_tenants_idioma_documentos'));
  select idioma_documentos into otro from tenants
   where idioma_documentos is distinct from new.idioma_documentos limit 1;
  if found then
    raise exception using
      errcode = 'check_violation',
      message = format('Los documentos de esta instancia se redactan en %s: una organizacion nueva no puede nacer en %s (ADR 0049).', otro, new.idioma_documentos);
  end if;
  return new;
end $$;

drop trigger if exists trg_tenants_idioma_documentos_unico on tenants;
create trigger trg_tenants_idioma_documentos_unico
  before insert on tenants
  for each row execute function tenants_idioma_documentos_unico();

comment on column tenants.idioma_documentos is
  'ADR 0049 (03/11). Idioma de los DOCUMENTOS de la instancia (contrato y constancia de firmas): es, en o it, el mismo para todas sus organizaciones. Se elige al crear la primera (POST /api/bootstrap) y no se puede cambiar. NO es el idioma de la interfaz.';

commit;

select 'organizaciones fuera de es/en/it (deberia ser 0)' k, count(*)::text v
  from tenants where idioma_documentos not in ('es', 'en', 'it')
union all
select 'idiomas de documentos distintos en la instancia (deberia ser 0 o 1)', count(distinct idioma_documentos)::text
  from tenants
union all
select 'triggers del idioma de documentos (deberia ser 2)', count(*)::text
  from pg_trigger
 where tgname in ('trg_tenants_idioma_documentos_inmutable', 'trg_tenants_idioma_documentos_unico');
