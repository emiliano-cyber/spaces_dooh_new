-- @tipo: esquema
-- ============================================================================
--  CONTRATO-FIRMADO-EDITABLE · LAS VERSIONES FIRMADAS SE ARCHIVAN, NO SE BORRAN.
-- ----------------------------------------------------------------------------
--  Pedido del dueño el 2026-10-23: un contrato de arrendamiento firmado por las
--  dos partes tiene que poder cambiarse, y la firma nueva se arma con los datos
--  ACTUALES de la empresa para que las partes los revisen antes de volver a
--  firmar. Hasta hoy `editarContrato` lo rechazaba con 409 en cuanto existía una
--  sola firma, y la ficha decía «se crea un contrato nuevo».
--
--  El cambio de regla obliga a resolver un defecto que ya existía: «Volver a
--  enviar a firma» (`enviarAFirma`) hacía `delete from contrato_firmas` SIN
--  distinguir las firmadas, así que el expediente de evidencia —quién firmó,
--  cuándo, desde qué IP, sobre qué hash— y el texto que se firmó desaparecían.
--  Con la edición de firmados eso pasaría en cada cambio. Ahora, antes de anular
--  una firma, la versión firmada entera se copia aquí.
--
--  ═══ LA TABLA ═════════════════════════════════════════════════════════════
--
--  `contrato_versiones_firmadas`: una fila por versión firmada que se dejó de
--  usar, con lo que hace falta para probarla sin la tabla de firmas:
--
--    · `documento_congelado` + `documento_hash` — el texto exacto que se firmó
--      y su sello SHA-256, copiados de `contratos_arrendamiento`.
--    · `firmas` — la evidencia de CADA firma tal como estaba (parte, nombre
--      firmante, fecha, IP, navegador, hash). jsonb y no otra tabla: es una
--      fotografía, no algo que se consulte por partes.
--    · `version` — 1, 2, 3… por contrato, en el orden en que se archivaron.
--    · `motivo` + `usuario_*` — por qué se dejó de usar y quién lo hizo. El
--      nombre se copia porque el usuario puede darse de baja (`set null`).
--
--  `contrato_cambios.version_firmada` liga el renglón del historial con la
--  versión que ese cambio archivó, para que la ficha diga «este cambio anuló la
--  versión firmada 1».
--
--  Solo se INSERTA, también en los permisos: el `revoke` va aquí mismo porque
--  `20260824_grants_tablas_futuras.sql` concede update y delete por omisión a
--  toda tabla nueva (ver `20261011_contrato_cambios_solo_insercion.sql`).
--
--  ═══ LO QUE NO HACE ═══════════════════════════════════════════════════════
--
--  · No toca filas existentes ni rescata historia: lo que `enviarAFirma` borró
--    antes de hoy ya no existe en ningún lado.
--  · No toca `contrato_firmas`, `contratos_arrendamiento` ni `db/schema.sql`.
--
--  Vuelta atrás: la versión anterior no lee esta tabla ni la columna nueva; un
--  contrato editado tras firmarse se le vería sin firmas, pendiente de enviar.
--
--  POSTGRESQL 14: nada posterior. Transaccional e idempotente.
-- ============================================================================

begin;

create table if not exists contrato_versiones_firmadas (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  contrato_id         uuid not null references contratos_arrendamiento(id) on delete cascade,
  version             integer not null,
  documento_congelado text not null,
  documento_hash      text not null,
  congelado_en        timestamptz,
  firmas              jsonb not null,
  motivo              text,
  usuario_id          uuid references usuarios(id) on delete set null,
  usuario_nombre      text,
  archivado_en        timestamptz not null default now(),
  constraint contrato_versiones_firmadas_version_uq unique (contrato_id, version),
  constraint contrato_versiones_firmadas_version_ck check (version > 0),
  -- Una versión «firmada» sin una sola firma no prueba nada.
  constraint contrato_versiones_firmadas_firmas_ck
    check (jsonb_typeof(firmas) = 'array' and jsonb_array_length(firmas) > 0),
  constraint contrato_versiones_firmadas_motivo_ck check (motivo is null or length(motivo) <= 500)
);

comment on table contrato_versiones_firmadas is
  'CONTRATO-FIRMADO-EDITABLE (23/10). Cada version firmada de un contrato de arrendamiento que se dejo de usar al editarlo o reenviarlo a firma: el texto exacto, su hash y la evidencia de cada firma. Solo se inserta.';

alter table contrato_cambios add column if not exists version_firmada integer;
comment on column contrato_cambios.version_firmada is
  'Version de contrato_versiones_firmadas que este cambio archivo (el contrato estaba firmado). NULL si no habia firmas.';

-- ─── Aislamiento: igual que contrato_firmas y contrato_cambios ──────────────
alter table contrato_versiones_firmadas enable row level security;
alter table contrato_versiones_firmadas force row level security;
drop policy if exists tenant_isolation on contrato_versiones_firmadas;
create policy tenant_isolation on contrato_versiones_firmadas for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke update, delete, truncate on contrato_versiones_firmadas from %I', r);
      execute format('grant select, insert on contrato_versiones_firmadas to %I', r);
    end if;
  end loop;
end $$;

commit;

-- ─── Comprobación ────────────────────────────────────────────────────────────
select 'rls_forzado' k,
       (select case when relforcerowsecurity then 'si' else 'NO' end
          from pg_class where relname = 'contrato_versiones_firmadas') v
union all
select 'versiones archivadas (nace en 0)', count(*)::text from contrato_versiones_firmadas;
