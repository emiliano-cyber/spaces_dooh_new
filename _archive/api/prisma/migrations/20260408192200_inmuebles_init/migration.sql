-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "tenant_template";

-- CreateEnum
CREATE TYPE "tenant_template"."TipoMedio" AS ENUM ('ESPECTACULAR', 'PANTALLA_DIGITAL', 'PUENTE_PEATONAL', 'MOBILIARIO_URBANO', 'MURAL', 'VALLA', 'OTRO');

-- CreateEnum
CREATE TYPE "tenant_template"."EstComercial" AS ENUM ('DISPONIBLE', 'RESERVADO', 'OCUPADO', 'BLOQUEADO', 'EN_MANTENIMIENTO', 'BAJA');

-- CreateEnum
CREATE TYPE "tenant_template"."EstLegal" AS ENUM ('EN_ORDEN', 'PERMISO_VENCIDO', 'EN_TRAMITE', 'SUSPENDIDO', 'SIN_PERMISO');

-- CreateEnum
CREATE TYPE "tenant_template"."EstOperativo" AS ENUM ('ACTIVO', 'EN_MANTENIMIENTO', 'APAGADO', 'DAÑADO', 'BAJA');

-- CreateEnum
CREATE TYPE "tenant_template"."EstContrato" AS ENUM ('VIGENTE', 'POR_VENCER', 'VENCIDO', 'RENOVADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "tenant_template"."TipoIncidencia" AS ENUM ('CLIMA', 'MANTENIMIENTO', 'LEGAL', 'VANDALISMO', 'SUSPENSION_OPERATIVA', 'ACCIDENTE', 'OTRO');

-- CreateEnum
CREATE TYPE "tenant_template"."EstIncidencia" AS ENUM ('ABIERTA', 'EN_PROCESO', 'RESUELTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "tenant_template"."Prioridad" AS ENUM ('BAJA', 'NORMAL', 'ALTA', 'URGENTE');

-- CreateTable
CREATE TABLE "tenant_template"."Sitio" (
    "id" TEXT NOT NULL,
    "claveInterna" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoMedio" "tenant_template"."TipoMedio" NOT NULL,
    "lat" DECIMAL(10,8) NOT NULL,
    "lng" DECIMAL(11,8) NOT NULL,
    "direccion" TEXT NOT NULL,
    "alcaldia" TEXT,
    "ciudad" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "pais" TEXT NOT NULL DEFAULT 'MX',
    "alto" DECIMAL(6,2),
    "ancho" DECIMAL(6,2),
    "iluminado" BOOLEAN NOT NULL DEFAULT false,
    "orientacion" TEXT,
    "fotosJson" JSONB NOT NULL DEFAULT '[]',
    "estatusComercial" "tenant_template"."EstComercial" NOT NULL DEFAULT 'DISPONIBLE',
    "estatusLegal" "tenant_template"."EstLegal" NOT NULL DEFAULT 'EN_ORDEN',
    "estatusOperativo" "tenant_template"."EstOperativo" NOT NULL DEFAULT 'ACTIVO',
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sitio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."Arrendador" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rfc" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Arrendador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."ContratoArrendamiento" (
    "id" TEXT NOT NULL,
    "sitioId" TEXT NOT NULL,
    "arrendadorId" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "montoRenta" DECIMAL(12,2) NOT NULL,
    "periodicidad" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'MXN',
    "autoRenovable" BOOLEAN NOT NULL DEFAULT false,
    "clausulasJson" JSONB NOT NULL DEFAULT '{}',
    "documentoUrl" TEXT,
    "estatus" "tenant_template"."EstContrato" NOT NULL DEFAULT 'VIGENTE',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContratoArrendamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."LicenciaPermiso" (
    "id" TEXT NOT NULL,
    "sitioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "folio" TEXT,
    "autoridad" TEXT,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "documentoUrl" TEXT,
    "estatus" TEXT NOT NULL DEFAULT 'VIGENTE',
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenciaPermiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."Incidencia" (
    "id" TEXT NOT NULL,
    "sitioId" TEXT NOT NULL,
    "tipo" "tenant_template"."TipoIncidencia" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaResolucion" TIMESTAMP(3),
    "impactaComercial" BOOLEAN NOT NULL DEFAULT true,
    "estatus" "tenant_template"."EstIncidencia" NOT NULL DEFAULT 'ABIERTA',
    "fotosJson" JSONB NOT NULL DEFAULT '[]',
    "reportadoPorUserId" TEXT NOT NULL,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Incidencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."PagoRenta" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "fechaPago" TIMESTAMP(3),
    "facturaUrl" TEXT,
    "estatus" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoRenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "cambiosJson" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sitio_claveInterna_key" ON "tenant_template"."Sitio"("claveInterna");

-- CreateIndex
CREATE INDEX "AuditLog_entidadTipo_entidadId_idx" ON "tenant_template"."AuditLog"("entidadTipo", "entidadId");

-- AddForeignKey
ALTER TABLE "tenant_template"."ContratoArrendamiento" ADD CONSTRAINT "ContratoArrendamiento_sitioId_fkey" FOREIGN KEY ("sitioId") REFERENCES "tenant_template"."Sitio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."ContratoArrendamiento" ADD CONSTRAINT "ContratoArrendamiento_arrendadorId_fkey" FOREIGN KEY ("arrendadorId") REFERENCES "tenant_template"."Arrendador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."LicenciaPermiso" ADD CONSTRAINT "LicenciaPermiso_sitioId_fkey" FOREIGN KEY ("sitioId") REFERENCES "tenant_template"."Sitio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."Incidencia" ADD CONSTRAINT "Incidencia_sitioId_fkey" FOREIGN KEY ("sitioId") REFERENCES "tenant_template"."Sitio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."PagoRenta" ADD CONSTRAINT "PagoRenta_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "tenant_template"."ContratoArrendamiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
