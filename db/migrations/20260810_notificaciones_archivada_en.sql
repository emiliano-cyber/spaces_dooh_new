-- ============================================================================
--  «Borrar todas» en el centro de notificaciones — sin borrar nada.
-- ----------------------------------------------------------------------------
--  El panel listaba las últimas 100 notificaciones, leídas incluidas, así que
--  «Marcar todas» dejaba la lista igual de llena: solo se atenuaba. Para el
--  usuario eso es un botón que no hace nada, y por eso pedía uno que vaciara.
--
--  Se ARCHIVA en vez de borrar: la fila se conserva y deja de listarse. Borrar
--  de verdad haría irreversible un clic que la gente da para quitarse el punto
--  rojo de encima, y el coste de conservarla es una columna.
--
--  `archivada_en` guarda CUÁNDO, no un booleano: si mañana hace falta una
--  papelera («lo archivé sin querer, devuélveme lo de hoy»), la fecha ya está.
--  Un `archivada boolean` habría que volver a migrarlo para eso.
--
--  Idempotente: se puede correr dos veces sin romper nada.
-- ============================================================================

alter table notificaciones add column if not exists archivada_en timestamptz;

-- El panel filtra por `archivada_en is null` en cada consulta, sobre las
-- notificaciones de un tenant. El índice parcial cubre justo esa lectura y no
-- crece con lo archivado, que es lo que se acumula con el tiempo.
create index if not exists idx_notif_vivas
  on notificaciones (tenant_id, creado_en desc)
  where archivada_en is null;
