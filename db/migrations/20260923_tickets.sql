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

commit;
