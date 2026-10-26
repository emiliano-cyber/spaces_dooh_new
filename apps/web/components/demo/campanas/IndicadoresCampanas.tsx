'use client'

import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { formatMonto, type CampanaResumen } from '@/lib/data/client'
import { conteo } from '@/lib/plural'
import { formatNumero } from '@/lib/formato-numero'

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
        label="Activas"
        value={formatNumero(activas.length)}
        sub={`${conteo(confirmadas, 'confirmada', 'confirmadas')} por arrancar`}
        tono={activas.length > 0 ? 'verde' : 'neutro'}
      />
      <KPICard
        label="Por validar publicación"
        value={formatNumero(porValidar)}
        sub="enviadas al dominio"
        tono={porValidar > 0 ? 'ambar' : 'neutro'}
      />
      <KPICard
        label="Listas para facturar"
        value={formatNumero(listas)}
        sub="candado abierto"
        tono={listas > 0 ? 'verde' : 'neutro'}
      />
      {/* Si ninguna activa tiene presupuesto capturado, una raya con el motivo:
          un $0 afirmaría que se venden gratis. */}
      <KPICard
        label="Contratado vigente"
        value={conPresupuesto.length === 0 ? '—' : formatMonto(contratado)}
        sub={
          activas.length === 0
            ? 'sin campañas activas'
            : sinPresupuesto > 0
              ? `${conteo(sinPresupuesto, 'activa', 'activas')} sin presupuesto capturado`
              : 'de las campañas activas'
        }
      />
    </div>
  )
}
