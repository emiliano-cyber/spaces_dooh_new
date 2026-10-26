-- migrations/028_creativo_sin_foto.sql
-- Por que un creativo del catalogo no trae foto.
--
-- El catalogo y la galeria se llenan por caminos DISTINTOS: la huella viaja
-- siempre (32 bytes pegados al reporte de estado), la foto solo si el equipo
-- podia tomarla. Cuando no podia, la tarjeta salia igual que las demas y el
-- hallazgo se quedaba sin imagen, sin decir por que. El 23-oct-2026 el dueño
-- pregunto por uno de TLALPAN: "si es un creativo nuevo, deberia aparecer en la
-- galeria".
--
-- Las tres razones legitimas por las que no hay foto:
--   aprendizaje     las primeras horas solo se registra el loop, a proposito.
--   tope_del_dia    se agoto creative_max_dia (12 por omision).
--   envio_agrupado  la foto espera su envio junto (creative_envio_min > 0).
--   no_subio        se tomo, pero la subida fallo (la huella viaja aparte y si
--                   llego). Es el unico de los cuatro que hay que mirar.
--
-- NULL en los creativos que si tienen foto, y en los viejos (no sabemos por que
-- les falto; inventarlo seria peor que dejarlo en blanco).
--
-- Aditiva e idempotente.
DROP PROCEDURE IF EXISTS creativo_sin_foto;
DELIMITER $$
CREATE PROCEDURE creativo_sin_foto()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema=DATABASE() AND table_name='device_creatives'
                    AND column_name='sin_foto') THEN
    ALTER TABLE device_creatives
      ADD COLUMN sin_foto VARCHAR(24) NULL
      COMMENT 'Por que no hay foto: aprendizaje, tope_del_dia, envio_agrupado, no_subio';
  END IF;
END$$
DELIMITER ;
CALL creativo_sin_foto();
DROP PROCEDURE IF EXISTS creativo_sin_foto;
