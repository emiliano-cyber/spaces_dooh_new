import type { PrismaClient } from '@prisma/client'
import type { ReadinessStatus } from '@spaces-dooh/types'
import { logAudit } from '../../core/audit/audit.service'
import { eventBus } from '../../core/events/event-bus'

export async function check(
  prisma: PrismaClient,
  campanaId: string,
  tenantId: string,
  userId: string,
): Promise<ReadinessStatus> {
  const campana = await (prisma as any).campana.findUniqueOrThrow({
    where: { id: campanaId },
    include: {
      lines: true,
      creatividades: true,
      trafficOrders: { select: { id: true, estadoTecnico: true } },
    },
  })

  // Count evidencias from completed OTs linked to this campaign
  const otCompletada = await (prisma as any).ordenTrabajo.findFirst({
    where: { campanaId, estatus: 'COMPLETADA' },
    include: { _count: { select: { evidencias: true } } },
  })

  const conteoEvidencias: number = otCompletada
    ? (otCompletada._count?.evidencias ?? 0)
    : 0

  const requiereOT = ['OOH', 'HIBRIDA'].includes(campana.tipoCampana)
  const requiereTraffic = ['DOOH', 'HIBRIDA'].includes(campana.tipoCampana)

  const trafficFinalizada = campana.trafficOrders.find(
    (to: { estadoTecnico: string }) => to.estadoTecnico === 'FINALIZADA',
  )

  const status: ReadinessStatus = {
    listaParaFacturar: false,
    tipoCampana: campana.tipoCampana,
    items: {
      ocRecibida: {
        ok: campana.ocRecibida,
        url: campana.ocUrl ?? undefined,
      },
      fotosComprobatorias: {
        ok: conteoEvidencias >= 1,
        cantidad: conteoEvidencias,
      },
      reportePublicacion: {
        ok: campana.reportePublicacion,
        url: undefined,
      },
      otCompletada: {
        ok: requiereOT ? otCompletada !== null : true,
        otId: otCompletada?.id,
        requerida: requiereOT,
      },
      trafficFinalizado: {
        ok: requiereTraffic ? trafficFinalizada !== undefined : true,
        toId: trafficFinalizada?.id,
        requerido: requiereTraffic,
      },
    },
  }

  status.listaParaFacturar =
    status.items.ocRecibida.ok &&
    status.items.reportePublicacion.ok &&
    (requiereOT
      ? status.items.otCompletada.ok && status.items.fotosComprobatorias.ok
      : true) &&
    (requiereTraffic ? status.items.trafficFinalizado.ok : true)

  // Auto-transition to LISTA_FACTURAR
  if (status.listaParaFacturar && campana.estadoComercial === 'COMPLETADA') {
    await (prisma as any).campana.update({
      where: { id: campanaId },
      data: { estadoComercial: 'LISTA_FACTURAR' },
    })

    eventBus.emit({
      type: 'campana.readiness.changed',
      payload: { campanaId, tenantId, listaParaFacturar: true },
    })

    await logAudit(prisma, {
      userId,
      accion: 'campana.lista_facturar',
      entidadTipo: 'Campana',
      entidadId: campanaId,
      cambiosJson: { estadoComercial: 'LISTA_FACTURAR' },
    })
  }

  return status
}
