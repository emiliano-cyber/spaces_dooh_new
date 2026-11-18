-- @tipo: esquema
-- ============================================================================
--  EXT-CONTRATO · UNA CAMPAÑA NO SE EXTIENDE SIN UN CONTRATO NUEVO.
-- ----------------------------------------------------------------------------
--  APROBADA POR EL DUEÑO EL 29/10 (R3), FORMA RESTRICT. Regla del dueño del
--  2026-10-29: «Extender campaña» vuelve a ofrecerse en la ficha, pero exige
--  adjuntar EN ESE MISMO PASO el contrato firmado de la extensión; sin él, el
--  servidor la rechaza. Es ROJO R4 (cambia la fecha fin y lo que se factura) y
--  el dueño lo aprobó explícitamente.
--
--  ═══ POR QUÉ UNA TABLA Y NO LA COLUMNA QUE YA HAY ═════════════════════════
--
--  El único sitio de un contrato de cliente es `campanas.contrato_url`
--  (`20260721_campana_contrato.sql`): UNA columna, que `guardarContratoCampana`
--  sobrescribe. Guardar ahí el de la extensión borraría el contrato original.
--  `acciones` (la bitácora) es solo texto y `ordenes_compra` son OC con folio y
--  monto que llegan a finanzas: meter ahí un contrato inventaría una OC.
--
--  `campana_extensiones`: una fila por extensión, con lo que la prueba:
--
--    · `folio` — el folio con el tramo que ESTA extensión abrió (FOLIO-VENTA:
--      PR-2026-0042 → .1 → .2), para saber qué contrato cubre qué tramo.
--    · `fecha_fin_anterior` / `fecha_fin_nueva` — de dónde a dónde. El CHECK
--      exige que alargue: una «extensión» que no alarga no lleva contrato.
--    · `contrato_url` — el PDF firmado, mismo formato que `contrato_url` de la
--      campaña (archivo en base64 o URL http(s), PDF de hasta 10 MB).
--    · `usuario_*` — quién la hizo. El nombre se copia porque el usuario puede
--      darse de baja (`set null`).
--
--  ═══ RESTRICT, Y NO CASCADE ══════════════════════════════════════════════
--
--  `campana_id` es `on delete restrict` por decisión del dueño: una campaña con
--  extensiones NO se puede borrar, porque los contratos firmados no se pierden
--  nunca. Con `cascade` (lo que hace `ordenes_compra`) borrar la campaña se
--  llevaría los contratos de paso, sin que nadie lo decidiera. Borrar una
--  campaña así devolverá 409 «El registro está referenciado por otro» (23503).
--
--  Solo se INSERTA, también en los permisos: el `revoke` va aquí mismo porque
--  `20260824_grants_tablas_futuras.sql` concede update y delete por omisión a
--  toda tabla nueva (igual que `20261023_contrato_versiones_firmadas.sql`).
--
--  ═══ LO QUE NO HACE ═══════════════════════════════════════════════════════
--
--  · No toca filas existentes ni `campanas`, ni `db/schema.sql`. Las
--    extensiones de antes de hoy no tenían contrato y no se inventan.
--
--  Vuelta atrás: la versión anterior no lee esta tabla; extendería sin pedir
--  contrato y la tabla se quedaría como estaba.
--
--  POSTGRESQL 14: nada posterior. Transaccional e idempotente.
-- ============================================================================

begin;

create table if not exists campana_extensiones (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  campana_id          uuid not null references campanas(id) on delete restrict,
  folio               text not null,
  fecha_fin_anterior  date not null,
  fecha_fin_nueva     date not null,
  contrato_url        text not null,
  usuario_id          uuid references usuarios(id) on delete set null,
  usuario_nombre      text,
  creado_en           timestamptz not null default now(),
  -- Una extensión que no alarga no es una extensión (ni lleva contrato).
  constraint campana_extensiones_fechas_ck check (fecha_fin_nueva > fecha_fin_anterior),
  -- Sin contrato no hay extensión: tampoco vale la cadena vacía.
  constraint campana_extensiones_contrato_ck check (length(btrim(contrato_url)) > 0)
);

create index if not exists idx_campana_extensiones_campana on campana_extensiones (campana_id);

comment on table campana_extensiones is
  'EXT-CONTRATO (29/10). Cada extension de una campana con el contrato firmado que la respalda: folio del tramo, fechas de y hasta, el PDF y quien la hizo. Solo se inserta; campana_id on delete restrict (los contratos no se pierden).';

-- ─── Aislamiento: igual que contrato_versiones_firmadas ─────────────────────
alter table campana_extensiones enable row level security;
alter table campana_extensiones force row level security;
drop policy if exists tenant_isolation on campana_extensiones;
create policy tenant_isolation on campana_extensiones for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke update, delete, truncate on campana_extensiones from %I', r);
      execute format('grant select, insert on campana_extensiones to %I', r);
    end if;
  end loop;
end $$;

commit;

-- ─── Comprobación ────────────────────────────────────────────────────────────
select 'rls_forzado' k,
       (select case when relforcerowsecurity then 'si' else 'NO' end
          from pg_class where relname = 'campana_extensiones') v
union all
select 'extensiones (nace en 0)', count(*)::text from campana_extensiones;
