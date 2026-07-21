import type { Job } from 'bullmq'
import { getPrismaForTenant, publicPrisma } from '../db/client'
import * as readinessService from '../modules/comercial/readiness.service'

interface JobData {
  campanaId: string
  tenantId: string
}

/**
 * BullMQ processor that re-evaluates readiness for a single campaign.
 * Triggered by the 'readiness-check' queue whenever an OT is completed,
 * a document is uploaded, or a TrafficOrder reaches FINALIZADA.
 */
export async function readinessCheckProcessor(job: Job<JobData>): Promise<void> {
  const { campanaId, tenantId } = job.data
  console.log(`[readiness-job] Checking campana ${campanaId} (tenant ${tenantId})`)

  const tenant = await publicPrisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) {
    console.warn(`[readiness-job] Tenant ${tenantId} not found — skipping`)
    return
  }

  const prisma = getPrismaForTenant(tenant.dbSchema)
  const result = await readinessService.check(prisma, campanaId, tenantId, 'system')

  console.log(
    `[readiness-job] campana ${campanaId}: listaParaFacturar=${result.listaParaFacturar}`,
  )
}
