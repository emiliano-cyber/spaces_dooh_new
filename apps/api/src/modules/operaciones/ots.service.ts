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
  prioridad?: string
  fechaDesde?: string
  fechaHasta?: string
  sitioId?: string
  campanaId?: string
  page?: number
  limit?: number
}

interface RequestUser { id: string; rol: string }

const CAMPO_ROLES = ['field_worker', 'crew_chief']

export async function list(prisma: PrismaClient, filters: ListFilters, requestUser?: RequestUser) {
  const limit = filters.limit ?? 50
  const page = filters.page ?? 1
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}

  // Field workers only see their own OTs
  if (requestUser && CAMPO_ROLES.includes(requestUser.rol)) {
    where.asignadoAUserId = requestUser.id
  } else if (filters.asignadoAUserId) {
    where.asignadoAUserId = filters.asignadoAUserId
  }

  if (filters.estatus) where.estatus = filters.estatus
  if (filters.tipo) where.tipo = filters.tipo
  if (filters.prioridad) where.prioridad = filters.prioridad
  if (filters.sitioId) where.sitioId = filters.sitioId
  if (filters.campanaId) where.campanaId = filters.campanaId
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
      orderBy: [{ prioridad: 'desc' }, { fechaProgramada: 'asc' }],
    }),
  ])

  return { data: items, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
}

export async function getById(prisma: PrismaClient, id: string, requestUser?: RequestUser) {
  const ot = await (prisma as any).ordenTrabajo.findUniqueOrThrow({
    where: { id },
    include: { evidencias: { orderBy: { timestamp: 'asc' } } },
  })

  // Field workers can only view their own OTs
  if (requestUser && CAMPO_ROLES.includes(requestUser.rol) && ot.asignadoAUserId !== requestUser.id) {
    throw Object.assign(new Error('No tienes acceso a esta orden de trabajo'), { statusCode: 403 })
  }

  ot.evidencias = await Promise.all(
    ot.evidencias.map(async (ev: any) => ({
      ...ev,
      fotoUrlSigned: await getPresignedGet(ev.storageKey),
    })),
  )

  if (ot.fechaCompletada && ot.fechaInicio) {
    ot.tiempoTrabajadoMin = Math.round(
      (new Date(ot.fechaCompletada).getTime() - new Date(ot.fechaInicio).getTime()) / 60000,
    )
  } else {
    ot.tiempoTrabajadoMin = null
  }

  return ot
}

export async function create(prisma: PrismaClient, data: CreateOTData, userId: string) {
  const folio = await generateFolio(prisma)

  const checklistJson: ChecklistItem[] = (data.checklist ?? []).map((item, idx) => ({
    id: `item_${idx}`,
    texto: item.texto,
    completado: false,
    completadoEn: null,
    completadoPorUserId: null,
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
      supervisorUserId: data.supervisorUserId ?? null,
      creadoPorUserId: userId,
      fechaProgramada: data.fechaProgramada ? new Date(data.fechaProgramada) : null,
      campanaId: data.campanaId ?? null,
      requiereRevision: data.requiereRevision ?? false,
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

  if (current.estatus === 'COMPLETADA' || current.estatus === 'CANCELADA') {
    throw Object.assign(new Error(`No se puede modificar una OT en estatus ${current.estatus}`), { statusCode: 400 })
  }

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
    if (data.estatus === 'ASIGNADA' || !data.estatus) {
      updateData.estatus = 'ASIGNADA'
    }
    cambios.asignadoAUserId = { antes: current.asignadoAUserId, despues: data.asignadoAUserId }
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
  userId: string,
) {
  const ot = await (prisma as any).ordenTrabajo.findUniqueOrThrow({ where: { id: otId } })

  if (['EN_REVISION', 'COMPLETADA', 'CANCELADA'].includes(ot.estatus)) {
    throw Object.assign(new Error('No se puede modificar el checklist en este estatus'), { statusCode: 400 })
  }

  const checklist = ot.checklistJson as ChecklistItem[]
  const item = checklist.find((i) => i.id === itemId)
  if (!item) {
    throw Object.assign(new Error(`Checklist item '${itemId}' not found`), { statusCode: 404 })
  }

  item.completado = completado
  item.completadoEn = completado ? new Date().toISOString() : undefined
  item.completadoPorUserId = completado ? userId : undefined

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

  if (!['EN_PROCESO', 'RECHAZADA'].includes(ot.estatus)) {
    throw Object.assign(
      new Error(`No se puede completar una OT en estatus ${ot.estatus}`),
      { statusCode: 400 },
    )
  }

  if (ot._count.evidencias === 0) {
    throw Object.assign(
      new Error('Se requiere al menos una fotografía para completar la orden'),
      { statusCode: 400 },
    )
  }

  const nuevoEstatus = ot.requiereRevision ? 'EN_REVISION' : 'COMPLETADA'

  const updated = await (prisma as any).ordenTrabajo.update({
    where: { id: otId },
    data: {
      estatus: nuevoEstatus,
      fechaCompletada: new Date(),
      notas: data.notas ?? ot.notas,
    },
  })

  await logAudit(prisma, {
    userId,
    accion: 'ot.completada',
    entidadTipo: 'OrdenTrabajo',
    entidadId: otId,
    cambiosJson: { estatus: nuevoEstatus },
  })

  if (nuevoEstatus === 'COMPLETADA') {
    eventBus.emit({
      type: 'ot.completada',
      payload: { otId, tenantId, campanaId: ot.campanaId ?? null },
    })
  }

  return updated
}

export async function bloquear(
  prisma: PrismaClient,
  otId: string,
  data: { motivo: string },
  userId: string,
) {
  if (!data.motivo || data.motivo.trim().length < 10) {
    throw Object.assign(new Error('El motivo debe tener al menos 10 caracteres'), { statusCode: 400 })
  }

  const ot = await (prisma as any).ordenTrabajo.findUniqueOrThrow({ where: { id: otId } })

  if (['COMPLETADA', 'CANCELADA', 'BLOQUEADA'].includes(ot.estatus)) {
    throw Object.assign(new Error(`No se puede bloquear una OT en estatus ${ot.estatus}`), { statusCode: 400 })
  }

  const updated = await (prisma as any).ordenTrabajo.update({
    where: { id: otId },
    data: {
      estatus: 'BLOQUEADA',
      motivoBloqueo: data.motivo,
      fechaCompletada: new Date(),
    },
  })

  await logAudit(prisma, {
    userId,
    accion: 'ot.bloqueada',
    entidadTipo: 'OrdenTrabajo',
    entidadId: otId,
    cambiosJson: { motivo: data.motivo },
  })

  return updated
}

export async function aprobar(
  prisma: PrismaClient,
  otId: string,
  data: { notas?: string },
  userId: string,
  tenantId: string,
) {
  const ot = await (prisma as any).ordenTrabajo.findUniqueOrThrow({ where: { id: otId } })

  if (ot.estatus !== 'EN_REVISION') {
    throw Object.assign(new Error('Solo se pueden aprobar OTs en estatus EN_REVISION'), { statusCode: 400 })
  }

  const updated = await (prisma as any).ordenTrabajo.update({
    where: { id: otId },
    data: {
      estatus: 'COMPLETADA',
      revisadoPorUserId: userId,
      revisadoEn: new Date(),
      revisionNotas: data.notas ?? null,
    },
  })

  await logAudit(prisma, {
    userId,
    accion: 'ot.aprobada',
    entidadTipo: 'OrdenTrabajo',
    entidadId: otId,
    cambiosJson: { notas: data.notas },
  })

  eventBus.emit({
    type: 'ot.completada',
    payload: { otId, tenantId, campanaId: ot.campanaId ?? null },
  })

  return updated
}

export async function rechazar(
  prisma: PrismaClient,
  otId: string,
  data: { motivo: string },
  userId: string,
) {
  if (!data.motivo || data.motivo.trim().length < 10) {
    throw Object.assign(new Error('El motivo de rechazo debe tener al menos 10 caracteres'), { statusCode: 400 })
  }

  const ot = await (prisma as any).ordenTrabajo.findUniqueOrThrow({ where: { id: otId } })

  if (ot.estatus !== 'EN_REVISION') {
    throw Object.assign(new Error('Solo se pueden rechazar OTs en estatus EN_REVISION'), { statusCode: 400 })
  }

  const updated = await (prisma as any).ordenTrabajo.update({
    where: { id: otId },
    data: {
      estatus: 'RECHAZADA',
      revisadoPorUserId: userId,
      revisadoEn: new Date(),
      revisionNotas: data.motivo,
    },
  })

  await logAudit(prisma, {
    userId,
    accion: 'ot.rechazada',
    entidadTipo: 'OrdenTrabajo',
    entidadId: otId,
    cambiosJson: { motivo: data.motivo },
  })

  return updated
}

export async function reabrir(
  prisma: PrismaClient,
  otId: string,
  data: { instrucciones?: string },
  userId: string,
) {
  const ot = await (prisma as any).ordenTrabajo.findUniqueOrThrow({ where: { id: otId } })

  if (!['BLOQUEADA', 'RECHAZADA'].includes(ot.estatus)) {
    throw Object.assign(new Error('Solo se pueden reabrir OTs BLOQUEADAS o RECHAZADAS'), { statusCode: 400 })
  }

  const updateData: Record<string, unknown> = {
    estatus: 'EN_PROCESO',
    fechaCompletada: null,
    revisadoPorUserId: null,
    revisadoEn: null,
    revisionNotas: null,
    motivoBloqueo: null,
  }
  if (data.instrucciones) {
    updateData.instrucciones = data.instrucciones
  }

  const updated = await (prisma as any).ordenTrabajo.update({
    where: { id: otId },
    data: updateData,
  })

  await logAudit(prisma, {
    userId,
    accion: 'ot.reabierta',
    entidadTipo: 'OrdenTrabajo',
    entidadId: otId,
    cambiosJson: { instrucciones: data.instrucciones },
  })

  return updated
}

export async function cancelar(
  prisma: PrismaClient,
  otId: string,
  data: { motivo: string },
  userId: string,
) {
  if (!data.motivo || data.motivo.trim().length < 5) {
    throw Object.assign(new Error('Se requiere un motivo de cancelación'), { statusCode: 400 })
  }

  const ot = await (prisma as any).ordenTrabajo.findUniqueOrThrow({ where: { id: otId } })

  if (ot.estatus === 'COMPLETADA') {
    throw Object.assign(new Error('No se puede cancelar una OT ya completada'), { statusCode: 400 })
  }

  const updated = await (prisma as any).ordenTrabajo.update({
    where: { id: otId },
    data: {
      estatus: 'CANCELADA',
      motivoCancelacion: data.motivo,
    },
  })

  await logAudit(prisma, {
    userId,
    accion: 'ot.cancelada',
    entidadTipo: 'OrdenTrabajo',
    entidadId: otId,
    cambiosJson: { motivo: data.motivo },
  })

  return updated
}

export async function getCalendario(
  prisma: PrismaClient,
  filters: { desde: string; hasta: string; userId?: string },
  requestUser?: RequestUser,
) {
  const where: Record<string, unknown> = {
    fechaProgramada: {
      gte: new Date(filters.desde),
      lte: new Date(filters.hasta),
    },
  }

  if (requestUser && CAMPO_ROLES.includes(requestUser.rol)) {
    where.asignadoAUserId = requestUser.id
  } else if (filters.userId) {
    where.asignadoAUserId = filters.userId
  }

  const ots = await (prisma as any).ordenTrabajo.findMany({
    where,
    orderBy: { fechaProgramada: 'asc' },
    select: {
      id: true, folio: true, tipo: true, prioridad: true, estatus: true,
      asignadoAUserId: true, fechaProgramada: true, descripcion: true,
    },
  })

  const grouped: Record<string, unknown[]> = {}
  for (const ot of ots) {
    const dateKey = (ot.fechaProgramada as Date).toISOString().split('T')[0]
    if (!grouped[dateKey]) grouped[dateKey] = []
    grouped[dateKey].push(ot)
  }

  return grouped
}
