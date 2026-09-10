-- ===========================================================================
--  Las 12 pantallas de g500 dejan de estar en Peru · 2026-09-10
--  Se aplica en la INSTANCIA de g500 (base `spaces`), no en el PADRE.
--
--  ── Que corrige ───────────────────────────────────────────────────────────
--  `sitios.pais` era `not null default 'PE'` desde que el producto se vendia
--  como «Billboards Peru SA» (`db/schema.sql:136`), y el alta no captura ese
--  campo. Las 12 pantallas de g500 quedaron registradas en Peru, y viajaron asi
--  a su instancia en el traslado del 09/09. Son direcciones de CDMX y Edomex:
--  TLALPAN 985, PATRIOTISMO Y PENSILVANIA, CALZADA MEXICO TACUBA, GUSTAVO BAZ,
--  AV. PALO SOLO, BLVD. MAGNOCENTRO INTERLOMAS...
--
--  Importa porque NO es un dato interno: la liga publica de la pantalla imprime
--  la ubicacion, y el cliente la lee en su propia ficha.
--
--  ── Esto es distinto de la migracion, y las dos hacen falta ───────────────
--  `db/migrations/20260910_pais_sin_default.sql` impide que vuelva a pasar
--  --quita el default y el NOT NULL-- pero NO toca ninguna fila, a proposito:
--  cambiar datos de un cliente no puede ser el efecto colateral de un
--  despliegue. Esto es esa decision, tomada aparte y a mano.
--
--  Las dos son independientes: este script funciona con o sin la migracion
--  aplicada, porque escribe un valor y no un null.
--
--  ── Alcance ───────────────────────────────────────────────────────────────
--  Acotado por el valor previo ('PE') Y por la organizacion. El guard aborta si
--  no toca exactamente 12 filas: si manana son 13, alguien dio de alta una
--  pantalla mas y hay que mirarla antes de arrastrarla.
--
--  ── Pasada en seco ────────────────────────────────────────────────────────
--  Cambia `commit` por `rollback` al final y comprueba que diga UPDATE 12.
-- ===========================================================================
\set ON_ERROR_STOP on

begin;

-- Estado previo, a la vista.
select pais, count(*) as pantallas
  from sitios
 where tenant_id = (select id from tenants where slug = 'g500')
 group by pais order by pais;

update sitios
   set pais = 'MX'
 where tenant_id = (select id from tenants where slug = 'g500')
   and pais = 'PE';

do $$
declare destino uuid; n_mx int; n_pe int;
begin
  select id into destino from tenants where slug = 'g500';
  if destino is null then
    raise exception 'No hay organizacion con slug g500 en esta instancia.';
  end if;

  select count(*) into n_mx from sitios where tenant_id = destino and pais = 'MX';
  select count(*) into n_pe from sitios where tenant_id = destino and pais = 'PE';

  if n_mx <> 12 then
    raise exception 'Se esperaban 12 pantallas en MX y hay %', n_mx;
  end if;
  if n_pe <> 0 then
    raise exception 'Quedan % pantallas en PE', n_pe;
  end if;

  raise notice 'OK · las 12 pantallas de g500 quedan en MX, ninguna en PE.';
end $$;

commit;
