-- migrations/032_foto_al_recuperar.sql
-- La foto de cuando la imagen volvio, tambien cuando la recupera una persona.
--
-- EL HUECO
-- --------
-- Una falla guarda DOS fotos: la de cuando se detecto (`photo_id`) y la de
-- cuando se recupero (`photo_recuperacion_id`). La segunda la sube el propio
-- equipo al cerrar la falla, dentro del mismo evento. Asi que la tiene SOLO la
-- falla que se cerro sola.
--
-- Cuando una persona marca «ya se recupero» desde el panel -porque fue a la
-- calle, porque le avisaron, porque la vio bien en el vivo- no hay evento del
-- equipo y no hay foto: el historial se queda con la prueba de que se fue y
-- ninguna de que volvio. Es justo la mitad que hace falta para cobrarle a un
-- cliente o para defenderse de el: «se cayo a las 19:40 y volvio a las 21:05»
-- sin nada que ensenar de las 21:05.
--
-- COMO SE LLENA
-- -------------
-- Al marcarla a mano, el servidor le pide una foto al equipo (TAKE_PHOTO) y
-- apunta aqui CUANDO la pidio. La foto llega por el camino de siempre -no hay
-- camino nuevo, ni una APK nueva- y al guardarse se busca una falla de ese
-- equipo con la foto pedida hace poco y sin foto de recuperacion todavia: esa
-- se queda con ella.
--
-- POR QUE UNA FECHA Y NO UNA BANDERA. La ventana tiene que caducar. Un equipo
-- apagado no contesta hoy y puede contestar manana al encender: sin caducidad,
-- la primera foto del dia siguiente entraria como «asi volvio la imagen» con
-- catorce horas de retraso, y seria una prueba falsa. Con la fecha, la ventana
-- se mide en minutos (ver monitoreo.controller) y lo que llega tarde se guarda
-- como una foto normal, que es lo que es.
ALTER TABLE pantalla_fallas
  ADD COLUMN foto_pedida_en DATETIME NULL AFTER photo_recuperacion_id;

-- Lo que se pregunta en cada subida de foto: «¿este equipo espera una?».
CREATE INDEX idx_falla_foto_pedida ON pantalla_fallas (device_id, foto_pedida_en);
