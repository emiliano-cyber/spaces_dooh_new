-- migrations/017_testigo_de_alta.sql
-- Dos usos para una credencial: LEER el espejo, o DAR DE ALTA un equipo.
--
-- EL PROBLEMA
-- -----------
-- SE.6 quiere que el instalador que se baja del perfil de g500 registre al
-- equipo ya asignado a g500. La forma ingenua es que el agente mande
-- `owner: "g500"` en el alta, y no sirve: el dueno es la frontera que separa a
-- un cliente de otro, y con eso cualquiera se registra como quien quiera. Una
-- frontera que se declara sola no es una frontera.
--
-- Asi que el instalador no lleva el NOMBRE del dueno: lleva un testigo que solo
-- existe para esa instancia. El servidor mira de quien es ese testigo y estampa
-- el dueno el mismo. El equipo no puede mentir porque no conoce el testigo de
-- nadie mas.
--
-- POR QUE EN LA MISMA TABLA QUE LAS LLAVES
-- ----------------------------------------
-- Un testigo de alta es una credencial con dueno, que se revoca, que conviene
-- saber cuando se uso por ultima vez y quien la creo. Es exactamente lo que ya
-- hace `api_keys`, y tener dos tablas para lo mismo significa dos sitios donde
-- revocar y dos historiales que mirar cuando algo se filtra.
--
-- Lo que SI hay que separar es para que sirve cada una, y esa es la columna
-- `uso`. Una llave de lectura vive en el archivo de configuracion de un servidor
-- que controlamos; un testigo de alta viaja DENTRO de un instalador que pasa por
-- las manos de quien va al sitio, se copia a un USB y acaba en un correo. No
-- pueden ser la misma cosa: si lo fueran, el dia que alguien pegue por comodidad
-- la llave de lectura en un instalador, estaria repartiendo el acceso a las
-- fotos de ese cliente. Con la columna puesta, el servidor lo impide: un testigo
-- de alta no puede leer NADA, y una llave de lectura no puede dar de alta.
--
-- NOTA: en produccion las migraciones de docker-entrypoint-initdb.d solo corren
-- en la PRIMERA inicializacion. Para una BD ya existente, aplicar a mano:
--   docker compose -f infra/docker-compose.ip.yml exec -T mysql \
--     mysql -uroot -p"$DB_PASSWORD" "$DB_NAME" < backend/migrations/017_testigo_de_alta.sql

DROP PROCEDURE IF EXISTS add_testigo_de_alta;
DELIMITER $$
CREATE PROCEDURE add_testigo_de_alta()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema=DATABASE() AND table_name='api_keys' AND column_name='uso') THEN
    ALTER TABLE api_keys
      ADD COLUMN uso ENUM('lectura','alta') NOT NULL DEFAULT 'lectura'
      COMMENT 'lectura = la instancia consulta su espejo; alta = el instalador registra un equipo con el dueno de esta credencial';
  END IF;
END$$
DELIMITER ;
CALL add_testigo_de_alta();
DROP PROCEDURE IF EXISTS add_testigo_de_alta;
