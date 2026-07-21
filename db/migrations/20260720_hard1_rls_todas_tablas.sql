-- ============================================================================
-- Hardening 1 · Bloque B — RLS fail-closed + FORCE en TODAS las tablas de tenant.
--
-- Hallazgo: solo 7 tablas eran fail-closed + FORCE (M5 + `usuarios` en el Bloque
-- A). Las 16 restantes seguían fail-OPEN y sin FORCE: sin `app.tenant_id` fijado
-- devolvían TODAS las filas de TODOS los tenants.
--
-- Patrón idéntico al de arr_m5_rls_failclosed.sql:
--   using/with check: tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
-- Sin `OR ... IS NULL`: si el GUC no está fijado no se ve nada y los INSERT/UPDATE
-- fallan el WITH CHECK.
--
-- ── Rutas PÚBLICAS (sin sesión) ────────────────────────────────────────────
-- Dos superficies del BFF no tienen sesión y por tanto no tienen tenant que
-- fijar: el portal de campaña (/api/portal/:token) y la propuesta compartible
-- (/api/propuestas/publica/:token). Ambas dependían del fail-open.
--
-- Se corrigen COMO INDICA EL GATE B —fijando `app.tenant_id` correctamente, NO
-- relajando la política—: el token público ya es el secreto que autoriza, así que
-- resuelve el tenant vía estas dos funciones SECURITY DEFINER acotadas, y la app
-- corre el resto de las consultas bajo ese tenant (db.ts → qConTenant /
-- withTenantTxExplicito). Cada función devuelve UN uuid a partir de un token
-- aleatorio: no expone ninguna fila.
--
-- Nota: `sitios` ya era fail-closed desde M5, así que ambas superficies públicas
-- llevaban desde entonces devolviendo CERO sitios. Bug preexistente que este
-- cambio también repara (ver reporte de fase).
--
-- Rol de la app: prod `spaces_user`, local `spaces_app`; ambos
-- NOSUPERUSER/NOBYPASSRLS, así que las políticas SÍ les aplican. El bloque ASSERT
-- del final falla la migración si eso deja de ser cierto.
--
-- Idempotente y aditiva.
-- ============================================================================
begin;

-- ─── 1. Resolución de tenant para las rutas públicas ────────────────────────

-- Portal de campaña: token → tenant. Solo si el portal está activo.
create or replace function portal_tenant_por_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tenant_id from campanas
   where portal_token = p_token and portal_activo = true
   limit 1;
$$;

-- Propuesta compartible: token aleatorio → tenant.
create or replace function propuesta_tenant_por_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tenant_id from propuestas
   where token_publico = p_token
   limit 1;
$$;

do $$
declare
  r text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant execute on function portal_tenant_por_token(text) to %I', r);
      execute format('grant execute on function propuesta_tenant_por_token(text) to %I', r);
    end if;
  end loop;
end $$;

revoke execute on function portal_tenant_por_token(text) from public;
revoke execute on function propuesta_tenant_por_token(text) from public;

-- ─── 2. fail-closed + ENABLE + FORCE en las 16 tablas restantes ────────────
do $$
declare
  t text;
  restantes text[] := array[
    'acciones','campanas','clientes','cobranzas','creatividades','evidencias_ot',
    'facturas','incidencias','notificaciones','ordenes_compra','ordenes_impresion',
    'ordenes_trabajo','propuesta_items','propuestas','reservas','sitio_modalidades'];
begin
  foreach t in array restantes loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format($p$create policy tenant_isolation on %I for all
      using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
      with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)$p$, t);
  end loop;
end $$;

-- ─── 3. ASSERT: el rol de la app NO puede saltarse la RLS ──────────────────
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

-- ─── 4. ASSERT: no debe quedar NINGUNA tabla de tenant sin fail-closed+FORCE ─
do $$
declare
  faltan text;
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

-- ─── Verificación (query del GATE B: debe devolver 0 filas) ────────────────
select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
   and exists (select 1 from information_schema.columns col
                where col.table_name = c.relname and col.column_name = 'tenant_id')
   and (not c.relrowsecurity or not c.relforcerowsecurity);
