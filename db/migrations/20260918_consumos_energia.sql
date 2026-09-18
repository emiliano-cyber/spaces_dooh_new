-- ============================================================================
--  Consumos de energía eléctrica — la quinta dimensión de rentabilidad.
-- ----------------------------------------------------------------------------
--  El dueño pidió cinco reportes de rentabilidad. Cuatro existían; el de
--  consumo de luz era el ÚNICO SIN UN SOLO DATO en el sistema: una búsqueda por
--  `kwh`, `consumo`, `energia`, `electric`, `cfe` y `recibo_luz` sobre todo el
--  repositorio devolvía UNA coincidencia, y era el valor `'ELECTRICO'` del enum
--  `tipo_ot`. No había nada que reportar porque no había dónde capturarlo.
--
--  Se le preguntó quién va a teclear el dato y cada cuánto, y eligió
--  (2026-09-18), con sus palabras:
--
--    «El medidor suele ser del predio, no de la pantalla, así que se captura
--     una vez por predio y por mes y SE REPARTE ENTRE SUS PANTALLAS IGUAL QUE
--     LA RENTA. Es lo más realista y reusa el reparto que ya existe y está
--     probado.»
--
--  Esa elección es la que nombra esta tabla, y de ella salen sus tres decisiones
--  de forma: el anclaje al PREDIO, el periodo MENSUAL y el reparto por caras
--  —que NO se implementa aquí, sino en `lib/data/reportes.ts`, reusando la
--  fracción de caras de `rentaAtribuidaPorSitio()`.
--
--  RLS fail-closed + FORCE por tenant (patrón M5), porque esta tabla se crea
--  después del barrido global de Hardening 1 y no la alcanza.
-- ============================================================================
begin;

create table if not exists consumos_energia (
  id          uuid primary key default gen_random_uuid(),
  -- Sin DEFAULT, y es deliberado. El DEFAULT de `tenant_id` a RGB fue una
  -- deriva real de este repo que se midió y se retiró
  -- (`20260812_sin_default_tenant.sql`): una fila insertada sin contexto de
  -- tenant acababa en otra organización SIN dar ningún error.
  tenant_id   uuid not null,

  -- ─── Anclaje EXCLUYENTE: o un predio, o una pantalla suelta ──────────────
  -- El molde es `licencias` (`20260729_licencias_permisos.sql:41-58`), y el
  -- motivo es el mismo: o ampara un predio —y con él todas sus pantallas—, o
  -- ampara una pantalla que va por su cuenta.
  --
  -- El medidor del predio es el caso normal, el que describió el dueño. La
  -- pantalla suelta está aquí porque `sitios.predio_id` es NULLABLE: hay
  -- pantallas sin predio, y si el anclaje fuera solo al predio su consumo no
  -- tendría dónde ir — se quedaría sin capturar, y el reporte diría que esa
  -- pantalla no gasta luz en vez de decir que no se sabe.
  predio_id   uuid references predios(id) on delete cascade,
  sitio_id    uuid references sitios(id)  on delete cascade,

  -- ─── El periodo es un MES de calendario ──────────────────────────────────
  -- Se guarda el día 1 del mes que cubre el recibo. El motor lo reparte por los
  -- días de ESE mes cuando el bucket del reporte lo corta a la mitad, así que
  -- una fila con `periodo = 2026-02-17` se repartiría como si el mes empezara
  -- ese día: el CHECK lo impide aquí, en la base, porque la tabla la puede
  -- escribir cualquier cosa que llegue mañana y no solo el controller de hoy.
  periodo     date not null,

  -- Identificador del medidor tal como viene impreso en el recibo (número de
  -- servicio, RPU, o como lo llame quien captura). NULLABLE: un predio con un
  -- solo medidor puede no tener el número anotado, y bloquear la captura por
  -- eso es fricción en la pantalla de quien tiene un recibo en la mano.
  --
  -- Su razón de ser es la UNICIDAD: un predio puede tener MÁS DE UN MEDIDOR, y
  -- sin el medidor en la clave el segundo recibo real del mes sería imposible
  -- de capturar. Ver el índice único más abajo.
  medidor     text,

  -- ─── Las dos cifras del recibo, las dos OBLIGATORIAS ─────────────────────
  -- NOT NULL los dos, y es una decisión, no un descuido: un recibo de luz trae
  -- siempre las dos cifras impresas.
  --
  -- Con `kwh` nullable, una fila sumaría importe y no kWh, y el costo por kWh
  -- de ese renglón saldría de dividir un importe COMPLETO entre unos kWh
  -- INCOMPLETOS. Eso no da error: da una cifra creíble y falsa. Manejarlo con
  -- cuidado costaría propagar un «no se sabe» por cinco sitios del motor y de
  -- la tabla; no admitir el dato a medias cuesta una palabra.
  kwh         numeric(12,2) not null,
  importe     numeric(14,2) not null,

  notas       text,
  creado_en   timestamptz not null default now(),
  -- Quién lo capturó. `on delete set null` y no cascade: si el usuario se va, el
  -- recibo se queda — es un costo del negocio, no una pertenencia suya.
  creado_por  uuid references usuarios(id) on delete set null
);

-- Exactamente UNO de los dos anclajes. Sin esto, una fila con los dos —o con
-- ninguno— haría ambiguo a quién se le reparte el consumo, y el reparto lo
-- tiraría en silencio: dinero capturado que no aparece en ninguna fila.
alter table consumos_energia drop constraint if exists consumo_energia_anclaje_ck;
alter table consumos_energia add  constraint consumo_energia_anclaje_ck
  check ((predio_id is not null) <> (sitio_id is not null));

-- El periodo es el primer día de su mes. Ver el comentario de la columna.
alter table consumos_energia drop constraint if exists consumo_energia_periodo_ck;
alter table consumos_energia add  constraint consumo_energia_periodo_ck
  check (extract(day from periodo) = 1);

-- Ni kWh ni importe negativos. Un importe negativo es una nota de crédito y no
-- un consumo: entrarlo aquí RESTARÍA costo y mejoraría el margen sin que nada
-- lo dijera. Si algún día hacen falta, van con su propio concepto y no como un
-- recibo en negativo. El cero sí se admite: un medidor que no giró es un hecho.
alter table consumos_energia drop constraint if exists consumo_energia_cifras_ck;
alter table consumos_energia add  constraint consumo_energia_cifras_ck
  check (kwh >= 0 and importe >= 0);

-- ─── Que el mismo recibo no se capture DOS VECES ────────────────────────────
--
-- Es el negativo más caro de esta tabla: un recibo capturado dos veces DUPLICA
-- el costo de la luz en el reporte y no da ningún error — da un margen peor de
-- lo que es, que es exactamente la clase de mentira que este módulo existe para
-- no contar.
--
-- La clave lleva el MEDIDOR dentro porque un predio puede tener más de uno. Sin
-- él, la clave `(tenant, predio, periodo)` haría imposible capturar el segundo
-- medidor real del mes, y quien captura acabaría sumando los dos recibos a mano
-- en una sola fila: el total quedaría bien y el detalle por medidor se perdería.
--
-- Y se indexa `coalesce(medidor,'')` y NO `medidor`: en Postgres los NULL son
-- DISTINTOS entre sí dentro de un índice único, así que con la columna a secas
-- dos filas con medidor nulo entrarían las dos — justo el caso del predio con un
-- solo medidor sin número anotado, que es el más común. `nulls not distinct`
-- existe desde Postgres 15 y haría lo mismo, pero ataría esta migración a la
-- versión del motor de cada instancia; el `coalesce` no.
create unique index if not exists consumos_energia_predio_uq
  on consumos_energia (tenant_id, predio_id, periodo, coalesce(medidor, ''))
  where predio_id is not null;
create unique index if not exists consumos_energia_sitio_uq
  on consumos_energia (tenant_id, sitio_id, periodo, coalesce(medidor, ''))
  where sitio_id is not null;

-- La consulta del reporte: todos los recibos de un rango de periodos, del
-- tenant. Es la única lectura caliente y crecerá con la antigüedad de la cuenta.
create index if not exists consumos_energia_periodo_ix
  on consumos_energia (tenant_id, periodo);

-- RLS fail-closed + FORCE (patrón `arr_m5_rls_failclosed`, literal de
-- `db/migrations/20260723_almacen.sql:47-60`).
--
-- FORCE es lo que impide que el DUEÑO de la tabla se salte la política.
-- Fail-closed —comparar contra `nullif(current_setting('app.tenant_id',
-- true),'')::uuid`— es lo que hace que SIN contexto de tenant no se vea nada,
-- en vez de verlo todo: la política del barrido global de Hardening 1 lleva un
-- `or ... is null` para poder migrar, y copiarlo aquí dejaría esta tabla ABIERTA
-- a cualquier consulta que no fijara el tenant.
--
-- Las DOS mitades hacen falta. Sin `with check`, una organización podría
-- INSERTAR filas con el `tenant_id` de otra y no verlas nunca — pero el reporte
-- de la otra sí, con el costo de una luz que no es suya.
-- Escrito LITERAL y no dentro del `foreach t in array` de `almacen.sql`, que es
-- el único detalle en que esto se separa de ese patrón. El predicado es el mismo
-- carácter por carácter; lo que cambia es que aquí no pasa por `format()`.
--
-- El motivo no es estético: `almacen.sql` monta dos tablas con el bucle y eso
-- gana algo, pero con UNA tabla el bucle solo esconde el SQL detrás de `%I`, y
-- **un guard que lee el archivo fuente deja de poder comprobar que la política
-- existe**. Se descubrió justo así: el guard de esta migración se quedó en rojo
-- pidiendo `alter table consumos_energia enable row level security` mientras la
-- política SÍ se creaba, porque en el archivo solo estaba `alter table %I`. El
-- mismo criterio que sigue `licencias` (`20260729_licencias_permisos.sql:73-79`).
alter table consumos_energia enable row level security;
alter table consumos_energia force  row level security;
drop policy if exists tenant_isolation on consumos_energia;
create policy tenant_isolation on consumos_energia for all
  using      (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

-- El rol de la aplicación NO se escribe a mano: en local es `spaces_app` y en
-- producción `spaces_user`. Se derivan de una tabla ya existente del mismo
-- módulo, de forma que la nueva quede con la MISMA superficie de acceso que las
-- que ya pasaron auditoría, sea cual sea el entorno.
--
-- Y si no se encuentra ninguno, se ROMPE la migración. Sin GRANT la tabla queda
-- inaccesible para la app y el síntoma no aparece al migrar: aparece como un
-- error de permisos la primera vez que alguien abre la pantalla de captura,
-- cuando nadie está mirando el log de la migración.
do $$
declare r record; n int := 0;
begin
  for r in
    select distinct grantee from information_schema.role_table_grants
     where table_name = 'contratos_arrendamiento'
       and grantee in (select rolname from pg_roles where rolcanlogin and not rolsuper)
  loop
    execute format('grant select, insert, update, delete on consumos_energia to %I', r.grantee);
    n := n + 1;
  end loop;
  if n = 0 then
    raise exception 'No se encontro el rol de la aplicacion. Sin GRANT, consumos_energia queda inaccesible para la app.';
  end if;
  raise notice 'Permisos concedidos a % rol(es) de aplicacion.', n;
end $$;

comment on table consumos_energia is
  'Recibos de luz, uno por punto de medicion y por mes. Anclaje excluyente predio/pantalla, igual que contratos y licencias. El importe se reparte entre las pantallas del predio con la MISMA fraccion de caras que la renta (lib/data/reportes.ts). Un periodo sin fila es un dato QUE FALTA, no un consumo cero: el reporte lo declara.';

commit;

-- Verificación
select 'tabla' k, coalesce((select table_name from information_schema.tables where table_name='consumos_energia'), '(FALTA)') v
union all
select 'rls_activo', (select case when relrowsecurity then 'si' else 'NO' end from pg_class where relname='consumos_energia')
union all
select 'rls_forzado', (select case when relforcerowsecurity then 'si' else 'NO' end from pg_class where relname='consumos_energia')
union all
select 'politicas', (select count(*)::text from pg_policy where polrelid='consumos_energia'::regclass)
union all
select 'constraints', (select string_agg(conname, ', ' order by conname) from pg_constraint
                        where conrelid='consumos_energia'::regclass and contype='c')
union all
select 'indices', (select string_agg(indexname, ', ' order by indexname) from pg_indexes where tablename='consumos_energia')
union all
select 'filas', (select count(*)::text from consumos_energia);
