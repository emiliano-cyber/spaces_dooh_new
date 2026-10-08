-- migrations/012_ajustes_camara.sql
-- Ajustes de imagen por equipo (encuadre y color).
--
-- Ya existian camera_lens y camera_zoom (migracion 007), pensados para los
-- telefonos. Faltaba todo lo demas, y hacia falta por dos razones concretas:
--
--   1. La Raspberry ignoraba hasta el zoom. El encuadre que se ajustaba desde el
--      dashboard funcionaba en los telefonos y en la Pi no hacia nada, porque su
--      agente llamaba a la camara sin pasarle un solo parametro.
--
--   2. La camara de la Pi es la Module 3 NoIR, SIN filtro infrarrojo. La
--      vegetacion refleja muchisimo infrarrojo cercano, esa luz entra al sensor
--      y las hojas de los arboles salen MORADAS. El automatico de balance de
--      blancos se despista justo con eso. Con ganancias de blanco manuales y algo
--      menos de saturacion queda presentable. Aclaracion honesta: es fisica del
--      sensor y el software solo lo atenua; el arreglo de verdad es un filtro de
--      corte infrarrojo o la Module 3 estandar.
--
-- Se guarda como JSON y no como una columna por ajuste porque cada tipo de
-- equipo entiende un juego distinto, y asi se agregan sin migrar la tabla otra
-- vez. Lo que no reconoce el agente, lo ignora.
--
--   {
--     "centro_x": 0.5, "centro_y": 0.5,   -- a donde apunta el recorte del zoom
--     "brillo": 0.0,                      -- -1 .. 1
--     "contraste": 1.0,                   --  0 .. 2  (1 = normal)
--     "saturacion": 1.0,                  --  0 .. 2  (0 = blanco y negro)
--     "nitidez": 1.0,
--     "ev": 0.0,                          -- compensacion de exposicion
--     "awb": "daylight",                  -- modo de balance de blancos
--     "awb_rojo": 1.6, "awb_azul": 1.4,   -- ganancias manuales (mandan sobre awb)
--     "ruido": "auto",
--     "hflip": false, "vflip": false
--   }
--
-- Aditiva e idempotente.
DROP PROCEDURE IF EXISTS add_ajustes_camara;
DELIMITER $$
CREATE PROCEDURE add_ajustes_camara()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='camera_ajustes') THEN
    ALTER TABLE devices ADD COLUMN camera_ajustes JSON NULL
      COMMENT 'Ajustes de imagen del equipo (encuadre fino, color, exposicion)';
  END IF;
END$$
DELIMITER ;
CALL add_ajustes_camara();
DROP PROCEDURE IF EXISTS add_ajustes_camara;
