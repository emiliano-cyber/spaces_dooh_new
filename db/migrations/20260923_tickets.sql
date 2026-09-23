-- @tipo: esquema
-- Tickets de soporte (ADR 0038). El cliente los escribe desde su instancia y el
-- panel del PADRE los jala por /api/tickets.
--
-- Lleva tenant_id y RLS como cualquier tabla de negocio: el dato es del owner.
-- La ruta del panel lo atraviesa a proposito y con qRaw, y eso esta documentado
-- en tickets-repo.ts y probado en pareja (aisla el cliente / atraviesa el panel).
begin;

do $$ begin
  create type est_ticket as enum ('ABIERTO','EN_PROCESO','RESUELTO','CERRADO');
exception when duplicate_object then null; end $$;

create table if not exists tickets (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  folio                 text not null,
  asunto                text not null,
  cuerpo                text not null,
  estado                est_ticket not null default 'ABIERTO',
  prioridad             prioridad  not null default 'NORMAL',
  creado_por_usuario    uuid references usuarios(id) on delete set null,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  respuesta             text,
  respondido_en         timestamptz
);

create unique index if not exists idx_tickets_folio    on tickets (folio);
create index        if not exists idx_tickets_tenant   on tickets (tenant_id);
create index        if not exists idx_tickets_estado   on tickets (estado);

alter table tickets enable row level security;
alter table tickets force row level security;

drop policy if exists tenant_isolation on tickets;
create policy tenant_isolation on tickets for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid
         or nullif(current_setting('app.tenant_id', true),'') is null)
  with check (true);

-- ─── GRANTs al rol de la app ───────────────────────────────────────────────
-- Anadido el 2026-09-23, en la revision final de la rama: esta era la UNICA de
-- las seis migraciones que crean tabla sin un solo GRANT. El motivo por el que
-- las otras cinco lo llevan esta escrito en
-- `20260917_entidades_fiscales.sql:193`: «En produccion las tablas las posee
-- otro rol, asi que el GRANT es explicito».
--
-- ─── Y por que ninguna prueba lo veia ──────────────────────────────────────
-- El arnes de integracion crea todo con el rol PROPIETARIO y aplica antes
-- `20260824_grants_tablas_futuras.sql`, que fija privilegios POR OMISION para
-- las tablas que cree ese mismo rol: `tickets` nacia con permisos aunque aqui
-- no se concediera ninguno. En una instancia de verdad la tabla se crea, la
-- migracion sale 0, y despues `spaces_app` no puede leerla --- y ningun error
-- apunta a permisos. Medido en rojo en
-- `apps/web/lib/test/grants-tickets.e2e.test.ts`, que reproduce el caso de
-- produccion y no el del arnes.
--
-- Por rol EXISTENTE porque los entornos difieren (`spaces_user` en el droplet
-- viejo, `spaces_app` desde `20260820_grants_rol_app.sql`). Sin secuencias: la
-- clave la pone `gen_random_uuid()`, aqui no hay ninguna.
do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select, insert, update, delete on tickets to %I', r);
    end if;
  end loop;
end $$;

commit;
