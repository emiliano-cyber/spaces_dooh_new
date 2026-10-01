-- @tipo: esquema
-- ============================================================================
--  Las pantallas digitales que entraron por CSV ANTES del 2026-09-29 se
--  reservaban como FIJAS. Esta migración corrige esas filas.
-- ----------------------------------------------------------------------------
--  Encontrado en DEMO el 2026-10-01: una campaña generada desde una propuesta
--  sobre «Santa Fe Torre Digital» salió OOH (fija), con `spots_reservados`
--  null, igual que otra del 29/09. En el inventario la pantalla SÍ se veía
--  digital. En local, la misma pantalla daba DOOH.
--
--  ─── LA CAUSA ───────────────────────────────────────────────────────────────
--  El arreglo de `b25c7ca6` (29/09) hizo que el IMPORTADOR escriba
--  `tipo_medio = 'PANTALLA_DIGITAL'` cuando la pantalla es digital
--  (`valoresDe`, lib/server/sitios-repo.ts). Antes ponía en `tipo_medio` solo la
--  estructura física —ESPECTACULAR, MURAL, MOBILIARIO_URBANO, OTRO—, y el
--  booking mira SOLO `tipo_medio` (`generarCampanaDesdePropuesta` y la reserva
--  directa, en campanas-repo.ts).
--
--  Aquel arreglo cuidó las cargas NUEVAS. Nadie corrigió las que ya estaban: en
--  DEMO las 10 pantallas de `carga-digitales-demo.csv` se cargaron el 25/09, y
--  seguían con su estructura física en `tipo_medio`. Esta migración es la
--  mitad que faltaba.
--
--  ─── EL CRITERIO, Y POR QUÉ ESTOS TRES Y NO UNO ─────────────────────────────
--  Una fila se corrige solo si tiene las TRES marcas que el importador viejo
--  ponía únicamente a las digitales (`importarSitios`, en sitios-repo.ts):
--
--   · `exhibicion` en ('digital','rotativo')
--   · `comercializacion = 'PROGRAMATICO'`
--   · `total_spots` no nulo (el importador ponía 12; a una fija, null)
--
--  `exhibicion = 'rotativo'` SOLO no basta: un prisma rotativo es una lona y
--  puede llevar esa marca. Lo que lo distingue es que es TRADICIONAL y no tiene
--  slots. Por eso la prueba lleva ese caso, y no se toca.
--
--  ─── LO QUE NO SE PIERDE, Y LO QUE NO SE TOCA ───────────────────────────────
--   · La estructura física sigue en `tipo_estructura` («Pantalla LED», «Mupi
--     digital»), que es donde el CSV la trae. Es la misma decisión del 29/09.
--   · NO se corrigen campañas ni reservas ya creadas. En una instancia con datos
--     reales, una campaña así puede estar impresa o facturada, y cambiarle el
--     tipo por debajo movería sus candados sin que nadie lo decidiera. Las de
--     DEMO son de prueba y se regeneran a mano. Decidido por el dueño el 01/10.
--
--  Recorre TODAS las organizaciones de la instancia: el migrador tiene
--  `bypassrls`, que es justo lo que esto necesita. Idempotente: la segunda vez
--  ya no hay filas que cumplan el criterio.
--
--  Efecto visible y correcto: estas pantallas dejan de contar en el reporte por
--  metro cuadrado, que excluye las digitales a propósito.
-- ============================================================================

begin;

do $$
declare n int;
begin
  update sitios
     set tipo_medio = 'PANTALLA_DIGITAL'
   where tipo_medio <> 'PANTALLA_DIGITAL'
     and exhibicion in ('digital', 'rotativo')
     and comercializacion = 'PROGRAMATICO'
     and total_spots is not null;
  get diagnostics n = row_count;
  raise notice 'pantallas digitales corregidas: %', n;
end $$;

commit;
