-- ============================================================================
-- Proof of play — consultas a DOOHmain, guardadas CRUDAS.
--
-- Por qué cruda y no una tabla de "reproducciones por día":
-- todavía NO hemos visto una respuesta con datos. Al 16-jul-2026, get_stats y
-- get_metrics devuelven siempre `[]` porque nada ha salido al aire (todo es
-- demo). Sabemos que la llave es `stats`/`metrics` y que es un arreglo; NO
-- sabemos qué trae cada elemento.
--
-- Modelar ahora esa tabla sería inventarse columnas, y el día que lleguen datos
-- reales el parser fallaría en silencio o mostraría números equivocados — en la
-- pantalla con la que se le cobra al anunciante. Así que se guarda el payload
-- literal + de qué se preguntó y cuándo. Cuando haya una respuesta con datos, se
-- lee de aquí, se conoce la forma y ENTONCES se modela el reporte encima, con
-- el histórico ya capturado.
--
-- Aditivo e idempotente.
-- ============================================================================
begin;

create table if not exists doohmain_consultas_play (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  -- Qué se preguntó: 'stats' (por campaña) o 'metrics' (por pantalla).
  tipo         text not null check (tipo in ('stats', 'metrics')),
  campana_id   uuid,          -- campaña de SPACES, si la consulta fue por campaña
  auths        text[],        -- auths de DOOHmain consultados
  pantallas    text[],        -- pantallas consultadas
  desde        date not null,
  hasta        date not null,
  -- La respuesta LITERAL de DOOHmain. Fuente de verdad; no se interpreta aún.
  payload      jsonb not null,
  -- Atajo honesto: ¿el arreglo venía vacío? Así la UI puede decir "sin datos"
  -- sin fingir que entiende el contenido.
  vacio        boolean not null,
  error        text,          -- si la llamada falló, el motivo (payload = '{}')
  consultado_en timestamptz not null default now(),
  consultado_por uuid
);

create index if not exists dcp_tenant_idx  on doohmain_consultas_play(tenant_id);
create index if not exists dcp_campana_idx on doohmain_consultas_play(campana_id);
create index if not exists dcp_fecha_idx   on doohmain_consultas_play(consultado_en desc);

comment on table doohmain_consultas_play is
  'Respuestas crudas de DOOHmain (get_stats/get_metrics) para proof of play. Se guarda el payload literal porque aún no se ha visto una respuesta con datos: modelar columnas ahora sería adivinar.';

-- Aislamiento por tenant, igual que el resto del módulo (fail-closed + FORCE).
alter table doohmain_consultas_play enable row level security;
alter table doohmain_consultas_play force  row level security;
drop policy if exists tenant_isolation on doohmain_consultas_play;
create policy tenant_isolation on doohmain_consultas_play for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

-- El rol de la app necesita escribir aquí (en prod es spaces_user).
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'spaces_user') then
    grant select, insert, update, delete on doohmain_consultas_play to spaces_user;
  end if;
  if exists (select 1 from pg_roles where rolname = 'spaces_app') then
    grant select, insert, update, delete on doohmain_consultas_play to spaces_app;
  end if;
end $$;

commit;

-- Verificación
select 'tabla' k, count(*)::text v from pg_class where relname='doohmain_consultas_play' and relkind='r'
union all
select 'rls_forced', (relforcerowsecurity)::text from pg_class where relname='doohmain_consultas_play'
union all
select 'consultas_guardadas', count(*)::text from doohmain_consultas_play;
