'use client'

import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { formatMonto } from '@/lib/data/derive'
import { formatNumero } from '@/lib/formato-numero'
import { conteo } from '@/lib/plural'
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
  if (errorCarga) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard label="Recibos capturados" value="—" sub="no se pudo cargar" />
        <KPICard label="Faltan" value="—" sub="no se pudo cargar" />
        <KPICard label="Importe del periodo" value="—" sub="no se pudo cargar" />
        <KPICard label="kWh del periodo" value="—" sub="no se pudo cargar" />
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
        label="Recibos capturados"
        value={`${formatNumero(capturados)} de ${formatNumero(tablero.esperados)}`}
        sub="del periodo"
      />
      <KPICard
        label="Faltan"
        value={formatNumero(tablero.faltantes)}
        sub={tablero.faltantes > 0 ? 'el reporte enseña menos luz de la real' : 'captura completa'}
        tono={tablero.esperados === 0 ? 'neutro' : tablero.faltantes > 0 ? 'ambar' : 'verde'}
      />
      <KPICard
        label="Importe del periodo"
        value={recibos.length === 0 ? '—' : formatMonto(importe)}
        sub={
          huerfanos > 0
            ? `solo lo capturado · ${conteo(huerfanos, 'recibo', 'recibos')} sin pantalla`
            : 'solo lo capturado'
        }
      />
      <KPICard
        label="kWh del periodo"
        value={recibos.length === 0 ? '—' : formatNumero(kwh)}
        sub="solo lo capturado"
      />
    </div>
  )
}
