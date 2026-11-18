-- @tipo: esquema
-- ============================================================================
--  NOTIF-USUARIO · LA BANDEJA DE NOTIFICACIONES ES DE CADA PERSONA.
--  Forma aprobada por el dueño el 2026-10-21.
-- ----------------------------------------------------------------------------
--  Pedido del dueño: poder borrar las notificaciones una por una o todas de un
--  botón, y que las leídas se queden en la bandeja. Al revisarlo apareció lo
--  que de verdad faltaba: `notificaciones.leida` y `notificaciones.archivada_en`
--  son UNA fila por empresa, así que cuando un vendedor marcaba como leído o
--  vaciaba su panel, se lo marcaba o vaciaba también al Dueño.
--
--  ═══ LA TABLA ═════════════════════════════════════════════════════════════
--
--  `notificaciones_usuario`: lo que UNA persona hizo con UN aviso. La
--  notificación sigue siendo una por empresa —la crea el sistema con
--  `notificar()`, sin destinatario—; lo nuevo es el estado de cada quien:
--
--    · `leida_en`   null = sin leer para esa persona;
--    · `borrada_en` null = sigue en su bandeja. Se OCULTA, no se destruye, por
--      lo mismo que `archivada_en` el 10/08: borrar de verdad haría
--      irreversible un clic que la gente da para quitarse el punto rojo, y
--      guardar CUÁNDO deja abierta una papelera futura.
--
--  La fila solo existe si la persona hizo algo: sin fila = sin leer y en la
--  bandeja. Por eso el `check` de abajo exige al menos una de las dos fechas.
--
--  ═══ LO QUE YA HABÍA ═══════════════════════════════════════════════════════
--
--  No se toca ni se rellena nada. `notificaciones.leida` y `archivada_en` se
--  quedan como están y la aplicación las sigue LEYENDO: lo que ya se archivó
--  para todos con el «Borrar todas» de antes sigue oculto para todos, y lo ya
--  marcado leído sigue leído. Desde esta versión la aplicación ya no las
--  ESCRIBE: lo nuevo va a esta tabla.
--
--  Y el código anterior funciona con este esquema —ignora la tabla—, así que
--  volver a la versión de antes no necesita deshacer nada.
--
--  ═══ AISLAMIENTO ══════════════════════════════════════════════════════════
--
--  · `tenant_id` con la misma RLS fail-closed + FORCE que el resto.
--  · FK COMPUESTA (notificacion_id, tenant_id): una fila no puede colgar del
--    aviso de OTRA empresa aunque alguien se equivoque de id. Para eso
--    `notificaciones` necesita la única (id, tenant_id), que se añade aquí.
--  · `usuario_id` sale siempre de la SESIÓN en la aplicación, nunca del cuerpo.
--
--  ═══ POSTGRESQL 14 ════════════════════════════════════════════════════════
--  Nada posterior a la 14. Sin `-- @pg-min`.
--
--  Transaccional e idempotente.
-- ============================================================================

begin;

do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'notificaciones_id_tenant_uq'
                    and conrelid = 'notificaciones'::regclass) then
    alter table notificaciones add constraint notificaciones_id_tenant_uq unique (id, tenant_id);
  end if;
end $$;

create table if not exists notificaciones_usuario (
  tenant_id       uuid not null references tenants(id) on delete cascade,
  notificacion_id uuid not null,
  -- Se va con la persona: su bandeja no le sirve a nadie más.
  usuario_id      uuid not null references usuarios(id) on delete cascade,
  leida_en        timestamptz,
  borrada_en      timestamptz,
  primary key (notificacion_id, usuario_id),
  -- Se va con el aviso, y nunca puede apuntar al de otra empresa.
  constraint notificaciones_usuario_notif_fk
    foreign key (notificacion_id, tenant_id)
    references notificaciones (id, tenant_id) on delete cascade,
  constraint notificaciones_usuario_algo_ck
    check (leida_en is not null or borrada_en is not null)
);

-- El panel pregunta por «las de esta persona en esta empresa»: el tenant va
-- primero, como en el resto de índices de tablas con tenant.
create index if not exists idx_notif_usuario_tenant_usuario
  on notificaciones_usuario (tenant_id, usuario_id);

-- ─── Aislamiento: igual que el resto de tablas con tenant_id ────────────────
alter table notificaciones_usuario enable row level security;
alter table notificaciones_usuario force row level security;
drop policy if exists tenant_isolation on notificaciones_usuario;
create policy tenant_isolation on notificaciones_usuario for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select, insert, update, delete on notificaciones_usuario to %I', r);
    end if;
  end loop;
end $$;

commit;
