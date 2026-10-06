-- @tipo: esquema
-- ============================================================================
--  Las NOTAS de la version disponible, en el buzon de la instancia.
--  Pedido del dueno, 2026-10-01. Hermana de ADR 0037.
-- ----------------------------------------------------------------------------
--  UNA columna en `actualizaciones_instancia` (`20260921_actualizaciones_
--  instancia.sql`), ninguna tabla. Guarda la entrada de `novedades.json` de la
--  version DISPONIBLE -la que el dueno todavia no instala-, tal cual:
--  `{ "version": "v0.9.2", "fecha": "AAAA-MM-DD", "items": [{ "tipo", "texto" }] }`.
--
--  QUIEN ESCRIBE: el ACTUALIZADOR (`update.sh`, su sonda de estado), con el
--  rol privilegiado, en la misma sentencia que `version_disponible` y
--  `digest_disponible`, leyendo el `novedades.json` de la imagen nueva. NULL
--  cuando la imagen no trae notas para esa version: las notas nunca tumban
--  una actualizacion.
--
--  QUIEN LEE: la APLICACION (`GET /api/actualizaciones`), para ensenarle al
--  Dueno y al Administrador que trae la version ANTES de aprobarla. La app la
--  revalida al leer (`apps/web/lib/novedades.ts`) y descarta lo que no sirva:
--  lo escribe otro proceso, desde otra imagen.
--
--  POR QUE NO HAY NINGUN `grant` AQUI, y es a proposito:
--    · LEER ya esta concedido: `20260921` da `select` de TABLA a la app, y un
--      privilegio de tabla cubre tambien las columnas que se anadan despues.
--    · ESCRIBIR no se concede: el `update` de la app sobre esta tabla es POR
--      COLUMNA (modo, aprobado_*, actualizado_en), y una columna nueva nace
--      fuera de esa lista. Si la app pudiera escribir esto, podria ensenar al
--      lado del boton de instalar unas notas que la imagen no trae.
--  `migraciones.e2e.test.ts` lo comprueba con el rol de la app: lee, y el
--  `update` da `permission denied`.
--
--  Y LA SONDA MIRA SI LA COLUMNA EXISTE antes de escribirla: corre con la
--  imagen NUEVA contra la base VIEJA, y la primera `--comprobar` tras publicar
--  esta version llega antes que esta migracion. Ver `guion_estado()` en
--  `infra/scripts/update.sh`.
--
--  `jsonb` y no `text`: la app la consume como objeto, y Postgres rechaza en
--  la escritura lo que no sea JSON en vez de dejarlo para el lector.
--  Idempotente: `add column if not exists`.
-- ============================================================================
begin;

alter table actualizaciones_instancia add column if not exists notas_disponibles jsonb;

comment on column actualizaciones_instancia.notas_disponibles is
  'Notas de la version disponible (entrada de novedades.json de la imagen nueva). La escribe update.sh; la app solo la lee. NULL = sin notas.';

commit;
