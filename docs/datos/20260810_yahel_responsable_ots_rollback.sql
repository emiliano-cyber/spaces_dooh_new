-- ===========================================================================
--  ROLLBACK de 20260810_yahel_responsable_ots.sql
--
--  Devuelve las dos OT a «sin responsable» y desactiva a yahel.
--
--  ── POR QUE NO SE BORRA EL USUARIO ────────────────────────────────────────
--  Se pone `activo = false` en vez de `delete`. Dos motivos:
--
--   · `acciones.usuario_id` es `on delete set null`, asi que borrarlo dejaria
--     sus entradas de bitacora a nombre de nadie. La bitacora es append-only y
--     se usa como prueba: perder la atribucion es peor que dejar una fila.
--   · Si ya entro con Google, tiene una fila en `identidades_externas` con
--     `on delete cascade`. Borrar al usuario se la lleva, y volver a crearlo
--     obligaria a rehacer la vinculacion.
--
--  Un usuario inactivo no puede entrar (`usuarioActual()` devuelve null si
--  `!activo`), que es lo que se quiere deshacer. Si de verdad hace falta
--  eliminarlo, hay un `delete` comentado al final — leelo antes de usarlo.
--
--  OJO CON EL ORDEN: primero se sueltan las OT y DESPUES se desactiva. Al
--  reves da igual funcionalmente, pero deja un intervalo en el que hay trabajo
--  atribuido a alguien que ya no puede entrar a explicarlo.
--
--  Contrastar con la salida del PASO 0.2 del script antes de usar esto: si
--  alguna de las dos OT ya tenia responsable ANTES, este rollback se lo quita.
--  El script solo tocaba las que estaban en null, asi que no deberia pasar —
--  pero el `where` de abajo lo acota a yahel por si acaso.
-- ===========================================================================

begin;

select set_config('app.tenant_id', '4cdba4aa-444d-4238-a983-959d18b1a2bf', false);

-- ─── 1. Soltar las OT ──────────────────────────────────────────────────────
-- Acotado a yahel: si entretanto alguien asigno otra OT a otra persona, no se
-- toca.
update ordenes_trabajo
   set asignado_a = null
 where tenant_id = '4cdba4aa-444d-4238-a983-959d18b1a2bf'
   and asignado_a = (select id from usuarios where lower(email) = 'eyro0303@gmail.com');

-- ─── 2. Desactivar al usuario ──────────────────────────────────────────────
update usuarios
   set activo = false
 where lower(email) = 'eyro0303@gmail.com'
   and tenant_id = '4cdba4aa-444d-4238-a983-959d18b1a2bf';

-- ─── 3. Bitacora ───────────────────────────────────────────────────────────
-- No se borra la entrada que escribio el script: la bitacora es append-only y
-- una entrada de auditoria no se elimina porque se deshaga lo que registro. Se
-- deja, y este rollback anade la suya.
insert into acciones (accion, entidad, usuario_nombre, tenant_id)
values ('Rollback: yahel desactivado y las 2 OT vuelven a quedar sin responsable',
        'Deshace 20260810_yahel_responsable_ots.sql',
        'Sistema',
        '4cdba4aa-444d-4238-a983-959d18b1a2bf');

-- ─── 4. Comprobacion ───────────────────────────────────────────────────────
do $$
declare v_n int;
begin
  select count(*) into v_n
    from ordenes_trabajo
   where tenant_id = '4cdba4aa-444d-4238-a983-959d18b1a2bf' and asignado_a is null;
  if v_n <> 2 then
    raise exception 'Se esperaban 2 OT sin responsable y hay %.', v_n;
  end if;
  if exists (
    select 1 from usuarios
     where lower(email) = 'eyro0303@gmail.com' and activo
  ) then
    raise exception 'yahel sigue activo.';
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
--  SOLO SI DE VERDAD HAY QUE ELIMINARLO (no es lo recomendado, ver cabecera):
--
--    begin;
--      select set_config('app.tenant_id','4cdba4aa-444d-4238-a983-959d18b1a2bf',false);
--      -- Suelta primero las OT o el `on delete set null` las dejara en null
--      -- igualmente, pero sin dejar rastro de por que.
--      update ordenes_trabajo set asignado_a = null
--       where asignado_a = (select id from usuarios where lower(email)='eyro0303@gmail.com');
--      delete from usuarios where lower(email) = 'eyro0303@gmail.com';
--    commit;
--
--  Esto se lleva por cascada su vinculo de Google (`identidades_externas`) y
--  sus sesiones, y deja sus entradas de bitacora con `usuario_id = null`
--  conservando `usuario_nombre`.
-- ---------------------------------------------------------------------------
