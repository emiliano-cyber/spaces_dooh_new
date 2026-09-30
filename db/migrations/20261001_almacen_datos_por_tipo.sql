-- @tipo: esquema
-- ============================================================================
--  ALM-01 · los datos propios de cada articulo del almacen.
--  PENDIENTE DE APROBACION DEL DUENO al escribirse (regla del 29/09: ninguna
--  columna aterriza en main sin que el vea la forma).
-- ----------------------------------------------------------------------------
--  Pedido del dueno el 2026-09-30: «en almacen se debe de poder anadir mas
--  elementos, camionetas, herramientas, pantallas, camaras, etc.».
--
--  El TIPO no necesita migracion: `almacen_activos.tipo_activo` es `text` SIN
--  CHECK desde `20260723_almacen.sql:26`, y el catalogo nuevo lo aplica el
--  servidor (`apps/web/lib/almacen-tipos.ts`). Lo que no cabe en ninguna
--  columna de hoy son los datos que distinguen una camioneta de otra: placas,
--  marca, modelo, numero de serie, y en que bodega esta guardado algo. Sin
--  esto, van a `notas` y no se pueden ni buscar ni ensenar en columna.
--
--  ─── CINCO COLUMNAS text, NULLABLE Y SIN DEFAULT ─────────────────────────
--  NULL = «no se capturo», y es lo que tienen TODAS las filas de antes. Sin
--  default para no inventar un dato que nadie tecleo.
--
--    marca, modelo, numero_serie   equipo, herramienta, camara, vehiculo (VIN)
--    placas                        SOLO vehiculos (CHECK de abajo)
--    ubicacion                     cualquiera: donde esta guardado. NO es
--                                  `sitio_id`, que dice en que PANTALLA esta
--                                  instalado; esto es «bodega norte, anaquel 3»
--
--  ─── POR QUE NO LLEVA CHECK `tipo_activo in (...)` ────────────────────────
--  Seria lo natural (text + CHECK, zona A5), y NO se pone a proposito: hasta
--  el 30/09 la ruta aceptaba CUALQUIER texto en `tipo_activo`, asi que puede
--  haber filas en produccion con valores fuera del catalogo. Un CHECK normal
--  haria abortar esta migracion en esa base; uno `not valid` la dejaria pasar
--  pero haria fallar el siguiente UPDATE de esas filas —el que cambia su
--  estado al moverlas—, que es peor porque rompe el almacen DESPUES y sin
--  aviso. El catalogo lo aplica el servidor. Si el dueno lo quiere tambien en
--  la base, primero se mide cuantas filas estan fuera (consulta al final) y se
--  decide que hacer con ellas.
--
--  Idempotente y PG14 (g500 corre 14.24), y por eso SIN `@pg-min`:
--  `add column if not exists` y los CHECK dentro de
--  `do $$ ... if not exists (pg_constraint)`, sin nada de 15. Ensayada el
--  30/09 en un postgres:14-alpine (14.24) desechable: dos pasadas, y una fila
--  vieja con texto libre en el tipo se sigue pudiendo mover.
--  La RLS y los GRANT de la tabla son de `20260723_almacen.sql` y cubren las
--  columnas nuevas sin tocar nada: la politica es por fila y el GRANT por tabla.
-- ============================================================================
begin;

alter table almacen_activos add column if not exists marca        text;
alter table almacen_activos add column if not exists modelo       text;
alter table almacen_activos add column if not exists numero_serie text;
alter table almacen_activos add column if not exists placas       text;
alter table almacen_activos add column if not exists ubicacion    text;

-- Los CHECK aparte del `add column`, para que la migracion sea idempotente
-- tambien a medias. Mismo patron que `20260929_costo_real_ot.sql`.
do $$ begin
  -- Unas placas en una camara son un error de captura, y guardarlas haria que
  -- buscar por placa encontrara una camara. El servidor ya lo rechaza; esto lo
  -- para si alguien entra por otro lado. Todas las filas de antes tienen
  -- `placas` NULL, asi que no puede fallar al crearse.
  if not exists (
    select 1 from pg_constraint
     where conname = 'almacen_activos_placas_solo_vehiculo'
       and conrelid = 'almacen_activos'::regclass
  ) then
    alter table almacen_activos
      add constraint almacen_activos_placas_solo_vehiculo
      check (placas is null or tipo_activo = 'VEHICULO');
  end if;

  -- Los mismos topes que el zod de `almacen-controller.ts`: un texto de un
  -- mega en una marca no es un dato, es un accidente o un abuso.
  if not exists (
    select 1 from pg_constraint
     where conname = 'almacen_activos_datos_largo'
       and conrelid = 'almacen_activos'::regclass
  ) then
    alter table almacen_activos
      add constraint almacen_activos_datos_largo
      check (
            coalesce(char_length(marca), 0)        <= 120
        and coalesce(char_length(modelo), 0)       <= 120
        and coalesce(char_length(numero_serie), 0) <= 120
        and coalesce(char_length(placas), 0)       <= 20
        and coalesce(char_length(ubicacion), 0)    <= 200
      );
  end if;
end $$;

comment on column almacen_activos.placas is
  'ALM-01. Placas de un vehiculo, sin espacios y en mayusculas (lo normaliza el servidor). SOLO para tipo_activo = VEHICULO: el CHECK almacen_activos_placas_solo_vehiculo lo impone.';
comment on column almacen_activos.ubicacion is
  'ALM-01. Donde esta guardado el articulo (bodega, anaquel). No es sitio_id, que dice en que pantalla esta INSTALADO.';

commit;

-- ─── Verificacion ──────────────────────────────────────────────────────────
-- La ultima fila es la que decide si algun dia se puede poner el CHECK del
-- tipo: cuantas filas tienen un `tipo_activo` fuera del catalogo de hoy.
select 'columnas nuevas en almacen_activos' k, count(*)::text v
  from information_schema.columns
 where table_name = 'almacen_activos'
   and column_name in ('marca','modelo','numero_serie','placas','ubicacion')
union all
select 'checks nuevos', count(*)::text
  from pg_constraint
 where conname in ('almacen_activos_placas_solo_vehiculo','almacen_activos_datos_largo')
union all
select 'filas con tipo_activo fuera del catalogo', count(*)::text
  from almacen_activos
 where tipo_activo not in ('VEHICULO','HERRAMIENTA','PANTALLA','EQUIPO','CAMARA','ESTRUCTURA','LONA','OTRO');
