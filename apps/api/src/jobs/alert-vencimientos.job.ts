import type { Job } from 'bullmq'
import { getPrismaForTenant, publicPrisma } from '../db/client'
import { getAlertasVencimiento } from '../modules/inmuebles/alertas.service'
import { sendAlert } from '../core/email/email.service'

interface JobData {
  tenantId: string
  dbSchema: string
}

async function getOwnerEmail(tenantId: string): Promise<string | null> {
  const owner = await publicPrisma.user.findFirst({
    where: { tenantId },
  })
  return owner?.email ?? null
}

export async function alertVencimientosProcessor(job: Job<JobData>): Promise<void> {
  const { tenantId, dbSchema } = job.data
  console.log(`[alertas-job] Procesando tenant ${tenantId} (schema: ${dbSchema})`)

  const prisma = getPrismaForTenant(dbSchema)
  const alertas = await getAlertasVencimiento(prisma, 30)

  const ownerEmail = await getOwnerEmail(tenantId)
  if (!ownerEmail) {
    console.warn(`[alertas-job] No se encontró email para tenant ${tenantId}`)
    return
  }

  let enviados = 0

  for (const contrato of alertas.contratos) {
    if (contrato.nivel !== 'critico') continue
    try {
      await sendAlert({
        to: ownerEmail,
        tipo: 'contrato',
        nombre: contrato.sitio?.nombre ?? contrato.id,
        diasRestantes: contrato.diasRestantes,
        nivel: contrato.nivel,
        extra: { contratoId: contrato.id, arrendador: contrato.arrendador?.nombre },
      })
      enviados++
    } catch (err) {
      console.error(`[alertas-job] Error enviando email contrato ${contrato.id}:`, err)
    }
  }

  for (const licencia of alertas.licencias) {
    if (licencia.nivel !== 'critico') continue
    try {
      await sendAlert({
        to: ownerEmail,
        tipo: 'licencia',
        nombre: licencia.sitio?.nombre ?? licencia.id,
        diasRestantes: licencia.diasRestantes,
        nivel: licencia.nivel,
        extra: { licenciaId: licencia.id, tipo: licencia.tipo },
      })
      enviados++
    } catch (err) {
      console.error(`[alertas-job] Error enviando email licencia ${licencia.id}:`, err)
    }
  }

  console.log(
    `[alertas-job] Tenant ${tenantId}: ${alertas.contratos.length} contratos, ` +
    `${alertas.licencias.length} licencias revisadas, ${enviados} alertas críticas enviadas`,
  )
}
