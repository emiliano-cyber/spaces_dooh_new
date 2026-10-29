-- migrations/029_creativo_ultima_foto.sql
-- La ficha de un creativo ensena como aparecio Y como se ve ahora.
--
-- Hasta aqui `device_creatives` guardaba UNA foto, y a proposito la PRIMERA:
-- `ligarFoto` hacia `photo_id = IFNULL(photo_id, VALUES(photo_id))`, asi que la
-- segunda y las siguientes se perdian. Para una tarjeta de "esto aparecio" es
-- lo correcto; para mirar un anuncio que lleva semanas puesto, no dice nada de
-- como esta hoy: si sigue ahi, si se deslavo, si la pantalla ya no lo pinta
-- igual. El dueno lo pidio el 29-oct-2026: "que siempre muestre la primera foto
-- y la ultima".
--
--   photo_id         la primera, intacta: es la evidencia del hallazgo.
--   photo_id_ultima  la mas reciente que hayamos aceptado de ese creativo.
--                    NULL mientras solo haya una (la ficha ensena una sola).
--
-- Y el refresco se RACIONA, porque cada foto son datos moviles del sitio:
--
--   creative_refoto_h  horas que tienen que pasar para aceptar otra foto del
--                      MISMO creativo. 0 = nunca (lo de antes: la repetida se
--                      descarta siempre). Por omision 24: a lo sumo una al dia
--                      por creativo, y solo cuando el equipo vuelva a mandarla.
--
-- Ojo con el tope diario: estas fotos tambien cuentan contra `creative_max_dia`
-- porque se guardan con source='creative_change', que es lo que mide
-- `fotosDeHoy`. Es deliberado — el tope es el techo duro del gasto del sitio y
-- no debe poder rodearse por esta puerta.
--
-- Aditiva e idempotente.
DROP PROCEDURE IF EXISTS creativo_ultima_foto;
DELIMITER $$
CREATE PROCEDURE creativo_ultima_foto()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema=DATABASE() AND table_name='device_creatives'
                    AND column_name='photo_id_ultima') THEN
    ALTER TABLE device_creatives
      ADD COLUMN photo_id_ultima BIGINT UNSIGNED NULL
      COMMENT 'La foto mas reciente del mismo creativo; NULL si solo hay una';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema=DATABASE() AND table_name='devices'
                    AND column_name='creative_refoto_h') THEN
    ALTER TABLE devices
      ADD COLUMN creative_refoto_h SMALLINT UNSIGNED NOT NULL DEFAULT 24
      COMMENT 'Horas entre fotos del mismo creativo; 0 = no repetir';
  END IF;
END$$
DELIMITER ;
CALL creativo_ultima_foto();
DROP PROCEDURE IF EXISTS creativo_ultima_foto;
