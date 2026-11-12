-- @tipo: esquema
-- ============================================================================
--  AVISOS-CANAL · LOS AVISOS TAMBIEN POR CORREO, Y WHATSAPP SEMBRADO.
--  Aprobada por el dueño el 2026-11-12 (zona ROJA R3).
-- ----------------------------------------------------------------------------
--  Pedido del dueño: «hacer los avisos por correo y dejar sembrada la opción de
--  envío por WhatsApp; lo de olvidé contraseña, solo correo». Hasta hoy los
--  avisos (`notificar()`: propuestas, campañas, ODC, facturas, pagos, cobranza
--  y OT) vivían solo en la campana de la aplicación.
--
--  ═══ LA TABLA ═════════════════════════════════════════════════════════════
--
--  `avisos_usuario`: una fila = «esta persona quiere este tipo de aviso por
--  este canal». La fila EXISTE o no existe; no hay columna «activo».
--
--  · Sin fila = no se le manda. Así, al aplicar la migración NADIE empieza a
--    recibir correos que no pidió: el comportamiento es exactamente el de
--    antes hasta que cada quien lo encienda en Mi cuenta → Avisos.
--  · `tipo` es el `notificaciones.tipo` que escribe `notificar()`
--    (PROPUESTA, CAMPANA, ODC, FACTURA, PAGO, COBRANZA, OT). SIN check: un tipo
--    nuevo no debe exigir migración. La aplicación solo acepta los de
--    `TIPOS_AVISO` (`lib/avisos.ts`).
--  · `canal` SÍ lleva check ('correo', 'whatsapp'): un canal nuevo es una
--    decisión, no un dato, y tiene que pasar por aquí.
--
--  ═══ EL TELÉFONO ══════════════════════════════════════════════════════════
--
--  `usuarios.telefono_whatsapp`, en formato internacional E.164 (+52…), que es
--  el único que acepta la API de WhatsApp de Meta. null = no lo dio. Hoy NO SE
--  USA para enviar nada: WhatsApp está sembrado, no encendido.
--
--  ═══ LO QUE NO TOCA ═══════════════════════════════════════════════════════
--
--  · Recuperar contraseña ni invitaciones: van siempre por correo, a la
--    dirección de la cuenta, y no consultan esta tabla. Ni pueden: un enlace
--    para entrar a la cuenta no se manda a un canal que la persona eligió para
--    enterarse de una factura.
--  · El correo diario de contratos (`/api/recordatorios`) sigue yendo a los
--    Dueños como hasta hoy.
--  · `auth_usuario_por_sesion()` ni `auth_usuario_por_email()`: cambiar su
--    `returns table` rompe la reaplicación de `20260720_hard1_usuarios_rls.sql`
--    (ver la cabecera de `20260907_solo_google.sql`).
--
--  ═══ AISLAMIENTO ══════════════════════════════════════════════════════════
--
--  · `tenant_id` con la misma RLS fail-closed + FORCE que el resto.
--  · `usuario_id` sale siempre de la SESIÓN en la aplicación, nunca del cuerpo.
--  · Se va con la persona (`on delete cascade`): sus preferencias no le sirven
--    a nadie más, y borrar usuarios es borrado real desde el 09/11.
--  · `usuarios` ya es fail-closed + FORCE; la columna nueva hereda su RLS.
--
--  ═══ POSTGRESQL 14 ════════════════════════════════════════════════════════
--  Nada posterior a la 14. Sin `-- @pg-min`.
--
--  Transaccional e idempotente: se puede correr dos veces.
-- ============================================================================

begin;

alter table usuarios
  add column if not exists telefono_whatsapp text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'usuarios_telefono_whatsapp_e164'
       and conrelid = 'usuarios'::regclass
  ) then
    alter table usuarios
      add constraint usuarios_telefono_whatsapp_e164
      check (telefono_whatsapp is null or telefono_whatsapp ~ '^\+[1-9][0-9]{7,14}$');
  end if;
end $$;

comment on column usuarios.telefono_whatsapp is
  'Teléfono para avisos por WhatsApp, en E.164 (+52…). null = no lo dio. '
  'Sembrado el 12/11: todavía no se envía nada por WhatsApp. Nunca se usa para '
  'recuperar la contraseña, que va solo por correo.';

create table if not exists avisos_usuario (
  tenant_id  uuid not null references tenants(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  tipo       text not null,
  canal      text not null,
  creado_en  timestamptz not null default now(),
  primary key (usuario_id, tipo, canal),
  constraint avisos_usuario_canal_ck check (canal in ('correo', 'whatsapp')),
  constraint avisos_usuario_tipo_ck  check (length(tipo) between 1 and 40)
);

-- `notificar()` pregunta «quién quiere ESTE tipo por ESTE canal en esta
-- empresa»: el tenant va primero, como en el resto de índices con tenant.
create index if not exists idx_avisos_usuario_tenant_tipo
  on avisos_usuario (tenant_id, tipo, canal);

-- ─── Aislamiento: igual que el resto de tablas con tenant_id ────────────────
alter table avisos_usuario enable row level security;
alter table avisos_usuario force row level security;
drop policy if exists tenant_isolation on avisos_usuario;
create policy tenant_isolation on avisos_usuario for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select, insert, update, delete on avisos_usuario to %I', r);
    end if;
  end loop;
end $$;

commit;
