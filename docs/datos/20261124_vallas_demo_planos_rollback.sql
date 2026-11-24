-- ============================================================================
--  20261124_vallas_demo_planos_rollback.sql — quita lo que dejó
--  20261124_vallas_demo_planos.sql (solo eso: las vallas del 23/11 se quedan;
--  para quitarlas está 20261123_vallas_demo_rollback.sql, DESPUÉS de este).
--
--    sudo -u postgres psql -d spaces -v ON_ERROR_STOP=1 -v org=g500 -f 20261124_vallas_demo_planos_rollback.sql
--
--  Las filas de propuesta_cambios de DEMO-PR-VAL-01 se quedan: el historial
--  solo crece (ADR 0051) y no tiene FK a la propuesta.
-- ============================================================================

begin;

select set_config('app.usuario_nombre', 'Semilla DEMO (rollback)', true);

create temp table _org on commit drop as
  select id from tenants where slug = :'org';

delete from reservas r
 using campanas c
 where c.id = r.campana_id and c.folio = 'DEMO-CA-VAL-01'
   and r.tenant_id = (select id from _org) and c.tenant_id = (select id from _org);

delete from campanas
 where folio = 'DEMO-CA-VAL-01' and tenant_id = (select id from _org);

-- Los sitios de la propuesta se van por on delete cascade.
delete from propuestas
 where folio = 'DEMO-PR-VAL-01' and tenant_id = (select id from _org);

-- Los clientes, solo si ya no los usa nada.
delete from clientes cl
 where cl.tenant_id = (select id from _org)
   and cl.rfc in ('DMV030303AB1', 'DMV030303AB2')
   and not exists (select 1 from campanas c where c.cliente_id = cl.id)
   and not exists (select 1 from propuestas p where p.cliente_id = cl.id);

select count(*) filter (where folio = 'DEMO-PR-VAL-01') as propuestas_que_quedan
  from propuestas where tenant_id = (select id from _org);

commit;
