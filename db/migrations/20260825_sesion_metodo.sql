-- ============================================================================
--  La sesión registra CÓMO se abrió: con contraseña o con Google.
-- ----------------------------------------------------------------------------
--  Lo pide el **ADR 0018**, y sin esto su condición central no se puede
--  evaluar. Hoy `crearSesion(usuarioId)` (`lib/server/auth.ts:92-101`) se llama
--  **idéntica** desde `api/auth/login` y desde `api/auth/google/callback`, y
--  `sesiones` guarda solo `token`, `usuario_id` y `expira_en`: una vez abierta,
--  **no queda rastro de por dónde entró nadie**.
--
--  ─── Por qué `default 'password'` y no `'google'` ni null ──────────────────
--
--  Las sesiones que ya existen se marcan como `password`. Es deliberado y es la
--  opción segura: de ellas **no se puede afirmar** que vinieran de Google, y la
--  excepción del ADR 0018 solo se abre para las que sí. Marcarlas `google`
--  regalaría la excepción a sesiones vivas de origen desconocido; dejarlas null
--  obligaría a decidir el caso ambiguo en el código, que es donde se olvida.
--
--  Consecuencia práctica y aceptada: quien tenga sesión abierta ahora mismo
--  tendrá que volver a entrar con Google para poder fijar su contraseña. Es una
--  molestia de una vez y del lado correcto.
--
--  ─── Por qué la función se REESCRIBE aquí ─────────────────────────────────
--
--  `usuarios` es fail-closed + FORCE, así que la app no lee `sesiones`
--  directamente: resuelve por `auth_usuario_por_sesion()`, SECURITY DEFINER
--  (`20260804_reautenticacion_individual.sql:70-87`). Si el método no sale por
--  ahí, no llega al código. Se añade una columna al `returns table`, y por eso
--  hace falta `drop` antes del `create`: PostgreSQL no deja cambiar el tipo de
--  retorno con `create or replace`.
--
--  El `drop` se lleva los GRANT por delante, así que se rehacen abajo — mismo
--  patrón y mismos dos roles que la migración del 04/08.
--
--  Idempotente y transaccional: se puede volver a aplicar sin efecto.
-- ============================================================================

begin;

alter table sesiones
  add column if not exists metodo text not null default 'password';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sesiones_metodo_ck'
  ) then
    alter table sesiones
      add constraint sesiones_metodo_ck check (metodo in ('password', 'google'));
  end if;
end $$;

comment on column sesiones.metodo is
  'Cómo se abrió la sesión. Lo consume el ADR 0018 para permitir fijar la '
  'primera contraseña sin teclear la anterior. Ver 20260825_sesion_metodo.sql.';

-- La función tiene que devolverlo o el código no lo ve.
drop function if exists auth_usuario_por_sesion(text);
create function auth_usuario_por_sesion(p_token text)
returns table (
  id uuid, nombre text, email text, cargo text,
  rol text, activo boolean, tenant_id uuid, debe_cambiar_password boolean,
  metodo text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.nombre, u.email, u.cargo, u.rol::text, u.activo, u.tenant_id,
         u.debe_cambiar_password, s.metodo
    from sesiones s
    join usuarios u on u.id = s.usuario_id
   where s.token = p_token
     and s.expira_en > now()
   limit 1;
$$;

-- El DROP se llevó los permisos. Se rehacen sobre los roles que existan, igual
-- que en `20260804_reautenticacion_individual.sql:91-98`.
do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant execute on function auth_usuario_por_sesion(text) to %I', r);
    end if;
  end loop;
end $$;

commit;
