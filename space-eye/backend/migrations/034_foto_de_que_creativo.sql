-- migrations/034_foto_de_que_creativo.sql
-- Que creativo ensena cada foto, y los que solo aparecen en fotos por horario.
--
-- LO QUE HABIA
-- ------------
-- El servidor YA reconoce el creativo de todas las fotos: `refrescarConFoto`
-- endereza la pantalla, le saca la huella y la compara contra el catalogo del
-- sitio. Lo hacia con cada foto por horario y a peticion... y tiraba el
-- resultado, salvo una vez cada `creative_refoto_h` horas.
--
-- Por eso no se podian sacar los comprobantes de una campana: la galeria sabia
-- CUANDO se tomo cada foto y de que equipo, pero no QUE anuncio estaba en la
-- pantalla. Juntar las de un cliente era mirarlas una por una.
--
-- `photos.phash` (migracion 011) NO sirve para esto y por eso no se reutiliza:
-- es la huella que mando el equipo con SU foto de hallazgo, solo existe en las
-- de `creative_change`, y es la huella de ESA foto, no la identidad del
-- creativo en el catalogo. Dos fotos del mismo anuncio con distinta luz tienen
-- huellas distintas; lo que las agrupa es a que fila de `device_creatives`
-- casaron, que es justo lo que se guarda aqui.
--
-- LO QUE NO SE PODIA VER
-- ----------------------
-- Y hay un segundo agujero, que es el que reporto el dueno el 24-nov-2026: con
-- Hivestack -y con cualquier programatica- el loop cambia solo. El equipo
-- detecta por esquinas (ORB) y esos cambios se le van; la foto por horario los
-- retrata, pero como nadie la miraba contra el catalogo, ese anuncio NO entraba
-- en ninguna parte. No se contaba, no se avisaba y no tenia ficha.
--
-- Con `descubierto` se puede decir de donde salio cada uno sin inventar una
-- tabla aparte: 'equipo' es el hallazgo de siempre, 'servidor' es el que
-- aparecio en una foto que ya estaba pagada.
--
-- Aditiva. No reescribe nada de lo que ya hay: las fotos viejas se quedan con
-- `creativo` en NULL, que es la verdad -no sabemos que ensenaban- y no una
-- suposicion. El guion `backend/scripts/etiquetar-fotos.ts` las reconoce hacia
-- atras cuando alguien lo pida, equipo por equipo.
ALTER TABLE photos
  ADD COLUMN creativo CHAR(64) NULL
    COMMENT 'Huella del creativo del catalogo que se reconocio en esta foto'
    AFTER phash;

-- Por equipo y creativo, y ordenado por fecha: es exactamente la consulta de
-- «dame los comprobantes de esta campana», que es para lo que existe la
-- columna. Sin el indice, juntar un mes de un anuncio recorre la tabla entera
-- de fotos del sitio.
ALTER TABLE photos
  ADD KEY idx_foto_creativo (device_id, creativo, taken_at);

ALTER TABLE device_creatives
  ADD COLUMN descubierto ENUM('equipo','servidor') NOT NULL DEFAULT 'equipo'
    COMMENT 'Quien lo encontro: el ORB del equipo, o el servidor en una foto'
    AFTER aprendido;

-- De quien es ese anuncio, en palabras.
--
-- La camara sabe QUE anuncios salen y desde cuando, pero no de quien son:
-- nadie le dice a Space Eye que el creativo de la esquina superior es de
-- Dessea. Sin un nombre, un paquete de comprobantes se llama
-- «comprobantes.zip» y el filtro de la galeria dice «las fotos de un solo
-- creativo», que no es algo que se le pueda mandar a un cliente.
--
-- Lo pone una persona desde la ficha, y es opcional: un creativo sin nombre
-- sigue funcionando igual. VARCHAR y no una tabla de campanas porque lo que
-- hace falta es una etiqueta para identificar un paquete, no un modelo de
-- negocio: las campanas de verdad viven en SPACE OS y un anuncio en pantalla
-- no siempre corresponde a una de ellas -la programatica, justamente, no-.
ALTER TABLE device_creatives
  ADD COLUMN nombre VARCHAR(120) NULL
    COMMENT 'De quien es, puesto a mano: se usa para nombrar sus comprobantes'
    AFTER descubierto;
