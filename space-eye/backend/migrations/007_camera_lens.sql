-- migrations/007_camera_lens.sql
-- Encuadre fijo por dispositivo: lente y zoom.
--
-- El zoom de la vista en vivo NO llegaba a las fotos programadas: con stream la
-- foto sale de la sesion de CameraX y hereda los ajustes, pero sin stream (que es
-- el caso de toda foto por horario) se abria la camara con Camera2 sin aplicar
-- nada. El encuadre quedaba fijo al del lente principal.
--
-- Ahora la configuracion vive por dispositivo y viaja en el payload de TAKE_PHOTO,
-- asi que aplica IGUAL a la foto programada y a la manual.
--
--   camera_lens: 'main'  = lente principal (comportamiento de siempre)
--                'wide'  = gran angular (el 0.5x), para abarcar mas desde cerca.
--                Solo en equipos que lo tengan; si no, la APK usa el principal.
--   camera_zoom: 0.0 (mas abierto) .. 1.0 (mas cerrado), sobre el lente elegido.
--
-- Aditiva e idempotente.
DROP PROCEDURE IF EXISTS add_camera_lens;
DELIMITER $$
CREATE PROCEDURE add_camera_lens()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='camera_lens') THEN
    ALTER TABLE devices ADD COLUMN camera_lens VARCHAR(10) NOT NULL DEFAULT 'main';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='camera_zoom') THEN
    ALTER TABLE devices ADD COLUMN camera_zoom FLOAT NOT NULL DEFAULT 0;
  END IF;
END$$
DELIMITER ;
CALL add_camera_lens();
DROP PROCEDURE IF EXISTS add_camera_lens;
