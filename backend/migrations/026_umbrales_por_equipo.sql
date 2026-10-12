-- migrations/026_umbrales_por_equipo.sql
-- Umbrales de la revision de la pantalla, AJUSTABLES desde la web por equipo
-- (oct-2026). Hasta ahora vivian en el codigo de la app: corregir una falsa
-- alarma de un sitio exigia una APK nueva.
--
--   salud_cambio_minimo: diferencia media (niveles de gris) entre dos vistazos
--     para contar "cambio el anuncio". NULL = el de fabrica (8). Una pantalla
--     deslavada por el sol cambia poco aunque cambie el anuncio: bajarlo evita
--     "pantalla congelada" falsas.
--   salud_sin_contenido: fraccion de la textura normal bajo la cual la pantalla
--     se da por apagada o sin contenido. NULL = el de fabrica (0.4).
--
-- Aditiva e idempotente.
DROP PROCEDURE IF EXISTS umbrales_por_equipo;
DELIMITER $$
CREATE PROCEDURE umbrales_por_equipo()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='salud_cambio_minimo') THEN
    ALTER TABLE devices ADD COLUMN salud_cambio_minimo DECIMAL(4,1) NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='salud_sin_contenido') THEN
    ALTER TABLE devices ADD COLUMN salud_sin_contenido DECIMAL(3,2) NULL;
  END IF;
END$$
DELIMITER ;
CALL umbrales_por_equipo();
DROP PROCEDURE IF EXISTS umbrales_por_equipo;
