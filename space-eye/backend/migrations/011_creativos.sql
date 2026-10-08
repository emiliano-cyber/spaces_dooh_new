-- migrations/011_creativos.sql
-- Deteccion de creativo nuevo en la pantalla, sin gastar datos moviles.
--
-- COMO FUNCIONA (y por que asi):
--
-- Las pantallas LED pasan imagenes fijas de ~20 segundos en un loop de 12
-- clientes: la vuelta completa dura unos 4 minutos, y los huecos se rellenan con
-- un creativo institucional. Como son imagenes fijas y no video, la huella visual
-- de cada creativo es estable y se puede reconocer.
--
-- El equipo hace cada tantas horas un RECORRIDO DEL LOOP: abre la camara unos
-- minutos, saca un cuadro cada pocos segundos, le calcula una huella de 256 bits
-- y TIRA la imagen. Nunca sube una foto para detectar: manda 32 bytes de huella
-- pegados al reporte de estado que ya sale igual. Una foto son 1.5 MB; el
-- recorrido entero, con sus doce creativos, no llega a un kilobyte.
--
-- Cuando ve una huella que no conoce, la camara ya esta abierta y ese creativo
-- sigue en pantalla otros ~20 segundos: toma la foto EN ESE INSTANTE. Por eso la
-- deteccion vive en el equipo y no en el servidor: para cuando el servidor
-- mandara la orden, la pantalla ya habria cambiado de cliente.
--
-- Las primeras 24 horas solo APRENDE, sin fotografiar: registra los creativos del
-- loop de dia y de noche (la misma lona da otra huella con otra luz). Pasado ese
-- plazo queda armado y solo dispara con lo genuinamente nuevo.
--
-- Aditiva e idempotente.

CREATE TABLE IF NOT EXISTS device_creatives (
  id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  device_id     BIGINT UNSIGNED NOT NULL,
  phash         CHAR(64) NOT NULL COMMENT 'Huella de 256 bits en hexadecimal',
  vistas        INT UNSIGNED NOT NULL DEFAULT 1,
  primera_vez   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultima_vez    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- La foto de evidencia que se tomo al detectarlo. NULL en los creativos
  -- aprendidos durante las primeras 24 horas, que a proposito no se fotografian.
  photo_id      BIGINT UNSIGNED NULL,
  aprendido     BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Vino de la fase de aprendizaje',
  -- Marcado a mano en el dashboard: "esto no es un creativo nuevo" (un reflejo,
  -- la pantalla apagada, la misma lona con otra luz). Deja de avisar.
  descartado    BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY uk_dev_hash (device_id, phash),
  KEY idx_dev_ultima (device_id, ultima_vez),
  CONSTRAINT fk_creativo_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP PROCEDURE IF EXISTS add_creativos;
DELIMITER $$
CREATE PROCEDURE add_creativos()
BEGIN
  -- Apagado por omision: encender la vigilancia es una decision por sitio, con
  -- su costo en bateria y en fotos.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='creative_watch') THEN
    ALTER TABLE devices ADD COLUMN creative_watch BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  -- Cuando se encendio. Las primeras 24 horas a partir de aqui son aprendizaje.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='creative_desde') THEN
    ALTER TABLE devices ADD COLUMN creative_desde TIMESTAMP NULL;
  END IF;

  -- Tope de fotos de creativo nuevo por dia. Un cambio de campana legitimo puede
  -- tocar varios de los 12 espacios del loop a la vez, de ahi el 12; pero es un
  -- techo duro para que nada se desboque sin que nadie se entere.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='creative_max_dia') THEN
    ALTER TABLE devices ADD COLUMN creative_max_dia SMALLINT UNSIGNED NOT NULL DEFAULT 12;
  END IF;

  -- Cada cuanto hace un recorrido del loop (minutos).
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='creative_cada_min') THEN
    ALTER TABLE devices ADD COLUMN creative_cada_min SMALLINT UNSIGNED NOT NULL DEFAULT 360;
  END IF;

  -- Cuanto dura el recorrido y cada cuanto saca un cuadro (segundos). Por
  -- omision 270s con paso de 15s = 18 cuadros: cubre la vuelta completa de 4
  -- minutos con margen, y con 20s por creativo no se salta ninguno.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='creative_recorrido_seg') THEN
    ALTER TABLE devices ADD COLUMN creative_recorrido_seg SMALLINT UNSIGNED NOT NULL DEFAULT 270;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='creative_paso_seg') THEN
    ALTER TABLE devices ADD COLUMN creative_paso_seg SMALLINT UNSIGNED NOT NULL DEFAULT 15;
  END IF;

  -- Cuantos bits (de 256) pueden diferir para seguir considerandola la misma
  -- imagen. Medido con anuncios de prueba: el mismo creativo entre el dia y la
  -- noche se mueve hasta 16 bits; dos creativos distintos quedan a 75 o mas.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='creative_tolerancia') THEN
    ALTER TABLE devices ADD COLUMN creative_tolerancia TINYINT UNSIGNED NOT NULL DEFAULT 24;
  END IF;

  -- La huella de la foto, para ligarla con el creativo que la disparo.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='photos' AND column_name='phash') THEN
    ALTER TABLE photos ADD COLUMN phash CHAR(64) NULL;
  END IF;

  -- Origen nuevo, para distinguir en la galeria la evidencia de un cambio de
  -- creativo de una foto de horario o de una pedida a mano.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='photos'
                   AND column_name='source' AND COLUMN_TYPE LIKE '%creative_change%') THEN
    ALTER TABLE photos MODIFY COLUMN source
      ENUM('manual','scheduled','on_demand','boot','creative_change') DEFAULT 'manual';
  END IF;
END$$
DELIMITER ;
CALL add_creativos();
DROP PROCEDURE IF EXISTS add_creativos;
