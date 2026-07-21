-- Portal Cliente: user accounts, site assignments, and public comment threads

CREATE TABLE IF NOT EXISTS "tenant_template"."PortalCliente" (
    "id"           TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre"       TEXT NOT NULL,
    "activo"       BOOLEAN NOT NULL DEFAULT true,
    "creadoEn"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortalCliente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PortalCliente_email_key"
    ON "tenant_template"."PortalCliente"("email");

CREATE TABLE IF NOT EXISTS "tenant_template"."PortalClienteSitio" (
    "clienteId" TEXT NOT NULL,
    "sitioId"   TEXT NOT NULL,
    CONSTRAINT "PortalClienteSitio_pkey" PRIMARY KEY ("clienteId","sitioId")
);

ALTER TABLE "tenant_template"."PortalClienteSitio"
    ADD CONSTRAINT "PortalClienteSitio_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "tenant_template"."PortalCliente"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "tenant_template"."ComentarioPublico" (
    "id"          TEXT NOT NULL,
    "otId"        TEXT NOT NULL,
    "texto"       TEXT NOT NULL,
    "fotoUrl"     TEXT,
    "storageKey"  TEXT,
    "timestamp"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autorTipo"   TEXT NOT NULL,
    "autorNombre" TEXT NOT NULL,
    "clienteId"   TEXT,
    "userId"      TEXT,
    CONSTRAINT "ComentarioPublico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ComentarioPublico_otId_idx"
    ON "tenant_template"."ComentarioPublico"("otId");

ALTER TABLE "tenant_template"."ComentarioPublico"
    ADD CONSTRAINT "ComentarioPublico_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "tenant_template"."PortalCliente"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
