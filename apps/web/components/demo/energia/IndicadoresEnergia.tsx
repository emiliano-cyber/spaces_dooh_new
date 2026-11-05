'use client'

import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { formatMonto } from '@/lib/data/derive'
import { formatNumero } from '@/lib/formato-numero'
import { useIdioma } from '@/lib/i18n/contexto'
import type { TableroUI } from './captura'

// ============================================================================
//  Fila de indicadores de Consumo de luz — el lenguaje del Dashboard.
//
//  La cobertura («faltan 7 de 24») era un párrafo largo en ámbar, y el total de
//  kWh y el importe del periodo no se decían en ninguna parte aunque `tablero`
//  ya los trae en sus celdas. Aquí solo se SUMAN y se pintan: qué es un hueco y
//  cuántos faltan lo sigue decidiendo el servidor (`esperados`, `faltantes`) y
//  `captura.ts`. Los textos largos de `resumenDeCobertura` no se van: se quedan
//  sobre la rejilla, porque explican el porqué.
//
//  Con error de carga, una raya: un cero afirmaría que no se gastó luz.
// ============================================================================

export function IndicadoresEnergia({
  tablero,
  cargando,
  errorCarga,
}: {
  tablero: TableroUI | null
  cargando: boolean
  errorCarga: string | null
}) {
  const { t, idioma } = useIdioma()
  if (errorCarga) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard label={t('energia.kpi.capturados')} value="—" sub={t('energia.kpi.no-cargar')} />
        <KPICard label={t('energia.kpi.faltan')} value="—" sub={t('energia.kpi.no-cargar')} />
        <KPICard label={t('energia.kpi.importe')} value="—" sub={t('energia.kpi.no-cargar')} />
        <KPICard label={t('energia.kpi.kwh')} value="—" sub={t('energia.kpi.no-cargar')} />
      </div>
    )
  }
  if (cargando || !tablero) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICardSkeleton />
        <KPICardSkeleton />
        <KPICardSkeleton />
        <KPICardSkeleton />
      </div>
    )
  }

  const recibos = tablero.celdas.flatMap((c) => c.recibos)
  const importe = recibos.reduce((s, r) => s + (Number(r.importe) || 0), 0)
  const kwh = recibos.reduce((s, r) => s + (Number(r.kwh) || 0), 0)
  const capturados = tablero.esperados - tablero.faltantes
  const huerfanos = tablero.huerfanos.length

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KPICard
        label={t('energia.kpi.capturados')}
        value={t('energia.kpi.de', { a: formatNumero(capturados, 0, idioma), b: formatNumero(tablero.esperados, 0, idioma) })}
        sub={t('energia.kpi.del-periodo')}
      />
      <KPICard
        label={t('energia.kpi.faltan')}
        value={formatNumero(tablero.faltantes, 0, idioma)}
        sub={tablero.faltantes > 0 ? t('energia.kpi.menos-luz') : t('energia.kpi.completa')}
        tono={tablero.esperados === 0 ? 'neutro' : tablero.faltantes > 0 ? 'ambar' : 'verde'}
      />
      <KPICard
        label={t('energia.kpi.importe')}
        value={recibos.length === 0 ? '—' : formatMonto(importe, idioma)}
        sub={
          huerfanos > 0
            ? t(huerfanos === 1 ? 'energia.kpi.sin-pantalla.uno' : 'energia.kpi.sin-pantalla.otros', { n: formatNumero(huerfanos, 0, idioma) })
            : t('energia.kpi.solo-capturado')
        }
      />
      <KPICard
        label={t('energia.kpi.kwh')}
        value={recibos.length === 0 ? '—' : formatNumero(kwh, 0, idioma)}
        sub={t('energia.kpi.solo-capturado')}
      />
    </div>
  )
}
