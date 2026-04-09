import type { PrismaClient } from '@prisma/client'
import { logAudit } from '../../core/audit/audit.service'
import { eventBus } from '../../core/events/event-bus'
import * as readinessService from './readiness.service'

export async function generateTrafficFolio(prisma: PrismaClient): Promise<string> {
  const count = await (prisma as any).trafficOrder.count()
  const year = new Date().getFullYear()
  const seq = String(count + 1).padStart(4, '0')
  return `TO-${year}-${seq}`
}

interface ListFilters {
  campanaId?: string
  estadoTecnico?: string
}

export async function list(prisma: PrismaClient, filters: ListFilters) {
  const where: Record<string, unknown> = {}
  if (filters.campanaId) where['campanaId'] = filters.campanaId
  if (filters.estadoTecnico) where['estadoTecnico'] = filters.estadoTecnico

  return (prisma as any).trafficOrder.findMany({
    where,
    include: {
      campana: { select: { folio: true, nombre: true } },
    },
    orderBy: { creadoEn: 'desc' },
  })
}

export async function getById(prisma: PrismaClient, id: string) {
  return (prisma as any).trafficOrder.findUnique({
    where: { id },
    include: {
      campana: { select: { folio: true, nombre: true, tipoCampana: true } },
    },
  })
}

export async function updateEstado(
  prisma: PrismaClient,
  toId: string,
  estadoTecnico: string,
  nota: string,
  userId: string,
  tenantId: string,
) {
  const to = await (prisma as any).trafficOrder.findUniqueOrThrow({ where: { id: toId } })

  const logEntry = {
    timestamp: new Date().toISOString(),
    estadoTecnico,
    nota,
    userId,
  }

  const logsJson = Array.isArray(to.logsJson) ? to.logsJson : []

  const updated = await (prisma as any).trafficOrder.update({
    where: { id: toId },
    data: {
      estadoTecnico,
      logsJson: [...logsJson, logEntry],
    },
  })

  eventBus.emit({
    type: 'traffic.estado.changed',
    payload: { trafficOrderId: toId, tenantId, estado: estadoTecnico },
  })

  await logAudit(prisma, {
    userId,
    accion: 'traffic.estado.changed',
    entidadTipo: 'TrafficOrder',
    entidadId: toId,
    cambiosJson: { estadoTecnico, nota },
  })

  if (estadoTecnico === 'FINALIZADA') {
    await readinessService.check(prisma, to.campanaId, tenantId, userId)
  }

  return updated
}

export async function attachDelivery(
  prisma: PrismaClient,
  toId: string,
  data: { storageKey: string; url: string },
  userId: string,
) {
  const updated = await (prisma as any).trafficOrder.update({
    where: { id: toId },
    data: {
      deliveryReportUrl: data.url,
      deliveryStorageKey: data.storageKey,
    },
  })

  await logAudit(prisma, {
    userId,
    accion: 'traffic.delivery.attached',
    entidadTipo: 'TrafficOrder',
    entidadId: toId,
    cambiosJson: { storageKey: data.storageKey, url: data.url },
  })

  return updated
}
