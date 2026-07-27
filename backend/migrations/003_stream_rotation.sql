-- migrations/003_stream_rotation.sql
-- Orientacion por defecto del stream por dispositivo. La fija un admin al
-- previsualizar; todos la ven al abrir/recargar. Aditiva y compatible.
--
-- Idempotente: usa un procedimiento para agregar la columna solo si no existe
-- (MySQL 8 no soporta ADD COLUMN IF NOT EXISTS).
DROP PROCEDURE IF EXISTS add_stream_rotation;
DELIMITER $$
CREATE PROCEDURE add_stream_rotation()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'devices' AND column_name = 'stream_rotation'
  ) THEN
    ALTER TABLE devices ADD COLUMN stream_rotation SMALLINT NOT NULL DEFAULT 0 AFTER stream_quality;
  END IF;
END$$
DELIMITER ;
CALL add_stream_rotation();
DROP PROCEDURE IF EXISTS add_stream_rotation;
