-- ===========================================================================
--  VUELTA ATRAS de 20260910_pais_mx_g500.sql
--
--  Estado previo, leido de la base ANTES de aplicar (no escrito de memoria):
--
--      pais | pantallas
--      PE   | 12
--
--  Las 12 pantallas de g500 estaban TODAS en 'PE'. Devolverlas ahi es exacto:
--  no habia ninguna con otro valor que se pudiera pisar.
--
--  ── Cuando usarlo ─────────────────────────────────────────────────────────
--  Practicamente nunca: 'PE' era el dato equivocado. Existe porque la
--  convencion de este directorio lo exige y porque un cambio sin marcha atras
--  no se aplica -- no porque se espere necesitarlo.
-- ===========================================================================
\set ON_ERROR_STOP on

begin;

select pais, count(*) as pantallas
  from sitios
 where tenant_id = (select id from tenants where slug = 'g500')
 group by pais order by pais;

update sitios
   set pais = 'PE'
 where tenant_id = (select id from tenants where slug = 'g500')
   and pais = 'MX';

do $$
declare n int;
begin
  select count(*) into n
    from sitios
   where tenant_id = (select id from tenants where slug = 'g500')
     and pais = 'PE';
  if n <> 12 then raise exception 'Se esperaban 12 en PE y hay %', n; end if;
  raise notice 'Vuelta atras OK · las 12 vuelven a PE.';
end $$;

commit;
