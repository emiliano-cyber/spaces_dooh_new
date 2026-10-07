-- @tipo: esquema
-- ============================================================================
--  CONTRATO-CAMBIOS · QUIÉN PROPUSO CADA CAMBIO A UN CONTRATO ANTES DE FIRMARLO.
-- ----------------------------------------------------------------------------
--  Un contrato de arrendamiento se negocia antes de firmarse: el arrendador
--  pide otra renta, nosotros otra fecha. Hasta hoy la edición sobrescribía la
--  fila y solo dejaba en la bitácora «Editó contrato» con el folio: ni qué
--  cambió, ni de cuánto a cuánto, ni quién lo había pedido. Lo pidió el dueño
--  el 07/10.
--
--  ═══ LA TABLA ═════════════════════════════════════════════════════════════
--
--  `contrato_cambios`: un renglón por edición que de verdad cambió algo.
--
--    · `propuesto_por` — la PARTE que pidió el cambio: el ARRENDADOR (el dueño
--      del espacio) o el ARRENDATARIO (nosotros). Lo elige quien captura. NULL
--      en los cambios que no son negociación —completar un contrato INCOMPLETO
--      o asignar la razón social que paga—, que no tienen contraparte.
--    · `usuario_id` + `usuario_nombre` — QUIÉN lo capturó, de la sesión y
--      nunca del cuerpo. El nombre se copia porque el usuario puede darse de
--      baja (`set null`) y el historial tiene que seguir diciendo quién fue.
--    · `cambios` — lista de {campo, etiqueta, antes, despues} ya legibles: los
--      ids van con el NOMBRE de ese momento y el PDF solo como «había / se
--      reemplazó» (`lib/contrato-cambios.ts`).
--    · `envio_anulado` — el contrato ya se había enviado a firma y este cambio
--      anuló ese envío: el enlace del arrendador deja de servir y hay que
--      volver a enviarlo con el texto nuevo.
--
--  Solo se INSERTA: la aplicación no tiene ruta que edite ni borre un renglón.
--  Si se borra el contrato, su historial se va con él (`cascade`), igual que
--  `contrato_firmas`.
--
--  ═══ LO QUE NO HACE ═══════════════════════════════════════════════════════
--
--  · No cambia ninguna fila existente ni rescata historia: antes de hoy no hay
--    de dónde sacar quién propuso qué, y no se inventa.
--  · No toca `contratos_arrendamiento`, `contrato_firmas` ni `db/schema.sql`.
--
--  POSTGRESQL 14: nada posterior. Transaccional e idempotente.
-- ============================================================================

begin;

create table if not exists contrato_cambios (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  contrato_id    uuid not null references contratos_arrendamiento(id) on delete cascade,
  propuesto_por  text,
  motivo         text,
  usuario_id     uuid references usuarios(id) on delete set null,
  usuario_nombre text not null,
  cambios        jsonb not null,
  envio_anulado  boolean not null default false,
  creado_en      timestamptz not null default now(),
  constraint contrato_cambios_parte_ck
    check (propuesto_por is null or propuesto_por in ('ARRENDADOR', 'ARRENDATARIO')),
  -- Mismo tope que pide el formulario; la base es la red si otra ruta escribe.
  constraint contrato_cambios_motivo_ck check (motivo is null or length(motivo) <= 500),
  -- Un renglón sin cambios no es historia: es ruido.
  constraint contrato_cambios_lista_ck
    check (jsonb_typeof(cambios) = 'array' and jsonb_array_length(cambios) > 0)
);

-- Lo único que se pregunta: «los cambios de este contrato, del más nuevo al
-- más viejo».
create index if not exists idx_contrato_cambios_contrato
  on contrato_cambios (contrato_id, creado_en desc);

comment on table contrato_cambios is
  'CONTRATO-CAMBIOS (07/10). Cada edicion de un contrato de arrendamiento: que cambio (antes/despues legibles), que parte lo propuso y quien lo capturo. Solo se inserta.';
comment on column contrato_cambios.propuesto_por is
  'ARRENDADOR o ARRENDATARIO. NULL cuando no es negociacion (completar un contrato INCOMPLETO, asignar la razon social que paga).';
comment on column contrato_cambios.envio_anulado is
  'El contrato estaba enviado a firma y este cambio anulo el envio: el enlace del arrendador deja de servir.';

-- ─── Aislamiento: igual que el resto de tablas con tenant_id ────────────────
alter table contrato_cambios enable row level security;
alter table contrato_cambios force row level security;
drop policy if exists tenant_isolation on contrato_cambios;
create policy tenant_isolation on contrato_cambios for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      -- Sin UPDATE ni DELETE: el historial no se reescribe. El borrado en
      -- cascada desde el contrato no necesita el permiso.
      execute format('grant select, insert on contrato_cambios to %I', r);
    end if;
  end loop;
end $$;

commit;
