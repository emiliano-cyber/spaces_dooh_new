-- ===========================================================================
--  Retira la organización `demo-rentabilidad` de `spaces_demo` (DEMO, en el
--  PADRE): 65 filas sueltas que dejó una siembra mal dirigida.
--
--  ── Qué pasó ──────────────────────────────────────────────────────────────
--  El 2026-10-06 a las 22:23 UTC se corrió
--  `infra/scripts/sembrar-catalogo-demo.sh spaces_demo --con-guion`, que
--  entonces usaba `demo-rentabilidad` como organización por omisión. La demo de
--  esa base vive en `demo`. `semilla-demo.mjs` creó `demo-rentabilidad`, dio
--  por «ya sembradas» sus pantallas, campañas y órdenes `DEMO-` —son únicas en
--  toda la base y eran de `demo`— y metió lo que se guarda por organización.
--  Su salida: «filas nuevas: 65 · ya sembradas: 182». El catálogo falló después
--  y volvió atrás entero, así que lo único que quedó es esto.
--
--  Medido en el servidor ese mismo día: `demo-rentabilidad` tiene 0 usuarios,
--  0 pantallas y 2 campañas. Nadie puede entrar en ella. Las dos semillas y el
--  guion del PADRE ya no pueden repetirlo: piden la organización de forma
--  explícita y paran si las claves son de otra.
--
--  ── Cómo se corre ─────────────────────────────────────────────────────────
--  Desde /var/www/Spaces en el PADRE, con la URL de `spaces_migrador`:
--
--    . infra/scripts/conexion-pg.sh
--    U=$(grep '^DATABASE_URL=' /etc/space-os/demo-instancia.env | cut -d= -f2-)
--    pg_derivar_conexion "$U"
--    mkdir -p /var/lib/space-os/respaldos-semilla/demo-rentabilidad
--    correr_pg psql -f docs/datos/20261006_retirar_org_demo_rentabilidad.sql
--        → PASADA EN SECO: captura, borra, comprueba y VUELVE ATRÁS
--    correr_pg psql -v aplicar=1 -f docs/datos/20261006_retirar_org_demo_rentabilidad.sql
--        → lo mismo, y COMMIT
--
--  ── Vuelta atrás ──────────────────────────────────────────────────────────
--  `20261006_retirar_org_demo_rentabilidad_rollback.sql` recarga las filas
--  desde los CSV que este archivo captura ANTES de borrar, leídos de la base y
--  no escritos de memoria. Y hay una segunda vía, exacta por construcción: la
--  semilla es determinista, así que
--  `node scripts/semilla-demo.mjs --org=demo-rentabilidad` (con la protección
--  nueva, que lo impediría salvo a propósito) produciría las mismas filas.
--
--  Por id explícito, como manda el README de este directorio. El slug y los
--  recuentos solo se usan para comprobar que el id es el que se cree.
-- ===========================================================================
\set ON_ERROR_STOP on
\set tenant '351b401a-2f69-4b58-8bb4-7c47a63aa37d'
\set dir '/var/lib/space-os/respaldos-semilla/demo-rentabilidad'

select set_config('retiro.tenant', :'tenant', false);

-- ── 1 · Que el id sea la organización que se cree, y lo que tiene ──────────
-- Recorre TODAS las tablas con `tenant_id`, no una lista: si la aplicación
-- hubiera escrito algo más en esta organización (una notificación, una
-- acción), el recuento no cuadra y no se toca nada. Lo esperado es lo que
-- imprimió la siembra: 65 filas en diez tablas, más la propia organización.
do $$
declare
  t uuid := current_setting('retiro.tenant')::uuid;
  esperado jsonb := '{"config_negocio":1,"entidades_fiscales":3,"entidad_roles":5,
                      "arrendadores":4,"predios":4,"clientes":2,"campanas":2,
                      "facturas":2,"cobranzas":2,"consumos_energia":40}';
  r record;
  n int;
  malos text := '';
begin
  if not exists (select 1 from tenants where id = t and slug = 'demo-rentabilidad') then
    raise exception 'El id % no es la organizacion demo-rentabilidad. No se toca nada.', t;
  end if;
  for r in select table_name from information_schema.columns
            where table_schema = 'public' and column_name = 'tenant_id' order by 1 loop
    execute format('select count(*) from %I where tenant_id = $1', r.table_name) into n using t;
    if n <> coalesce((esperado ->> r.table_name)::int, 0) then
      malos := malos || format(' %s=%s (esperado %s)', r.table_name, n, coalesce(esperado ->> r.table_name, '0'));
    end if;
  end loop;
  if malos <> '' then
    raise exception 'La organizacion no tiene lo que se esperaba:%. No se toca nada.', malos;
  end if;
  raise notice 'Comprobado: demo-rentabilidad tiene exactamente las 65 filas de la siembra.';
end $$;

-- ── 2 · Captura, ANTES de borrar ───────────────────────────────────────────
-- Un CSV por tabla, con cabecera, en el orden en que se recargan. La ruta y el
-- id van escritos en cada línea porque `\copy` no expande variables de psql.
\copy (select * from tenants where id = '351b401a-2f69-4b58-8bb4-7c47a63aa37d') to '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/tenants.csv' csv header
\copy (select * from config_negocio where tenant_id = '351b401a-2f69-4b58-8bb4-7c47a63aa37d') to '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/config_negocio.csv' csv header
\copy (select * from entidades_fiscales where tenant_id = '351b401a-2f69-4b58-8bb4-7c47a63aa37d') to '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/entidades_fiscales.csv' csv header
\copy (select * from entidad_roles where tenant_id = '351b401a-2f69-4b58-8bb4-7c47a63aa37d') to '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/entidad_roles.csv' csv header
\copy (select * from arrendadores where tenant_id = '351b401a-2f69-4b58-8bb4-7c47a63aa37d') to '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/arrendadores.csv' csv header
\copy (select * from predios where tenant_id = '351b401a-2f69-4b58-8bb4-7c47a63aa37d') to '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/predios.csv' csv header
\copy (select * from consumos_energia where tenant_id = '351b401a-2f69-4b58-8bb4-7c47a63aa37d') to '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/consumos_energia.csv' csv header
\copy (select * from clientes where tenant_id = '351b401a-2f69-4b58-8bb4-7c47a63aa37d') to '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/clientes.csv' csv header
\copy (select * from campanas where tenant_id = '351b401a-2f69-4b58-8bb4-7c47a63aa37d') to '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/campanas.csv' csv header
\copy (select * from facturas where tenant_id = '351b401a-2f69-4b58-8bb4-7c47a63aa37d') to '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/facturas.csv' csv header
\copy (select * from cobranzas where tenant_id = '351b401a-2f69-4b58-8bb4-7c47a63aa37d') to '/var/lib/space-os/respaldos-semilla/demo-rentabilidad/cobranzas.csv' csv header

-- ── 3 · El borrado, en orden inverso de dependencia ────────────────────────
-- Sin `cascade` (R5): si algo más colgara de estas filas, la clave ajena para
-- el borrado y la transacción vuelve atrás entera.
begin;
delete from cobranzas        where tenant_id = :'tenant';
delete from facturas         where tenant_id = :'tenant';
delete from campanas         where tenant_id = :'tenant';
delete from clientes         where tenant_id = :'tenant';
delete from consumos_energia where tenant_id = :'tenant';
delete from predios          where tenant_id = :'tenant';
delete from arrendadores     where tenant_id = :'tenant';
delete from entidad_roles    where tenant_id = :'tenant';
delete from entidades_fiscales where tenant_id = :'tenant';
delete from config_negocio   where tenant_id = :'tenant';
delete from tenants          where id = :'tenant';

do $$
begin
  if exists (select 1 from tenants where id = current_setting('retiro.tenant')::uuid) then
    raise exception 'La organizacion sigue ahi.';
  end if;
  if not exists (select 1 from tenants where slug = 'demo') then
    raise exception 'La organizacion demo no esta: algo no cuadra, no se confirma.';
  end if;
  raise notice 'Borrado comprobado: demo-rentabilidad ya no existe y demo sigue intacta.';
end $$;

\if :{?aplicar}
commit;
\echo '== APLICADO: demo-rentabilidad retirada. Captura en' :'dir'
\else
rollback;
\echo '== PASADA EN SECO: todo cuadro y se volvio atras. Para aplicar: -v aplicar=1'
\endif
