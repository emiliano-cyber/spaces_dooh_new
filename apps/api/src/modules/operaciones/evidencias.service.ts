import type { PrismaClient } from '@prisma/client'
import { buildKey, getPresignedUpload, deleteObject } from '../../db/storage'
import { logAudit } from '../../core/audit/audit.service'

function isAdminUser(user: { rol: string; permisos: string[] }): boolean {
  return user.rol === 'owner' || user.rol === 'admin'
    || user.permisos.includes('*') || user.permisos.includes('ots:assign')
}

export async function addEvidencia(
  prisma: PrismaClient,
  otId: string,
  data: {
    fotoUrl: string
    storageKey: string
    tipo?: string
    lat?: number
    lng?: number
    precision?: number
    tamanoMb?: number
    formato?: string
    deviceInfo?: string
    capturadaEn?: Date | string | null
  },
  user: { id: string; rol: string; permisos: string[] },
) {
  const ot = await (prisma as any).ordenTrabajo.findUniqueOrThrow({ where: { id: otId } })

  if (ot.estatus === 'CANCELADA') {
    throw Object.assign(
      new Error('No se puede agregar evidencia a una OT cancelada'),
      { statusCode: 400 },
    )
  }
  if (['COMPLETADA', 'EN_REVISION'].includes(ot.estatus) && !isAdminUser(user)) {
    throw Object.assign(
      new Error(`No se puede agregar evidencia a una OT en estatus ${ot.estatus}`),
      { statusCode: 400 },
    )
  }

  const evidencia = await (prisma as any).evidenciaOT.create({
    data: {
      otId,
      fotoUrl: data.fotoUrl,
      storageKey: data.storageKey,
      tipo: data.tipo ?? 'INSTALACION',
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      precision: data.precision ?? null,
      tamanoMb: data.tamanoMb ?? null,
      formato: data.formato ?? 'image/jpeg',
      deviceInfo: data.deviceInfo ?? null,
      capturadaEn: data.capturadaEn ? new Date(data.capturadaEn) : null,
      uploadedBy: user.id,
    },
  })

  // Advance to EN_PROCESO on first evidencia (from PENDIENTE or ASIGNADA)
  if (ot.estatus === 'PENDIENTE' || ot.estatus === 'ASIGNADA') {
    await (prisma as any).ordenTrabajo.update({
      where: { id: otId },
      data: {
        estatus: 'EN_PROCESO',
        fechaInicio: ot.fechaInicio ?? new Date(),
      },
    })
  }

  return evidencia
}

export async function deleteEvidencia(
  prisma: PrismaClient,
  otId: string,
  evidenciaId: string,
  userId: string,
) {
  const evidencia = await (prisma as any).evidenciaOT.findUnique({ where: { id: evidenciaId } })
  if (!evidencia || evidencia.otId !== otId) {
    throw Object.assign(new Error('Evidencia no encontrada'), { statusCode: 404 })
  }

  await (prisma as any).evidenciaOT.delete({ where: { id: evidenciaId } })

  // Best-effort: try to remove from object storage too. No-op si falla (ya borrada de BD).
  if (evidencia.storageKey) {
    try {
      await deleteObject(evidencia.storageKey)
    } catch (err) {
      console.warn(`[evidencias] no se pudo borrar de Spaces ${evidencia.storageKey}:`, (err as Error).message)
    }
  }

  await logAudit(prisma, {
    userId,
    accion: 'evidencia.eliminada',
    entidadTipo: 'EvidenciaOT',
    entidadId: evidenciaId,
    cambiosJson: { otId, storageKey: evidencia.storageKey, tipo: evidencia.tipo, timestamp: evidencia.timestamp },
  })

  return { ok: true }
}

export async function getPresignedUploadUrl(
  tenantId: string,
  otId: string,
  filename: string,
  contentType: string,
) {
  const key = buildKey(tenantId, 'ots', otId, filename)
  const uploadUrl = await getPresignedUpload(key, contentType)
  return { uploadUrl, key }
}
