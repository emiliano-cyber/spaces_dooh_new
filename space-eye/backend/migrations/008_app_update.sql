-- migrations/008_app_update.sql
-- Actualizacion remota de la app desde el dashboard.
--
-- Hasta ahora, cada version nueva exigia ir sitio por sitio a reinstalar el APK.
-- Con esto el equipo descarga e instala la actualizacion cuando se le ordena:
-- silenciosa si la app es device owner, con una confirmacion en pantalla si no.
--
--   commands.command_type: se agrega 'UPDATE_APP' al enum.
--   devices.device_owner:   si el equipo puede instalar SIN intervencion humana.
--   devices.app_version_code: numero de version instalado (el nombre "0.9.0" no
--                             sirve para comparar; el codigo si).
--
-- Aditiva e idempotente.
ALTER TABLE commands MODIFY COLUMN command_type
  ENUM('TAKE_PHOTO','START_STREAM','STOP_STREAM','UPDATE_CONFIG','REBOOT_APP',
       'SYNC_SCHEDULE','CHANGE_QUALITY','UPDATE_APP') NOT NULL;

DROP PROCEDURE IF EXISTS add_app_update;
DELIMITER $$
CREATE PROCEDURE add_app_update()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='device_owner') THEN
    ALTER TABLE devices ADD COLUMN device_owner TINYINT(1) NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='app_version_code') THEN
    ALTER TABLE devices ADD COLUMN app_version_code INT NULL;
  END IF;
END$$
DELIMITER ;
CALL add_app_update();
DROP PROCEDURE IF EXISTS add_app_update;
