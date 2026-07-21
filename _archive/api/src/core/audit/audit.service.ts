import type { PrismaClient } from '@prisma/client'

interface AuditData {
  userId: string
  accion: string
  entidadTipo: string
  entidadId: string
  cambiosJson?: object
}

export async function logAudit(prisma: PrismaClient, data: AuditData): Promise<void> {
  try {
    await (prisma as any).auditLog.create({
      data: {
        userId: data.userId,
        accion: data.accion,
        entidadTipo: data.entidadTipo,
        entidadId: data.entidadId,
        cambiosJson: data.cambiosJson ?? {},
      },
    })
  } catch (err) {
    console.error('[AuditLog] Error al guardar entrada de auditoría:', err)
  }
}
