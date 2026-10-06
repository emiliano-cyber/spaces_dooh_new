-- migrations/021_vinculaciones.sql
-- Codigos de vinculacion: como entra un equipo NUEVO al Space Eye de una empresa.
--
-- Hasta ahora, en un Space Eye de empresa (modo instancia) CUALQUIER aparato que
-- conociera la direccion del servidor quedaba dado de alta como de la empresa:
-- bastaba tener el APK. Desde aqui un equipo nuevo entra solo con un codigo que
-- un usuario de la empresa genero en SPACE OS ("Agregar dispositivo"):
--
--   - de un solo uso: el primer equipo que lo presenta lo gasta;
--   - con vencimiento: una hora el de un telefono (se escanea en el momento),
--     dias el de una Raspberry o una PC (la tarjeta se prepara antes de ir);
--   - se puede cancelar;
--   - queda quien lo genero, cuando se uso y con que equipo (auditoria).
--
-- Un equipo que YA existe (mismo device_uid) se sigue registrando sin codigo:
-- renovar su llave o reinstalarlo no debe exigir nada, y la migracion de la
-- flota de :4000 depende de eso.
CREATE TABLE IF NOT EXISTS vinculaciones (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  codigo        CHAR(8)      NOT NULL,
  tipo          ENUM('telefono','raspberry','pc') NOT NULL,
  owner         VARCHAR(64)  NULL,
  nota          VARCHAR(120) NULL,
  creado_por    VARCHAR(190) NULL,
  creado_en     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_en     DATETIME     NOT NULL,
  usado_en      DATETIME     NULL,
  device_id     INT          NULL,
  cancelado_en  DATETIME     NULL,
  UNIQUE KEY uq_vinculaciones_codigo (codigo),
  KEY idx_vinculaciones_pendientes (usado_en, cancelado_en, expira_en)
);
