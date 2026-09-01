-- ############################################################################
--  ⚠️  LA COPIA QUE MANDA EN UNA INSTANCIA ES LA MIGRACION.
--
--  Desde el 2026-09-01 este DDL vive tambien en
--      db/migrations/20260901_doohmain_tracking.sql
--  y es esa la que aplican `provision-instancia.sh` y el runner de cada
--  instancia. Este archivo se conserva porque el SDK tambien se usa suelto
--  desde la raiz del repo.
--
--  SI DIVERGEN, GANA LA MIGRACION: es la unica que deja registro de haberse
--  aplicado. Si tocas una, toca la otra.
--
--  La migracion ademas CONCEDE PERMISOS al rol de la aplicacion, que este
--  archivo no hace: aplicarlo suelto deja las tablas sin GRANT si quien lo
--  corre no es el dueno de la base.
-- ############################################################################

-- Tablas de tracking de la integración con DOOHmain (PostgreSQL).
-- Sostienen la idempotencia: registran qué se creó/subió/publicó en DOOHmain
-- para no duplicar. Aplicar una vez sobre la BD local:
--   psql "<DATABASE_URL>" -f doohmain_sdk/schema.sql
-- Es idempotente (IF NOT EXISTS): se puede re-ejecutar sin daño.

CREATE TABLE IF NOT EXISTS doohmain_remote_campaigns (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    version        TEXT        NOT NULL,
    auth           TEXT,
    name           TEXT,
    anunciante     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uniq_version UNIQUE (version)   -- una campaña por versión de creativo
);

CREATE TABLE IF NOT EXISTS doohmain_remote_lists (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    screen_name    TEXT        NOT NULL,
    list_name      TEXT        NOT NULL,
    campaign_auth  TEXT,
    media_id       BIGINT      NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uniq_screen_list_media UNIQUE (screen_name, list_name, media_id)
);

CREATE TABLE IF NOT EXISTS media_uploads (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    version      TEXT        NOT NULL,
    media_id     BIGINT      NOT NULL,
    file_hash    TEXT,
    filename     TEXT,
    local_path   TEXT,
    ancho        INTEGER,
    alto         INTEGER,
    extension    TEXT,
    source_mtime BIGINT,
    source_size  BIGINT,
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uniq_media_version UNIQUE (version)
);
