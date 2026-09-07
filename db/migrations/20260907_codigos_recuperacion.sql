-- ============================================================================
-- `codigos_recuperacion` — la última puerta del Dueño de una instancia.
-- (ADR 0028 · B1 del Plan_Acceso_Duenos)
--
-- ── Por qué existe esta tabla ───────────────────────────────────────────────
-- El ADR 0028 decide que el Dueño de cada instancia entra SOLO con Google. Eso
-- retira el riesgo que dos correcciones no lograron cerrar —ROJO-1 y el defecto
-- 22: una contraseña que genera el operador, la ve en su pantalla y se queda en
-- su historial— pero abre otro: el día que pierda esa cuenta de Google no tiene
-- ninguna puerta, y el PADRE no tiene correo saliente.
--
-- Estos códigos son esa puerta. Y resuelven un segundo problema, que es el que
-- permite automatizar el alta entera: los genera y los ve ÉL, en su navegador,
-- así que AS OOH deja de tener ningún secreto suyo que entregar (ADR 0029 §5).
--
-- ── Por qué sha256 y NO bcrypt, que es lo que se usa con las contraseñas ────
-- Una contraseña la elige una persona y tiene poca entropía: bcrypt existe para
-- que probarlas salga caro. Un código de aquí es aleatorio y de ~74 bits, así
-- que la fuerza bruta ya es inviable y el hash lento no compra nada. Lo que sí
-- costaría es real: bcrypt lleva sal, así que el mismo código da hashes
-- distintos y NO se puede buscar — habría que traer los diez códigos del
-- usuario y compararlos uno a uno, casi un segundo de CPU **por intento
-- fallido**, en la ruta que se usa justo cuando alguien no puede entrar. Es un
-- vector de denegación de servicio regalado.
--
-- Con sha256 el hash es determinista, se indexa y se resuelve de UNA consulta.
-- Mismo razonamiento con el que F5.8 eligió un token opaco en vez de un JWT.
--
-- ── Por qué RLS aunque la lectura sea PRE-SESIÓN ───────────────────────────
-- Igual que `password_resets` (07/08) e `identidades_externas` (06/08): cuando
-- alguien presenta un código todavía no se sabe de qué organización es, así que
-- la resolución va por una función SECURITY DEFINER acotada. La RLS no es la
-- barrera principal —lo es el código— pero da defensa en profundidad: un fallo
-- futuro que consulte esta tabla sin contexto de tenant devuelve CERO filas en
-- vez de poder enumerar los códigos de todas las organizaciones.
--
-- Y el ASSERT de `20260720_hard1_rls_todas_tablas.sql` exige que TODA tabla con
-- `tenant_id` tenga RLS + FORCE. Sin esto, esta migración rompería ese
-- invariante en cuanto alguien lo comprobara.
--
-- Transaccional. Idempotente.
-- ============================================================================
begin;

-- ─── 1. La tabla ───────────────────────────────────────────────────────────
create table if not exists codigos_recuperacion (
  -- El sha256 del código normalizado, en hexadecimal. NUNCA el código.
  codigo_hash text primary key,
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  tenant_id   uuid not null,
  usado_en    timestamptz,               -- null = sin usar
  creado_en   timestamptz not null default now()
);

create index if not exists idx_codigos_recuperacion_usuario
  on codigos_recuperacion(usuario_id);

-- Los sin usar de un usuario, que es la consulta de «cuántos te quedan».
create index if not exists idx_codigos_recuperacion_vivos
  on codigos_recuperacion(usuario_id) where usado_en is null;

comment on table codigos_recuperacion is
  'Codigos de un solo uso con los que el Dueño entra sin Google (ADR 0028). '
  'Se guarda el sha256, nunca el codigo. Los ve UNICAMENTE el propio usuario, '
  'una vez, al generarlos.';

comment on column codigos_recuperacion.usado_en is
  'Null = sin usar. Un codigo usado NO se borra: su fila es el rastro de que '
  'alguien entro por esa puerta, y ese rastro importa mas que el espacio.';

-- ─── 2. Permisos para el rol de la app ─────────────────────────────────────
-- En prod las tablas las posee `postgres`, así que el rol de app necesita
-- GRANT explícito. Se hace por rol existente porque los entornos difieren.
do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant select, insert, update, delete on codigos_recuperacion to %I', r);
    end if;
  end loop;
end $$;

-- ─── 3. Resolución PRE-SESIÓN: hash → fila ─────────────────────────────────
-- Mismo patrón exacto que `auth_reset_por_token()`, `auth_usuario_por_email()`
-- y `auth_usuario_por_identidad()`.
--
-- Devuelve UNA fila a partir del hash de un código de ~74 bits: no expone nada
-- que quien no tenga el código pueda usar. Y devuelve `usado_en` en vez de
-- filtrar por él a propósito — **quien llama tiene que distinguir «no existe»
-- de «ya se usó»**, porque son dos cosas distintas y la segunda merece quedar
-- anotada: significa que alguien tiene un código viejo del Dueño.
create or replace function auth_codigo_recuperacion(p_hash text)
returns table (
  usuario_id uuid, tenant_id uuid, usado_en timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select cr.usuario_id, cr.tenant_id, cr.usado_en
    from codigos_recuperacion cr
   where cr.codigo_hash = p_hash
   limit 1;
$$;

do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant execute on function auth_codigo_recuperacion(text) to %I', r);
    end if;
  end loop;
end $$;

revoke execute on function auth_codigo_recuperacion(text) from public;

-- ─── 4. RLS fail-closed + FORCE ────────────────────────────────────────────
alter table codigos_recuperacion enable row level security;
alter table codigos_recuperacion force row level security;
drop policy if exists tenant_isolation on codigos_recuperacion;
create policy tenant_isolation on codigos_recuperacion for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

-- ─── 5. ASSERT: el invariante de hard1 sigue cumpliéndose ──────────────────
-- CERO tablas con `tenant_id` sin RLS+FORCE. Si esta migración se olvidara del
-- paso 4, se enteraría aquí y no tres semanas después.
do $$
declare faltan text;
begin
  select string_agg(c.relname, ', ') into faltan
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and exists (select 1 from information_schema.columns col
                  where col.table_name = c.relname and col.column_name = 'tenant_id')
     and (not c.relrowsecurity or not c.relforcerowsecurity);
  if faltan is not null then
    raise exception 'Tablas con tenant_id sin RLS+FORCE: %', faltan;
  end if;
end $$;

commit;

-- ─── Verificación (debe devolver 0 filas) ──────────────────────────────────
select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
   and exists (select 1 from information_schema.columns col
                where col.table_name = c.relname and col.column_name = 'tenant_id')
   and (not c.relrowsecurity or not c.relforcerowsecurity);
