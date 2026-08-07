-- ============================================================================
-- `password_resets` pasa a fail-closed + FORCE, como el resto de tablas con
-- `tenant_id`.
--
-- ── Por qué se cambia una decisión que estaba tomada a propósito ────────────
-- La cabecera de 20260723_password_resets.sql dice, con razón, que el flujo es
-- PRE-SESIÓN y que se accede por el TOKEN: un secreto de 256 bits, de un solo
-- uso y con expiración. Eso sigue siendo cierto y sigue siendo la barrera real.
--
-- Lo que no encaja es otra cosa: 20260720_hard1_rls_todas_tablas.sql documenta
-- una consulta de verificación —toda tabla con `tenant_id` debe tener RLS +
-- FORCE— y afirma que «debe devolver 0 filas». Hoy devuelve `password_resets`.
-- El ASSERT de aquella migración no lo vio porque esta tabla se creó DESPUÉS,
-- y alfabéticamente va detrás.
--
-- Así que el estado actual no es «exenta a propósito» ni «cubierta»: es un
-- invariante roto que salta cada vez que alguien corre la comprobación, sin
-- ninguna explicación al lado. Se elige cubrirla en vez de documentar la
-- excepción porque:
--
--   · el patrón ya está probado —`identidades_externas` (06/08) es igual de
--     pre-sesión y funciona con RLS, resolviendo por función SECURITY DEFINER—;
--   · da defensa en profundidad real: un fallo futuro que consulte esta tabla
--     sin contexto de tenant devolvería CERO filas en vez de poder enumerar
--     tokens de todas las organizaciones. El token seguiría siendo la barrera
--     principal, pero deja de ser la única.
--
-- ── Lo que hay que tocar en el código, y por qué no basta con la migración ──
-- `password-reset-repo.ts` lee y escribe esta tabla con `qRaw`, que NO fija
-- `app.tenant_id`. Con RLS fail-closed eso devuelve cero filas y falla los
-- INSERT — o sea que aplicar SOLO esta migración deja «recuperar contraseña»
-- INSERVIBLE EN SILENCIO: ningún error, simplemente todos los enlaces pasan a
-- ser inválidos. Es el mismo modo de fallo que dejó el desbloqueo roto un
-- despliegue entero (43f9284).
--
-- Por eso van juntos migración y código en el mismo cambio, y por eso el
-- despliegue tiene que aplicar la migración Y el código a la vez.
--
-- Transaccional. Idempotente.
-- ============================================================================
begin;

-- ─── 1. Resolución pre-sesión: token → fila ────────────────────────────────
-- Mismo patrón exacto que `auth_usuario_por_email()` y
-- `auth_usuario_por_identidad()`: la consulta ocurre ANTES de saber de qué
-- organización es quien pide, así que va por una función SECURITY DEFINER
-- acotada. Devuelve UNA fila a partir de un token aleatorio: no expone nada que
-- quien no tenga el token pueda usar.
create or replace function auth_reset_por_token(p_token text)
returns table (
  usuario_id uuid, tenant_id uuid, expira_en timestamptz, usado_en timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pr.usuario_id, pr.tenant_id, pr.expira_en, pr.usado_en
    from password_resets pr
   where pr.token = p_token
   limit 1;
$$;

do $$
declare r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant execute on function auth_reset_por_token(text) to %I', r);
    end if;
  end loop;
end $$;

revoke execute on function auth_reset_por_token(text) from public;

-- ─── 2. RLS fail-closed + FORCE ────────────────────────────────────────────
alter table password_resets enable row level security;
alter table password_resets force row level security;
drop policy if exists tenant_isolation on password_resets;
create policy tenant_isolation on password_resets for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

-- ─── 3. ASSERT: el invariante de hard1 vuelve a cumplirse ──────────────────
-- Ahora sí: CERO tablas con `tenant_id` sin RLS+FORCE. Si alguien añade otra y
-- se olvida, esta migración se lo dirá la próxima vez que se aplique desde cero
-- —cosa que el arnés de integración hace en cada corrida—.
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

-- ─── Verificación (la del GATE B: ahora debe devolver 0 filas) ─────────────
select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
   and exists (select 1 from information_schema.columns col
                where col.table_name = c.relname and col.column_name = 'tenant_id')
   and (not c.relrowsecurity or not c.relforcerowsecurity);
