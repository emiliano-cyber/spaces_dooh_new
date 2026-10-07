-- migrations/010_ventanas_aleatorias.sql
-- Fotos a una hora impredecible dentro de franjas de horario.
--
-- Para que una foto sirva de auditoria no puede caer siempre al mismo minuto:
-- si el horario es predecible, deja de ser evidencia de lo que pasa el resto del
-- dia. Pero tampoco sirve el azar puro, porque puede amontonar todas las fotos
-- en la madrugada y dejar el dia sin cobertura.
--
-- La solucion son FRANJAS: se define "entre 8 y 10, entre 13 y 15, entre 18 y 20"
-- y el sistema toma UNA foto en un minuto al azar dentro de cada franja. Cada dia
-- sortea minutos distintos.
--
--   windows: [{"ini":"08:00","fin":"10:00"}, {"ini":"18:00","fin":"20:00"}]
--            Las horas son de PARED en la zona horaria del schedule (timezone),
--            no del servidor: el backend corre en UTC y sin esto una franja de
--            las 8 de la manana disparaba a las 2 de la madrugada.
--
-- Una franja puede cruzar la medianoche ("22:00" a "02:00"): se entiende que
-- termina al dia siguiente.
--
-- Aditiva e idempotente.
DROP PROCEDURE IF EXISTS add_ventanas_aleatorias;
DELIMITER $$
CREATE PROCEDURE add_ventanas_aleatorias()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema=DATABASE() AND table_name='schedules' AND column_name='windows') THEN
    ALTER TABLE schedules ADD COLUMN windows JSON NULL
      COMMENT 'Franjas horarias [{ini,fin}] para frequency_type=random_windows';
  END IF;

  -- El tipo nuevo se suma a los que ya existian; los schedules viejos no se tocan.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema=DATABASE() AND table_name='schedules'
                   AND column_name='frequency_type' AND COLUMN_TYPE LIKE '%random_windows%') THEN
    ALTER TABLE schedules MODIFY COLUMN frequency_type
      ENUM('interval','cron','specific_times','random_windows') NOT NULL;
  END IF;
END$$
DELIMITER ;
CALL add_ventanas_aleatorias();
DROP PROCEDURE IF EXISTS add_ventanas_aleatorias;
