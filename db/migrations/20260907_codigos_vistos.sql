-- ============================================================================
-- `usuarios.codigos_vistos_en` — cuándo el Dueño vio sus códigos.
-- (ADR 0028 · B2 del Plan_Acceso_Duenos)
--
-- ── Qué sujeta ─────────────────────────────────────────────────────────────
-- Los códigos de recuperación (`20260907_codigos_recuperacion.sql`) son la
-- única puerta del Dueño el día que pierda su cuenta de Google. Pero solo
-- sirven si los TIENE: generarlos y no enseñárselos, o enseñárselos y dejarle
-- navegar sin confirmar que los guardó, es tener la puerta y perder la llave.
--
-- `null` = todavía no los ha visto. Con eso `exigir()` cierra la aplicación
-- igual que hace con `debe_cambiar_password` (ADR 0009), y por la misma razón:
-- hay estados en los que dejar al usuario seguir es peor que cortarle.
--
-- ── Por qué una FECHA y no un booleano ─────────────────────────────────────
-- Un booleano contesta «sí» y nada más. La fecha contesta además CUÁNDO, y eso
-- es lo que permite responder «¿desde cuándo tiene este Dueño sus códigos?» el
-- día que haya una disputa sobre quién pudo entrar a esa instancia. Cuesta lo
-- mismo.
--
-- ── Y por qué NO se rellena para los usuarios que ya existen ───────────────
-- Se podría poner `now()` a todos y evitar que a alguien le salga la pantalla.
-- No se hace: sería afirmar que vieron unos códigos que nadie les enseñó. La
-- columna nace en `null` para todos, que es la verdad — y no encierra a nadie,
-- porque el guard solo mira a quien entró con Google, y hoy nadie entra así.
--
-- Transaccional. Idempotente.
-- ============================================================================
begin;

alter table usuarios
  add column if not exists codigos_vistos_en timestamptz;

comment on column usuarios.codigos_vistos_en is
  'Cuando el usuario vio y CONFIRMO sus codigos de recuperacion (ADR 0028). '
  'Null = todavia no. Mientras sea null y la sesion se haya abierto con Google, '
  '`exigir()` cierra la aplicacion, igual que con debe_cambiar_password.';

-- ─── ASSERT: la columna existe y admite null ───────────────────────────────
-- Si alguien la crease `not null default now()`, estaria afirmando que todos
-- los usuarios de hoy vieron unos codigos que nadie les enseño.
do $$
declare n int;
begin
  select count(*) into n
    from information_schema.columns
   where table_name = 'usuarios' and column_name = 'codigos_vistos_en'
     and is_nullable = 'YES';
  if n <> 1 then
    raise exception 'usuarios.codigos_vistos_en no existe o no admite null';
  end if;
end $$;

-- ─── La sesión tiene que traer la columna, o el guard no la ve ─────────────
-- `usuarioActual()` NO consulta `usuarios` directamente: resuelve por
-- `auth_usuario_por_sesion()`, SECURITY DEFINER. Si la columna no sale por ahí,
-- no llega al código y el guard de `exigir()` no existiría.
--
-- Se añade una columna al `returns table`, y por eso hace falta `drop` antes del
-- `create`: PostgreSQL no deja cambiar el tipo de retorno con `create or
-- replace`. El `drop` se lleva los GRANT, así que se rehacen abajo — mismo
-- patrón y mismos dos roles que `20260825_sesion_metodo.sql:57-88`.
drop function if exists auth_usuario_por_sesion(text);
create function auth_usuario_por_sesion(p_token text)
returns table (
  id uuid, nombre text, email text, cargo text,
  rol text, activo boolean, tenant_id uuid, debe_cambiar_password boolean,
  metodo text, codigos_vistos_en timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.nombre, u.email, u.cargo, u.rol::text, u.activo, u.tenant_id,
         u.debe_cambiar_password, s.metodo, u.codigos_vistos_en
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

commit;

-- ─── Verificación ──────────────────────────────────────────────────────────
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_name = 'usuarios' and column_name = 'codigos_vistos_en';
