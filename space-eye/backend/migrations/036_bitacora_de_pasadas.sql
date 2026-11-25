-- migrations/036_bitacora_de_pasadas.sql
-- A QUE HORA salio cada creativo, y cuantas veces. La bitacora de la auditoria.
--
-- LO QUE HABIA (033)
-- ------------------
-- `device_creative_dias` guarda, por creativo y por dia, en cuantas REVISIONES
-- salio y cuantas hubo. Eso contesta «estuvo en rotacion el martes», que es
-- mucho mas de lo que habia antes, pero no contesta las dos preguntas que hace
-- un auditor de verdad:
--
--   · «a que hora salio» -> la fila llega al DIA y se acaba ahi;
--   · «cuantas veces»    -> cuenta VUELTAS, no pasadas. El equipo mira la
--     pantalla decenas de veces en una vuelta de cinco minutos y reporta
--     `vistas` como un CONJUNTO (linkedSetOf en Monitor.kt:324, `vistas = {}`
--     en monitor.py). Doce apariciones dentro de una vuelta se guardan como
--     una. El dato lo tiene el equipo en la mano y lo tira.
--
-- LO QUE ESTO NO ES, Y HAY QUE SEGUIR DICIENDOLO
-- ----------------------------------------------
-- NO SON REPRODUCCIONES. Una camara que mira cada tantos segundos puede decir
-- en cuantas de SUS MIRADAS estaba el anuncio; cuantas veces lo saco el
-- reproductor solo lo sabe quien reproduce. Por eso aqui nada se llama
-- `reproducciones` y todo viaja con su denominador: «312 de 1 840 miradas,
-- entre las 6:00 y las 23:00» es un numero que se defiende; «312
-- reproducciones» es uno que se cae en cuanto alguien pregunta como se midio.
--
-- POR QUE POR HORA Y NO UNA FILA POR PASADA
-- -----------------------------------------
-- Una pantalla en continuo con veinte anuncios da cientos de miles de miradas
-- al dia. Una fila por mirada son millones de filas al mes por equipo, y la
-- pregunta que contestan -«a que hora»- se contesta igual de bien con el
-- cubo de la hora, que son 20 x 24 = 480 filas al dia. Se guardan ademas la
-- primera y la ultima de cada hora, que es la precision que un reporte usa.
--
-- LA HORA ES LA DE LA PANTALLA, NO LA DEL SERVIDOR
-- ------------------------------------------------
-- Un anunciante compra las 8 de la manana DONDE ESTA EL ANUNCIO. `devices` no
-- tiene zona horaria (solo `clock_offset_s`), y ya hubo avisos de madrugada
-- por confundirlas. Asi que la hora la manda el equipo, que es el unico que la
-- sabe; `zona` dice de donde salio para que el reporte pueda advertirlo cuando
-- tuvo que suponerla.

-- 1. EL DIA: su cabecera, su denominador y su cierre -------------------------
--
-- Una fila por equipo y dia. Aqui vive el total de miradas del dia (el
-- denominador de todo lo demas, sin repetirlo en cada creativo) y el CIERRE:
-- hasta que el equipo no manda su resumen de fin de dia, el dia esta abierto y
-- un reporte sobre el es provisional. Es la diferencia entre un comprobante y
-- una captura de pantalla.
CREATE TABLE IF NOT EXISTS device_dias (
  device_id  BIGINT UNSIGNED NOT NULL,
  dia        DATE            NOT NULL,
  vistazos   INT UNSIGNED    NOT NULL DEFAULT 0,  -- miradas del dia
  vueltas    INT UNSIGNED    NOT NULL DEFAULT 0,  -- recorridos del dia
  primera    TIME            NULL,                -- primera mirada (hora del equipo)
  ultima     TIME            NULL,
  -- Con que vara se midio el dia. `vistazo` es el equipo que cuenta cada
  -- mirada (Raspberry y PC al dia); `vuelta` es el que solo manda el conjunto
  -- de lo que vio (los telefonos, cuya APK ya esta en la calle). Mezclar las
  -- dos en un reporte sin decirlo es el error que invalida la auditoria, asi
  -- que la vara viaja con el dato.
  medida     ENUM('vuelta','vistazo') NOT NULL DEFAULT 'vuelta',
  -- De donde salio la hora: la del equipo, o la del servidor cuando el equipo
  -- no la manda y hubo que suponerla.
  zona       ENUM('equipo','servidor') NOT NULL DEFAULT 'servidor',
  cerrado_at DATETIME        NULL,                -- cuando el equipo cerro el dia
  -- Miradas que el equipo conto y al servidor nunca le llegaron. El cierre
  -- trae el total del dia segun el equipo; si no cuadra con lo que se fue
  -- guardando vuelta a vuelta, la diferencia son reportes perdidos (red caida,
  -- equipo reiniciado). Se guarda en vez de taparla: un dia con huecos sigue
  -- sirviendo, pero el reporte tiene que poder decirlo.
  perdidos   INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY (device_id, dia),
  KEY idx_dia_cierre (dia, cerrado_at),
  CONSTRAINT fk_devdia_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. LA HORA: el denominador de cada hora ------------------------------------
--
-- Aparte y no dentro de la fila de cada creativo: en una hora con veinte
-- anuncios, el numero de miradas es UNO, no veinte copias que se pueden
-- desincronizar. 24 filas al dia por equipo.
CREATE TABLE IF NOT EXISTS device_horas (
  device_id BIGINT UNSIGNED NOT NULL,
  dia       DATE            NOT NULL,
  hora      TINYINT UNSIGNED NOT NULL,            -- 0-23, hora de la pantalla
  vistazos  INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY (device_id, dia, hora),
  CONSTRAINT fk_devhora_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. EL CREATIVO EN ESA HORA: la bitacora ------------------------------------
CREATE TABLE IF NOT EXISTS device_creative_horas (
  device_id BIGINT UNSIGNED NOT NULL,
  phash     CHAR(64)        NOT NULL,
  dia       DATE            NOT NULL,
  hora      TINYINT UNSIGNED NOT NULL,
  -- Miradas de esa hora en las que el anuncio estaba. Con `device_horas` al
  -- lado sale el porcentaje de ocupacion, que es lo que se vendio.
  pasadas   INT UNSIGNED    NOT NULL DEFAULT 0,
  primera   TIME            NULL,                 -- dentro de la hora
  ultima    TIME            NULL,
  PRIMARY KEY (device_id, phash, dia, hora),
  KEY idx_creahora_dia (device_id, dia, hora),
  CONSTRAINT fk_creahora_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. La fila del dia tambien dice con que vara se midio -----------------------
--
-- `apariciones` (033) son VUELTAS; `pasadas` son MIRADAS. Son dos numeros
-- distintos y ninguno sustituye al otro: el viejo sigue siendo el unico que
-- tienen los telefonos, y el nuevo es el que pide la auditoria. Conviven, cada
-- uno con su nombre, en vez de cambiarle el significado a una columna que ya
-- tiene meses de historia dentro.
ALTER TABLE device_creative_dias
  ADD COLUMN pasadas INT UNSIGNED NOT NULL DEFAULT 0 AFTER apariciones,
  ADD COLUMN medida  ENUM('vuelta','vistazo') NOT NULL DEFAULT 'vuelta' AFTER revisiones;
