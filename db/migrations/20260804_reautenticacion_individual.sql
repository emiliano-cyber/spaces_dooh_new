-- ============================================================================
-- ADR 0009 · Reautenticación individual en vez de contraseña compartida.
-- Cierra el hallazgo A7 de la auditoría QA del 04/08/2026.
--
-- Qué cambia y por qué:
--
--  1. `tenants.cambios_password_hash` (una contraseña que TODO el equipo teclea)
--     se sustituye por `tenants.exigir_reautenticacion` (booleano). A partir de
--     aquí cada quien se reautentica con SU PROPIA contraseña de login, así que
--     no hay ningún secreto de tenant que guardar. Un secreto compartido no
--     prueba identidad: la bitácora decía «Ana facturó» cuando lo verificado era
--     «alguien que conoce el secreto del equipo facturó».
--
--     La migración conserva el COMPORTAMIENTO de cada tenant: donde había hash
--     el control estaba encendido → true; donde era null estaba apagado → false.
--     Así nadie se encuentra el candado puesto (ni quitado) por sorpresa.
--
--  2. `usuarios.debe_cambiar_password` — lo activa el restablecimiento de
--     terceros. Mientras esté en true el login deja entrar SOLO a cambiar la
--     contraseña. Sin esto, la temporal que ve el administrador seguiría siendo
--     válida indefinidamente y él podría entrar como esa persona cuando
--     quisiera.
--
-- El hash compartido se DESCARTA (no se archiva): guardar el bcrypt de un
-- secreto retirado es conservar un riesgo sin ninguna utilidad. Revertir el ADR
-- significa fijar una contraseña nueva, no recuperar la vieja — está dicho en
-- «Cómo revertir» del propio ADR.
--
-- Aditivo salvo por el DROP COLUMN final, que es el objetivo del cambio.
-- Idempotente: se puede correr dos veces sin efecto distinto.
-- ============================================================================
begin;

alter table tenants  add column if not exists exigir_reautenticacion boolean not null default false;
alter table usuarios add column if not exists debe_cambiar_password  boolean not null default false;

-- Traspaso del estado: hash presente = control encendido. Se hace ANTES de
-- soltar la columna y solo si todavía existe, para que repetir la migración no
-- pise el valor que un Dueño haya cambiado a mano después.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'tenants' and column_name = 'cambios_password_hash'
  ) then
    execute 'update tenants set exigir_reautenticacion = (cambios_password_hash is not null)';
    execute 'alter table tenants drop column cambios_password_hash';
  end if;
end $$;

-- Todos los desbloqueos vivos se cierran: fueron concedidos por una contraseña
-- que ya no existe, así que dejarlos correr sería honrar una prueba retirada.
update sesiones set desbloqueo_expira_en = null where desbloqueo_expira_en is not null;

comment on column tenants.exigir_reautenticacion is
  'Si true, los cambios sensibles exigen que el usuario reintroduzca SU propia contraseña (ADR 0009). Sin exención por rol.';
comment on column usuarios.debe_cambiar_password is
  'True tras un restablecimiento por un administrador: el login solo deja cambiar la contraseña hasta que se cambie.';

-- `auth_usuario_por_sesion` devuelve una columna más: la bandera de cambio
-- obligatorio. Se resuelve en la MISMA consulta que ya hace cada petición, en
-- vez de añadir un viaje extra a la base en `exigir()` — que corre en todas las
-- rutas y no debe pagar una consulta más por esto.
--
-- Hay que soltarla y recrearla: `create or replace` no puede cambiar el tipo de
-- retorno de una función que devuelve `table(...)`. `usuarios` es fail-closed +
-- FORCE, así que esta función SECURITY DEFINER sigue siendo la única vía por la
-- que la app resuelve una sesión; el GRANT se rehace abajo porque el DROP se
-- lleva los permisos por delante.
drop function if exists auth_usuario_por_sesion(text);
create function auth_usuario_por_sesion(p_token text)
returns table (
  id uuid, nombre text, email text, cargo text,
  rol text, activo boolean, tenant_id uuid, debe_cambiar_password boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.nombre, u.email, u.cargo, u.rol::text, u.activo, u.tenant_id,
         u.debe_cambiar_password
    from sesiones s
    join usuarios u on u.id = s.usuario_id
   where s.token = p_token
     and s.expira_en > now()
   limit 1;
$$;

do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant execute on function auth_usuario_por_sesion(text) to %I', r);
    end if;
  end loop;
end $$;
revoke execute on function auth_usuario_por_sesion(text) from public;

commit;

-- Verificación
select 'tenants.exigir_reautenticacion' k, count(*)::text v from information_schema.columns
  where table_name='tenants' and column_name='exigir_reautenticacion'
union all
select 'usuarios.debe_cambiar_password', count(*)::text from information_schema.columns
  where table_name='usuarios' and column_name='debe_cambiar_password'
union all
select 'cambios_password_hash (debe ser 0)', count(*)::text from information_schema.columns
  where table_name='tenants' and column_name='cambios_password_hash'
union all
select 'tenants con reautenticacion exigida', count(*)::text from tenants where exigir_reautenticacion;
