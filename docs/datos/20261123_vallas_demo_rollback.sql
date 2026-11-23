-- ============================================================================
--  20261123_vallas_demo_rollback.sql — quita lo que dejó 20261123_vallas_demo.sql
-- ----------------------------------------------------------------------------
--  Borra SOLO lo DEMO- de esa organización: vallas DEMO-V*, grupos DEMO-G* y
--  sitios DEMO-VAL-*. Si alguien ya vendió uno de esos sitios (una reserva lo
--  apunta), el borrado del sitio falla por la llave foránea y la transacción
--  entera se deshace: no queda nada a medias.
--
--  Uso:
--    sudo -u postgres psql -d spaces -v ON_ERROR_STOP=1 -v org=<slug> -f 20261123_vallas_demo_rollback.sql
-- ============================================================================

begin;

create temp table _org on commit drop as
  select id from tenants where slug = :'org';

do $$
begin
  if (select count(*) from _org) <> 1 then
    raise exception 'No hay una organizacion con ese slug.';
  end if;
end $$;

delete from vallas
 where tenant_id = (select id from _org) and numero like 'DEMO-V%';

delete from vallas_grupos
 where tenant_id = (select id from _org) and numero like 'DEMO-G%';

delete from sitios
 where tenant_id = (select id from _org) and clave_interna like 'DEMO-VAL-%';

commit;
