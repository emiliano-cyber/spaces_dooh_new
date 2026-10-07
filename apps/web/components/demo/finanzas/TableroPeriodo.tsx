'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { cn } from '@/lib/cn'
import { useCobranzas, useFacturas, usePagosRenta, formatMonto, formatFecha } from '@/lib/data/client'
import type { TipoPeriodo } from '@/lib/finanzas-periodo'
import { resumenFinanzasApi, type RespuestaResumen } from '@/lib/data/finanzas-periodo-api'

// ============================================================================
//  El tablero de Finanzas por periodo (06/10, ADR 0046).
// ----------------------------------------------------------------------------
//  Pedido del dueño: «dashboard con temporalidad en finanzas, facturas
//  vencidas, trimestre». Se elige el periodo —mes, mes pasado, trimestre,
//  trimestre pasado, año o un rango— y se ve lo facturado, lo cobrado, lo que
//  queda por cobrar al cierre, lo vencido y la renta. Las cuentas las hace el
//  servidor (`lib/finanzas-periodo.ts`); aquí solo se pintan.
// ============================================================================

export const OPCIONES_PERIODO: { tipo: TipoPeriodo; label: string }[] = [
  { tipo: 'mes', label: 'Este mes' },
  { tipo: 'mes-anterior', label: 'Mes pasado' },
  { tipo: 'trimestre', label: 'Trimestre' },
  { tipo: 'trimestre-anterior', label: 'Trimestre pasado' },
  { tipo: 'anio', label: 'Año' },
  { tipo: 'rango', label: 'Rango' },
]

const inputFecha =
  'h-8 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function TableroPeriodo() {
  const [tipo, setTipo] = useState<TipoPeriodo>('mes')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [datos, setDatos] = useState<RespuestaResumen | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  // El rango se pide solo cuando tiene las dos fechas: pedirlo a medias daría
  // un 400 en cada tecla.
  const listo = tipo !== 'rango' || (!!desde && !!hasta)

  // Se recalcula cuando cambian la cobranza, las facturas o la renta (un pago
  // recién registrado refresca el store): si no, las cifras se quedarían en las
  // de antes del pago hasta cambiar de periodo.
  const cobranzas = useCobranzas()
  const facturas = useFacturas()
  const rentas = usePagosRenta()

  useEffect(() => {
    if (!listo) return
    let vivo = true
    setCargando(true)
    setError(null)
    resumenFinanzasApi({ periodo: tipo, desde, hasta })
      .then((d) => { if (vivo) setDatos(d) })
      .catch((e) => { if (vivo) setError(e instanceof Error ? e.message : 'No se pudo calcular el periodo') })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [tipo, desde, hasta, listo, cobranzas, facturas, rentas])

  const r = datos?.resumen

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Resumen del periodo</CardTitle>
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
          <div className={cn('space-y-3', cargando && 'opacity-60')}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Cifra label="Facturado" valor={formatMonto(r.facturado.monto)} pie={`${r.facturado.facturas} factura${r.facturado.facturas === 1 ? '' : 's'}`} />
              <Cifra label="Cobrado" valor={formatMonto(r.cobrado)} pie="pagos recibidos en el periodo" tono="ok" />
              <Cifra label="Por cobrar al cierre" valor={formatMonto(r.saldoFinal)} pie={`al inicio: ${formatMonto(r.saldoInicial)}`} />
              <Cifra
                label="Facturas vencidas"
                valor={String(r.vencido.facturas)}
                pie={`${formatMonto(r.vencido.monto)} al ${formatFecha(r.corte)}`}
                tono={r.vencido.facturas > 0 ? 'error' : undefined}
              />
              {r.renta && (
                <>
                  <Cifra label="Renta pagada" valor={formatMonto(r.renta.pagada)} pie="a propietarios" />
                  <Cifra label="Renta por pagar" valor={formatMonto(r.renta.porPagar)} pie="del periodo" tono={r.renta.porPagar > 0 ? 'warning' : undefined} />
                </>
              )}
            </div>
            {r.abonosSinFecha > 0 && (
              <p className="flex items-start gap-1.5 text-[11px] text-muted">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                {formatMonto(r.abonosSinFecha)} de lo cobrado son pagos de antes de que el sistema guardara la fecha de
                cada pago: se fecharon con la fecha de su factura, así que su mes es aproximado.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const TONO = { ok: 'text-success', error: 'text-error', warning: 'text-warning' } as const

function Cifra({ label, valor, pie, tono }: { label: string; valor: string; pie: string; tono?: keyof typeof TONO }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={cn('demo-num mt-1 text-lg font-semibold text-ink', tono && TONO[tono])}>{valor}</div>
      <div className="mt-0.5 text-[11px] text-muted">{pie}</div>
    </div>
  )
}
