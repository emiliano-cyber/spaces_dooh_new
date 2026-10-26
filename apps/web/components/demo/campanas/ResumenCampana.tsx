'use client'

import {
  useCampana,
  useOrdenesTrabajo,
  useEvidencias,
  useMargenCampana,
  useReporteCampana,
  candadoFacturacion,
  otAbierta,
  formatMonto,
} from '@/lib/data/client'
import { formatNumero } from '@/lib/formato-numero'
import { cn } from '@/lib/cn'

// ============================================================================
//  Franja de resumen bajo el encabezado de la campaña — la franja secundaria
//  del Dashboard (`rounded-md border bg-surface-2 px-4 py-2 text-[12px]`).
//
//  Total, margen, % entregado, candado, OT y evidencias vivían cada uno dentro
//  de su sección, y varias nacen plegadas al fondo: para saber cómo iba una
//  campaña había que abrir cuatro tarjetas. Aquí se leen de un vistazo, como el
//  «Campaign Summary» de Broadsign POP.
//
//  NO son KPICard a propósito: cuatro tarjetas grandes empujarían Creativos y
//  la Validación hacia abajo, y el dueño los quiere arriba (22/10 y 23/10).
//
//  Es un componente aparte —y no JSX en `campanas/[id]/page.tsx`— para que la
//  página solo gane UNA línea: otra rama cambia ese archivo y así se juntan sin
//  pelea. Lee del mismo store que la página (los hooks no piden nada nuevo al
//  servidor) y repite sus mismas reglas: `candadoFacturacion` y las OT de la
//  campaña; las evidencias son las de esas OT, como en la sección Evidencias.
// ============================================================================

export function ResumenCampana({ campanaId }: { campanaId: string }) {
  const c = useCampana(campanaId)
  const ots = useOrdenesTrabajo()
  const evidencias = useEvidencias()
  const margen = useMargenCampana(campanaId)
  const reporte = useReporteCampana(campanaId)

  if (!c) return null

  const misOts = (ots ?? []).filter((o) => o.campanaId === campanaId)
  const abiertas = misOts.filter(otAbierta).length
  const misEvid = (evidencias ?? []).filter((e) => misOts.some((o) => o.id === e.otId))
  const tieneFija = c.tipoCampana === 'OOH' || c.tipoCampana === 'HIBRIDA'
  const candado = candadoFacturacion(c)

  return (
    <dl className="m-0 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border border-border bg-surface-2 px-4 py-2 text-[12px]">
      <Par
        etiqueta="Total"
        valor={c.presupuestoBruto ? formatMonto(c.presupuestoBruto) : '—'}
        title={c.presupuestoBruto ? undefined : 'Sin presupuesto capturado en la propuesta'}
      />
      <Par
        etiqueta="Margen"
        valor={margen ? `${margen.margenPct.toFixed(0)}%` : '—'}
        cls={margen ? (margen.margen >= 0 ? 'text-success' : 'text-error') : undefined}
      />
      <Par
        etiqueta="Entregado"
        valor={reporte ? `${reporte.cumplimientoPct.toFixed(0)}%` : '—'}
        cls={reporte ? (reporte.cumplimientoPct >= 100 ? 'text-success' : 'text-warning') : undefined}
      />
      <Par
        etiqueta="Candado"
        valor={candado ? 'Lista para facturar' : 'Pendiente'}
        cls={candado ? 'text-success' : 'text-warning'}
        mono={false}
      />
      <Par
        etiqueta="OT"
        valor={
          misOts.length === 0
            ? '—'
            : `${formatNumero(abiertas)} ${abiertas === 1 ? 'abierta' : 'abiertas'} de ${formatNumero(misOts.length)}`
        }
      />
      {tieneFija && <Par etiqueta="Evidencias" valor={formatNumero(misEvid.length)} />}
    </dl>
  )
}

function Par({
  etiqueta,
  valor,
  cls,
  title,
  mono = true,
}: {
  etiqueta: string
  valor: string
  cls?: string
  title?: string
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline gap-1.5" title={title}>
      <dt className="text-muted">{etiqueta}</dt>
      <dd className={cn('m-0 font-medium', mono && 'demo-num', cls ?? 'text-ink')}>{valor}</dd>
    </div>
  )
}
