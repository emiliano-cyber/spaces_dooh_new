-- migrations/013_giro_foto.sql
-- Cuanto hay que girar las fotos de un equipo para verlas derechas.
--
-- El telefono de BLVD. MAGNOCENTRO esta montado al reves y sube sus fotos de
-- cabeza, etiquetadas como derechas (orientacion EXIF = 1), asi que nada las
-- endereza despues.
--
-- OJO CON QUE ES Y QUE NO ES:
--
--   * NO se gira el archivo guardado. Se intento y se revirtio el mismo dia:
--     girar obliga a recomprimir y una foto de 1.2 MB quedaba en 630 KB, con la
--     perdida de calidad que eso trae. La evidencia se guarda tal como la manda
--     el equipo.
--   * Este valor es solo la REFERENCIA del equipo. Lo que de verdad se aplica va
--     foto por foto en photos.display_rotation (migracion 014), y solo al
--     mostrarla y descargarla.
--
-- Se anota por foto y no por equipo porque el mismo telefono entrega
-- orientaciones distintas: con la vista en vivo abierta la app ya manda la foto
-- derecha, y sin visor la manda como sale del sensor.
--
-- No confundir con stream_rotation (migracion 003), que gira el VIDEO en el
-- navegador y no toca ningun archivo. Este equipo lo demuestra: tiene la vista
-- en 90 y sus fotos necesitan 180.
--
--   photo_rotation: 0, 90, 180 o 270 grados en sentido horario.
--
-- Aditiva e idempotente.
DROP PROCEDURE IF EXISTS add_giro_foto;
DELIMITER $$
CREATE PROCEDURE add_giro_foto()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='photo_rotation') THEN
    ALTER TABLE devices ADD COLUMN photo_rotation SMALLINT UNSIGNED NOT NULL DEFAULT 0
      COMMENT 'Giro horario que se aplica a la foto al recibirla (0/90/180/270)';
  END IF;
END$$
DELIMITER ;
CALL add_giro_foto();
DROP PROCEDURE IF EXISTS add_giro_foto;
