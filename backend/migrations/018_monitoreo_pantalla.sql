-- migrations/018_monitoreo_pantalla.sql
-- Donde esta la pantalla en la foto, su horario, y el monitoreo de fallas.
--
-- LA PANTALLA EN LA FOTO (devices.pantalla)
-- ------------------------------------------
-- Medido el 23-sep-2026 con fotos reales: en PATRIOTISMO la pantalla es ~3% de
-- la foto y el resto es la gasolinera. Reconocer creativos o buscar gabinetes
-- sobre la foto ENTERA no funciona: el fondo manda. Por eso el equipo solo mira
-- dentro de la pantalla, que se marca UNA vez en el dashboard:
--
--   {
--     "esquinas": [[x,y] arriba-izq, arriba-der, abajo-der, abajo-izq],  -- fracciones de la foto
--     "filas": 4, "columnas": 6,          -- gabinetes, para decir "Gabinete 4"
--     "excluir": [[3,5]],                 -- zonas tapadas por algo fijo (barda, arbol)
--     "horario": {"inicio": "06:00", "fin": "24:00"}   -- cuando debe estar encendida
--   }
--
-- Cuatro esquinas y no un rectangulo: casi ninguna camara ve la pantalla de
-- frente (TLALPAN la ve en diagonal) y hay que enderezarla para que cada gabinete
-- caiga en su lugar. Van en fracciones de la foto TAL COMO LA GUARDA el equipo
-- (antes de display_rotation). Valen para UN encuadre: si se cambia el lente o el
-- zoom, hay que volver a marcarlas.
--
-- Fuera del horario una pantalla apagada es lo normal y no se vigila. Por
-- omision de 6:00 a 24:00, que es el horario habitual de los clientes.
--
-- FALLAS (pantalla_fallas)
-- ------------------------
-- El equipo analiza su pantalla SIN mandar imagenes; solo cuando confirma una
-- falla (varias vueltas seguidas) manda una alerta con UNA foto de evidencia, y
-- otra cuando se recupera. Esta tabla es el historial: que, donde, cuando, con
-- que confianza, su evidencia, y cuando y como se cerro.
--
-- Reemplaza a la 018_recuadro_pantalla que nunca llego a produccion.
-- Aditiva e idempotente. En produccion, aplicar a mano:
--   docker compose -f infra/docker-compose.ip.yml exec -T mysql \
--     mysql -uroot -p"$DB_PASSWORD" "$DB_NAME" < backend/migrations/018_monitoreo_pantalla.sql

CREATE TABLE IF NOT EXISTS pantalla_fallas (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  device_id       BIGINT UNSIGNED NOT NULL,
  tipo            VARCHAR(32) NOT NULL COMMENT 'zona_apagada, zona_congelada, pantalla_apagada, pantalla_congelada, camara_movida, sin_imagen',
  fila            TINYINT UNSIGNED NULL COMMENT 'Gabinete (desde 0); NULL = toda la pantalla',
  columna         TINYINT UNSIGNED NULL,
  gabinete        SMALLINT UNSIGNED NULL COMMENT 'Numero como lo cuenta una persona, desde 1',
  confianza       DECIMAL(3,2) NOT NULL DEFAULT 0,
  estado          ENUM('abierta','recuperada','descartada') NOT NULL DEFAULT 'abierta',
  detectada_en    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recuperada_en   TIMESTAMP NULL,
  cerrada_por     ENUM('equipo','usuario') NULL COMMENT 'Quien la cerro: el equipo al verla sana, o alguien en el dashboard',
  user_id         BIGINT UNSIGNED NULL COMMENT 'Quien la descarto o cerro a mano',
  nota            VARCHAR(500) NULL,
  photo_id        BIGINT UNSIGNED NULL COMMENT 'Evidencia al detectarla',
  photo_recuperacion_id BIGINT UNSIGNED NULL COMMENT 'Evidencia al recuperarse',
  detalle         JSON NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_dev_estado (device_id, estado),
  KEY idx_estado_fecha (estado, detectada_en),
  CONSTRAINT fk_falla_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP PROCEDURE IF EXISTS add_monitoreo_pantalla;
DELIMITER $$
CREATE PROCEDURE add_monitoreo_pantalla()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='pantalla') THEN
    ALTER TABLE devices ADD COLUMN pantalla JSON NULL COMMENT 'Esquinas, gabinetes, zonas excluidas y horario de la pantalla';
  END IF;
  -- Apagado por omision, como la vigilancia de creativos: es una decision por sitio.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='salud_watch') THEN
    ALTER TABLE devices ADD COLUMN salud_watch BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  -- Desde cuando vigila: las primeras 24 h solo aprende (que zonas nunca cambian).
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='salud_desde') THEN
    ALTER TABLE devices ADD COLUMN salud_desde TIMESTAMP NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='salud_cada_min') THEN
    ALTER TABLE devices ADD COLUMN salud_cada_min SMALLINT UNSIGNED NOT NULL DEFAULT 60;
  END IF;
  -- Vueltas seguidas con la misma falla antes de avisar.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='salud_confirmaciones') THEN
    ALTER TABLE devices ADD COLUMN salud_confirmaciones TINYINT UNSIGNED NOT NULL DEFAULT 2;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='salud_umbral') THEN
    ALTER TABLE devices ADD COLUMN salud_umbral DECIMAL(3,2) NOT NULL DEFAULT 0.60;
  END IF;
  -- Tope de alertas nuevas por dia: una pantalla que se vuelve loca no debe
  -- llenar el dashboard ni el plan de datos.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='salud_max_dia') THEN
    ALTER TABLE devices ADD COLUMN salud_max_dia TINYINT UNSIGNED NOT NULL DEFAULT 6;
  END IF;
  -- Resumen de la ultima vuelta (pantalla, camara, zonas sospechosas, excluidas).
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='salud_ultimo') THEN
    ALTER TABLE devices ADD COLUMN salud_ultimo JSON NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='photos'
                   AND column_name='source' AND COLUMN_TYPE LIKE '%falla%') THEN
    ALTER TABLE photos MODIFY COLUMN source
      ENUM('manual','scheduled','on_demand','boot','creative_change','falla') DEFAULT 'manual',
      -- Agregar un valor al final es instantaneo; si la columna de produccion
      -- difiriera en algo, MySQL copiaria TODA la tabla de fotos bloqueando a la
      -- flota. Asi falla al instante en vez de copiar.
      ALGORITHM=INSTANT;
  END IF;
END$$
DELIMITER ;
CALL add_monitoreo_pantalla();
DROP PROCEDURE IF EXISTS add_monitoreo_pantalla;
