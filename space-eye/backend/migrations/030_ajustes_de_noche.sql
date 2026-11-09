-- migrations/030_ajustes_de_noche.sql
-- Los ajustes de camara pueden cambiar por horario.
--
-- `camera_ajustes` (brillo, exposicion, balance, centro del recorte) es UNO y
-- vale a toda hora. Pero la pantalla no se ve igual a las 3 de la tarde que a
-- las 9 de la noche: el mismo ajuste que deja una foto correcta de dia la deja
-- quemada de noche, cuando el LED es lo unico que ilumina la escena. Hasta
-- ahora la unica salida era que alguien entrara al dashboard dos veces al dia
-- a mover el control a mano, y nadie lo hace.
--
--   noche_inicio / noche_fin  el tramo en hora LOCAL del sitio (19:00 a 07:00).
--                             Puede cruzar la medianoche. NULL = sin tramo de
--                             noche, que es lo de siempre.
--   camera_ajustes_noche      SOLO lo que cambia en ese tramo. Se encima sobre
--                             `camera_ajustes`, no lo sustituye: poner el
--                             brillo de noche no debe borrar el encuadre ni el
--                             balance de blancos del sitio.
--
-- La hora se juzga contra la zona del sitio, no contra la del servidor: el
-- contenedor corre en UTC y "a partir de las 7" se habria disparado a la 1 de
-- la madrugada (la misma trampa que ya documenta utils/horarios.ts).
--
-- Aditiva e idempotente.
DROP PROCEDURE IF EXISTS ajustes_de_noche;
DELIMITER $$
CREATE PROCEDURE ajustes_de_noche()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema=DATABASE() AND table_name='devices'
                    AND column_name='camera_ajustes_noche') THEN
    ALTER TABLE devices
      ADD COLUMN camera_ajustes_noche JSON NULL
      COMMENT 'Ajustes que se enciman sobre camera_ajustes dentro del tramo de noche';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema=DATABASE() AND table_name='devices'
                    AND column_name='noche_inicio') THEN
    ALTER TABLE devices
      ADD COLUMN noche_inicio TIME NULL COMMENT 'Hora local en que empieza el tramo de noche',
      ADD COLUMN noche_fin    TIME NULL COMMENT 'Hora local en que termina; puede cruzar la medianoche';
  END IF;
END$$
DELIMITER ;
CALL ajustes_de_noche();
DROP PROCEDURE IF EXISTS ajustes_de_noche;
