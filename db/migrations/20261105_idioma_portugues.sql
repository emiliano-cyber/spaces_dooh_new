-- @tipo: esquema
-- ============================================================================
--  P3 DEL PORTUGUES · LA BASE APRENDE `pt` (pt-BR).
-- ----------------------------------------------------------------------------
--  APROBADA POR EL DUEÑO EL 05/11 («Sí, igual que italiano»), como tarea ROJA
--  (R3, migración; y firmas: el idioma de los documentos entra en el texto que
--  se sella). Ver `vault/03-Frontend/portugues-olas.md` §3 y la adenda del
--  ADR 0049.
--
--  Las dos columnas que guardan un idioma nacieron el 03/11 con un CHECK
--  `in ('es', 'en', 'it')`. La ola 0 del portugués metió `pt` en la INTERFAZ
--  (`IDIOMAS`) y, para no chocar con esos CHECK, quien escribía en la base
--  validaba contra una lista aparte (`IDIOMAS_EN_LA_BASE`). Esta migración
--  abre los dos CHECK a `pt`; la aplicación retira esa lista en el mismo
--  cambio.
--
--   1. `usuarios.idioma_preferido` (`20261103_usuarios_idioma_preferido.sql`):
--      la preferencia de «Mi cuenta». Sigue admitiendo `null` (= seguir al
--      navegador). Que el portugués esté APAGADO (`IDIOMA_PORTUGUES`) no es
--      cosa de la base: la aplicación no deja guardarlo apagado, y si se
--      apaga después, la preferencia se ignora sin error, como el italiano.
--   2. `tenants.idioma_documentos` (`20261103_idioma_documentos_por_instancia.sql`):
--      el idioma de los papeles de la instancia. Sigue siendo INMUTABLE y uno
--      por instancia: esos dos triggers no se tocan (no nombran idiomas).
--
--  ═══ LO QUE NO HACE ═════════════════════════════════════════════════════
--
--  · No cambia el idioma de nadie: ninguna fila pasa a `pt`. Las instancias
--    que existen siguen en `es` (o en lo que nacieron), y sus contratos
--    firmados se cotejan byte a byte igual que ayer.
--  · No toca `db/schema.sql` ni los triggers del ADR 0049.
--  · Mismo NOMBRE de restricción que el original, a propósito: si la cadena
--    se reaplica entera (`deploy.yml`), la del 03/11 de `usuarios` ve que la
--    restricción existe y no la recrea con la lista corta; y la de `tenants`
--    la recrea corta, pero ESTA va detrás (orden lexicográfico) y la vuelve
--    a abrir.
--
--  Vuelta atrás (solo si NINGUNA fila tiene `pt`; si la hay, el ADD falla, que
--  es lo correcto):
--    alter table usuarios drop constraint usuarios_idioma_preferido_valido;
--    alter table usuarios add constraint usuarios_idioma_preferido_valido
--      check (idioma_preferido is null or idioma_preferido in ('es','en','it'));
--    alter table tenants drop constraint tenants_idioma_documentos_ck;
--    alter table tenants add constraint tenants_idioma_documentos_ck
--      check (idioma_documentos in ('es','en','it'));
--
--  POSTGRESQL 14: nada posterior. Transaccional e idempotente (drop if exists
--  + add): correrla dos veces deja lo mismo.
-- ============================================================================

begin;

-- ─── 1 · La preferencia de la cuenta ────────────────────────────────────────
alter table usuarios drop constraint if exists usuarios_idioma_preferido_valido;
alter table usuarios add  constraint usuarios_idioma_preferido_valido
  check (idioma_preferido is null or idioma_preferido in ('es', 'en', 'it', 'pt'));

comment on column usuarios.idioma_preferido is
  'Idioma de la INTERFAZ elegido por la persona en Mi cuenta (es/en/it/pt). '
  'null = seguir al navegador (cookie spaces_idioma y Accept-Language). Si el '
  'idioma esta apagado en la instancia se ignora sin error. No afecta a los '
  'documentos (contratos, propuestas impresas), que son de la instancia.';

-- ─── 2 · El idioma de los documentos de la instancia ────────────────────────
alter table tenants drop constraint if exists tenants_idioma_documentos_ck;
alter table tenants add  constraint tenants_idioma_documentos_ck
  check (idioma_documentos in ('es', 'en', 'it', 'pt'));

comment on column tenants.idioma_documentos is
  'ADR 0049 (03/11; pt el 05/11). Idioma de los DOCUMENTOS de la instancia (contrato, constancia, propuesta impresa, portal, comprobante y correos): es, en, it o pt, el mismo para todas sus organizaciones. Se elige al crear la primera (POST /api/bootstrap) y no se puede cambiar. NO es el idioma de la interfaz.';

commit;

select 'cuentas con un idioma fuera de es/en/it/pt (deberia ser 0)' k, count(*)::text v
  from usuarios where idioma_preferido is not null and idioma_preferido not in ('es', 'en', 'it', 'pt')
union all
select 'organizaciones fuera de es/en/it/pt (deberia ser 0)', count(*)::text
  from tenants where idioma_documentos not in ('es', 'en', 'it', 'pt')
union all
select 'triggers del idioma de documentos (deberia ser 2)', count(*)::text
  from pg_trigger
 where tgname in ('trg_tenants_idioma_documentos_inmutable', 'trg_tenants_idioma_documentos_unico');
