-- ===========================================================================
--  VUELTA ATRAS de 20261006_retirar_org_demo_rentabilidad.sql
--
--  Recarga la organización `demo-rentabilidad` de `spaces_demo` y sus 65 filas
--  desde los CSV que el script de retiro capturó ANTES de borrar, en
--  /var/lib/space-os/respaldos-semilla/demo-rentabilidad/. Mismos id, mismas
--  fechas, mismos valores: es la fila tal como estaba, no una reconstrucción.
--
--  ── Cuándo usarlo ─────────────────────────────────────────────────────────
--  Prácticamente nunca: eran filas sueltas que nadie podía ver. Existe porque
--  la convención de este directorio lo exige y porque un cambio sin marcha
--  atrás no se aplica.
--
--  Se corre igual que el retiro (ver su cabecera), y también tiene pasada en
--  seco: sin `-v aplicar=1` recarga, comprueba y vuelve atrás.
-- ===========================================================================
\set ON_ERROR_STOP on

begin;

do $$
begin
  if exists (select 1 from tenants where id = '351b401a-2f69-4b58-8bb4-7c47a63aa37d') then
    raise exception 'La organizacion ya existe: no hay nada que devolver.';
  end if;
end $$;

-- En orden de dependencia: lo que se referencia antes que lo que referencia.
\copy tenants            from '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/tenants.csv' csv header
\copy config_negocio     from '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/config_negocio.csv' csv header
\copy entidades_fiscales from '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/entidades_fiscales.csv' csv header
\copy entidad_roles      from '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/entidad_roles.csv' csv header
\copy arrendadores       from '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/arrendadores.csv' csv header
\copy predios            from '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/predios.csv' csv header
\copy consumos_energia   from '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/consumos_energia.csv' csv header
\copy clientes           from '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/clientes.csv' csv header
\copy campanas           from '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/campanas.csv' csv header
\copy facturas           from '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/facturas.csv' csv header
\copy cobranzas          from '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/cobranzas.csv' csv header

do $$
declare
  t uuid := '351b401a-2f69-4b58-8bb4-7c47a63aa37d';
  n int;
begin
  select (select count(*) from config_negocio where tenant_id = t)
       + (select count(*) from entidades_fiscales where tenant_id = t)
       + (select count(*) from entidad_roles where tenant_id = t)
       + (select count(*) from arrendadores where tenant_id = t)
       + (select count(*) from predios where tenant_id = t)
       + (select count(*) from consumos_energia where tenant_id = t)
       + (select count(*) from clientes where tenant_id = t)
       + (select count(*) from campanas where tenant_id = t)
       + (select count(*) from facturas where tenant_id = t)
       + (select count(*) from cobranzas where tenant_id = t)
    into n;
  if n <> 65 then raise exception 'Se esperaban 65 filas y volvieron %', n; end if;
  raise notice 'Vuelta atras comprobada: las 65 filas y la organizacion estan de vuelta.';
end $$;

\if :{?aplicar}
commit;
\echo '== APLICADA la vuelta atras.'
\else
rollback;
\echo '== PASADA EN SECO de la vuelta atras: cuadro y se volvio atras. Para aplicar: -v aplicar=1'
\endif
