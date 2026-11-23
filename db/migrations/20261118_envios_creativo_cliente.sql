-- @tipo: esquema
-- ============================================================================
--  ENVIO-CLIENTE · EL CLIENTE MANDA SU CREATIVO DESDE LA LIGA, Y NO ENTRA A
--  `creatividades` HASTA QUE ALGUIEN AUTORIZADO LO APRUEBA.
--  Aprobada por el dueño el 2026-11-18 (zona ROJA R3): «Tabla temporal en la BD».
-- ----------------------------------------------------------------------------
--  Pedido del dueño (18/11): «de la liga se pueda subir el creativo que veremos
--  desde la pantalla de Campañas, y obvio no se puede aprobar más que por los
--  perfiles seleccionados». Y, el mismo día: «el subir el creativo no debe de
--  poderse guardar en la BD; solo mandar el archivo para que lo vean los
--  usuarios permitidos, y ellos al aprobarlo se apruebe automáticamente y ahora
--  sí se guarde y se suba el creativo a DOOHmain».
--
--  Fuera de la base no había dónde: las instancias corren en un contenedor que
--  `update.sh` reemplaza en cada versión y sin volumen de escritura. Se eligió
--  esta tabla APARTE, que es una sala de espera:
--
--  · Una fila = un archivo que mandó el cliente por la liga de su propuesta.
--  · `PENDIENTE` lleva el archivo (`contenido`, data URL como el arte de
--    `creatividades`). Aprobar CREA el creativo ya aprobado en `creatividades`
--    y BORRA esta fila: el archivo no vive en dos sitios.
--  · `RECHAZADO` se queda SIN el archivo (se borra el contenido) y con el
--    motivo, para que la liga le diga al cliente qué ajustar.
--  · Nada de aquí llega a `creatividades`, a DOOHmain ni a imprenta sin que
--    un Dueño o Administrador lo apruebe en la ficha de campaña.
--
--  ═══ AISLAMIENTO ══════════════════════════════════════════════════════════
--  · `tenant_id` con la misma RLS fail-closed + FORCE que el resto.
--  · La campaña y el sitio van con FK COMPUESTA `(id, tenant_id)`: un envío no
--    puede apuntar a la campaña o a la pantalla de otra organización ni aunque
--    el código se equivocara. Para eso `campanas` estrena su
--    `unique (id, tenant_id)` (sitios ya lo tenía desde PAQ-01).
--  · Se va con su campaña (`on delete cascade`), como sus creativos.
--  · La ruta pública resuelve el tenant con `propuesta_tenant_por_token` y
--    escribe bajo `qConTenant`; nunca con `qRaw`.
--
--  ═══ POSTGRESQL 14 ════════════════════════════════════════════════════════
--  Nada posterior a la 14. Sin `-- @pg-min`.
--
--  Transaccional e idempotente: se puede correr dos veces.
-- ============================================================================

begin;

do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'campanas_id_tenant_uq'
                    and conrelid = 'campanas'::regclass) then
    alter table campanas add constraint campanas_id_tenant_uq unique (id, tenant_id);
  end if;
end $$;

create table if not exists envios_creativo_cliente (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  campana_id      uuid not null,
  -- La pantalla que eligió el cliente (null si la campaña no tiene ninguna).
  sitio_id        uuid,
  nombre_archivo  text not null,
  tipo_mime       text not null,
  tamano_bytes    integer not null,
  -- Medida en píxeles que midió el navegador; orienta a quien aprueba.
  ancho_px        integer,
  alto_px         integer,
  -- El archivo, como data URL. Solo mientras está PENDIENTE.
  contenido       text,
  estatus         text not null default 'PENDIENTE',
  motivo_rechazo  text,
  -- La IP con el último tramo en cero: basta para ver abusos, no identifica.
  ip_truncada     text,
  creado_en       timestamptz not null default now(),
  revisado_en     timestamptz,
  revisado_por    text,
  constraint envios_cc_campana_fk foreign key (campana_id, tenant_id)
    references campanas (id, tenant_id) on delete cascade,
  constraint envios_cc_sitio_fk foreign key (sitio_id, tenant_id)
    references sitios (id, tenant_id) on delete cascade,
  constraint envios_cc_estatus_ck check (estatus in ('PENDIENTE', 'RECHAZADO')),
  constraint envios_cc_tipo_ck check (tipo_mime in ('image/jpeg', 'image/png', 'image/webp')),
  constraint envios_cc_nombre_ck check (length(nombre_archivo) between 1 and 200),
  constraint envios_cc_tamano_ck check (tamano_bytes > 0),
  -- Pendiente CON archivo; rechazado SIN él. Lo rechazado no se guarda.
  constraint envios_cc_contenido_ck check (
    (estatus = 'PENDIENTE' and contenido is not null) or
    (estatus = 'RECHAZADO' and contenido is null)
  )
);

create index if not exists idx_envios_cc_tenant_campana
  on envios_creativo_cliente (tenant_id, campana_id, creado_en);

-- ─── Aislamiento: igual que el resto de tablas con tenant_id ────────────────
alter table envios_creativo_cliente enable row level security;
alter table envios_creativo_cliente force row level security;
drop policy if exists tenant_isolation on envios_creativo_cliente;
create policy tenant_isolation on envios_creativo_cliente for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select, insert, update, delete on envios_creativo_cliente to %I', r);
    end if;
  end loop;
end $$;

commit;
