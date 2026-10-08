-- migrations/005_overlay_style.sql
-- Estilo configurable de la marca de informacion por dispositivo (JSON):
--   { size, weight, color, shadow, bg, align, letterSpacing, lineSpacing }
-- size: factor relativo al ancho (ej. 2.2 = ancho/(46/2.2)). weight: 'normal'|'bold'.
-- color: hex. shadow/bg: bool. align: 'left'|'center'|'right'. spacing: px/em relativos.
-- Aditiva e idempotente. NULL = usa los valores por defecto del render.
DROP PROCEDURE IF EXISTS add_overlay_style;
DELIMITER $$
CREATE PROCEDURE add_overlay_style()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='overlay_style') THEN
    ALTER TABLE devices ADD COLUMN overlay_style JSON NULL;
  END IF;
END$$
DELIMITER ;
CALL add_overlay_style();
DROP PROCEDURE IF EXISTS add_overlay_style;
