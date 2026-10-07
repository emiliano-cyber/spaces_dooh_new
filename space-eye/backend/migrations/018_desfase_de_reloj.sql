-- migrations/018_desfase_de_reloj.sql
-- Cuanto miente el reloj de un equipo, para poder enderezar su hora al mostrarla.
--
-- EL PROBLEMA
-- -----------
-- La hora que se sella en una evidencia sale del RELOJ DEL EQUIPO: los tres
-- agentes mandan `taken_at` con su propia hora, en UTC. El servidor la guarda
-- tal cual. Si el reloj del equipo va corrido, TODAS sus evidencias llevan una
-- hora que no es -y la evidencia es lo que se factura-.
--
-- Aparecio con el telefono de la autopista Mexico-Queretaro: dos horas
-- atrasadas en cada foto. Lo correcto seria ponerle la hora al telefono, pero
-- eso pide ir al sitio o una version nueva de la APK, y mientras tanto las
-- evidencias siguen saliendo mal.
--
-- POR QUE UNA COLUMNA EN `devices` Y NO UN ARREGLO EN CADA FOTO
-- -------------------------------------------------------------
-- Un reloj corrido no es un problema de una foto: es del equipo, y afecta a
-- todas por igual, a las de ayer y a las que vengan. Con el desfase guardado en
-- el equipo, la correccion se aplica AL LEER -una sola vez, en las consultas que
-- devuelven fotos- y con eso quedan bien las historicas y las nuevas a la vez.
--
-- Y SOBRE TODO: NO SE TOCA `photos.taken_at`
-- ------------------------------------------
-- Lo comodo seria correr un UPDATE sumandole dos horas a lo que ya hay. No se
-- hace, y el motivo es que entonces se pierde lo que el equipo dijo de verdad.
-- El dato crudo es el unico testigo de que su reloj esta mal; el dia que alguien
-- pregunte "¿y como saben que eran las dos y no las cuatro?", la respuesta es
-- poder ensenar las dos cosas: lo que mando el equipo y lo que se corrigio.
--
-- Ademas se deshace solo: poner el desfase en 0 devuelve todo a como estaba, sin
-- restaurar nada. Un UPDATE no se deshace.
--
-- EL SIGNO
-- --------
-- `clock_offset_s` son los segundos que hay que SUMARLE a la hora del equipo
-- para obtener la buena. Un equipo dos horas atrasado lleva +7200.
--
-- Se mide con `npm run revisar:relojes` y se aplica con `npm run ajustar:reloj`.
--
-- NOTA: en produccion las migraciones de docker-entrypoint-initdb.d solo corren
-- en la PRIMERA inicializacion. Para una BD ya existente, aplicar a mano:
--   docker compose -f infra/docker-compose.ip.yml exec -T mysql \
--     mysql -uroot -p"$DB_PASSWORD" "$DB_NAME" < backend/migrations/018_desfase_de_reloj.sql

DROP PROCEDURE IF EXISTS add_desfase_de_reloj;
DELIMITER $$
CREATE PROCEDURE add_desfase_de_reloj()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='clock_offset_s') THEN
    ALTER TABLE devices
      ADD COLUMN clock_offset_s INT NOT NULL DEFAULT 0
      COMMENT 'Segundos a SUMAR a taken_at de este equipo para enderezar su hora. 0 = su reloj esta bien. Se mide con revisar:relojes.';
  END IF;
END$$
DELIMITER ;
CALL add_desfase_de_reloj();
DROP PROCEDURE IF EXISTS add_desfase_de_reloj;
