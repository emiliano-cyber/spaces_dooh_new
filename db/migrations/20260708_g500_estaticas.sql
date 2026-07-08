-- ============================================================================
--  S0-3: reclasificación de inventario — las ESPECTACULAR son estáticas
-- ----------------------------------------------------------------------------
--  Las pantallas de G500 estaban marcadas exhibicion='rotativo' / total_spots=12,
--  por lo que el motor las trataba como digitales de 12 slots y permitía
--  doble-booking. Son estáticas (1 cara): reserva exclusiva con bloqueo duro de
--  traslapes. Se alinea el dato para que todas las vistas (Inventario, Comercial,
--  Disponibilidad, Network) sean consistentes. Idempotente.
-- ============================================================================

update public.sitios
   set es_rotativo       = false,
       exhibicion        = 'fijo',
       total_spots       = 1,
       spots_disponibles = null
 where tipo_medio = 'ESPECTACULAR';
