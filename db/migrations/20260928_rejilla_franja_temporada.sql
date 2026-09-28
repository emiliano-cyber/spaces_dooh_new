-- @tipo: esquema
-- ============================================================================
--  REJILLA-01 · el precio de venta deja de ser UN numero y pasa a ser una
--  rejilla: f(pantalla, unidad, FRANJA, FECHA).   ADR 0039, Fase 1.
-- ----------------------------------------------------------------------------
--  Hoy el precio de venta es `sitio_modalidades (sitio_id, unidad) ->
--  tarifa_publicada`, con `unique (sitio_id, unidad)` (db/schema.sql:207-211).
--  Un numero por pantalla y unidad, y se acabo. Esta migracion anade las dos
--  dimensiones que faltan --la hora del dia y la epoca del ano-- y el sitio
--  donde queda escrito QUE FRANJA SE CONTRATO.
--
--  Aditiva entera. No toca una sola fila existente, no cambia ninguna
--  restriccion existente, no edita ninguna migracion anterior y no toca
--  db/schema.sql. No mueve ni un importe.
--
--  ═══ LAS DOS DECISIONES DE DISENO, con el motivo escrito ══════════════════
--
--  1 · LAS FRANJAS SON POR ORGANIZACION, no fijas para toda la flota.
--
--  Este producto son INSTANCIAS SOBERANAS: cada dueno corre su copia completa
--  con su base y su dominio (vault/01-Arquitectura/modelo-instancias-soberanas
--  .md). El prime de una pantalla en un centro comercial no es el de una en
--  carretera, y un catalogo fijo en el codigo obligaria a que el dueno de
--  Guadalajara vendiera con las franjas que le sirven a otro.
--
--  El repositorio ya tiene la respuesta de los dos lados y la diferencia
--  importa: `catalogo_roles_entidad` NO lleva tenant_id a proposito --son
--  cinco papeles fiscales de la flota, se corrigen por migracion y no tienen
--  CRUD (entidades-repo.ts:107)--, mientras que `entidades_fiscales` SI lo
--  lleva, con su pantalla de alta, porque son datos del owner. Una franja
--  horaria es un dato del owner: la define su mercado, no el producto. Por eso
--  sigue el molde de `entidades_fiscales` y no el de `catalogo_roles_entidad`.
--
--  Lo que cuesta, dicho con todas las letras: una tabla mas, una pantalla de
--  configuracion mas, y un dueno que empieza con la rejilla vacia. El
--  invariante 1 --la rejilla es DISPERSA-- es lo que hace que ese coste no se
--  pague por adelantado: sin una sola franja capturada, todo se vende como hoy.
--
--  2 · LA TEMPORADA ES UNA ENTIDAD PROPIA, no una vigencia sobre la fila.
--
--  La alternativa era `desde`/`hasta` en cada fila de tarifa. Se descarta, y no
--  por elegancia:
--
--   · «Buen Fin» son UNAS fechas para TODO el inventario. Como vigencia por
--     fila, esas dos fechas se reescriben en cada (pantalla x unidad x franja)
--     que la tenga --cientos de copias del mismo hecho--, y el dia que el dueno
--     mueva el Buen Fin un dia tiene que editarlas TODAS. Las que se le
--     escapen no dan ningun error: cobran el precio de temporada un dia de mas.
--     Es la «segunda verdad que envejece» que este repositorio ya documento en
--     lib/server/tenant.ts:87-89 y en 20260928_vendedor_en_propuesta.sql al
--     negarse a copiar el vendedor a `campanas`.
--   · Y sin entidad no hay donde prohibir el solape. Dos filas con vigencias
--     cruzadas darian dos precios para el mismo dia, y el desempate lo
--     decidiria el `order by` que tocara. Congelar un precio inexplicable es
--     peor que no congelarlo.
--
--  El coste de la entidad, tambien dicho: una tabla y una pantalla mas, y que
--  «Diciembre» y «Buen Fin» no puedan convivir tal cual --el solape esta
--  prohibido--. Eso ultimo es deliberado: obliga al dueno a decir que precio
--  manda esos cuatro dias, que es una decision de negocio, no un detalle.
--
--  ═══ POR QUE UNA TABLA NUEVA Y NO AMPLIAR sitio_modalidades ═══════════════
--
--  Lo primero que uno intenta es anadir `franja_id` y `temporada_id` a
--  `sitio_modalidades` y mover su `unique`. Se descarta por TRES motivos
--  medidos, y el tercero es el que decide:
--
--   1. PostgreSQL 14. `unique (sitio_id, unidad, franja_id, temporada_id)` NO
--      deduplica cuando las columnas son NULL: dos filas «sin franja» de la
--      misma pantalla y unidad entrarian las dos. `nulls not distinct` es
--      sintaxis de PostgreSQL 15 y g500 corre 14.24 --un `-- @pg-min: 15` mas
--      para la cola entera de la unica instancia con datos de cliente (guard
--      del runner, codigo de salida 4). Aqui se resuelve con COALESCE a un uuid
--      centinela, que funciona en 14; ver el indice de abajo.
--   2. `on conflict (sitio_id, unidad)` se apoya HOY en ese unique
--      (sitios-repo.ts:493, la captura desde la ficha del 2026-09-28). Cambiar
--      la restriccion convierte ese upsert en un insert duplicado, y el sintoma
--      seria una tarifa que «no se guarda» sin ningun error.
--   3. Y EL DECISIVO: `actualizarSitioCompleto` hace
--      `delete from sitio_modalidades where sitio_id = $1` y reinserta lo que
--      trae el archivo (sitios-repo.ts:336). Para una re-importacion es
--      CORRECTO --el archivo es la verdad completa de esa pantalla-- pero si la
--      rejilla viviera en esa tabla, volver a importar un CSV BORRARIA LA
--      REJILLA ENTERA de esa pantalla en silencio. Perder un precio no da
--      error: solo se deja de cobrar.
--
--  Con tabla aparte, el invariante 1 deja de ser una convencion del codigo y
--  pasa a ser estructural: sin filas en `sitio_tarifas`, el camino de lectura
--  de hoy no cambia en absoluto.
--
--  ═══ LAS FK A FRANJA Y TEMPORADA SON COMPUESTAS (id, tenant_id) ═══════════
--
--  Al reves que `propuestas.usuario_id` del mismo dia, y el motivo es que aqui
--  el agujero SI ES ALCANZABLE. `usuario_id` sale de `usuarioActual()`, de la
--  sesion; `franja_id` entra POR EL CUERPO DE LA PETICION --el vendedor elige
--  la franja en un selector--. Una FK plana se comprueba con los privilegios
--  del DUENO de la tabla y por tanto ELUDE la RLS: solo exigiria que la franja
--  existiera EN ALGUN SITIO. Es el agujero exacto que
--  20260918_entidad_tenant_compuesto.sql midio con `entidad_id`.
--
--  Y aqui SI se puede hacer en PostgreSQL 14: lo que exigia la 15 en aquella
--  migracion era `on delete set null (columna)`, no la FK compuesta. Con
--  `restrict` y `cascade` no hace falta lista de columnas.
--
--  `MATCH SIMPLE` (el de omision, y el correcto): la FK no se comprueba cuando
--  `franja_id` es NULL, asi que «sin franja» --que es el caso normal-- entra
--  sin tocar nada.
--
--  `sitio_tarifas.sitio_id` se queda con FK PLANA, igual que
--  `sitio_modalidades`: ese id no viaja en el cuerpo, llega por la ruta y el
--  repositorio lee la fila de la pantalla bajo RLS y toma de ELLA el tenant
--  --el mismo invariante que documenta `actualizarModalidades`--, asi que el
--  tenant de la tarifa no puede discrepar del de su pantalla.
--
--  ═══ POR QUE `propuesta_items.franja_id` ES `on delete restrict` ══════════
--
--  Una franja CONTRATADA es un hecho. `set null` la borraria del registro vivo
--  y `cascade` se llevaria el item entero --o sea la venta--. Con `restrict`,
--  una franja que ya se vendio no se puede borrar, y por eso el repositorio NO
--  ofrece borrado: la baja es LOGICA (`activo = false`), como en
--  `entidades_fiscales` y `arrendadores`. `restrict` es el respaldo del dia que
--  alguien borre a mano.
--
--  Consecuencia que conviene tener escrita: borrar un TENANT que tenga franjas
--  contratadas fallaria por este `restrict`. Hoy solo borra tenants el arnes de
--  integracion, sobre bases donde no hay franjas. Si algun dia hace falta
--  borrar una organizacion de verdad, hay que vaciar en orden.
--
--  Lo contratado ademas se CONGELA en `propuestas.snapshot_economico` al
--  aprobar (invariante 3 del ADR 0039), asi que el precio de una propuesta
--  aprobada no depende de que estas filas sigan existiendo ni de lo que digan
--  hoy. Esta columna es el registro vivo; el snapshot es el contrato.
--
--  ═══ LO QUE ESTA MIGRACION NO HACE, y hay que saberlo ═════════════════════
--
--  · NO prohibe el solape en la base. Una franja que cruza la medianoche
--    (22:00-06:00) son DOS tramos, y una restriccion de exclusion sobre rangos
--    necesitaria `btree_gist` --una extension que no esta garantizada en toda
--    la flota-- y aun asi no sabria partir el tramo. El guardian es
--    `apps/web/lib/rejilla.ts` (`motivoFranjaInvalida`,
--    `motivoTemporadaInvalida`), declarado UNA vez e importado por todos los
--    caminos de escritura, igual que `lib/modalidades.ts`. Queda como pregunta
--    abierta para el dueno si se quiere ademas en el esquema.
--  · NO toca `sitio_modalidades`, ni su unique, ni su contenido.
--  · NO construye descuentos por volumen, codigos ni paquetes: son las fases
--    2, 3 y 4 del ADR 0039.
--
--  Transaccional e idempotente.
-- ============================================================================
begin;

-- ─── 1 · Las franjas horarias de la organizacion ───────────────────────────
--
-- `hora_inicio`/`hora_fin` son TEXT con CHECK y no `time`, y es deliberado: el
-- modulo puro que valida y resuelve trabaja con 'HH:MM' exacto, y el driver
-- devuelve un `time` como '06:00:00'. Guardar el mismo dato en dos formas
-- obliga a normalizar en cada lectura, y la normalizacion que alguien olvide no
-- da error --pinta '06:00:00' en la cotizacion del cliente--. El CHECK deja el
-- formato fijado en el esquema, que es donde no se puede olvidar.
--
-- EL FIN ES EXCLUSIVO: 06:00-10:00 y 10:00-14:00 se tocan y NO se solapan. Sin
-- eso un dueno no podria partir el dia sin dejar huecos de un minuto.
create table if not exists franjas_horarias (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  nombre      text not null,
  hora_inicio text not null check (hora_inicio ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  hora_fin    text not null check (hora_fin    ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  -- Las franjas de un dia se leen en el orden en que el dueno las piensa, que
  -- no es el alfabetico ni el de captura. Sin esto «Madrugada» saldria antes
  -- que «Prime».
  orden       integer not null default 0,
  -- Baja LOGICA. Una franja vendida no se borra (ver el `restrict` de abajo):
  -- se apaga, deja de ofrecerse en el selector y sus contratos siguen en pie.
  activo      boolean not null default true,
  creado_en   timestamptz not null default now(),
  constraint franjas_horarias_inicio_fin_ck check (hora_inicio <> hora_fin)
);

-- Dos franjas con el mismo nombre en la misma organizacion son indistinguibles
-- en el selector, y el vendedor elegiria una al azar.
create unique index if not exists idx_franjas_tenant_nombre
  on franjas_horarias (tenant_id, lower(nombre));
create index if not exists idx_franjas_tenant on franjas_horarias (tenant_id, orden, nombre);

-- La pareja sobre la que se componen las FK. No sustituye a la PK: es
-- adicional, y su indice es redundante por diseno (mismo criterio y mismo
-- motivo que `entidades_fiscales_id_tenant_uq`, 20260918).
do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'franjas_horarias_id_tenant_uq'
       and conrelid = 'franjas_horarias'::regclass
  ) then
    alter table franjas_horarias
      add constraint franjas_horarias_id_tenant_uq unique (id, tenant_id);
  end if;
end $$;

-- ─── 2 · Las temporadas de la organizacion ─────────────────────────────────
--
-- Fechas CONCRETAS con ano, no un patron anual recurrente. «Buen Fin 2026» y
-- «Buen Fin 2027» son dos filas, y eso es lo correcto: las fechas del Buen Fin
-- cambian cada ano y un patron recurrente tendria que adivinarlas. Ademas, una
-- propuesta se cotiza sobre fechas concretas: una temporada recurrente
-- obligaria a proyectar el patron al ano de la venta, que es calculo escondido
-- sobre dinero.
--
-- AMBOS EXTREMOS SON INCLUSIVOS: una temporada del 13 al 16 cubre el dia 16.
create table if not exists temporadas (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  nombre    text not null,
  desde     date not null,
  hasta     date not null,
  activo    boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint temporadas_rango_ck check (hasta >= desde)
);

create unique index if not exists idx_temporadas_tenant_nombre
  on temporadas (tenant_id, lower(nombre));
create index if not exists idx_temporadas_tenant on temporadas (tenant_id, desde);

do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'temporadas_id_tenant_uq'
       and conrelid = 'temporadas'::regclass
  ) then
    alter table temporadas
      add constraint temporadas_id_tenant_uq unique (id, tenant_id);
  end if;
end $$;

-- ─── 3 · LA REJILLA: la tarifa por (pantalla, unidad, franja, temporada) ───
--
-- DISPERSA POR DISENO. Se puebla donde el dueno quiera, no en todas las
-- combinaciones. Siete unidades x N franjas x M temporadas crece rapido, y el
-- ADR 0039 deja escrito que nadie ha medido cuantas filas son en un inventario
-- real. Una pantalla sin NINGUNA fila aqui se vende exactamente como hoy.
--
-- NO LLEVA `costo_compra`, y es una decision: el costo de una pantalla es la
-- renta al arrendador (un solo costo, ADR 0006 y la nota del 2026-08) y no
-- cambia porque el spot salga a las siete o a las tres. Duplicarlo por franja
-- daria N copias de un numero que no varia, y la primera que alguien editara
-- crearia una segunda verdad sobre el mismo gasto. El costo se sigue leyendo de
-- `sitio_modalidades`.
create table if not exists sitio_tarifas (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  sitio_id         uuid not null references sitios(id) on delete cascade,
  unidad           text not null,
  -- NULL = «cualquier franja». La fila aplica cuando no hay una mas especifica.
  franja_id        uuid,
  -- NULL = «todo el ano».
  temporada_id     uuid,
  tarifa_publicada numeric(14,2) not null default 0,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);

-- EL UNIQUE, Y LA TRAMPA DE PostgreSQL 14 QUE RESUELVE.
--
-- `unique (sitio_id, unidad, franja_id, temporada_id)` NO impediria dos filas
-- «sin franja ni temporada» de la misma pantalla y unidad: en el estandar, dos
-- NULL no son iguales, asi que el indice las admite las dos. El sintoma seria
-- dos precios para la misma venta y el que ganara dependeria del `order by`.
-- `nulls not distinct` lo arregla en PostgreSQL 15 y g500 corre 14.24.
--
-- COALESCE al uuid nulo hace el mismo trabajo en 14. El centinela
-- '00000000-...' no puede chocar con un id real: `gen_random_uuid()` nunca lo
-- produce (lleva la version 4 en el tercer grupo).
--
-- `on conflict` tiene que repetir estas mismas expresiones para apuntar a este
-- indice; se hace en `sitios-repo.ts`, y una prueba lo fija.
create unique index if not exists idx_sitio_tarifas_rejilla
  on sitio_tarifas (
    sitio_id,
    unidad,
    coalesce(franja_id,    '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(temporada_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index if not exists idx_sitio_tarifas_sitio  on sitio_tarifas (sitio_id, unidad);
create index if not exists idx_sitio_tarifas_tenant on sitio_tarifas (tenant_id);

-- Las FK compuestas: una tarifa NO puede colgar de una franja de otra
-- organizacion. `cascade` porque una fila de rejilla sin su franja no
-- significa nada -- al reves que un item de propuesta, que es una venta.
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'sitio_tarifas_franja_fkey'
      and conrelid = 'sitio_tarifas'::regclass
  ) then
    alter table sitio_tarifas
      add constraint sitio_tarifas_franja_fkey
      foreign key (franja_id, tenant_id)
      references franjas_horarias (id, tenant_id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'sitio_tarifas_temporada_fkey'
      and conrelid = 'sitio_tarifas'::regclass
  ) then
    alter table sitio_tarifas
      add constraint sitio_tarifas_temporada_fkey
      foreign key (temporada_id, tenant_id)
      references temporadas (id, tenant_id) on delete cascade;
  end if;
end $$;

-- `drop if exists` + `create` y no `create or replace trigger`: eso ultimo
-- existe desde PostgreSQL 14 y la flota esta justo en el limite (g500: 14.24).
-- Esta forma funciona en cualquier version y es igual de idempotente.
drop trigger if exists trg_sitio_tarifas_upd on sitio_tarifas;
create trigger trg_sitio_tarifas_upd before update on sitio_tarifas
  for each row execute function set_actualizado_en();

-- ─── 4 · QUE FRANJA SE CONTRATO ────────────────────────────────────────────
--
-- NULLABLE, y no lleva DEFAULT. Todo lo ya vendido se queda sin franja, y eso
-- es la verdad: se vendio sin franja. Rellenarlo con «la primera» convertiria
-- una laguna en una afirmacion falsa sobre lo que un cliente acepto -- el mismo
-- criterio que `propuestas.usuario_id` el mismo dia y que el DEFAULT de tenant
-- que retiro 20260812_sin_default_tenant.sql.
--
-- NO se guarda la temporada en el item: la temporada se DEDUCE de las fechas
-- del propio item (`fecha_inicio`), asi que copiarla seria una segunda verdad
-- que envejece. La que se aplico SI queda congelada en el snapshot al aprobar,
-- que es donde tiene que estar: ahi es un hecho historico, no un dato vivo.
alter table propuesta_items add column if not exists franja_id uuid;
alter table reservas        add column if not exists franja_id uuid;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'propuesta_items_franja_fkey'
      and conrelid = 'propuesta_items'::regclass
  ) then
    alter table propuesta_items
      add constraint propuesta_items_franja_fkey
      foreign key (franja_id, tenant_id)
      references franjas_horarias (id, tenant_id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'reservas_franja_fkey'
      and conrelid = 'reservas'::regclass
  ) then
    alter table reservas
      add constraint reservas_franja_fkey
      foreign key (franja_id, tenant_id)
      references franjas_horarias (id, tenant_id) on delete restrict;
  end if;
end $$;

create index if not exists idx_prop_items_franja on propuesta_items (franja_id, tenant_id);
create index if not exists idx_reservas_franja   on reservas (franja_id, tenant_id);

comment on column propuesta_items.franja_id is
  'REJILLA-01. La franja horaria CONTRATADA para este sitio. NULL = se vendio sin franja (todo lo anterior al 2026-09-28, y toda venta que no la use). La tarifa que le toco se congela en propuestas.snapshot_economico al aprobar. OJO: la franja NO viaja al CMS -- el SDK de DOOHmain no acepta --hora ni --dias (doohmain_sdk/__main__.py:66-75); es un compromiso comercial que alguien programa a mano.';

comment on column reservas.franja_id is
  'REJILLA-01. Heredada del propuesta_item al convertir la propuesta en campana. Misma advertencia: no viaja al CMS.';

-- ─── 5 · RLS, igual que las 16 tablas de 20260720_hard1_rls_todas_tablas ───
--
-- Fail-closed ESTRICTO --sin el `or ... is null` que llevan `tickets`--, que es
-- lo que tienen `sitio_modalidades`, `propuesta_items` y `reservas`: sin
-- `app.tenant_id` fijado no se ve ni se escribe nada. Estas tablas son
-- exactamente igual de sensibles: son precios de venta.
do $$
declare t text;
begin
  foreach t in array array['franjas_horarias','temporadas','sitio_tarifas'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format($p$create policy tenant_isolation on %I for all
      using (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
      with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)$p$, t);
  end loop;
end $$;

-- ─── 6 · GRANTs al rol de la app ───────────────────────────────────────────
--
-- Explicitos, y por el motivo que 20260923_tickets.sql dejo medido en rojo: en
-- produccion las tablas las posee OTRO rol, y el arnes de integracion no ve la
-- diferencia porque crea todo con el propietario y tiene privilegios por
-- omision (20260824_grants_tablas_futuras.sql). Sin esto la tabla se crea, la
-- migracion sale 0, y despues `spaces_app` no puede leerla -- y ningun error
-- apunta a permisos.
--
-- Por rol EXISTENTE porque los entornos difieren (`spaces_user` en el droplet
-- viejo, `spaces_app` desde 20260820_grants_rol_app.sql). Sin secuencias: las
-- claves las pone `gen_random_uuid()`.
do $$
declare r text; t text;
begin
  foreach r in array array['spaces_user','spaces_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      foreach t in array array['franjas_horarias','temporadas','sitio_tarifas'] loop
        execute format('grant select, insert, update, delete on %I to %I', t, r);
      end loop;
    end if;
  end loop;
end $$;

commit;

-- ─── Verificacion ──────────────────────────────────────────────────────────
-- Las dos ultimas filas son las que importan el dia del despliegue: dicen que
-- NADA cambio de precio. La rejilla nace vacia, y por eso todo se sigue
-- vendiendo exactamente como ayer.
select 'las tres tablas de la rejilla existen' k, count(*)::text v
  from information_schema.tables
 where table_name in ('franjas_horarias','temporadas','sitio_tarifas')
union all
select 'las tres con RLS forzada',
       count(*)::text
  from pg_class
 where relname in ('franjas_horarias','temporadas','sitio_tarifas')
   and relrowsecurity and relforcerowsecurity
union all
select 'las cuatro FK compuestas hacia franja/temporada',
       count(*)::text
  from pg_constraint
 where conname in ('sitio_tarifas_franja_fkey','sitio_tarifas_temporada_fkey',
                   'propuesta_items_franja_fkey','reservas_franja_fkey')
union all
select 'filas de rejilla (nace vacia: nada cambia de precio)',
       count(*)::text from sitio_tarifas
union all
select 'items de propuesta CON franja contratada (nace en cero)',
       count(*)::text from propuesta_items where franja_id is not null;
