-- migrations/025_actualizacion_sin_toque.sql
-- Si el telefono se actualiza solo, y si no, por que (oct-2026).
--
-- Desde la APK 0.16.4 la app declara UPDATE_PACKAGES_WITHOUT_USER_ACTION y, en
-- Android 12+, se actualiza a si misma sin que nadie confirme. Cada estado
-- reporta:
--   app_actualiza_sola: 1 = la proxima actualizacion entra sola (o es kiosco).
--   app_actualiza_motivo: kiosco | sola | android_viejo | sin_permiso |
--     sin_instalar_apps | otro_dueno (ver AppUpdater.decidir).
--   app_instalador: quien instalo la app (diagnostico).
--   android_sdk: version de Android (31 = Android 12).
-- NULL = version anterior a la 0.16.4: no lo sabe decir, y pedira un toque.
--
-- Aditiva e idempotente.
DROP PROCEDURE IF EXISTS actualizacion_sin_toque;
DELIMITER $$
CREATE PROCEDURE actualizacion_sin_toque()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='app_actualiza_sola') THEN
    ALTER TABLE devices
      ADD COLUMN app_actualiza_sola TINYINT(1) NULL,
      ADD COLUMN app_actualiza_motivo VARCHAR(30) NULL,
      ADD COLUMN app_instalador VARCHAR(120) NULL,
      ADD COLUMN android_sdk SMALLINT NULL;
  END IF;
END$$
DELIMITER ;
CALL actualizacion_sin_toque();
DROP PROCEDURE IF EXISTS actualizacion_sin_toque;
