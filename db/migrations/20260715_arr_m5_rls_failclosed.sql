-- ============================================================================
-- Arrendadores Fase 1 · M5 — RLS FAIL-CLOSED + FORCE (módulo + sitios).
-- Endurece tenant_isolation de FAIL-OPEN a FAIL-CLOSED en las tablas del módulo
-- y en `sitios` (decisión del GATE §5.2):
--   predios, arrendador_razon_social, contratos_arrendamiento, pagos_renta,
--   arrendadores, sitios.
-- Fail-closed: si `app.tenant_id` no está fijado (o está vacío) NO se ve ninguna
-- fila y los INSERT/UPDATE fallan el WITH CHECK. La app fija el GUC por request
-- (lib/server/db.ts → q()/q1()/withTenantTx/fijarTenant).
-- FORCE: aplica la RLS incluso al owner de la tabla (defensa en profundidad).
-- NO se tocan usuarios/tenants (exentas: el login se resuelve pre-sesión).
-- Idempotente.
-- ============================================================================
begin;

do $$
declare
  t text;
  enforced text[] := array[
    'predios','arrendador_razon_social','contratos_arrendamiento',
    'pagos_renta','arrendadores','sitios'];
begin
  foreach t in array enforced loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format($p$create policy tenant_isolation on %I for all
      using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
      with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)$p$, t);
  end loop;
end $$;

commit;

-- Verificación: política fail-closed (sin OR ... IS NULL) y FORCE activo.
select c.relname,
       c.relrowsecurity  as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       (position('is null' in lower(pg_get_expr(p.polqual, p.polrelid))) = 0) as fail_closed
  from pg_class c
  join pg_policy p on p.polrelid = c.oid and p.polname = 'tenant_isolation'
 where c.relname in ('predios','arrendador_razon_social','contratos_arrendamiento',
                     'pagos_renta','arrendadores','sitios')
 order by c.relname;
