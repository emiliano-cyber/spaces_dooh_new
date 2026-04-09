-- CreateEnum
CREATE TYPE "tenant_template"."TipoOT" AS ENUM ('MONTAJE_LONA', 'MONTAJE_DIGITAL', 'DESMONTAJE', 'MANTENIMIENTO_PREVENTIVO', 'MANTENIMIENTO_CORRECTIVO', 'HERRERIA', 'ELECTRICO', 'INSPECCION', 'OTRO');

-- CreateEnum
CREATE TYPE "tenant_template"."EstOT" AS ENUM ('PENDIENTE', 'ASIGNADA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "tenant_template"."OrdenTrabajo" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "tipo" "tenant_template"."TipoOT" NOT NULL,
    "sitioId" TEXT,
    "descripcion" TEXT NOT NULL,
    "instrucciones" TEXT,
    "checklistJson" JSONB NOT NULL DEFAULT '[]',
    "prioridad" "tenant_template"."Prioridad" NOT NULL DEFAULT 'NORMAL',
    "asignadoAUserId" TEXT,
    "fechaProgramada" TIMESTAMP(3),
    "fechaInicio" TIMESTAMP(3),
    "fechaCompletada" TIMESTAMP(3),
    "campanaId" TEXT,
    "estatus" "tenant_template"."EstOT" NOT NULL DEFAULT 'PENDIENTE',
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenTrabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."EvidenciaOT" (
    "id" TEXT NOT NULL,
    "otId" TEXT NOT NULL,
    "fotoUrl" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "lat" DECIMAL(10,8),
    "lng" DECIMAL(11,8),
    "tipo" TEXT NOT NULL DEFAULT 'FOTO',
    "uploadedBy" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenciaOT_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrdenTrabajo_folio_key" ON "tenant_template"."OrdenTrabajo"("folio");

-- AddForeignKey
ALTER TABLE "tenant_template"."EvidenciaOT" ADD CONSTRAINT "EvidenciaOT_otId_fkey" FOREIGN KEY ("otId") REFERENCES "tenant_template"."OrdenTrabajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
