-- migrations/019_aprendizaje.sql
-- Cuanto aprende un equipo antes de empezar a avisar, configurable por equipo.
--
-- Hasta aqui era fijo en 24 horas (creativos y fallas). Pedido del 24-sep-2026:
-- en produccion basta con 2 horas, y en pruebas debe armarse con la PRIMERA
-- vuelta para poder probar fallas sin esperar.
--
--   aprendizaje_min = 0    -> aprende solo la primera vuelta y ya vigila
--   aprendizaje_min = 120  -> 2 horas (el nuevo valor por omision)
--
-- Lo que se pierde con un aprendizaje corto, y conviene saberlo:
--   - las zonas tapadas (una barda) se aprenden solas con 2 vueltas o mas; con 0
--     hay que marcarlas a mano en el dashboard;
--   - un creativo solo visto de dia puede no reconocerse la primera noche y
--     gastar una foto (el tope diario lo limita). Despues queda aprendido.
--
-- Aplica a creativos y a fallas por igual. Aditiva e idempotente.
DROP PROCEDURE IF EXISTS add_aprendizaje;
DELIMITER $$
CREATE PROCEDURE add_aprendizaje()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='aprendizaje_min') THEN
    ALTER TABLE devices ADD COLUMN aprendizaje_min SMALLINT UNSIGNED NOT NULL DEFAULT 120
      COMMENT 'Minutos que el equipo solo aprende (creativos y fallas) antes de avisar; 0 = solo la primera vuelta';
  END IF;
END$$
DELIMITER ;
CALL add_aprendizaje();
DROP PROCEDURE IF EXISTS add_aprendizaje;
