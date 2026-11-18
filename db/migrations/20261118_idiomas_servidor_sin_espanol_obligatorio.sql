-- @tipo: esquema
-- ============================================================================
--  «Idiomas del servidor» SIN el espanol obligatorio. IDIOMAS-SIN-ES,
--  2026-11-18. Tarea ROJA (R3) aprobada por el dueno el 18/11.
-- ----------------------------------------------------------------------------
--  Pedido del dueno, en «Administracion → Idiomas del servidor»: «si lo cambia,
--  las 4 opciones de abajo deben estar sin seleccionar para que el usuario
--  elija el idioma». Y sobre el espanol, que hasta hoy era una casilla fija:
--  «tambien sin marcar y elegible».
--
--  `20261110_idiomas_del_servidor.sql` exigia `'es' = any (idiomas)`. Esa
--  migracion YA ESTA APLICADA y no se edita: aqui se sustituye el CHECK por uno
--  que pide lo que de verdad hace falta —AL MENOS UN idioma conocido—. Una
--  lista vacia sigue prohibida: un servidor sin idiomas no puede pintar nada.
--  `NULL` sigue significando «lo que digan las variables `IDIOMA_*`».
--
--  El espanol sigue siendo el respaldo del DICCIONARIO (los textos que falten
--  de traducir); eso vive en el codigo y no depende de esta columna. Ninguna
--  fila cambia: lo que hoy cumple el CHECK viejo cumple el nuevo.
--
--  Idempotente: `drop constraint if exists` + `add`, dentro de la transaccion.
--  Aplicarla dos veces deja exactamente el mismo CHECK.
-- ============================================================================
begin;

alter table apariencia_instancia drop constraint if exists apariencia_instancia_idiomas_ck;

alter table apariencia_instancia
  add constraint apariencia_instancia_idiomas_ck check (
    idiomas is null
    or (idiomas <@ array['es', 'en', 'it', 'pt']::text[] and cardinality(idiomas) >= 1)
  );

commit;
