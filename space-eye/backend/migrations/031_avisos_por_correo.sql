-- migrations/031_avisos_por_correo.sql
-- Aviso por correo cuando una pantalla falla, y la huella de las fallas que el
-- SERVIDOR descarta por si solo.
--
-- EL CORREO (avisos_correo)
-- -------------------------
-- Una sola fila (id = 1) por instancia: a quien se le avisa, con que cuenta y
-- cada cuanto se agrupa. Todo se edita desde el panel, en Fallas.
--
-- LA LLAVE VIVE AQUI, Y NO SOLO EN EL ENTORNO
-- -------------------------------------------
-- Lo normal seria que un secreto viviera solo en el entorno del contenedor.
-- Pero cambiar una variable de entorno en una instancia significa entrar al
-- droplet y reiniciar el contenedor, y eso aqui lo hace una persona distinta de
-- la que opera las pantallas: el dia que la empresa cambie de cuenta de correo,
-- los avisos se quedan mudos hasta que esa persona tenga tiempo. Por eso la
-- llave se puede cambiar desde el panel.
--
-- Reglas que eso obliga a cumplir, y que estan en avisos.controller.ts:
--   · La llave NUNCA sale hacia el navegador. Solo sus ultimos 4 caracteres,
--     para reconocer cual esta puesta.
--   · Solo un admin la cambia, y mandarla vacia NO la borra (eso seria apagar
--     los avisos sin querer al guardar cualquier otro ajuste).
--   · El entorno (RESEND_API_KEY / EMAIL_FROM) sigue sirviendo de respaldo: si
--     la base no tiene llave, se usa la del contenedor. Asi una instancia ya
--     configurada no se queda sin correo al aplicar esta migracion.
--
-- Se agrupa a proposito: "media pantalla apagada" en una cuadricula grande son
-- cientos de gabinetes, y un correo por cada uno es un buzon inservible. Se
-- espera `agrupar_min` desde la primera falla y sale UN correo por equipo con
-- todas. De paso, una falla que se arregla sola en ese rato no llega a molestar
-- a nadie.
--
-- pantalla_fallas.aviso_en es la marca de que ya salio: sin ella, un reinicio
-- del backend volveria a mandar el correo de todo lo que siguiera abierto.
--
-- LO QUE DESCARTA EL SERVIDOR (cerrada_por = 'servidor')
-- ------------------------------------------------------
-- Hasta ahora una falla la cerraba el equipo o una persona. Ahora el servidor
-- tambien descarta las "camara movida" en las que el propio equipo no puede
-- tener razon (ver monitoreo.controller.ts, `porQueNoSeCree`).
--
-- Aditiva e idempotente. En produccion, aplicar a mano:
--   docker compose -f infra/docker-compose.ip.yml exec -T mysql \
--     mysql -uroot -p"$DB_PASSWORD" "$DB_NAME" < backend/migrations/031_avisos_por_correo.sql

CREATE TABLE IF NOT EXISTS avisos_correo (
  id              TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
  activo          BOOLEAN NOT NULL DEFAULT FALSE,
  destinatarios   TEXT NOT NULL COMMENT 'Correos separados por coma',
  llave           VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'Llave del proveedor (Resend). Vacia = la del entorno',
  remitente       VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'De quien sale: "Nombre <correo@dominio>". Vacio = el del entorno',
  agrupar_min     SMALLINT UNSIGNED NOT NULL DEFAULT 15 COMMENT 'Espera desde la primera falla antes de mandar el resumen',
  ultimo_envio_en TIMESTAMP NULL,
  ultimo_error    VARCHAR(500) NULL COMMENT 'Por que no salio el ultimo correo, para verlo en el panel',
  user_id         BIGINT UNSIGNED NULL COMMENT 'Quien lo configuro',
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO avisos_correo (id, activo, destinatarios) VALUES (1, FALSE, '');

DROP PROCEDURE IF EXISTS add_avisos_por_correo;
DELIMITER $$
CREATE PROCEDURE add_avisos_por_correo()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()
                   AND table_name='pantalla_fallas' AND column_name='aviso_en') THEN
    ALTER TABLE pantalla_fallas ADD COLUMN aviso_en TIMESTAMP NULL COMMENT 'Cuando salio el correo de esta falla';
  END IF;
  -- El servidor tambien puede cerrar una falla. Agregar un valor AL FINAL de un
  -- ENUM es instantaneo; si la columna de produccion difiriera en algo, MySQL
  -- copiaria la tabla entera, asi que falla al instante en vez de copiar.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()
                   AND table_name='pantalla_fallas' AND column_name='cerrada_por'
                   AND COLUMN_TYPE LIKE '%servidor%') THEN
    ALTER TABLE pantalla_fallas MODIFY COLUMN cerrada_por ENUM('equipo','usuario','servidor') NULL
      COMMENT 'Quien la cerro: el equipo al verla sana, alguien en el dashboard, o el servidor al no creersela',
      ALGORITHM=INSTANT;
  END IF;
  -- La cuenta de correo, para las bases que ya tengan la tabla sin estas dos.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()
                   AND table_name='avisos_correo' AND column_name='llave') THEN
    ALTER TABLE avisos_correo ADD COLUMN llave VARCHAR(255) NOT NULL DEFAULT ''
      COMMENT 'Llave del proveedor (Resend). Vacia = la del entorno';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()
                   AND table_name='avisos_correo' AND column_name='remitente') THEN
    ALTER TABLE avisos_correo ADD COLUMN remitente VARCHAR(255) NOT NULL DEFAULT ''
      COMMENT 'De quien sale: "Nombre <correo@dominio>". Vacio = el del entorno';
  END IF;
  -- Las que esperan correo se buscan cada minuto; sin indice es un recorrido de
  -- la tabla entera de fallas cada vez.
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE()
                   AND table_name='pantalla_fallas' AND index_name='idx_falla_aviso') THEN
    ALTER TABLE pantalla_fallas ADD INDEX idx_falla_aviso (estado, aviso_en, detectada_en);
  END IF;
END$$
DELIMITER ;
CALL add_avisos_por_correo();
DROP PROCEDURE IF EXISTS add_avisos_por_correo;
