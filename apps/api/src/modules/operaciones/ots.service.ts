import type { PrismaClient } from '@prisma/client'
import type { ChecklistItem, CreateOTData } from '@spaces-dooh/types'
import { logAudit } from '../../core/audit/audit.service'
import { eventBus } from '../../core/events/event-bus'
import { getPresignedGet } from '../../db/storage'

export async function generateFolio(prisma: PrismaClient): Promise<string> {
  const count = await (prisma as any).ordenTrabajo.count()
  const year = new Date().getFullYear()
  const seq = String(count + 1).padStart(4, '0')
  return `OT-${year}-${seq}`
}

interface ListFilters {
  asignadoAUserId?: string
  estatus?: string
  tipo?: string
  fechaDesde?: string
  fechaHasta?: string
  sitioId?: string
  page?: number
  limit?: number
}

export async function list(prisma: PrismaClient, filters: ListFilters) {
  const limit = filters.limit ?? 50
  const page = filters.page ?? 1
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (filters.asignadoAUserId) where.asignadoAUserId = filters.asignadoAUserId
  if (filters.estatus) where.estatus = filters.estatus
  if (filters.tipo) where.tipo = filters.tipo
  if (filters.sitioId) where.sitioId = filters.sitioId
  if (filters.fechaDesde || filters.fechaHasta) {
    where.fechaProgramada = {
      ...(filters.fechaDesde && { gte: new Date(filters.fechaDesde) }),
      ...(filters.fechaHasta && { lte: new Date(filters.fechaHasta) }),
    }
  }

  const [total, items] = await Promise.all([
    (prisma as any).ordenTrabajo.count({ where }),
    (prisma as any).ordenTrabajo.findMany({
      where,
      skip,
      take: limit,
      include: { _count: { select: { evidencias: true } } },
      // Prioridad enum order in DB: BAJA(0) NORMAL(1) ALTA(2) URGENTE(3) → desc = URGENTE first
      orderBy: [{ prioridad: 'desc' }, { fechaProgramada: 'asc' }],
    }),
  ])

  return { data: items, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
}

export async function getById(prisma: PrismaClient, id: string) {
  const ot = await (prisma as any).ordenTrabajo.findUniqueOrThrow({
    where: { id },
    include: { evidencias: true },
  })

  ot.evidencias = await Promise.all(
    ot.evidencias.map(async (ev: any) => ({
      ...ev,
      fotoUrlSigned: await getPresignedGet(ev.storageKey),
    })),
  )

  return ot
}

export async function create(prisma: PrismaClient, data: CreateOTData, userId: string) {
  const folio = await generateFolio(prisma)

  const checklistJson: ChecklistItem[] = (data.checklist ?? []).map((item, idx) => ({
    id: `item_${idx}`,
    texto: item.texto,
    completado: false,
  }))

  const estatus = data.asignadoAUserId ? 'ASIGNADA' : 'PENDIENTE'

  const ot = await (prisma as any).ordenTrabajo.create({
    data: {
      folio,
      tipo: data.tipo,
      sitioId: data.sitioId ?? null,
      descripcion: data.descripcion,
      instrucciones: data.instrucciones ?? null,
      checklistJson,
      prioridad: data.prioridad ?? 'NORMAL',
      asignadoAUserId: data.asignadoAUserId ?? null,
      fechaProgramada: data.fechaProgramada ? new Date(data.fechaProgramada) : null,
      campanaId: data.campanaId ?? null,
      estatus,
    },
  })

  await logAudit(prisma, {
    userId,
    accion: 'ot.created',
    entidadTipo: 'OrdenTrabajo',
    entidadId: ot.id,
    cambiosJson: { folio, tipo: data.tipo, estatus },
  })

  return ot
}

export async function update(
  prisma: PrismaClient,
  id: string,
  data: { estatus?: string; asignadoAUserId?: string; prioridad?: string; notas?: string; fechaProgramada?: string },
  userId: string,
) {
  const current = await (prisma as any).ordenTrabajo.findUniqueOrThrow({ where: { id } })

  const updateData: Record<string, unknown> = {}
  const cambios: Record<string, { antes: unknown; despues: unknown }> = {}

  if (data.estatus !== undefined && data.estatus !== current.estatus) {
    updateData.estatus = data.estatus
    cambios.estatus = { antes: current.estatus, despues: data.estatus }
  }
  if (data.prioridad !== undefined && data.prioridad !== current.prioridad) {
    updateData.prioridad = data.prioridad
    cambios.prioridad = { antes: current.prioridad, despues: data.prioridad }
  }
  if (data.notas !== undefined) {
    updateData.notas = data.notas
  }
  if (data.fechaProgramada !== undefined) {
    updateData.fechaProgramada = new Date(data.fechaProgramada)
  }
  if (data.asignadoAUserId !== undefined && data.asignadoAUserId !== current.asignadoAUserId) {
    updateData.asignadoAUserId = data.asignadoAUserId
    cambios.asignadoAUserId = { antes: current.asignadoAUserId, despues: data.asignadoAUserId }
    // Set fechaInicio on first assignment
    if (!current.fechaInicio && data.estatus === 'ASIGNADA') {
      updateData.fechaInicio = new Date()
    }
  }

  const updated = await (prisma as any).ordenTrabajo.update({ where: { id }, data: updateData })

  await logAudit(prisma, {
    userId,
    accion: 'ot.updated',
    entidadTipo: 'OrdenTrabajo',
    entidadId: id,
    cambiosJson: cambios,
  })

  return updated
}

export async function updateChecklist(
  prisma: PrismaClient,
  otId: string,
  itemId: string,
  completado: boolean,
  _userId: string,
) {
  const ot = await (prisma as any).ordenTrabajo.findUniqueOrThrow({ where: { id: otId } })
  const checklist = ot.checklistJson as ChecklistItem[]

  const item = checklist.find((i) => i.id === itemId)
  if (!item) {
    throw Object.assign(new Error(`Checklist item '${itemId}' not found`), { statusCode: 404 })
  }

  item.completado = completado
  item.completadoEn = completado ? new Date().toISOString() : undefined

  return (prisma as any).ordenTrabajo.update({
    where: { id: otId },
    data: { checklistJson: checklist },
  })
}

export async function completar(
  prisma: PrismaClient,
  otId: string,
  data: { notas?: string },
  userId: string,
  tenantId: string,
) {
  const ot = await (prisma as any).ordenTrabajo.findUniqueOrThrow({
    where: { id: otId },
    include: { _count: { select: { evidencias: true } } },
  })

  if (ot.estatus === 'COMPLETADA' || ot.estatus === 'CANCELADA') {
    throw Object.assign(
      new Error(`La OT ya está en estatus ${ot.estatus}`),
      { statusCode: 400 },
    )
  }

  if (ot._count.evidencias === 0) {
    throw Object.assign(
      new Error('Se requiere al menos una fotografía para completar la orden'),
      { statusCode: 400 },
    )
  }

  const updated = await (prisma as any).ordenTrabajo.update({
    where: { id: otId },
    data: { estatus: 'COMPLETADA', fechaCompletada: new Date(), notas: data.notas ?? null },
  })

  await logAudit(prisma, {
    userId,
    accion: 'ot.completada',
    entidadTipo: 'OrdenTrabajo',
    entidadId: otId,
    cambiosJson: { estatus: 'COMPLETADA', fechaCompletada: updated.fechaCompletada },
  })

  eventBus.emit({
    type: 'ot.completada',
    payload: { otId, tenantId, campanaId: ot.campanaId ?? null },
  })

  return updated
}

export async function getCalendario(
  prisma: PrismaClient,
  filters: { desde: string; hasta: string; userId?: string },
) {
  const where: Record<string, unknown> = {
    fechaProgramada: {
      gte: new Date(filters.desde),
      lte: new Date(filters.hasta),
    },
  }
  if (filters.userId) where.asignadoAUserId = filters.userId

  const ots = await (prisma as any).ordenTrabajo.findMany({
    where,
    orderBy: { fechaProgramada: 'asc' },
  })

  const grouped: Record<string, unknown[]> = {}
  for (const ot of ots) {
    const dateKey = (ot.fechaProgramada as Date).toISOString().split('T')[0]
    if (!grouped[dateKey]) grouped[dateKey] = []
    grouped[dateKey].push(ot)
  }

  return grouped
}
