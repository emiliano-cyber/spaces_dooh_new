import type { PrismaClient } from '@prisma/client'
import { logAudit } from '../../core/audit/audit.service'
import { eventBus } from '../../core/events/event-bus'
import type { CreateIncidenciaInput } from './inmuebles.schemas'

export async function create(
  prisma: PrismaClient,
  sitioId: string,
  data: CreateIncidenciaInput,
  userId: string,
) {
  const incidencia = await (prisma as any).incidencia.create({
    data: {
      sitioId,
      tipo: data.tipo,
      descripcion: data.descripcion,
      impactaComercial: data.impactaComercial,
      fechaInicio: data.fechaInicio,
      notas: data.notas,
      reportadoPorUserId: userId,
    },
    include: { sitio: true },
  })

  if (data.impactaComercial) {
    eventBus.emit({
      type: 'sitio.incidencia.created',
      payload: {
        sitioId,
        tenantId: incidencia.sitio.tenantId ?? sitioId,
        tipo: data.tipo,
        impactaComercial: data.impactaComercial,
        descripcion: data.descripcion,
      },
    })
  }

  if (data.tipo === 'MANTENIMIENTO') {
    await (prisma as any).sitio.update({
      where: { id: sitioId },
      data: { estatusOperativo: 'EN_MANTENIMIENTO' },
    })
  }

  await logAudit(prisma, {
    userId,
    accion: 'incidencia.created',
    entidadTipo: 'Incidencia',
    entidadId: incidencia.id,
    cambiosJson: { sitioId, tipo: data.tipo, impactaComercial: data.impactaComercial },
  })

  return incidencia
}

export async function resolve(
  prisma: PrismaClient,
  incidenciaId: string,
  data: { notas?: string; fechaResolucion?: Date },
  userId: string,
) {
  const incidencia = await (prisma as any).incidencia.update({
    where: { id: incidenciaId },
    data: {
      estatus: 'RESUELTA',
      fechaResolucion: data.fechaResolucion ?? new Date(),
      ...(data.notas !== undefined && { notas: data.notas }),
    },
  })

  await logAudit(prisma, {
    userId,
    accion: 'incidencia.resolved',
    entidadTipo: 'Incidencia',
    entidadId: incidenciaId,
    cambiosJson: { estatus: 'RESUELTA', fechaResolucion: incidencia.fechaResolucion },
  })

  return incidencia
}
