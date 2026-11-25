-- migrations/035_creativo_de_que_campana.sql
-- De QUIEN es cada creativo, sin que nadie lo teclee.
--
-- LO QUE FALTABA
-- --------------
-- Con la 034 el sistema ya sabe QUE anuncio sale en cada foto, y se le puede
-- poner nombre a mano para mandar sus comprobantes. Lo que no sabia es de
-- quien es ese anuncio: la camara ve la pantalla, no la factura.
--
-- Pero el dato YA ESTA EN LA BASE. Cada campana trae su creatividad de
-- referencia (`campaigns.creative_path`, que Operaciones sube desde SPACE OS) y
-- su anunciante. Lo unico que faltaba era comparar una cosa con la otra.
--
-- Y se puede comparar con lo que ya hay: la pantalla enderezada y la
-- creatividad pasan por el MISMO normalizador -320 px de ancho, en gris- y de
-- ahi sale la misma huella de 256 bits que el servidor usa para todo lo demas.
--
-- MEDIDO el 25-nov-2026 contra los creativos de las pantallas DEMO: 13 de 14
-- casaron con su campana a 1-10 bits de distancia, y el que no era de ninguna
-- salio a 85. La separacion es enorme porque son la misma imagen; en campo
-- habra reflejos, angulo y noche, asi que el umbral se queda corto a proposito
-- (ver IDENTIFICAR_BITS en creativos.controller) y lo dudoso se deja sin
-- identificar. Un anunciante equivocado en un comprobante es peor que ninguno.
--
-- POR QUE NO SE COPIA EL NOMBRE. `campaign_id` apunta a la campana; el nombre
-- se lee de ella al pintarlo. Copiarlo aqui crearia dos verdades y la del
-- catalogo se quedaria vieja en cuanto alguien renombrara la campana. El
-- `nombre` de la 034 sigue siendo lo que una persona escribio, y gana siempre:
-- es una correccion, no un duplicado.
ALTER TABLE device_creatives
  ADD COLUMN campaign_id BIGINT UNSIGNED NULL
    COMMENT 'La campana cuya creatividad reconocio el servidor en este anuncio'
    AFTER nombre,
  ADD COLUMN campana_bits TINYINT UNSIGNED NULL
    COMMENT 'A cuantos bits caso, para poder juzgar si el parecido convence',
  ADD CONSTRAINT fk_creativo_campana FOREIGN KEY (campaign_id)
    REFERENCES campaigns (id) ON DELETE SET NULL;

-- Todas las fotos en las que salio un anuncio de esta campana. Es la consulta
-- de «ensename los comprobantes de este cliente», y sin el indice recorre el
-- catalogo entero del sitio por cada pagina de la galeria.
ALTER TABLE device_creatives
  ADD KEY idx_creativo_campana (campaign_id);
