-- migrations/016_dueno_por_equipo.sql
-- De quien es cada camara, y a que alcance llega cada llave de servicio.
--
-- POR QUE
-- -------
-- Hasta hoy Space Eye no sabia de quien era un equipo: `GET /api/devices`
-- devolvia la flota entera a cualquiera que tuviera credenciales. Con un solo
-- cliente daba igual; con Space Eye como modulo de SPACE OS y una instancia por
-- cliente, es una fuga.
--
-- Y no es teoria. Se probo en local el 2026-09-17: se creo una organizacion
-- nueva en SPACE OS, sin ninguna relacion con las camaras, se le dio un sitio
-- con `codigo_proveedor = 05599-D01` y su ficha mostro el equipo
-- "PATRIOTISMO Y PENSILVANIA - G500" con su foto. La RLS de SPACE OS aguanto
-- —pedir el sitio ajeno dio 404— pero no puede proteger datos que no estan en
-- su base. Basta teclear en un formulario un codigo que exista.
--
-- EL DUENO SE ASIGNA POR LOTE, NO CAMARA POR CAMARA
-- -------------------------------------------------
-- Solo hay dos formas de que un equipo tenga dueno:
--   1. al darse de alta, del sello del instalador que se bajo de ese perfil;
--   2. en bloque, una vez, para los que ya estaban puestos -que es lo que hace
--      esta migracion: todo lo que existe hoy es de g500.
-- Las camaras que comparten dueno SON el grupo; no hay otra entidad.
--
-- POR QUE NO CUELGA DE device_groups
-- ----------------------------------
-- Existe `devices.group_id` y una tabla `device_groups` sin usar. Poner ahi el
-- dueno seria un error: un grupo sirve para organizar DENTRO de un cliente -por
-- ciudad, por campana- y si el dueno viviera en el grupo, mover una camara de
-- grupo la moveria de cliente en silencio. El dueno es una frontera de
-- seguridad; el grupo es comodidad.
--
-- NULL SIGNIFICA "SIN ASIGNAR", Y NO SE VE DESDE NINGUNA LLAVE CON ALCANCE
-- -----------------------------------------------------------------------
-- Un equipo sin dueno no es de todos: es de nadie hasta que alguien lo asigne.
-- Una llave con alcance nunca lo ve. Asi, olvidar asignar un equipo lo deja
-- invisible -molesto y evidente- en vez de visible para todos, que es el fallo
-- que no avisa.
--
-- NOTA: en produccion las migraciones de docker-entrypoint-initdb.d solo corren
-- en la PRIMERA inicializacion. Para una BD ya existente, aplicar a mano:
--   docker compose -f infra/docker-compose.ip.yml exec -T mysql \
--     mysql -uroot -p"$DB_PASSWORD" "$DB_NAME" < backend/migrations/016_dueno_por_equipo.sql

DROP PROCEDURE IF EXISTS add_dueno_por_equipo;
DELIMITER $$
CREATE PROCEDURE add_dueno_por_equipo()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema=DATABASE() AND table_name='devices' AND column_name='owner') THEN
    ALTER TABLE devices
      ADD COLUMN owner VARCHAR(64) NULL
      COMMENT 'Instancia duena del equipo, tal como la nombra SPACE OS (p.ej. g500). NULL = sin asignar';
    ALTER TABLE devices ADD INDEX idx_devices_owner (owner);

    -- Llenado inicial, en bloque: todo lo que existe hoy es de g500. Va DENTRO
    -- del IF para que reaplicar la migracion no vuelva a marcar equipos que
    -- alguien haya reasignado despues.
    UPDATE devices SET owner = 'g500';
  END IF;

  -- Alcance de la llave de servicio. NULL = ve la flota entera, que es lo que
  -- necesita el padre y nuestra propia operacion; con un valor, ve solo lo de
  -- ese dueno.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema=DATABASE() AND table_name='api_keys' AND column_name='owner') THEN
    ALTER TABLE api_keys
      ADD COLUMN owner VARCHAR(64) NULL
      COMMENT 'Alcance de la llave. NULL = toda la flota; con valor, solo los equipos de ese dueno';
  END IF;
END$$
DELIMITER ;
CALL add_dueno_por_equipo();
DROP PROCEDURE IF EXISTS add_dueno_por_equipo;
