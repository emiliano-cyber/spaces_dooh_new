'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMonto } from '@/lib/data/derive'
import type { FilaRentabilidad, ReporteRentabilidad } from '@/lib/data/reportes'
import { COLUMNAS, formatoPorcentaje, ordenarFilas, type ColumnaReporte, type Orden } from './tabla'

// ============================================================================
//  La tabla del reporte. Ordena, y nada más.
// ----------------------------------------------------------------------------
//  El ordenamiento vive en `tabla.ts` porque es el único sitio de la pantalla
//  donde se puede MENTIR sin dar error: el `margenPct` en `null` significa «no
//  hubo ingreso», no «0 %», y tratado como cero coloca la pantalla que costó y
//  no vendió entre las que quedaron a la par.
// ============================================================================

function Celda({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-2 py-2 align-middle', className)}>{children}</td>
}

// Rojo si pierde, verde si gana. El color lo pone quien pinta, no el
// formateador (`formatMonto` ya mete los negativos entre paréntesis, que es la
// convención contable: «$ -156,986.66» se lee mal en una columna de cifras).
const tonoMargen = (n: number) => (n < 0 ? 'text-error' : n > 0 ? 'text-success' : 'text-ink')

export function TablaRentabilidad({
  reporte,
  orden,
  onOrdenar,
}: {
  reporte: ReporteRentabilidad
  orden: Orden
  onOrdenar: (columna: ColumnaReporte) => void
}) {
  const filas = ordenarFilas(reporte.filas, orden)
  const t = reporte.totales

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
            {COLUMNAS.map((c) => (
              <th key={c.clave} className={cn('px-2 py-2 font-medium', c.numerica && 'text-right')}>
                <button
                  type="button"
                  onClick={() => onOrdenar(c.clave)}
                  className={cn(
                    'inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink',
                    orden.columna === c.clave && 'text-ink',
                  )}
                >
                  {c.label}
                  {/* La flecha solo en la columna activa: una flecha en cada
                      cabecera no dice por cuál está ordenada la tabla. */}
                  {orden.columna === c.clave ? (
                    orden.direccion === 'asc' ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    )
                  ) : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filas.map((f: FilaRentabilidad) => (
            <tr key={f.clave} className="hover:bg-surface-2">
              <Celda>
                <span className="text-ink">{f.etiqueta}</span>
                {/* El detalle desambigua nombres repetidos, y el arrendador dice
                    a quién se le paga la renta que sale en «costo del espacio».
                    Sin contrato se DICE, en vez de dejar un 0 que parece medido. */}
                <span className="block text-[11px] text-muted">
                  {[f.detalle || null, f.tieneContrato ? f.arrendador : 'sin contrato']
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </Celda>
              <Celda className="demo-num text-right">{formatMonto(f.ingreso)}</Celda>
              <Celda className="demo-num text-right">{formatMonto(f.costoEspacio)}</Celda>
              <Celda className="demo-num text-right">{formatMonto(f.costoOperacion)}</Celda>
              <Celda className="demo-num text-right">{formatMonto(f.costoTotal)}</Celda>
              <Celda className={cn('demo-num text-right font-medium', tonoMargen(f.margen))}>
                {formatMonto(f.margen)}
              </Celda>
              <Celda
                className={cn(
                  'demo-num text-right',
                  f.margenPct == null ? 'text-muted' : tonoMargen(f.margenPct),
                )}
                // El título explica la raya: sin él, una celda vacía se lee
                // como un dato que falta por un fallo.
              >
                <span title={f.margenPct == null ? 'Sin ingreso en el rango: no hay porcentaje que calcular' : undefined}>
                  {formatoPorcentaje(f.margenPct)}
                </span>
              </Celda>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {/* El total viene del SERVIDOR (`reporte.totales`) y no se suma aquí:
              dos sumas de lo mismo divergen, y la del servidor es la que cuadra
              con el desglose por periodo. */}
          <tr className="border-t-2 border-border-strong font-medium">
            <Celda className="text-ink">Total ({filas.length})</Celda>
            <Celda className="demo-num text-right">{formatMonto(t.ingreso)}</Celda>
            <Celda className="demo-num text-right">{formatMonto(t.costoEspacio)}</Celda>
            <Celda className="demo-num text-right">{formatMonto(t.costoOperacion)}</Celda>
            <Celda className="demo-num text-right">{formatMonto(t.costoTotal)}</Celda>
            <Celda className={cn('demo-num text-right', tonoMargen(t.margen))}>{formatMonto(t.margen)}</Celda>
            <Celda className="demo-num text-right">{formatoPorcentaje(t.margenPct)}</Celda>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
