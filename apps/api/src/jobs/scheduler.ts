import { alertasQueue } from './queue'
import { publicPrisma } from '../db/client'

export async function scheduleAlertJobs(): Promise<void> {
  const tenants = await publicPrisma.tenant.findMany({ where: { activo: true } })

  for (const tenant of tenants) {
    await alertasQueue.add(
      'check-vencimientos',
      { tenantId: tenant.id, dbSchema: tenant.dbSchema },
      {
        jobId: `alertas-${tenant.id}`,
        repeat: { pattern: '0 8 * * *' },
        removeOnComplete: true,
        removeOnFail: false,
      },
    )
    console.log(`[scheduler] Job programado para tenant "${tenant.nombre}" (${tenant.id})`)
  }

  console.log(`[scheduler] ${tenants.length} job(s) de alertas programados`)
}
