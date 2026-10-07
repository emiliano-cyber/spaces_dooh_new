-- migrations/004_photo_overlay.sql
-- Marca de informacion configurable por dispositivo (nombre · fecha · hora).
-- La posicion se guarda por dispositivo y el overlay se dibuja en el dashboard
-- (no se quema en el telefono a partir de la APK v0.8.0). Aditiva e idempotente.
--
-- overlay_x / overlay_y: posicion del CENTRO del bloque de texto, en % (0-100).
--   Default 50 / 92 = abajo-centro.
-- photos.watermark_baked: TRUE si la foto ya trae la marca quemada por el telefono
--   (APK <= 0.7.0). Las fotos de v0.8.0 llegan limpias (FALSE) y reciben el overlay.
DROP PROCEDURE IF EXISTS add_photo_overlay;
DELIMITER $$
CREATE PROCEDURE add_photo_overlay()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='overlay_x') THEN
    ALTER TABLE devices ADD COLUMN overlay_x DECIMAL(5,2) NOT NULL DEFAULT 50.00;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='overlay_y') THEN
    ALTER TABLE devices ADD COLUMN overlay_y DECIMAL(5,2) NOT NULL DEFAULT 92.00;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='overlay_enabled') THEN
    ALTER TABLE devices ADD COLUMN overlay_enabled BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='photos' AND column_name='watermark_baked') THEN
    ALTER TABLE photos ADD COLUMN watermark_baked BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
END$$
DELIMITER ;
CALL add_photo_overlay();
DROP PROCEDURE IF EXISTS add_photo_overlay;
