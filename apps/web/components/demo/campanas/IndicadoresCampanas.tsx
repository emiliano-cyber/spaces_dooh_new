'use client'

import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { formatMonto, type CampanaResumen } from '@/lib/data/client'
import { formatNumero } from '@/lib/formato-numero'
import { useTexto } from '@/lib/i18n/contexto'

// ============================================================================
//  Fila de indicadores del listado de Campañas — el lenguaje del Dashboard
//  (`inicio/page.tsx`): cuatro KPICard en `sm:2 / xl:4`.
//
//  Solo PRESENTA lo que la pantalla ya tiene cargado (`useCampanasResumen`
//  y la cola `porValidar`): no hay endpoint nuevo ni regla nueva. Con trece
//  campañas había que recorrerlas todas para saber cuántas estaban al aire o
//  esperando validación; es lo primero que ponen arriba Jobber y Broadsign.
// ============================================================================

export function IndicadoresCampanas({
  campanas,
  porValidar,
}: {
  campanas: CampanaResumen[] | undefined
  porValidar: number
}) {
  const t = useTexto()
  if (!campanas) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICardSkeleton />
        <KPICardSkeleton />
        <KPICardSkeleton />
        <KPICardSkeleton />
      </div>
    )
  }

  const activas = campanas.filter(({ campana }) => campana.estadoComercial === 'ACTIVA')
  const confirmadas = campanas.filter(({ campana }) => campana.estadoComercial === 'CONFIRMADA').length
  // «Lista para facturar» = el candado abierto (la misma `candadoFacturacion`
  // que pinta cada fila). Las completadas o canceladas no cuentan: ya no es
  // trabajo pendiente de nadie.
  const listas = campanas.filter(
    ({ campana, candado }) =>
      candado && campana.estadoComercial !== 'COMPLETADA' && campana.estadoComercial !== 'CANCELADA',
  ).length
  const conPresupuesto = activas.filter(({ campana }) => campana.presupuestoBruto)
  const sinPresupuesto = activas.length - conPresupuesto.length
  const contratado = conPresupuesto.reduce((s, { campana }) => s + (campana.presupuestoBruto ?? 0), 0)

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KPICard
        label={t('campanas.kpi.activas')}
        value={formatNumero(activas.length)}
        sub={t(confirmadas === 1 ? 'campanas.kpi.activas.sub.uno' : 'campanas.kpi.activas.sub.otros', {
          n: formatNumero(confirmadas),
        })}
        tono={activas.length > 0 ? 'verde' : 'neutro'}
      />
      <KPICard
        label={t('campanas.kpi.por-validar')}
        value={formatNumero(porValidar)}
        sub={t('campanas.kpi.por-validar.sub')}
        tono={porValidar > 0 ? 'ambar' : 'neutro'}
      />
      <KPICard
        label={t('campanas.kpi.listas')}
        value={formatNumero(listas)}
        sub={t('campanas.kpi.listas.sub')}
        tono={listas > 0 ? 'verde' : 'neutro'}
      />
      {/* Si ninguna activa tiene presupuesto capturado, una raya con el motivo:
          un $0 afirmaría que se venden gratis. */}
      <KPICard
        label={t('campanas.kpi.contratado')}
        value={conPresupuesto.length === 0 ? '—' : formatMonto(contratado)}
        sub={
          activas.length === 0
            ? t('campanas.kpi.contratado.sin-activas')
            : sinPresupuesto > 0
              ? t(
                  sinPresupuesto === 1
                    ? 'campanas.kpi.contratado.sin-presupuesto.uno'
                    : 'campanas.kpi.contratado.sin-presupuesto.otros',
                  { n: formatNumero(sinPresupuesto) },
                )
              : t('campanas.kpi.contratado.sub')
        }
      />
    </div>
  )
}
