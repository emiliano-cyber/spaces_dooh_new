-- CreateEnum
CREATE TYPE "tenant_template"."TipoCampana" AS ENUM ('OOH', 'DOOH', 'HIBRIDA');

-- CreateEnum
CREATE TYPE "tenant_template"."EstComercialCampana" AS ENUM ('DRAFT', 'COTIZACION', 'CONFIRMADA', 'ACTIVA', 'COMPLETADA', 'CANCELADA', 'LISTA_FACTURAR');

-- CreateEnum
CREATE TYPE "tenant_template"."EstTecnico" AS ENUM ('PENDIENTE', 'EN_PUBLICACION', 'PAUSADA', 'FINALIZADA', 'ERROR');

-- CreateEnum
CREATE TYPE "tenant_template"."TipoVenta" AS ENUM ('SPOT_UNIT', 'DAY_PACK', 'HOUR_PACK', 'SOV', 'TAKEOVER', 'FIXED_PKG', 'PROG_DIRECT', 'PROG_PMP', 'PROG_OPEN', 'MAKEGOOD', 'HOUSE_AD');

-- CreateTable: Cliente
CREATE TABLE "tenant_template"."Cliente" (
    "id"           TEXT NOT NULL,
    "nombre"       TEXT NOT NULL,
    "rfc"          TEXT,
    "tipo"         TEXT NOT NULL DEFAULT 'DIRECTO',
    "contactoJson" JSONB NOT NULL DEFAULT '{}',
    "activo"       BOOLEAN NOT NULL DEFAULT true,
    "creadoEn"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Campana
CREATE TABLE "tenant_template"."Campana" (
    "id"                  TEXT NOT NULL,
    "folio"               TEXT NOT NULL,
    "nombre"              TEXT NOT NULL,
    "clienteId"           TEXT NOT NULL,
    "agencia"             TEXT,
    "marca"               TEXT,
    "tipoCampana"         "tenant_template"."TipoCampana" NOT NULL DEFAULT 'OOH',
    "fechaInicio"         TIMESTAMP(3) NOT NULL,
    "fechaFin"            TIMESTAMP(3) NOT NULL,
    "presupuestoBruto"    DECIMAL(14,2),
    "presupuestoNeto"     DECIMAL(14,2),
    "moneda"              TEXT NOT NULL DEFAULT 'MXN',
    "estadoComercial"     "tenant_template"."EstComercialCampana" NOT NULL DEFAULT 'DRAFT',
    "ocRecibida"          BOOLEAN NOT NULL DEFAULT false,
    "ocUrl"               TEXT,
    "fotosComprobatorias" BOOLEAN NOT NULL DEFAULT false,
    "reportePublicacion"  BOOLEAN NOT NULL DEFAULT false,
    "portalToken"         TEXT,
    "portalActivo"        BOOLEAN NOT NULL DEFAULT false,
    "notas"               TEXT,
    "creadoEn"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Campana_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CampaignLine
CREATE TABLE "tenant_template"."CampaignLine" (
    "id"           TEXT NOT NULL,
    "campanaId"    TEXT NOT NULL,
    "sitioId"      TEXT NOT NULL,
    "pantallasIds" TEXT[] NOT NULL,
    "fechaInicio"  TIMESTAMP(3) NOT NULL,
    "fechaFin"     TIMESTAMP(3) NOT NULL,
    "tipoVenta"    "tenant_template"."TipoVenta" NOT NULL DEFAULT 'DAY_PACK',
    "precio"       DECIMAL(12,2) NOT NULL,
    "cantidad"     INTEGER NOT NULL DEFAULT 1,
    "unidad"       TEXT NOT NULL DEFAULT 'DIA',
    "duracionSpot" INTEGER,
    "frecuencia"   INTEGER,
    "horarioJson"  JSONB NOT NULL DEFAULT '{}',
    "estatus"      TEXT NOT NULL DEFAULT 'ACTIVA',
    "creadoEn"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Creatividad
CREATE TABLE "tenant_template"."Creatividad" (
    "id"                TEXT NOT NULL,
    "campanaId"         TEXT NOT NULL,
    "nombre"            TEXT NOT NULL,
    "archivoUrl"        TEXT,
    "storageKey"        TEXT,
    "formato"           TEXT,
    "resolucion"        TEXT,
    "duracionSeg"       INTEGER,
    "pesoMb"            DECIMAL(8,2),
    "estatusValidacion" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "rechazadoMotivo"   TEXT,
    "destino"           TEXT,
    "subioPorUserId"    TEXT,
    "subioPorExterno"   BOOLEAN NOT NULL DEFAULT false,
    "creadoEn"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Creatividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Pantalla
CREATE TABLE "tenant_template"."Pantalla" (
    "id"          TEXT NOT NULL,
    "sitioId"     TEXT NOT NULL,
    "nombre"      TEXT NOT NULL,
    "resolucion"  TEXT,
    "orientacion" TEXT,
    "cmsTipo"     TEXT,
    "cmsScreenId" TEXT,
    "activa"      BOOLEAN NOT NULL DEFAULT true,
    "creadoEn"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pantalla_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TrafficOrder
CREATE TABLE "tenant_template"."TrafficOrder" (
    "id"                 TEXT NOT NULL,
    "folio"              TEXT NOT NULL,
    "campanaId"          TEXT NOT NULL,
    "campaignLineId"     TEXT,
    "connectorTipo"      TEXT NOT NULL DEFAULT 'MANUAL',
    "instruccionJson"    JSONB NOT NULL DEFAULT '{}',
    "referenciaExterna"  TEXT,
    "estadoTecnico"      "tenant_template"."EstTecnico" NOT NULL DEFAULT 'PENDIENTE',
    "deliveryReportUrl"  TEXT,
    "deliveryStorageKey" TEXT,
    "deliveryJson"       JSONB,
    "logsJson"           JSONB NOT NULL DEFAULT '[]',
    "creadoEn"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrafficOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ConnectorConfig
CREATE TABLE "tenant_template"."ConnectorConfig" (
    "id"              TEXT NOT NULL,
    "tipo"            TEXT NOT NULL,
    "credencialesEnc" TEXT NOT NULL,
    "activo"          BOOLEAN NOT NULL DEFAULT false,
    "config"          JSONB NOT NULL DEFAULT '{}',
    "creadoEn"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConnectorConfig_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE UNIQUE INDEX "Campana_folio_key"      ON "tenant_template"."Campana"("folio");
CREATE UNIQUE INDEX "Campana_portalToken_key" ON "tenant_template"."Campana"("portalToken");
CREATE UNIQUE INDEX "TrafficOrder_folio_key"  ON "tenant_template"."TrafficOrder"("folio");
CREATE UNIQUE INDEX "ConnectorConfig_tipo_key" ON "tenant_template"."ConnectorConfig"("tipo");

-- Foreign keys
ALTER TABLE "tenant_template"."Campana"
    ADD CONSTRAINT "Campana_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "tenant_template"."Cliente"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_template"."CampaignLine"
    ADD CONSTRAINT "CampaignLine_campanaId_fkey"
    FOREIGN KEY ("campanaId") REFERENCES "tenant_template"."Campana"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_template"."Creatividad"
    ADD CONSTRAINT "Creatividad_campanaId_fkey"
    FOREIGN KEY ("campanaId") REFERENCES "tenant_template"."Campana"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_template"."TrafficOrder"
    ADD CONSTRAINT "TrafficOrder_campanaId_fkey"
    FOREIGN KEY ("campanaId") REFERENCES "tenant_template"."Campana"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
