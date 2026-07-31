-- ============================================================================
-- Firma electrónica del contrato de arrendamiento desde la plataforma.
--
-- El problema que resuelve el CONGELADO:
--   El documento se REDACTA a partir de datos vivos (renta, vigencia, domicilio
--   del arrendador…). Si alguien edita la renta después de que el arrendador
--   firmó, la firma cubriría un texto distinto y nadie se enteraría. Por eso, al
--   enviar a firma se congela el texto exacto y se sella con SHA-256: lo que se
--   firma es ESE texto, no "lo que diga la base hoy".
--
--   Además la fecha de firma deja de ser "hoy" y pasa a ser la del congelado; si
--   no, el hash cambiaría solo por pasar la medianoche.
--
-- Decisión de producto (2026-07-29): editar un contrato firmado SÍ se permite,
-- pero invalida las firmas. La invalidación NO se guarda: se DERIVA comparando
-- el hash de lo firmado contra el del documento actual. Así también se detectan
-- los cambios indirectos —cambiar el domicilio del arrendador altera el texto
-- del contrato sin tocar el contrato— que un flag escrito a mano se perdería.
--
-- Alcance legal: esto es firma electrónica SIMPLE. El Código de Comercio la
-- reconoce, pero el peso probatorio lo da el expediente de evidencia que se
-- guarda aquí (quién, cuándo, desde dónde, sobre qué texto). No es e.firma del
-- SAT ni lleva constancia NOM-151.
-- ============================================================================

-- ─── Documento congelado (la versión que se firma) ──────────────────────────
alter table contratos_arrendamiento
  add column if not exists documento_congelado text,
  add column if not exists documento_hash      text,
  add column if not exists congelado_en        timestamptz;

-- ─── Firmas ─────────────────────────────────────────────────────────────────
create table if not exists contrato_firmas (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  contrato_id  uuid not null references contratos_arrendamiento(id) on delete cascade,
  -- Quién debe firmar. Dos partes y solo dos.
  parte        text not null check (parte in ('ARRENDADOR', 'ARRENDATARIO')),
  estatus      text not null default 'PENDIENTE'
                 check (estatus in ('PENDIENTE', 'FIRMADA', 'CANCELADA')),

  -- A quién se le pidió firmar (para cotejar contra lo que escriba al firmar).
  nombre_esperado text,
  correo          text,

  -- Enlace público de la parte externa. NULL en la parte interna, que firma con
  -- su sesión. Es un secreto: quien lo tiene puede firmar.
  token           text unique,
  token_expira_en timestamptz,

  -- ── Expediente de evidencia ──
  firmado_en   timestamptz,
  -- Lo que la persona escribió como su nombre al firmar. Se guarda literal, no
  -- se normaliza: es parte de la evidencia.
  nombre_firmante text,
  -- SHA-256 del texto que esta parte firmó. Si deja de coincidir con el del
  -- documento actual, la firma ya no corresponde y se muestra invalidada.
  documento_hash  text,
  ip           text,
  user_agent   text,
  -- Usuario de la plataforma, cuando la firma vino de una sesión iniciada.
  usuario_id   uuid references usuarios(id) on delete set null,

  creado_en    timestamptz not null default now()
);

-- Una firma por parte y contrato: no puede haber dos arrendadores firmando.
create unique index if not exists contrato_firma_parte_uq
  on contrato_firmas (contrato_id, parte);

create index if not exists contrato_firmas_contrato_idx on contrato_firmas (contrato_id);

-- El token se busca SIN sesión y sin tenant fijado (la RLS no aplica todavía),
-- así que necesita su propio índice.
create index if not exists contrato_firmas_token_idx on contrato_firmas (token)
  where token is not null;

-- Coherencia: una firma FIRMADA tiene que traer su evidencia completa. Sin esto
-- cabría una firma sin fecha ni hash, que no prueba nada.
alter table contrato_firmas drop constraint if exists contrato_firma_evidencia_ck;
alter table contrato_firmas add constraint contrato_firma_evidencia_ck check (
  estatus <> 'FIRMADA' or (
    firmado_en is not null and nombre_firmante is not null and documento_hash is not null
  )
);

-- ─── Aislamiento por inquilino (fail-closed + FORCE, igual que el módulo) ───
alter table contrato_firmas enable row level security;
alter table contrato_firmas force  row level security;
drop policy if exists tenant_isolation on contrato_firmas;
create policy tenant_isolation on contrato_firmas
  using      (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid)
  with check (tenant_id = (nullif(current_setting('app.tenant_id', true), ''))::uuid);

-- Mismos permisos que el resto del módulo, sin escribir el nombre del rol a
-- mano (local: spaces_app; producción: spaces_user).
do $$
declare r record;
begin
  for r in
    select distinct grantee from information_schema.role_table_grants
     where table_name = 'contratos_arrendamiento'
       and grantee in (select rolname from pg_roles where rolcanlogin and not rolsuper)
  loop
    execute format('grant select, insert, update, delete on contrato_firmas to %I', r.grantee);
  end loop;
end $$;

-- ─── Verificación ───────────────────────────────────────────────────────────
select 'rls_forzado',
       (select case when relforcerowsecurity then 'si' else 'NO' end
          from pg_class where relname = 'contrato_firmas')
union all
select 'politicas', (select count(*)::text from pg_policy where polrelid = 'contrato_firmas'::regclass);

-- ─── Resolución de tenant para la ruta PÚBLICA de firma ─────────────────────
-- Mismo patrón que portal_tenant_por_token: el enlace de firma se abre SIN
-- sesión, así que no hay `app.tenant_id` fijado y la RLS fail-closed de
-- contrato_firmas devolvería cero filas. Esta función SECURITY DEFINER resuelve
-- a qué inquilino pertenece el token; a partir de ahí todo corre bajo ese tenant.
create or replace function firma_tenant_por_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tenant_id from contrato_firmas
   where token is not null and token = p_token
   limit 1;
$$;

do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant execute on function firma_tenant_por_token(text) to %I', r);
    end if;
  end loop;
end $$;

revoke execute on function firma_tenant_por_token(text) from public;
