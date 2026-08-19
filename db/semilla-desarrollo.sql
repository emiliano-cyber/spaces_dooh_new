-- ============================================================================
--  semilla-desarrollo.sql — la organización de PRUEBAS del entorno local.
-- ----------------------------------------------------------------------------
--  NO forma parte del esquema, y ésa es toda su razón de ser.
--
--  Hasta el 2026-08-19, `db/schema.sql` sembraba el tenant 'RGB Catorce' /
--  'rgb' y su fila de `config_negocio`. Con una sola instalación eso era
--  cómodo; con el modelo de instancias soberanas es un defecto: **cada
--  instancia nueva nacía con la identidad de otro owner dentro**. La de PIXELED,
--  la de Telcel y la de quien viniera empezaban con una organización 'rgb' que
--  nadie había dado de alta, y bastaba con eso para romper dos criterios del
--  plan v3: el de F4.2 —«ni una fila de ningún owner»— y el de F4.5, que exige
--  que los slugs de DEMO y de `spaces_prod` no compartan ninguno.
--
--  Así que el esquema salió sin owner, y lo que sí hacía falta —una
--  organización con la que trabajar en local— se mudó aquí.
--
--  ── Quién la aplica y quién NO ────────────────────────────────────────────
--
--    · SÍ  el arnés de integración (`apps/web/lib/test/db-e2e.ts`), entre
--          `schema.sql` y las migraciones. Esa posición importa: reproduce una
--          base que YA tenía organización antes de migrar, que es el estado del
--          droplet, y es lo que hace disparar el backfill de
--          `20260812_schema_migrations.sql`.
--    · SÍ  quien monte el entorno local a mano, después de `schema.sql`.
--    · NO  la imagen: `Dockerfile:94-95` copia `db/schema.sql` y
--          `db/migrations/`, y este archivo no está en ninguno de los dos. Una
--          instancia de verdad crea su organización al aprovisionar
--          (`apps/web/scripts/bootstrap-auth.mjs`, y en F5.2 la ruta de
--          bootstrap de un solo uso).
--
--  Uso:
--    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/semilla-desarrollo.sql
--
--  Transaccional e idempotente: correrla dos veces no cambia una sola fila.
--  Y no crea usuarios: de eso se encarga `bootstrap-auth.mjs`, que pide la
--  identidad por variables de entorno —
--    ORG_SLUG=rgb ORG_NOMBRE='RGB Catorce' \
--    ADMIN_EMAIL=jose@pixeled.com.mx ADMIN_NOMBRE='Cliente_ RGB Catorce' \
--    DATABASE_URL=... node scripts/bootstrap-auth.mjs
-- ============================================================================

begin;

insert into tenants (nombre, slug) values ('RGB Catorce', 'rgb')
  on conflict (slug) do nothing;

-- Una fila de configuración por organización (ADR 0011). La app la crearía sola
-- al primer acceso (`lib/server/config-repo.ts:59-61`), pero dejarla puesta
-- mantiene el entorno local igual que antes de mover la semilla.
insert into config_negocio (tenant_id, moneda)
select t.id, 'MXN' from tenants t
 where not exists (select 1 from config_negocio c where c.tenant_id = t.id);

commit;

-- ─── Verificación ──────────────────────────────────────────────────────────
--   select slug from tenants;                      -- rgb
--   select count(*) from config_negocio;           -- 1 por organización
--
-- ─── ROLLBACK ──────────────────────────────────────────────────────────────
-- Se lleva por delante TODO lo que cuelgue de la organización (las FK van con
-- `on delete cascade`), así que en una base con datos de trabajo hay que
-- pensarlo dos veces:
--   delete from tenants where slug = 'rgb';
