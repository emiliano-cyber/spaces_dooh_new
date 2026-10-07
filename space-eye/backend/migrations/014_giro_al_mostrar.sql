-- migrations/014_giro_al_mostrar.sql
-- Enderezar la foto AL MOSTRARLA, sin tocar el archivo guardado.
--
-- El problema concreto: en BLVD. MAGNOCENTRO el telefono esta montado al reves y
-- sube las fotos de cabeza. Ya se intento arreglar girando el archivo en el
-- servidor y salio mal por dos razones (ver 013, que quedo sin uso):
--
--   1. Girar obliga a volver a comprimir y la evidencia pierde calidad.
--   2. La app NO entrega siempre la misma orientacion. Cuando la foto se pide con
--      la vista en vivo abierta, sale de la sesion de video ya girada; cuando se
--      pide sin visor -el boton "foto a todas" y TODAS las programadas- sale como
--      la da el sensor. Un giro fijo arregla una y rompe la otra.
--
-- Asi que aqui no se gira nada: se ANOTA cuanto habria que girar cada foto, y el
-- dashboard la muestra y la descarga derecha. El archivo original queda intacto,
-- que para eso es evidencia.
--
-- Y se anota FOTO POR FOTO, no por equipo, justamente porque el mismo equipo
-- entrega orientaciones distintas segun como se pidio la foto: al recibirla el
-- servidor sabe si el visor estaba abierto y decide.
--
--   devices.photo_rotation  -> cuanto hay que girar las fotos de ese equipo que
--                              lleguen SIN vista en vivo (0/90/180/270).
--   photos.display_rotation -> lo que de verdad le toca a esa foto concreta.
--
-- Aditiva e idempotente.
DROP PROCEDURE IF EXISTS add_giro_al_mostrar;
DELIMITER $$
CREATE PROCEDURE add_giro_al_mostrar()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema=DATABASE() AND table_name='photos' AND column_name='display_rotation') THEN
    ALTER TABLE photos ADD COLUMN display_rotation SMALLINT UNSIGNED NOT NULL DEFAULT 0
      COMMENT 'Giro horario al MOSTRAR y descargar. El archivo no se toca.';
  END IF;
END$$
DELIMITER ;
CALL add_giro_al_mostrar();
DROP PROCEDURE IF EXISTS add_giro_al_mostrar;
