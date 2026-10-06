-- @tipo: esquema
-- ============================================================================
--  PROP-PER · CUANDO SE APROBO Y CUANDO SE RECHAZO UNA PROPUESTA.
-- ----------------------------------------------------------------------------
--  El tablero de propuestas por periodo que pidio el dueno el 06/10 cuenta las
--  aprobadas y las rechazadas por la fecha EN QUE OCURRIERON. Hasta hoy una
--  propuesta guardaba solo `creado_en` y, si la acepto el cliente por la liga,
--  `aceptado_en`; la aprobacion interna y el rechazo no dejaban fecha.
--
--  Dos columnas, y nada mas:
--
--    · `aprobada_en`  — la pone `cambiarEstatusPropuesta` (aprobacion interna)
--      y `aceptarPropuestaPublica` (el cliente por la liga). Se conserva si ya
--      la tenia: re-aprobar no mueve la fecha.
--    · `rechazada_en` — la pone `cambiarEstatusPropuesta`.
--
--  Si una propuesta cambia de estatus, la fecha del estatus que deja se borra:
--  una rechazada que despues se aprueba es una APROBADA, no las dos cosas.
--
--  ═══ LAS QUE YA EXISTIAN ══════════════════════════════════════════════════
--
--  · APROBADAS: `aprobada_en` = cuando se congelo su precio (`snapshot_en`),
--    que es exactamente al aprobar (`congelarSnapshotEconomico`, que no vuelve
--    a escribir si ya hay snapshot). Si no hubiera snapshot, `aceptado_en`.
--  · RECHAZADAS: quedan SIN fecha. No hay de donde sacarla y no se inventa:
--    el tablero no las cuenta en ningun periodo.
--
--  No toca `db/schema.sql`, no edita migraciones anteriores, no cambia ningun
--  estatus ni ningun importe. Sin tabla nueva.
--
--  POSTGRESQL 14: nada posterior. Transaccional e idempotente.
-- ============================================================================

begin;

alter table propuestas add column if not exists aprobada_en  timestamptz;
alter table propuestas add column if not exists rechazada_en timestamptz;

comment on column propuestas.aprobada_en is
  'PROP-PER (06/10). Cuando se aprobo (internamente o por la liga del cliente). Las anteriores al 06/10: cuando se congelo su precio.';
comment on column propuestas.rechazada_en is
  'PROP-PER (06/10). Cuando se rechazo. NULL en las rechazadas anteriores al 06/10: no habia registro y no se inventa.';

update propuestas
   set aprobada_en = coalesce(snapshot_en, aceptado_en)
 where estatus = 'APROBADA'
   and aprobada_en is null;

-- Lo que el tablero filtra: «las aprobadas / rechazadas entre tal y tal fecha».
create index if not exists idx_propuestas_aprobada_en  on propuestas (tenant_id, aprobada_en)  where aprobada_en  is not null;
create index if not exists idx_propuestas_rechazada_en on propuestas (tenant_id, rechazada_en) where rechazada_en is not null;

commit;

select 'aprobadas sin fecha de aprobacion (sin snapshot ni aceptacion)' k, count(*)::text v
  from propuestas where estatus = 'APROBADA' and aprobada_en is null
union all
select 'rechazadas sin fecha (anteriores al 06/10, no se inventa)', count(*)::text
  from propuestas where estatus = 'RECHAZADA' and rechazada_en is null;
