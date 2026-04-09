import type { PrismaClient } from '@prisma/client'
import { logAudit } from '../../core/audit/audit.service'
import type { CreateContratoInput } from './inmuebles.schemas'

export async function listBySitio(prisma: PrismaClient, sitioId: string) {
  return (prisma as any).contratoArrendamiento.findMany({
    where: { sitioId },
    include: { arrendador: true },
    orderBy: { fechaInicio: 'desc' },
  })
}

export async function create(
  prisma: PrismaClient,
  sitioId: string,
  data: CreateContratoInput,
  userId: string,
) {
  const contrato = await (prisma as any).contratoArrendamiento.create({
    data: {
      sitioId,
      arrendadorId: data.arrendadorId,
      fechaInicio: data.fechaInicio,
      fechaFin: data.fechaFin,
      montoRenta: data.montoRenta,
      periodicidad: data.periodicidad,
      moneda: data.moneda,
      autoRenovable: data.autoRenovable,
      clausulasJson: data.clausulasJson ?? {},
      documentoUrl: data.documentoUrl,
    },
    include: { arrendador: true, sitio: true },
  })

  await logAudit(prisma, {
    userId,
    accion: 'contrato.created',
    entidadTipo: 'ContratoArrendamiento',
    entidadId: contrato.id,
    cambiosJson: { sitioId, arrendadorId: data.arrendadorId },
  })

  return contrato
}

export async function getVencimientosProximos(prisma: PrismaClient, diasUmbral = 30) {
  const ahora = new Date()
  const limite = new Date(ahora.getTime() + diasUmbral * 24 * 60 * 60 * 1000)

  const contratos = await (prisma as any).contratoArrendamiento.findMany({
    where: {
      estatus: 'VIGENTE',
      fechaFin: { lte: limite },
    },
    include: { sitio: true, arrendador: true },
    orderBy: { fechaFin: 'asc' },
  })

  return contratos.map((c: any) => ({
    ...c,
    diasRestantes: Math.ceil((new Date(c.fechaFin).getTime() - ahora.getTime()) / 86_400_000),
  }))
}
