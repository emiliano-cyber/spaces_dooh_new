-- ============================================================================
--  FINANZAS captura el costo de una orden de trabajo · accion `operaciones.costear`
-- ----------------------------------------------------------------------------
--  Pedido del dueno el 2026-09-29, encima del ADR 0040. El motivo es de oficio:
--  **la factura de la cuadrilla le llega a Finanzas**, asi que son ellos quienes
--  saben lo que costo la visita. Hoy FINANZAS tiene exactamente CUATRO filas
--  --`finanzas` ver/crear/facturar y `dashboard` ver-- y NI UNA de operaciones,
--  asi que `PATCH /api/ot/:id/costo` les contesta 403.
--
--  --- POR QUE UNA ACCION NUEVA Y NO `operaciones.crear` --------------------
--
--  Porque `operaciones.crear` NO es «capturar un costo»: es **crear y CERRAR
--  ordenes de trabajo** (`POST /api/ot` y `POST /api/ot/:id/cerrar`, medido el
--  29/09). Darsela a Finanzas para que teclee un importe les entregaria de paso
--  el trabajo de campo entero, que no es lo que se pidio ni de lejos. Una accion
--  nueva dice exactamente lo que autoriza y nada mas.
--
--  Se descarto tambien mover la ruta a `finanzas.crear`: dejaria FUERA a
--  OPERACIONES, que es quien manda la cuadrilla y muchas veces sabe el importe
--  antes que nadie, y ademas mezclaria el modulo de una pantalla que vive en
--  Operaciones.
--
--  --- LAS CUATRO FILAS, Y POR QUE CADA UNA --------------------------------
--
--   · DUENO        -> **EL DUENO NO TIENE BYPASS.** `permisosDeRol` y
--                     `tienePermiso` (`lib/server/auth.ts`) consultan la tabla
--                     sin excepcion para ningun rol. Una accion nueva sin su
--                     fila deja al dueno sin poder capturar el costo, y el
--                     sintoma seria «yo, que soy el dueno, no puedo» -- que no
--                     senala la causa. Mismo vicio que el default de
--                     `usuarios.rol`.
--   · ADMINISTRADOR-> el ADR 0040 dice que hace «las mismas cosas que el dueno».
--                     Sin esta fila esa frase deja de ser cierta, y la prueba
--                     que la comprueba se pone roja -- a proposito.
--   · OPERACIONES  -> ya trabajan las OT; el costo es parte de cerrar la visita.
--   · FINANZAS     -> el motivo del encargo.
--
--  Y una QUINTA fila que no es de la accion nueva: **`FINANZAS` + `operaciones`
--  + `ver`**. La tarjeta de captura vive DENTRO de la vista de la OT
--  (`components/operaciones/OTVista.tsx`), y `GET /api/ot` y `GET /api/ot/:id`
--  exigen `operaciones.ver`. No se puede costear lo que no se puede abrir.
--
--  > [!danger] LO QUE ESA QUINTA FILA ABRE DE MAS, dicho antes de hacerlo
--  > `operaciones.ver` gobierna TRES endpoints mas, no solo la OT:
--  > `GET /api/almacen` y `GET /api/energia/consumos`. Con esta fila, FINANZAS
--  > puede LEER el almacen y los recibos de luz de su propia organizacion.
--  > Las pantallas no se les abren --el menu no les da entrada-- pero el dato es
--  > alcanzable por la API.
--  >
--  > Se acepta porque son lecturas operativas de la MISMA empresa (la RLS sigue
--  > acotando por tenant) y porque la alternativa --partir `operaciones` en dos
--  > modulos-- es mucho mas cara. Pero es una ampliacion real y queda escrita
--  > aqui, no descubierta despues.
--
--  --- ESTO ES DE TODA LA FLOTA, NO POR EMPRESA ----------------------------
--
--  `rol_permisos` **NO tiene `tenant_id`** (`db/schema.sql`, primaria
--  `(rol, modulo, accion)`). O sea que esto aplica a g500 y a cualquier
--  instancia futura, y **no hay forma de que una empresa lo tenga distinto**. Es
--  lo contrario de las promociones del ADR 0039, que si cuelgan de la
--  organizacion. Si manana una empresa quiere que Finanzas NO costee, la unica
--  salida es borrar esa fila EN SU BASE a mano.
--
--  --- POR QUE EL NOMBRE EMPIEZA POR `roles_` ------------------------------
--
--  Por el ORDEN. Este archivo inserta filas para `ADMINISTRADOR`, que es un
--  valor de enum que anade `20260929_roles_de_venta_enum.sql`, y el orden del
--  runner es lexicografico: `roles_de_venta_*` < `roles_operaciones_costear`
--  ('d' < 'o'). Con cualquier otro nombre --`ot_`, `costear_`, `finanzas_`--
--  este archivo correria ANTES y moriria con «invalid input value for enum».
--  Se renombra en vez de tocar `ANTES_DE` porque ninguna de las tres esta
--  aplicada todavia en ningun sitio: renombrar solo confunde cuando ya se
--  desplego. Lo fija `scripts/migrar.test.ts`.
--
--  Idempotente: `on conflict do nothing` y ni un `delete` ni un `update`.
-- ============================================================================

begin;

-- --- 0 · GUARD: los valores del enum que se usan aqui ya existen ----------
-- Sin esto, el fallo seria un «invalid input value for enum "rol_demo"» a mitad
-- del insert, que no dice cual es el problema de verdad: que este archivo corrio
-- antes que el que anade el valor.
do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'rol_demo' and e.enumlabel = 'ADMINISTRADOR'
  ) then
    raise exception
      'Al enum rol_demo le falta ADMINISTRADOR. Aplica antes '
      '20260929_roles_de_venta_enum.sql: este archivo va DESPUES a proposito.';
  end if;
end $$;

-- --- 1 · La accion nueva ---------------------------------------------------
insert into rol_permisos (rol, modulo, accion)
values
  ('DUENO',         'operaciones', 'costear'),
  ('ADMINISTRADOR', 'operaciones', 'costear'),
  ('OPERACIONES',   'operaciones', 'costear'),
  ('FINANZAS',      'operaciones', 'costear'),
  -- La quinta: sin `ver` no llega a la pantalla donde se captura.
  ('FINANZAS',      'operaciones', 'ver')
on conflict (rol, modulo, accion) do nothing;

-- --- 2 · ASSERT ------------------------------------------------------------
do $$
declare faltan text;
begin
  select string_agg(format('%s.%s.%s', c.rol, c.modulo, c.accion), ', ' order by 1)
    into faltan
    from (values
      ('DUENO','operaciones','costear'),
      ('ADMINISTRADOR','operaciones','costear'),
      ('OPERACIONES','operaciones','costear'),
      ('FINANZAS','operaciones','costear'),
      ('FINANZAS','operaciones','ver')
    ) as c(rol, modulo, accion)
   where not exists (
     select 1 from rol_permisos p
      where p.rol::text = c.rol and p.modulo = c.modulo and p.accion = c.accion
   );
  if faltan is not null then
    raise exception 'Faltan filas de `operaciones.costear`: %', faltan;
  end if;

  -- FINANZAS captura el costo; NO crea ni cierra ordenes. Si apareciera
  -- `operaciones.crear`, alguien tomo el atajo que esta migracion existe para
  -- evitar, y el sintoma seria que Finanzas puede cerrar una OT -- algo que NO
  -- da ningun error y que nadie mira.
  if exists (
    select 1 from rol_permisos
     where rol::text = 'FINANZAS' and modulo = 'operaciones' and accion = 'crear'
  ) then
    raise exception
      'FINANZAS tiene `operaciones.crear`: eso es crear y CERRAR ordenes de '
      'trabajo, no capturar un costo. La accion que se pidio es `costear`.';
  end if;
end $$;

commit;

-- --- Verificacion ----------------------------------------------------------
--   select rol::text, accion from rol_permisos
--    where modulo = 'operaciones' order by 1, 2;
--   -- ADMINISTRADOR: costear, crear, aprobar, ver
--   -- DUENO:         costear, crear, aprobar, ver
--   -- FINANZAS:      costear, ver
--   -- IMPRENTA:      ver
--   -- OPERACIONES:   costear, crear, ver
--
-- --- ROLLBACK --------------------------------------------------------------
-- Deshacerlo deja a Finanzas sin poder capturar el costo y **al dueno tambien**,
-- porque el dueno no tiene bypass:
--
--   delete from rol_permisos
--    where modulo = 'operaciones'
--      and (accion = 'costear' or (rol::text = 'FINANZAS' and accion = 'ver'));
--
-- Y hay que devolver el guard de la ruta a `operaciones.crear` en el mismo
-- movimiento (`app/api/ot/[id]/costo/route.ts`), o la captura queda cerrada para
-- todo el mundo.
