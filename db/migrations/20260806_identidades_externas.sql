-- ============================================================================
-- ADR 0012 · Acceso con cuenta de Google — tabla de vinculación.
--
-- Guarda que una identidad de un proveedor externo (hoy solo Google) pertenece
-- a un usuario nuestro. NO crea usuarios ni tenants: el alta sigue siendo
-- /api/signup o Administración. Google autentica, no da de alta.
--
-- TABLA Y NO COLUMNA en `usuarios` porque el `sub` de Google no es el último
-- proveedor que va a existir, y porque así la vinculación es un hecho auditable
-- y borrable sin tocar la fila del usuario: quitar el acceso por Google es un
-- `delete` aquí, no desactivar a la persona.
--
-- SE GUARDA EL `sub`, NO EL CORREO, como clave. El correo de Google no es
-- estable —se puede cambiar en un Workspace, y una dirección liberada puede
-- reasignarse a otra persona—; el `sub` es inmutable. Vincular por correo en
-- cada entrada haría que el titular nuevo de una dirección heredara la cuenta
-- del anterior en silencio (alternativa D del ADR).
--
-- ── Por qué esta tabla SÍ lleva RLS, a diferencia de `password_resets` ──────
-- La resolución ocurre PRE-SESIÓN, antes de saber el tenant, así que la lectura
-- va por `auth_usuario_por_identidad()`, SECURITY DEFINER — mismo patrón exacto
-- que `auth_usuario_por_email()` en 20260720_hard1_usuarios_rls.sql. Eso
-- funciona AUNQUE la tabla tenga RLS+FORCE, porque la función corre como su
-- dueño (superusuario), y un superusuario no está sujeto a la política.
--
-- Se comprobó al escribir esto (2026-08-06) que `password_resets` tiene
-- `tenant_id` y NO tiene RLS: la consulta de verificación del GATE B, que la
-- migración de hardening documenta como «debe devolver 0 filas», devuelve una.
-- Se coló porque su migración es alfabéticamente posterior a
-- 20260720_hard1_rls_todas_tablas.sql, así que el ASSERT de aquélla nunca la
-- vio. Aquí NO se repite el descuido: esta tabla nace con RLS fail-closed +
-- FORCE, y el ASSERT del final lo verifica. (Lo de `password_resets` va aparte:
-- ponerle RLS sin más rompería el flujo de recuperar contraseña, que la lee con
-- `qRaw` — es trabajo propio, no de esta migración.)
--
-- Las ESCRITURAS no necesitan función definer: cuando se vincula ya se sabe el
-- tenant (se acaba de resolver al usuario por correo), así que van con
-- `qConTenant` y pasan la política igual que el resto del sistema.
--
-- Transaccional. Idempotente: `if not exists` en todo, y `create or replace` en
-- la función.
-- ============================================================================
begin;

-- ─── 1. La tabla ────────────────────────────────────────────────────────────
create table if not exists identidades_externas (
  proveedor     text        not null,
  -- Identificador estable del usuario en el proveedor. En Google es el claim
  -- `sub`: opaco, sin datos personales dentro.
  sub           text        not null,
  usuario_id    uuid        not null references usuarios(id) on delete cascade,
  tenant_id     uuid        not null references tenants(id),
  -- El correo que el proveedor reportó AL VINCULAR. No se usa para resolver
  -- —para eso está el `sub`—: queda como rastro de auditoría para poder
  -- responder «¿con qué cuenta se vinculó esto?» cuando el correo haya
  -- cambiado después.
  email_externo text,
  creado_en     timestamptz not null default now(),
  ultimo_uso_en timestamptz,
  primary key (proveedor, sub)
);

-- Un usuario tiene COMO MUCHO una identidad por proveedor. Se elige lo estricto
-- a propósito: cada vínculo extra es una vía más de entrada a la misma cuenta, y
-- relajar esta restricción luego es una migración trivial, mientras que
-- imponerla más tarde obligaría a resolver duplicados ya creados.
create unique index if not exists identidades_externas_usuario_proveedor_uidx
  on identidades_externas (proveedor, usuario_id);

-- Para el `delete` de revocación por usuario sin escanear la tabla.
create index if not exists identidades_externas_usuario_idx
  on identidades_externas (usuario_id);

-- ─── 2. RLS fail-closed + FORCE (patrón de hard1) ──────────────────────────
-- Sin `OR ... IS NULL`: si el GUC no está fijado no se ve nada, y los
-- INSERT/UPDATE fallan el WITH CHECK.
alter table identidades_externas enable row level security;
alter table identidades_externas force row level security;
drop policy if exists tenant_isolation on identidades_externas;
create policy tenant_isolation on identidades_externas for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

-- ─── 3. Resolución pre-sesión: (proveedor, sub) → usuario ──────────────────
-- Devuelve las MISMAS columnas que auth_usuario_por_sesion(), para que el
-- callback pueda tratar al usuario igual que cualquier otra vía de entrada.
-- No devuelve `password_hash`: esta función es para entrar, no para verificar
-- credenciales, y no hay ningún motivo para sacar el hash de la base aquí.
create or replace function auth_usuario_por_identidad(p_proveedor text, p_sub text)
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
    from identidades_externas ie
    join usuarios u on u.id = ie.usuario_id
   where ie.proveedor = p_proveedor
     and ie.sub = p_sub
   limit 1;
$$;

-- ─── 4. GRANTs al rol de la app (el que exista en este entorno) ────────────
do $$
declare
  r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant execute on function auth_usuario_por_identidad(text,text) to %I', r);
      execute format('grant select, insert, update, delete on identidades_externas to %I', r);
    end if;
  end loop;
end $$;

-- Nadie más debe poder ejecutarla (public incluye a cualquier rol futuro).
revoke execute on function auth_usuario_por_identidad(text,text) from public;

-- ─── 5. ASSERT: la tabla nueva no rompe el invariante de hard1 ─────────────
-- La migración de hardening exige que TODA tabla con `tenant_id` sea
-- fail-closed + FORCE. Se comprueba aquí y no se confía en que alguien vuelva a
-- correr aquélla: su ASSERT no ve las tablas creadas después.
do $$
begin
  if not exists (
    select 1 from pg_class c
     where c.relname = 'identidades_externas'
       and c.relrowsecurity and c.relforcerowsecurity
  ) then
    raise exception 'identidades_externas quedó sin RLS+FORCE, y tiene tenant_id.';
  end if;
end $$;

commit;

-- ─── Verificación (debe devolver 1 fila: la tabla nueva, con rls y force en t)
select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as force
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname = 'identidades_externas';
