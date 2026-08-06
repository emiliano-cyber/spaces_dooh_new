-- ===========================================================================
--  M13b (auditoria QA 04/08/2026) — la razon social del tenant G500.
--
--  >>> YA EJECUTADO — 2026-08-06, sobre spaces_prod. NO VOLVER A CORRER. <<<
--
--  El guard lo impide solo: la segunda pasada no encuentra la fila con el valor
--  viejo y aborta sin tocar nada. Se deja el archivo entero, no se borra —
--  el _rollback.sql sigue siendo el bueno si hiciera falta volver atras.
--
--  Ejecutado con el paso 0 (captura del estado previo de los cinco tenants) y
--  el paso 1 (ensayo en seco con rollback) por delante, ambos con la salida
--  esperada: UPDATE 1 y «RGB CATORCE S DE RL DE CV».
--
--  El informe lo reporto como cosmetico: «la razon social visible incluye el
--  prefijo DEMO». Quedo fuera del A9 del 04/08 para resolverse junto con M5.
--
--  DE:  DEMO RGB CATORCE S DE RL DE CV
--  A:   RGB CATORCE S DE RL DE CV
--
--  Por que el valor es ese y NO uno con «G500» dentro, que es lo que uno
--  esperaria de un tenant llamado G500 — confirmado con el usuario el
--  06/08/2026, y escrito aqui para que nadie lo «corrija» de vuelta:
--
--    G500 es el nombre COMERCIAL de la organizacion (`tenants.nombre`).
--    RGB CATORCE S DE RL DE CV es la razon social LEGAL de la misma empresa.
--    No son dos organizaciones: son los dos nombres de una.
--
--  Por eso el cambio es exactamente recortar el prefijo, y nada mas.
--
--  Y no es un campo decorativo: `obtenerConfigAdmin()`
--  (apps/web/lib/server/config-repo.ts:100) lo usa como la PARTE ARRENDATARIA
--  del contrato de arrendamiento que se manda a firma. Mientras diga «DEMO»,
--  los contratos de G500 salen a firma con esa palabra en el nombre de la
--  empresa que se obliga.
--
--  Tenant g500: 4cdba4aa-444d-4238-a983-959d18b1a2bf (el mismo del A9).
-- ===========================================================================

-- ---------------------------------------------------------------------------
--  PASO 0 · Capturar el estado previo. NO es opcional: la convencion de
--  docs/datos/README.md exige que el rollback se lea de la base, no se escriba
--  de memoria. Corre esto ANTES y contrasta la salida con el _rollback.sql.
--
--  Se listan los CINCO tenants y no solo g500 a proposito: si el prefijo DEMO
--  quedo en mas de uno, se ve aqui y no dentro de tres meses en un contrato.
-- ---------------------------------------------------------------------------
--
--   select id, slug, nombre, razon_social, nombre_comercial, rfc
--     from tenants
--    order by slug;
--
-- ---------------------------------------------------------------------------
--  PASO 1 · Ensayo. El mismo archivo con `commit` cambiado por `rollback`,
--  comprobando que toca UNA fila y que el valor resultante es el esperado.
-- ---------------------------------------------------------------------------

begin;

-- Guarda: si la fila ya no dice lo que este script supone —porque alguien la
-- corrigio a mano, o porque ya se aplico— se aborta en vez de pisar un valor
-- bueno. Correr esto dos veces no hace nada la segunda vez: falla y no toca.
do $$
begin
  if not exists (
    select 1 from tenants
     where id = '4cdba4aa-444d-4238-a983-959d18b1a2bf'
       and razon_social = 'DEMO RGB CATORCE S DE RL DE CV'
  ) then
    raise exception 'La razon social de g500 ya no es la que este script esperaba. Revisar a mano antes de continuar.';
  end if;
end $$;

update tenants
   set razon_social = 'RGB CATORCE S DE RL DE CV'
 where id = '4cdba4aa-444d-4238-a983-959d18b1a2bf';

-- Comprobacion en la misma transaccion: sin rastro de DEMO y con el valor
-- exacto esperado. Si algo no cuadra, la transaccion entera se deshace.
do $$
declare
  v text;
begin
  select razon_social into v from tenants where id = '4cdba4aa-444d-4238-a983-959d18b1a2bf';
  if v is distinct from 'RGB CATORCE S DE RL DE CV' then
    raise exception 'La razon social quedo en «%», que no es lo esperado.', v;
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
--  DESPUES DE APLICAR
--
--  · Administracion → Configuracion debe mostrar «RGB CATORCE S DE RL DE CV»
--    como razon social, con el nombre de la organizacion siguiendo en «G500».
--    Los dos a la vez es lo correcto: nombre comercial y razon social legal.
--  · Abrir un contrato de arrendamiento de G500 y comprobar que la parte
--    arrendataria ya no lleva «DEMO». Es lo unico que este cambio venia a
--    arreglar; sin comprobarlo, no se ha comprobado nada.
--  · Si el PASO 0 mostro el prefijo DEMO en otro tenant, o `nombre_comercial`
--    vacio donde deberia decir G500, abrir su propia intervencion: este script
--    toca una columna de un tenant y nada mas.
-- ---------------------------------------------------------------------------
