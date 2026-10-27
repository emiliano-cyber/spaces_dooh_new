'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, HandCoins, Receipt, Wallet } from 'lucide-react'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
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

  // Las dos fechas del rango. Se pintan en `accion` desde `sm` y, en un
  // teléfono, como primera línea del contenido: en la cabecera no caben junto
  // al título (medido a 390 px el 2026-10-26, el chevrón se salía de la
  // pantalla). Es el MISMO estado (`desde`/`hasta`), así que da igual dónde se
  // tecleen.
  const fechasRango = (
    <>
      <input type="date" className={inputFecha} value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
      <span className="text-[12px] text-muted">a</span>
      <input type="date" className={inputFecha} value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
    </>
  )

  return (
    // El selector de periodo va en `accion`, FUERA de lo que se pliega: el
    // periodo elegido vive en este componente y no en el contenido, así que
    // plegar y desplegar no lo pierde.
    <CardColapsable
      id="finanzas.resumen-periodo"
      titulo="Resumen del periodo"
      subtitulo={datos ? `${datos.periodo.etiqueta} · ${formatFecha(datos.periodo.desde)} a ${formatFecha(datos.periodo.hasta)}` : '—'}
      accion={
        <div className="flex flex-wrap items-center gap-1.5">
          {/* En un teléfono los seis botones no caben en la cabecera: «Trimestre
              pasado» se cortaba y el chevrón quedaba fuera de la pantalla
              (medido a 390 px el 2026-10-26). Ahí va un `<select>` con las
              MISMAS opciones y el MISMO `setTipo`; desde `sm`, el segmentado. */}
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoPeriodo)}
            aria-label="Periodo"
            className="h-8 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink sm:hidden"
          >
            {OPCIONES_PERIODO.map((o) => (
              <option key={o.tipo} value={o.tipo}>{o.label}</option>
            ))}
          </select>
          <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
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
          </div>
          {tipo === 'rango' && <span className="hidden items-center gap-1.5 sm:flex">{fechasRango}</span>}
        </div>
      }
    >
        {tipo === 'rango' && <div className="mb-3 flex items-center gap-1.5 sm:hidden">{fechasRango}</div>}
        {!listo ? (
          <p className="text-[13px] text-muted">Elige la fecha de inicio y la de fin.</p>
        ) : error ? (
          <p className="text-[13px] text-error">{error}</p>
        ) : !r ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </div>
        ) : (
          <div className={cn('space-y-3', cargando && 'opacity-60')}>
            {/* Rediseño del 2026-10-26 · las cifras con la forma del Dashboard
                (`KPICard`, cuatro columnas desde `xl`). Antes eran seis
                tarjetas iguales, y «Renta pagada $0.00» pesaba lo mismo que lo
                vencido. Lo que se cobra va primero; la renta baja a la franja
                de abajo. Son LOS MISMOS campos de `resumenFinanzasApi`: aquí
                no se suma ni se redondea nada. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KPICard
                label="Por cobrar al cierre"
                value={formatMonto(r.saldoFinal)}
                sub={`al inicio: ${formatMonto(r.saldoInicial)}`}
                tono="azul"
                icon={<HandCoins className="h-4 w-4" />}
              />
              <KPICard
                label="Vencido"
                value={formatMonto(r.vencido.monto)}
                sub={`${r.vencido.facturas} factura${r.vencido.facturas === 1 ? '' : 's'} al ${formatFecha(r.corte)}`}
                tono={r.vencido.facturas > 0 ? 'rojo' : 'neutro'}
                icon={<AlertTriangle className="h-4 w-4" />}
              />
              <KPICard
                label="Facturado"
                value={formatMonto(r.facturado.monto)}
                sub={`${r.facturado.facturas} factura${r.facturado.facturas === 1 ? '' : 's'}`}
                icon={<Receipt className="h-4 w-4" />}
              />
              <KPICard
                label="Cobrado"
                value={formatMonto(r.cobrado)}
                sub="pagos recibidos en el periodo"
                tono="verde"
                icon={<Wallet className="h-4 w-4" />}
              />
            </div>
            {r.renta && (
              // La renta es lo que SALE: va como desglose, en la franja
              // secundaria del Dashboard. Lo pendiente se tiñe de ámbar.
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border border-border bg-surface-2 px-4 py-2 text-[12px]">
                <span className="font-medium text-ink">Renta a propietarios</span>
                <span className="text-muted">
                  Pagada <span className="demo-num text-ink">{formatMonto(r.renta.pagada)}</span>
                </span>
                <span className="text-muted">
                  Por pagar del periodo{' '}
                  <span className={cn('demo-num', r.renta.porPagar > 0 ? 'font-medium text-[#9a6700]' : 'text-ink')}>
                    {formatMonto(r.renta.porPagar)}
                  </span>
                </span>
              </div>
            )}
            {r.abonosSinFecha > 0 && (
              <p className="flex items-start gap-1.5 text-[11px] text-muted">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                {formatMonto(r.abonosSinFecha)} de lo cobrado son pagos de antes de que el sistema guardara la fecha de
                cada pago: se fecharon con la fecha de su factura, así que su mes es aproximado.
              </p>
            )}
          </div>
        )}
    </CardColapsable>
  )
}
