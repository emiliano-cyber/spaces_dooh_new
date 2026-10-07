-- migrations/023_envio_agrupado_y_aviso_rapido.sql
-- Dos ajustes de la vigilancia de la pantalla, por equipo (oct-2026):
--
--   creative_envio_min: cuando mandar las fotos de creativos NUEVOS.
--     0 = al momento (como hasta ahora). 120/240/480/720 = juntas cada 2, 4, 8
--     o 12 horas, una por creativo (la mas nitida). El equipo sigue MIRANDO
--     todo el tiempo: solo cambia cuando manda. Agrupar no ahorra datos; el
--     consumo lo cuida el tope diario (creative_max_dia).
--
--   salud_aviso_rapido: la pantalla COMPLETA apagada en su horario avisa en
--     menos de un minuto, sin esperar la segunda confirmacion. Encendido por
--     omision: es el caso mas grave y el que el cliente nota primero.
--
-- Aditiva e idempotente.
DROP PROCEDURE IF EXISTS envio_agrupado_y_aviso_rapido;
DELIMITER $$
CREATE PROCEDURE envio_agrupado_y_aviso_rapido()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='creative_envio_min') THEN
    ALTER TABLE devices ADD COLUMN creative_envio_min INT NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='salud_aviso_rapido') THEN
    ALTER TABLE devices ADD COLUMN salud_aviso_rapido TINYINT(1) NOT NULL DEFAULT 1;
  END IF;
END$$
DELIMITER ;
CALL envio_agrupado_y_aviso_rapido();
DROP PROCEDURE IF EXISTS envio_agrupado_y_aviso_rapido;
