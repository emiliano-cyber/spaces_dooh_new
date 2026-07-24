-- ============================================================================
-- Recuperar contraseña — tabla de tokens de restablecimiento.
--
-- El flujo "olvidé mi contraseña" es PRE-SESIÓN (el usuario no ha entrado), así
-- que —igual que `sesiones`— esta tabla NO lleva RLS por tenant: se accede por
-- el TOKEN (secreto de 256 bits, de un solo uso y con expiración) vía qRaw. Se
-- guarda `tenant_id` solo para poder actualizar `usuarios` (fail-closed) con
-- qConTenant al consumir el token, sin volver a consultar la tabla de usuarios.
--
-- Aditiva e idempotente.
-- ============================================================================
begin;

create table if not exists password_resets (
  token       text primary key,
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  tenant_id   uuid not null,
  expira_en   timestamptz not null,
  usado_en    timestamptz,               -- null = sin usar
  creado_en   timestamptz not null default now()
);

create index if not exists idx_password_resets_usuario on password_resets(usuario_id);
create index if not exists idx_password_resets_expira  on password_resets(expira_en);

-- Permisos para el rol de la app (el que exista en este entorno). En prod las
-- tablas las posee `postgres`, así que el rol de app necesita GRANT explícito.
do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select, insert, update, delete on password_resets to %I', r);
    end if;
  end loop;
end $$;

commit;
