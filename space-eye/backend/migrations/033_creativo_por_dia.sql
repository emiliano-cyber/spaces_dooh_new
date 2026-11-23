-- migrations/033_creativo_por_dia.sql
-- La auditoria DIARIA de cada creativo: cuantas veces se vio y como se veia.
--
-- LO QUE HABIA
-- ------------
-- `device_creatives` lleva un contador `vistas` de por vida y dos fotos: la del
-- hallazgo y la ultima. Con eso se puede decir «este anuncio lleva 412 vistas
-- desde el 3 de octubre», que no sirve para auditar un mes: no dice si estuvo
-- en rotacion ayer, ni como se veia el martes.
--
-- LO QUE FALTA, Y ES UNA FILA POR DIA
-- -----------------------------------
--   · `apariciones`: en cuantas REVISIONES de ese dia salio. El equipo reporta
--     en cada vuelta las huellas que reconocio (ver `registrarRecorrido`), asi
--     que el dato ya llegaba y se estaba sumando a un total que lo borraba.
--   · `revisiones`: cuantas vueltas hubo ese dia en total. Sin el denominador,
--     «37 apariciones» no se puede leer: no es lo mismo con 40 revisiones que
--     con 400. Va en la misma fila para que el numero no dependa de recalcular
--     el historico.
--   · `photo_id`: la foto de ESE dia, si se consiguio. La de ayer se queda en
--     la fila de ayer: es lo que pidio el dueno -«todos los dias una foto nueva
--     conservando la anterior»- y lo que permite ensenar como envejece un
--     anuncio, o probar que el martes estaba bien y el miercoles no.
--
-- ESTO NO SON REPRODUCCIONES. Una camara que mira cada tantos minutos puede
-- decir en cuantas de SUS miradas estaba el anuncio, no cuantas veces lo saco
-- el reproductor. El numero de reproducciones solo lo tiene quien reproduce.
-- Por eso la columna se llama `apariciones` y viaja con su denominador: para
-- que nadie la lea como lo que no es.
CREATE TABLE IF NOT EXISTS device_creative_dias (
  device_id    BIGINT UNSIGNED NOT NULL,
  phash        CHAR(64)        NOT NULL,
  dia          DATE            NOT NULL,
  apariciones  INT UNSIGNED    NOT NULL DEFAULT 0,
  revisiones   INT UNSIGNED    NOT NULL DEFAULT 0,
  photo_id     BIGINT UNSIGNED NULL,
  PRIMARY KEY (device_id, phash, dia),
  KEY idx_dia (device_id, dia),
  CONSTRAINT fk_creadia_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- El tope de fotos EXTRA al dia, el de la foto diaria de cada creativo.
--
-- Aparte del tope de creativos nuevos (`creative_max_dia`) y no sumado a el: son
-- dos gastos distintos y el dueno fija cada uno. Una foto de mas al dia por
-- creativo, en una pantalla con veinte anuncios, son veinte fotos de datos
-- moviles; con el tope, las que quepan, y el resto se queda con la foto del dia
-- anterior hasta manana.
ALTER TABLE devices
  ADD COLUMN creative_fotos_dia TINYINT UNSIGNED NOT NULL DEFAULT 6 AFTER creative_refoto_h;

-- De donde salio la foto. `refoto` es la de la auditoria diaria: no es el
-- hallazgo de un creativo nuevo ni una foto por horario, y mezclarla con esas
-- dos falsearia los dos contadores que ya existen.
ALTER TABLE photos
  MODIFY COLUMN source ENUM(
    'manual','scheduled','on_demand','boot','creative_change','falla','campana','refoto'
  ) NULL DEFAULT 'manual';
