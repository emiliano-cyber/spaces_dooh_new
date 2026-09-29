-- ============================================================================
--  ADR 0040 · Los CUATRO valores nuevos de `rol_demo`, y NADA MAS.
-- ----------------------------------------------------------------------------
--  ESTE ARCHIVO SOLO ANADE VALORES AL ENUM. No siembra permisos, no cambia el
--  default de ninguna columna y no toca una sola fila. Parece un desperdicio de
--  archivo y no lo es: es la unica forma de que la migracion de al lado pueda
--  usarlos.
--
--  --- La regla de Postgres que obliga a partirlo en dos ----------------------
--
--      Un valor de enum recien anadido NO SE PUEDE USAR en la misma
--      transaccion que lo anadio.
--
--  MEDIDO el 2026-09-29 contra PostgreSQL 14.24 --que es lo que corre g500, la
--  unica instancia con datos de cliente-- y no razonado:
--
--      begin;
--      alter type rol_demo add value if not exists 'VENDEDOR';
--      alter table usuarios alter column rol set default 'VENDEDOR';
--      commit;
--
--      ERROR:  unsafe use of new value "VENDEDOR" of enum type rol_demo
--      HINT:   New enum values must be committed before they can be used.
--
--  Las migraciones de este repositorio son transaccionales --traen su propio
--  `begin; ... commit;`-- asi que una sola migracion que anada 'VENDEDOR' y
--  ademas lo use MUERE, y muere en el droplet.
--
--  --- Por que DOS ARCHIVOS bastan, y como se comprobo ------------------------
--
--  `scripts/migrar.mjs` aplica CADA archivo con su propia `cli.query()`, y cada
--  archivo trae su `begin; ... commit;`. O sea que dos archivos son DOS
--  TRANSACCIONES sobre la misma conexion, y eso es exactamente lo que la regla
--  pide: la primera confirma, la segunda ya puede usar los valores.
--  `apps/web/lib/test/db-e2e.ts` hace lo mismo con `p.query()` por archivo.
--
--  Ensayado contra el mismo PostgreSQL 14.24, en una sola sesion, y pasa.
--
--  --- El orden, que aqui es load-bearing ------------------------------------
--
--  Hoy sale del orden lexicografico: `..._enum.sql` va antes que
--  `..._matriz.sql` porque 'e' < 'm'. NO se anade una entrada a `ANTES_DE`
--  --ese mapa es para las excepciones REALES, y esta no lo es-- pero si se fija
--  con una prueba (`scripts/migrar.test.ts`) y con un guard dentro de la
--  migracion de al lado, que se niega a correr si estos valores no existen ya.
--  Un renombrado que invierta el orden se entera en CI, no en el servidor.
--
--  --- Lo que este archivo NO hace, a proposito ------------------------------
--
--  NO quita 'COMERCIAL' del enum. No se puede sin recrear el tipo entero
--  --soltar el default, reescribir cada columna que lo usa, volverlo a crear--,
--  y sobre una tabla con datos y con la cola de migraciones de g500 parada eso
--  es un riesgo que no compra nada. COMERCIAL se retira DE USO en el archivo de
--  al lado: sin filas en `rol_permisos` el valor existe y no autoriza nada.
--
--  Idempotente: `if not exists` en las cuatro. Reaplicarla no cambia nada.
-- ============================================================================

begin;

-- ADMINISTRADOR · el cuarto rol, precisado el 2026-09-29: «no es el dueno, pero
-- puede hacer las mismas cosas que el». Con dos excepciones que NO salen de la
-- matriz de permisos y viven en el codigo (ver el archivo de al lado).
alter type rol_demo add value if not exists 'ADMINISTRADOR';

-- DIRECTOR_COMERCIAL · autoriza los descuentos que se salen del techo de quien
-- vende, y define el catalogo de precio.
alter type rol_demo add value if not exists 'DIRECTOR_COMERCIAL';

-- GERENTE_VENTAS · crea paquetes cerrados SIN pedir permiso.
alter type rol_demo add value if not exists 'GERENTE_VENTAS';

-- VENDEDOR · cotiza, aplica descuentos y codigos. No crea ninguno de los dos.
-- Es ademas el DEFAULT nuevo de `usuarios.rol` (en el archivo de al lado).
alter type rol_demo add value if not exists 'VENDEDOR';

commit;

-- --- Verificacion ----------------------------------------------------------
--   select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
--    where t.typname = 'rol_demo' order by e.enumsortorder;
--   -- se esperan 10: los 6 de `db/schema.sql` mas estos 4.
--
-- --- ROLLBACK --------------------------------------------------------------
-- NO HAY. Un valor de enum no se puede quitar sin recrear el tipo entero. Esa
-- es la razon por la que esta migracion se aprueba antes de aplicarse y no
-- despues: lo que entra aqui se queda.
