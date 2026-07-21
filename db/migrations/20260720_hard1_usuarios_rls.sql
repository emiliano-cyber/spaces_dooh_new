-- ============================================================================
-- Hardening 1 · Bloque A — `usuarios` fail-closed + FORCE (cierra IDOR).
--
-- Hallazgo: PATCH/DELETE /api/usuarios/:id operaba solo por `id`, sin filtro de
-- tenant (usuarios-repo.ts:52,76). `usuarios` había quedado EXENTA de la RLS
-- fail-closed de M5 (arr_m5_rls_failclosed.sql:11) porque el login se resuelve
-- ANTES de conocer el tenant: su política llevaba un `OR app.tenant_id IS NULL`
-- (fail-OPEN) que es load-bearing para el bootstrap.
--
-- Esta migración quita ese fail-open y, para no romper el bootstrap, expone las
-- ÚNICAS tres lecturas que legítimamente necesitan visibilidad global como
-- funciones SECURITY DEFINER acotadas (una fila por credencial concreta), en vez
-- de dejar la tabla entera abierta:
--
--   auth_usuario_por_email(text)   → login (pre-sesión, pre-tenant)
--   auth_usuario_por_sesion(text)  → resolución de sesión (cada request)
--   auth_email_existe(text)        → unicidad GLOBAL de correo (signup/perfil)
--
-- El alta de usuario en signup NO necesita bypass: ahí el tenant recién creado ya
-- se conoce, así que la app fija `app.tenant_id` explícitamente (db.ts →
-- qConTenant). Por eso aquí no hay ninguna función de INSERT.
--
-- SECURITY DEFINER corre con los privilegios del OWNER de la función (el rol que
-- aplica esta migración: superusuario), que salta RLS. `search_path` va fijado
-- para cerrar el ataque clásico de resolución de nombres.
--
-- Rol de la app: en prod `spaces_user`, en local `spaces_app`. Ambos
-- NOSUPERUSER/NOBYPASSRLS, así que la política SÍ les aplica (verificado abajo).
-- Los GRANT se dan a los roles que existan, para que la migración sea portable
-- entre local y prod.
--
-- Idempotente y aditiva. No borra datos ni cambia enums.
-- ============================================================================
begin;

-- ─── 1. Lecturas de bootstrap acotadas (SECURITY DEFINER) ───────────────────

-- Login: resuelve al usuario por correo. Devuelve el hash para que la app lo
-- verifique con bcrypt; NO valida la contraseña aquí (bcrypt vive en la app).
create or replace function auth_usuario_por_email(p_email text)
returns table (
  id uuid, nombre text, email text, cargo text,
  rol text, activo boolean, password_hash text, tenant_id uuid
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.nombre, u.email, u.cargo, u.rol::text, u.activo,
         u.password_hash, u.tenant_id
    from usuarios u
   where lower(u.email) = lower(p_email)
   limit 1;
$$;

-- Resolución de sesión: token → usuario. Solo sesiones no expiradas.
create or replace function auth_usuario_por_sesion(p_token text)
returns table (
  id uuid, nombre text, email text, cargo text,
  rol text, activo boolean, tenant_id uuid
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.nombre, u.email, u.cargo, u.rol::text, u.activo, u.tenant_id
    from sesiones s
    join usuarios u on u.id = s.usuario_id
   where s.token = p_token
     and s.expira_en > now()
   limit 1;
$$;

-- Unicidad de correo: es GLOBAL a propósito (el login es por email sin tenant,
-- así que dos usuarios con el mismo correo en tenants distintos harían el login
-- ambiguo). Devuelve solo un booleano: no filtra ningún dato del otro tenant.
create or replace function auth_email_existe(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from usuarios where lower(email) = lower(p_email));
$$;

-- ─── 2. GRANTs al rol de la app (el que exista en este entorno) ─────────────
do $$
declare
  r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant execute on function auth_usuario_por_email(text) to %I', r);
      execute format('grant execute on function auth_usuario_por_sesion(text) to %I', r);
      execute format('grant execute on function auth_email_existe(text) to %I', r);
    end if;
  end loop;
end $$;

-- Nadie más debe poder ejecutarlas (public incluye a cualquier rol futuro).
revoke execute on function auth_usuario_por_email(text) from public;
revoke execute on function auth_usuario_por_sesion(text) from public;
revoke execute on function auth_email_existe(text) from public;

-- ─── 3. `usuarios` → fail-closed + FORCE (patrón exacto de M5) ─────────────
alter table usuarios enable row level security;
alter table usuarios force row level security;
drop policy if exists tenant_isolation on usuarios;
create policy tenant_isolation on usuarios for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

-- ─── 4. ASSERT: el rol de la app NO puede saltarse la RLS ──────────────────
-- Si alguien apunta la app a un rol con BYPASSRLS/SUPERUSER, todo lo anterior es
-- decorativo. Falla la migración antes que dar una falsa sensación de seguridad.
do $$
declare
  malo text;
begin
  select string_agg(rolname, ', ') into malo
    from pg_roles
   where rolname in ('spaces_user','spaces_app')
     and (rolsuper or rolbypassrls);
  if malo is not null then
    raise exception 'El rol de la app (%) tiene SUPERUSER o BYPASSRLS: la RLS no le aplicaria', malo;
  end if;
end $$;

commit;

-- ─── Verificación ──────────────────────────────────────────────────────────
-- fail_closed = true  → la política ya no tiene el `OR ... IS NULL`.
select c.relname,
       c.relrowsecurity      as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       (position('is null' in lower(pg_get_expr(p.polqual, p.polrelid))) = 0) as fail_closed
  from pg_class c
  join pg_policy p on p.polrelid = c.oid and p.polname = 'tenant_isolation'
 where c.relname = 'usuarios';
