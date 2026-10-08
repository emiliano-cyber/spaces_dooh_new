-- migrations/022_vinculacion_por_lote.sql
-- Un solo codigo (un solo QR, un solo archivo de microSD) para instalar VARIOS
-- equipos a la vez.
--
-- Instalar 20 telefonos o 20 Raspberry con un codigo cada uno son 20 clics y
-- 20 descargas. Un codigo de lote sirve para hasta `usos_max` equipos: cada uno
-- entra como un equipo distinto, con su propia llave. Los candados de un codigo
-- que sirve varias veces:
--   - tope de usos: el equipo usos_max + 1 no entra;
--   - vencimiento (lo elige quien lo genera);
--   - se cancela en cualquier momento;
--   - cada equipo que lo uso queda anotado (vinculacion_equipos), para dar de
--     baja el que no se reconozca.
-- El codigo de un solo uso sigue igual: usos_max = 1.
--
-- Aditiva e idempotente.
DROP PROCEDURE IF EXISTS vinculacion_por_lote;
DELIMITER $$
CREATE PROCEDURE vinculacion_por_lote()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='vinculaciones' AND column_name='usos_max') THEN
    ALTER TABLE vinculaciones ADD COLUMN usos_max INT NOT NULL DEFAULT 1, ADD COLUMN usos INT NOT NULL DEFAULT 0;
    -- Los de un solo uso que YA se usaron quedan contados como gastados: si no,
    -- con usos = 0 volverian a servir.
    UPDATE vinculaciones SET usos = 1 WHERE usado_en IS NOT NULL;
  END IF;
END$$
DELIMITER ;
CALL vinculacion_por_lote();
DROP PROCEDURE IF EXISTS vinculacion_por_lote;

CREATE TABLE IF NOT EXISTS vinculacion_equipos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  vinculacion_id  INT      NOT NULL,
  device_id       INT      NOT NULL,
  usado_en        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_vinculacion_equipos (vinculacion_id)
);
