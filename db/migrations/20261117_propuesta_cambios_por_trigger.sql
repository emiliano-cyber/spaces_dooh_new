-- @tipo: esquema
-- ============================================================================
--  ADR 0051 · Fase 3 — el historial de cada propuesta, campo por campo, lo
--  escribe LA BASE.
-- ----------------------------------------------------------------------------
--  Decisión del dueño el 2026-11-17 (ROJO R3 + R4), en lugar de lo que decía
--  §4 del ADR («se escribe en `propuestas-repo.ts`, en cada función»).
--
--  POR QUÉ UN TRIGGER Y NO UNA LLAMADA EN CADA FUNCIÓN. Cuatro de las funciones
--  que cambian una propuesta —editar, aprobar un sitio, cambiar el estatus y
--  ponerle cliente— no usan transacción: cada `q()` se guarda sola. Escribir el
--  historial «en la misma transacción» obligaba a reescribirlas, incluida la de
--  aprobar, que congela el dinero. Y aun reescritas, la próxima ruta que alguien
--  agregue podría olvidarse de escribir: un hueco silencioso. El trigger corre
--  DENTRO de la sentencia que cambia la fila, así que es la misma transacción por
--  construcción, y ninguna ruta —tampoco las de cupón y paquete, que viven en
--  otros archivos— puede saltárselo.
--
--  QUIÉN LO HIZO. La base no conoce la sesión: `lib/server/db.ts` fija, junto
--  con `app.tenant_id`, `app.usuario_id` y `app.usuario_nombre` de la sesión
--  (TRANSACTION-LOCAL, como el tenant; nunca del cuerpo de la petición). Sin
--  ellos el origen es SISTEMA. La aceptación por la liga pública se reconoce
--  por la fila misma (`aceptado_en` pasa de null a algo): origen CLIENTE, con el
--  nombre que el cliente escribió.
--
--  QUÉ COLUMNAS. Todas, comparando `to_jsonb(old)` con `to_jsonb(new)`, MENOS
--  las que no son una decisión de nadie o no deben repetirse aquí: ids, folio,
--  token de la liga, fechas de creación y de decisión (salen del estatus),
--  versión (va en su propia columna), el snapshot congelado (es una foto de lo
--  demás) y los datos de quien aceptó (van en la fila ACEPTAR). Una columna que
--  se agregue mañana queda registrada sin tocar esta migración.
--
--  LO QUE NO SE REGISTRA, A PROPÓSITO:
--   · los sitios que se insertan junto con la propuesta: el alta es UNA fila
--     CREAR, no una por pantalla (se reconoce porque la propuesta se creó en
--     esta misma transacción: `creado_en = now()`);
--   · los sitios que se van con el borrado de la propuesta: el borrado es UNA
--     fila BORRAR.
--
--  BORRAR UNA ORGANIZACIÓN. El historial solo crece, pero si la organización
--  entera se borra (hoy solo lo hacen pruebas), su historial se va con ella:
--  `crm_solo_crece()` deja pasar el DELETE cuando el tenant ya no existe, y los
--  triggers de aquí no escriben para un tenant que se está borrando. Sin eso,
--  borrar una organización con propuestas fallaría.
--
--  PostgreSQL 14. Idempotente (`create or replace`, `drop trigger if exists`).
-- ============================================================================

begin;

-- ─── Solo crece… salvo que se borre la organización entera ──────────────────
create or replace function crm_solo_crece()
  returns trigger
  language plpgsql
as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from tenants where id = old.tenant_id) then
    return old;
  end if;
  raise exception 'historial append-only: % no permitido sobre %', tg_op, tg_table_name
    using errcode = 'restrict_violation';
end;
$$;

-- ─── Quién: de la sesión, o SISTEMA ──────────────────────────────────────────
create or replace function crm_autor_id() returns uuid
  language sql stable
as $$ select nullif(current_setting('app.usuario_id', true), '')::uuid $$;

create or replace function crm_autor_nombre() returns text
  language sql stable
as $$ select left(nullif(current_setting('app.usuario_nombre', true), ''), 200) $$;

-- ─── propuestas ──────────────────────────────────────────────────────────────
create or replace function propuestas_registrar_cambio()
  returns trigger
  language plpgsql
as $$
declare
  viejo   jsonb;
  nuevo   jsonb;
  k       text;
  base    text;   -- la acción de la sentencia: ACEPTAR, ENVIAR, ESTATUS o EDITAR
  accion  text;
  origen  text;
  quien   uuid := crm_autor_id();
  nombre  text := crm_autor_nombre();
begin
  if tg_op = 'INSERT' then
    insert into propuesta_cambios (tenant_id, propuesta_id, folio, version, usuario_id, usuario_nombre,
                                   origen, accion, valor_nuevo)
    values (new.tenant_id, new.id, new.folio, new.version, quien, nombre,
            case when quien is null then 'SISTEMA' else 'APP' end, 'CREAR',
            jsonb_build_object('nombre', new.nombre, 'cliente_id', new.cliente_id, 'agencia_id', new.agencia_id,
                               'oportunidad_id', new.oportunidad_id));
    return new;
  end if;

  if tg_op = 'DELETE' then
    if not exists (select 1 from tenants where id = old.tenant_id) then
      return old;
    end if;
    insert into propuesta_cambios (tenant_id, propuesta_id, folio, version, usuario_id, usuario_nombre,
                                   origen, accion, valor_anterior)
    values (old.tenant_id, old.id, old.folio, old.version, quien, nombre,
            case when quien is null then 'SISTEMA' else 'APP' end, 'BORRAR',
            jsonb_build_object('nombre', old.nombre, 'estatus', old.estatus));
    return old;
  end if;

  -- UPDATE
  viejo := to_jsonb(old);
  nuevo := to_jsonb(new);
  if old.aceptado_en is null and new.aceptado_en is not null then
    base := 'ACEPTAR';
    origen := 'CLIENTE';
    quien := null;
    nombre := left(new.aceptado_por, 200);
  else
    origen := case when quien is null then 'SISTEMA' else 'APP' end;
    base := case
      when old.estatus is distinct from new.estatus and new.estatus = 'ENVIADA' then 'ENVIAR'
      when old.estatus is distinct from new.estatus then 'ESTATUS'
      else 'EDITAR' end;
  end if;

  for k in
    select key from jsonb_object_keys(nuevo) as key
     where key not in ('id','tenant_id','folio','token_publico','creado_en','version','aprobada_en',
                       'rechazada_en','snapshot_economico','snapshot_en','aceptado_en','aceptado_por',
                       'aceptado_ip','actualizado_en')
       and (nuevo -> key) is distinct from (viejo -> key)
     order by key
  loop
    accion := case
      when base = 'ACEPTAR' then 'ACEPTAR'
      when k like 'codigo\_%' then 'CODIGO'
      when k like 'paquete\_%' then 'PAQUETE'
      when k = 'oportunidad_id' then 'LIGAR'
      else base end;
    insert into propuesta_cambios (tenant_id, propuesta_id, folio, version, usuario_id, usuario_nombre,
                                   origen, accion, campo, valor_anterior, valor_nuevo)
    values (new.tenant_id, new.id, new.folio, new.version, quien, nombre, origen, accion, k,
            viejo -> k, nuevo -> k);
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_propuestas_registrar_cambio on propuestas;
create trigger trg_propuestas_registrar_cambio
  after insert or update or delete on propuestas
  for each row execute function propuestas_registrar_cambio();

-- ─── propuesta_items: los sitios ─────────────────────────────────────────────
create or replace function propuesta_items_registrar_cambio()
  returns trigger
  language plpgsql
as $$
declare
  fila    propuesta_items;
  p       record;
  viejo   jsonb;
  nuevo   jsonb;
  k       text;
  quien   uuid := crm_autor_id();
  nombre  text := crm_autor_nombre();
  origen  text;
begin
  if tg_op = 'DELETE' then fila := old; else fila := new; end if;
  select folio, version, creado_en into p from propuestas where id = fila.propuesta_id;
  -- Sin propuesta: se está borrando con ella (cascada), y eso ya es UNA fila
  -- BORRAR. Tampoco se escribe si la organización se está borrando.
  if not found or not exists (select 1 from tenants where id = fila.tenant_id) then
    return fila;
  end if;
  origen := case when quien is null then 'SISTEMA' else 'APP' end;

  if tg_op = 'INSERT' then
    -- Los sitios del alta van dentro de la fila CREAR: la propuesta nació en esta
    -- misma transacción (`now()` es la hora de inicio de la transacción).
    if p.creado_en = now() then
      return new;
    end if;
    insert into propuesta_cambios (tenant_id, propuesta_id, folio, version, usuario_id, usuario_nombre,
                                   origen, accion, item_id, valor_nuevo)
    values (new.tenant_id, new.propuesta_id, p.folio, p.version, quien, nombre, origen, 'AGREGAR_SITIO', new.id,
            jsonb_build_object('sitio_id', new.sitio_id, 'fecha_inicio', new.fecha_inicio,
                               'fecha_fin', new.fecha_fin, 'precio', new.precio));
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into propuesta_cambios (tenant_id, propuesta_id, folio, version, usuario_id, usuario_nombre,
                                   origen, accion, item_id, valor_anterior)
    values (old.tenant_id, old.propuesta_id, p.folio, p.version, quien, nombre, origen, 'QUITAR_SITIO', old.id,
            jsonb_build_object('sitio_id', old.sitio_id, 'fecha_inicio', old.fecha_inicio,
                               'fecha_fin', old.fecha_fin, 'precio', old.precio));
    return old;
  end if;

  viejo := to_jsonb(old);
  nuevo := to_jsonb(new);
  for k in
    select key from jsonb_object_keys(nuevo) as key
     where key not in ('id','tenant_id','propuesta_id','creado_en','actualizado_en')
       and (nuevo -> key) is distinct from (viejo -> key)
     order by key
  loop
    insert into propuesta_cambios (tenant_id, propuesta_id, folio, version, usuario_id, usuario_nombre,
                                   origen, accion, campo, item_id, valor_anterior, valor_nuevo)
    values (new.tenant_id, new.propuesta_id, p.folio, p.version, quien, nombre, origen,
            case when k = 'aprobado' then 'APROBAR_SITIO' else 'EDITAR' end, k, new.id, viejo -> k, nuevo -> k);
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_propuesta_items_registrar_cambio on propuesta_items;
create trigger trg_propuesta_items_registrar_cambio
  after insert or update or delete on propuesta_items
  for each row execute function propuesta_items_registrar_cambio();

comment on function propuestas_registrar_cambio() is
  'ADR 0051 Fase 3. Escribe propuesta_cambios campo por campo en la misma sentencia que cambia la propuesta. El autor sale de app.usuario_id/app.usuario_nombre (los fija lib/server/db.ts desde la sesión).';

commit;

-- ─── Comprobación ────────────────────────────────────────────────────────────
select 'los dos triggers del historial (2)' k, count(*)::text v
  from pg_trigger
 where tgname in ('trg_propuestas_registrar_cambio','trg_propuesta_items_registrar_cambio')
   and not tgisinternal;
