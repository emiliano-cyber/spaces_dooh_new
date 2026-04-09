import type { PrismaClient } from '@prisma/client'
import { buildKey, getPresignedUpload } from '../../db/storage'

export async function addEvidencia(
  prisma: PrismaClient,
  otId: string,
  data: { fotoUrl: string; storageKey: string; lat?: number; lng?: number; tipo?: string },
  userId: string,
) {
  const ot = await (prisma as any).ordenTrabajo.findUniqueOrThrow({ where: { id: otId } })

  if (ot.estatus === 'COMPLETADA' || ot.estatus === 'CANCELADA') {
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
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      tipo: data.tipo ?? 'FOTO',
      uploadedBy: userId,
    },
  })

  // Advance OT from PENDIENTE → EN_PROCESO on first evidencia
  if (ot.estatus === 'PENDIENTE') {
    await (prisma as any).ordenTrabajo.update({
      where: { id: otId },
      data: { estatus: 'EN_PROCESO' },
    })
  }

  return evidencia
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
