'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { cn } from '@/lib/cn'
import { formatMonto, formatFecha, usePropuestas } from '@/lib/data/client'
import type { TipoPeriodo } from '@/lib/finanzas-periodo'
import { OPCIONES_PERIODO } from '@/components/demo/finanzas/TableroPeriodo'
import { resumenPropuestasApi, type RespuestaResumenPropuestas } from '@/lib/data/propuestas-resumen-api'

// ============================================================================
//  El tablero de propuestas por periodo (PROP-PER, 06/10).
// ----------------------------------------------------------------------------
//  Pedido del dueño: «aprobadas, ganancia por aprobada, rechazadas, generadas,
//  y todo por lapsos de tiempo». Mismo selector de periodo que Finanzas. La
//  ganancia (venta − renta del contrato de cada pantalla) solo la ve quien
//  tiene `finanzas.ver`; a los demás no les llega del servidor.
// ============================================================================

const inputFecha =
  'h-8 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 10) / 10} %`)

export function TableroPropuestas() {
  const [tipo, setTipo] = useState<TipoPeriodo>('mes')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [datos, setDatos] = useState<RespuestaResumenPropuestas | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  // Se recalcula cuando cambian las propuestas del store (aprobar o rechazar
  // una desde la lista de abajo): si no, el tablero se quedaría con las cifras
  // de antes hasta cambiar de periodo.
  const propuestas = usePropuestas()

  const listo = tipo !== 'rango' || (!!desde && !!hasta)

  useEffect(() => {
    if (!listo) return
    let vivo = true
    setCargando(true)
    setError(null)
    resumenPropuestasApi({ periodo: tipo, desde, hasta })
      .then((d) => { if (vivo) setDatos(d) })
      .catch((e) => { if (vivo) setError(e instanceof Error ? e.message : 'No se pudo calcular el tablero') })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [tipo, desde, hasta, listo, propuestas])

  const r = datos?.resumen
  const conGanancia = datos?.conGanancia ?? false

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Resumen de propuestas</CardTitle>
          <p className="mt-0.5 text-[12px] text-muted">
            {datos ? `${datos.periodo.etiqueta} · ${formatFecha(datos.periodo.desde)} a ${formatFecha(datos.periodo.hasta)}` : '—'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {OPCIONES_PERIODO.map((o) => (
            <button
              key={o.tipo}
              type="button"
              onClick={() => setTipo(o.tipo)}
              aria-pressed={tipo === o.tipo}
              className={cn(
                'rounded border px-2.5 py-1 text-[12px] font-medium',
                tipo === o.tipo ? 'border-accent bg-accent text-white' : 'border-border-strong bg-surface text-ink hover:bg-surface-2',
              )}
            >
              {o.label}
            </button>
          ))}
          {tipo === 'rango' && (
            <span className="flex items-center gap-1.5">
              <input type="date" className={inputFecha} value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
              <span className="text-[12px] text-muted">a</span>
              <input type="date" className={inputFecha} value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!listo ? (
          <p className="text-[13px] text-muted">Elige la fecha de inicio y la de fin.</p>
        ) : error ? (
          <p className="text-[13px] text-error">{error}</p>
        ) : !r ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded bg-surface-2" />)}
          </div>
        ) : (
          <div className={cn('space-y-4', cargando && 'opacity-60')}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Cifra label="Generadas" valor={String(r.generadas)} pie="creadas en el periodo" />
              <Cifra label="Aprobadas" valor={String(r.aprobadas.n)} pie={`venta ${formatMonto(r.aprobadas.venta)} sin IVA`} tono="ok" />
              <Cifra label="Rechazadas" valor={String(r.rechazadas)} pie="en el periodo" tono={r.rechazadas > 0 ? 'error' : undefined} />
              <Cifra
                label="Tasa de cierre"
                valor={r.tasaCierre === null ? '—' : pct(r.tasaCierre * 100)}
                pie="aprobadas de las decididas"
              />
              {conGanancia && (
                <>
                  <Cifra label="Ganancia" valor={formatMonto(r.aprobadas.ganancia ?? 0)} pie={`margen ${pct(r.aprobadas.margenPct)}`} tono="ok" />
                  <Cifra
                    label="Ganancia por aprobada"
                    valor={r.aprobadas.gananciaPromedio === null ? '—' : formatMonto(r.aprobadas.gananciaPromedio)}
                    pie="venta − renta de las pantallas"
                  />
                </>
              )}
            </div>

            {conGanancia && r.aprobadas.sinCosto > 0 && (
              <p className="flex items-start gap-1.5 text-[11px] text-muted">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                {r.aprobadas.sinCosto === 1 ? '1 aprobada tiene' : `${r.aprobadas.sinCosto} aprobadas tienen`} alguna pantalla
                sin contrato de renta vigente: cuentan en la venta, pero no en la ganancia.
              </p>
            )}

            {r.porVendedor.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                      <th className="py-2 pr-4 font-medium">Vendedor</th>
                      <th className="py-2 pr-4 text-right font-medium">Generadas</th>
                      <th className="py-2 pr-4 text-right font-medium">Aprobadas</th>
                      <th className="py-2 pr-4 text-right font-medium">Rechazadas</th>
                      <th className="py-2 pr-4 text-right font-medium">Venta sin IVA</th>
                      {conGanancia && <th className="py-2 text-right font-medium">Ganancia</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {r.porVendedor.map((v) => (
                      <tr key={v.vendedor} className="border-b border-border last:border-0">
                        <td className="py-2 pr-4 text-ink">{v.vendedor}</td>
                        <td className="demo-num py-2 pr-4 text-right text-muted">{v.generadas}</td>
                        <td className="demo-num py-2 pr-4 text-right text-ink">{v.aprobadas}</td>
                        <td className="demo-num py-2 pr-4 text-right text-muted">{v.rechazadas}</td>
                        <td className="demo-num py-2 pr-4 text-right text-ink">{formatMonto(v.venta)}</td>
                        {conGanancia && <td className="demo-num py-2 text-right text-ink">{formatMonto(v.ganancia ?? 0)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {r.lista.length > 0 && (
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">Aprobadas del periodo</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                        <th className="py-2 pr-4 font-medium">Folio</th>
                        <th className="py-2 pr-4 font-medium">Propuesta</th>
                        <th className="py-2 pr-4 font-medium">Vendedor</th>
                        <th className="py-2 pr-4 font-medium">Aprobada</th>
                        <th className="py-2 pr-4 text-right font-medium">Venta sin IVA</th>
                        {conGanancia && <th className="py-2 pr-4 text-right font-medium">Renta</th>}
                        {conGanancia && <th className="py-2 text-right font-medium">Ganancia</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {r.lista.slice(0, 10).map((x) => (
                        <tr key={x.id} className="border-b border-border last:border-0">
                          <td className="demo-num py-2 pr-4 text-ink">{x.folio}</td>
                          <td className="py-2 pr-4 text-ink">{x.nombre}</td>
                          <td className="py-2 pr-4 text-muted">{x.vendedor ?? '—'}</td>
                          <td className="demo-num py-2 pr-4 text-muted">{formatFecha(x.aprobada)}</td>
                          <td className="demo-num py-2 pr-4 text-right text-ink">{x.venta === null ? '—' : formatMonto(x.venta)}</td>
                          {conGanancia && <td className="demo-num py-2 pr-4 text-right text-muted">{x.costoRenta === null ? 'sin contrato' : formatMonto(x.costoRenta)}</td>}
                          {conGanancia && (
                            <td className={cn('demo-num py-2 text-right', x.ganancia !== null && x.ganancia < 0 ? 'text-error' : 'text-ink')}>
                              {x.ganancia === null ? '—' : formatMonto(x.ganancia)}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {r.lista.length > 10 && <p className="mt-1 text-[11px] text-muted">Y {r.lista.length - 10} más.</p>}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const TONO = { ok: 'text-success', error: 'text-error' } as const

function Cifra({ label, valor, pie, tono }: { label: string; valor: string; pie: string; tono?: keyof typeof TONO }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={cn('demo-num mt-1 text-lg font-semibold text-ink', tono && TONO[tono])}>{valor}</div>
      <div className="mt-0.5 text-[11px] text-muted">{pie}</div>
    </div>
  )
}
