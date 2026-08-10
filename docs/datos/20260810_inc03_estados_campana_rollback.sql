-- ============================================================================
--  ROLLBACK de los estados que movió el barrido de INC-03 · 2026-08-10
-- ----------------------------------------------------------------------------
--  Esto NO es un cambio de datos a mano: es la vuelta atrás de un cambio que
--  hace el CÓDIGO solo. Se captura igualmente, y por un motivo concreto:
--
--    revertir el despliegue NO deshace lo que el barrido ya escribió.
--
--  En cuanto alguien con permiso de comercial abre una pantalla, `/api/estado`
--  dispara `recomputarEstadoCampanas()` y las dos campañas de abajo cambian de
--  estado en la base. Si después hubiera que volver al código anterior, esas
--  filas se quedarían movidas. Este archivo es la única forma de devolverlas.
--
--  Ensayo en seco previo (2026-08-10, contra spaces_prod, como `postgres`):
--
--    REGLA 1 → COMPLETADA .... 2 filas, las de abajo. Las dos terminaron de
--                              verdad: hoy es 2026-08-10.
--    REGLA 2 → ACTIVA ........ 0 filas.
--
--  Estado capturado ANTES de desplegar:
--
--    id                                    nombre                    estado  fecha_fin
--    61d39881-79f0-4366-9e1b-99ede64ac5ef  KFC                       ACTIVA  2026-08-08
--    7cca5163-1c50-4710-a7cd-cbca67820320  Propuesta para cliente 1  ACTIVA  2026-07-31
--
--  Las dos son del tenant 4cdba4aa-444d-4238-a983-959d18b1a2bf (g500).
--
--  Ninguna otra campaña se toca. Las que están COMPLETADA con fecha de fin
--  futura (`pruebas_produccion`, `card`, `prueba anual`…) el barrido las deja
--  como están a propósito: son cierres anticipados, decisiones de una persona.
--
--  Cómo correrlo (como `postgres`, igual que la captura):
--
--    sudo -u postgres psql -d spaces_prod -f 20260810_inc03_estados_campana_rollback.sql
--
--  Lleva su propia comprobación y hace COMMIT solo si cuadra.
-- ============================================================================

begin;

update campanas set estado_comercial = 'ACTIVA'
 where id = '61d39881-79f0-4366-9e1b-99ede64ac5ef'
   and estado_comercial = 'COMPLETADA';

update campanas set estado_comercial = 'ACTIVA'
 where id = '7cca5163-1c50-4710-a7cd-cbca67820320'
   and estado_comercial = 'COMPLETADA';

-- Guardarraíl: si no quedan las dos en ACTIVA, algo no es lo que se capturó
-- —quizá alguien las movió a mano entre medias— y es mejor no tocar nada.
do $$
declare n int;
begin
  select count(*) into n from campanas
   where id in ('61d39881-79f0-4366-9e1b-99ede64ac5ef',
                '7cca5163-1c50-4710-a7cd-cbca67820320')
     and estado_comercial = 'ACTIVA';
  if n <> 2 then
    raise exception 'Se esperaban 2 campañas en ACTIVA y hay %. Se aborta.', n;
  end if;
end $$;

-- OJO: la bitácora es append-only y NO se limpia. Los apuntes «Campaña
-- completada automáticamente…» se quedan, y está bien: pasó. Lo que se deshace
-- es el estado, no la historia.

commit;
