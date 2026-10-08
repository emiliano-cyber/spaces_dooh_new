-- migrations/015_llaves_servicio.sql
-- Llaves de servicio: credenciales para que OTRO SISTEMA lea la API.
--
-- POR QUE
-- -------
-- Hasta ahora, para que un sistema externo leyera Space Eye habia que darle
-- usuario y contrasena de una cuenta del dashboard. Eso tiene tres problemas y
-- los tres se ven ya en produccion:
--
--   1. Da la cuenta COMPLETA, con permiso de escritura incluido: quien lea
--      fotos puede tambien borrar equipos.
--   2. La sesion CADUCA a los 7 dias (JWT_REFRESH_TTL), asi que una integracion
--      servidor-a-servidor se cae sola cada semana.
--   3. Casi toda la operacion usa la MISMA cuenta admin, asi que en el registro
--      no hay forma de distinguir quien hizo que.
--
-- Una llave de servicio no caduca, solo lee, se revoca sola sin tocar a nadie
-- mas, y tiene nombre: en el registro se ve cual sistema pregunto.
--
-- LO QUE ESTA MIGRACION NO RESUELVE
-- ---------------------------------
-- El ALCANCE. Una llave sigue viendo la flota entera, porque en Space Eye un
-- equipo todavia no tiene dueno (SE.1). Cuando exista, aqui se agrega la
-- columna del dueno y el filtro. Mientras tanto esto no es peor que hoy -hoy se
-- entrega la cuenta admin- pero tampoco es aislamiento, y conviene no confundir
-- una cosa con la otra.
--
-- NOTA: en produccion las migraciones de docker-entrypoint-initdb.d solo corren
-- en la PRIMERA inicializacion. Para una BD ya existente, aplicar a mano:
--   docker compose -f infra/docker-compose.ip.yml exec -T mysql \
--     mysql -uroot -p"$DB_PASSWORD" "$DB_NAME" < backend/migrations/015_llaves_servicio.sql

CREATE TABLE IF NOT EXISTS api_keys (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  -- Para que en el registro se lea "instancia g500" y no un numero.
  nombre      VARCHAR(100) NOT NULL,
  -- Parte publica de la llave. Se guarda en claro porque sirve para BUSCARLA
  -- sin tener que comparar contra todas las filas, y para poder mostrar
  -- "se_a1b2c3d4e5f6..." en pantalla sin revelar el secreto.
  prefijo     CHAR(12) NOT NULL,
  -- SHA-256 de la llave completa. Es un secreto ALEATORIO de 32 bytes, no una
  -- contrasena elegida por una persona, asi que no hace falta bcrypt: no hay
  -- diccionario que probar y bcrypt costaria en CADA peticion.
  hash        CHAR(64) NOT NULL,
  -- Por omision NO escribe. Hoy ningun consumidor lo necesita y es la
  -- diferencia entre una fuga que expone datos y una que permite borrarlos.
  escritura   BOOLEAN NOT NULL DEFAULT FALSE,
  creada_por  BIGINT UNSIGNED NULL,
  creada_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Para poder contestar "esta llave sigue en uso?" antes de revocarla.
  ultimo_uso  TIMESTAMP NULL,
  -- Revocar NO borra: se conserva el rastro de que existio y de quien la creo.
  revocada_en TIMESTAMP NULL,
  UNIQUE KEY uq_api_keys_prefijo (prefijo),
  FOREIGN KEY (creada_por) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
