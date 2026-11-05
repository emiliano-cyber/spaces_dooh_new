'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, HandCoins, Receipt, Wallet } from 'lucide-react'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { cn } from '@/lib/cn'
import { useCobranzas, useFacturas, usePagosRenta, formatMonto, formatFecha } from '@/lib/data/client'
import { esEtiquetaRango, etiquetaPeriodo, type TipoPeriodo } from '@/lib/finanzas-periodo'
import { resumenFinanzasApi, type RespuestaResumen } from '@/lib/data/finanzas-periodo-api'
import { useIdioma } from '@/lib/i18n/contexto'
import { interpolarNodos } from '@/lib/i18n/nodos'
import { CLAVE_PERIODO } from './etiquetas'

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
  const { t, idioma } = useIdioma()
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
      .catch((e) => { if (vivo) setError(e instanceof Error ? e.message : t('finanzas.periodo.no-calcular')) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, desde, hasta, listo, cobranzas, facturas, rentas])

  const r = datos?.resumen

  // Las dos fechas del rango. Se pintan en `accion` desde `sm` y, en un
  // teléfono, como primera línea del contenido: en la cabecera no caben junto
  // al título (medido a 390 px el 2026-10-26, el chevrón se salía de la
  // pantalla). Es el MISMO estado (`desde`/`hasta`), así que da igual dónde se
  // tecleen.
  const fechasRango = (
    <>
      <input type="date" className={inputFecha} value={desde} onChange={(e) => setDesde(e.target.value)} aria-label={t('compartidos.periodo.desde')} />
      <span className="text-[12px] text-muted">{t('compartidos.periodo.a')}</span>
      <input type="date" className={inputFecha} value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label={t('compartidos.periodo.hasta')} />
    </>
  )

  return (
    // El selector de periodo va en `accion`, FUERA de lo que se pliega: el
    // periodo elegido vive en este componente y no en el contenido, así que
    // plegar y desplegar no lo pierde.
    <CardColapsable
      id="finanzas.resumen-periodo"
      titulo={t('finanzas.periodo.titulo')}
      subtitulo={
        // La etiqueta la arma el servidor en espanol («Noviembre 2026»); en
        // otro idioma se rearma con `etiquetaPeriodo` (costura, 2026-11-02).
        // Con un rango a mano la etiqueta YA son las fechas: en ingles saldrian
        // dos veces, asi que se pinta una, como en el tablero de Propuestas.
        datos && idioma !== 'es' && esEtiquetaRango(datos.periodo.etiqueta)
          ? etiquetaPeriodo(datos.periodo, idioma)
          : datos
          ? t('finanzas.periodo.subtitulo', {
              etiqueta: etiquetaPeriodo(datos.periodo, idioma),
              desde: formatFecha(datos.periodo.desde, idioma),
              hasta: formatFecha(datos.periodo.hasta, idioma),
            })
          : '—'
      }
      accion={
        <div className="flex flex-wrap items-center gap-1.5">
          {/* En un teléfono los seis botones no caben en la cabecera: «Trimestre
              pasado» se cortaba y el chevrón quedaba fuera de la pantalla
              (medido a 390 px el 2026-10-26). Ahí va un `<select>` con las
              MISMAS opciones y el MISMO `setTipo`; desde `sm`, el segmentado. */}
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoPeriodo)}
            aria-label={t('compartidos.periodo.aria')}
            className="h-8 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink sm:hidden"
          >
            {OPCIONES_PERIODO.map((o) => (
              <option key={o.tipo} value={o.tipo}>{t(CLAVE_PERIODO[o.tipo])}</option>
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
                {t(CLAVE_PERIODO[o.tipo])}
              </button>
            ))}
          </div>
          {tipo === 'rango' && <span className="hidden items-center gap-1.5 sm:flex">{fechasRango}</span>}
        </div>
      }
    >
        {tipo === 'rango' && <div className="mb-3 flex items-center gap-1.5 sm:hidden">{fechasRango}</div>}
        {!listo ? (
          <p className="text-[13px] text-muted">{t('compartidos.periodo.elige')}</p>
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
                label={t('finanzas.periodo.por-cobrar')}
                value={formatMonto(r.saldoFinal, idioma)}
                sub={t('finanzas.periodo.al-inicio', { monto: formatMonto(r.saldoInicial, idioma) })}
                tono="azul"
                icon={<HandCoins className="h-4 w-4" />}
              />
              <KPICard
                label={t('finanzas.periodo.vencido')}
                value={formatMonto(r.vencido.monto, idioma)}
                sub={t(r.vencido.facturas === 1 ? 'finanzas.periodo.vencido.sub.uno' : 'finanzas.periodo.vencido.sub.otros', {
                  n: r.vencido.facturas,
                  fecha: formatFecha(r.corte, idioma),
                })}
                tono={r.vencido.facturas > 0 ? 'rojo' : 'neutro'}
                icon={<AlertTriangle className="h-4 w-4" />}
              />
              <KPICard
                label={t('finanzas.periodo.facturado')}
                value={formatMonto(r.facturado.monto, idioma)}
                sub={t(r.facturado.facturas === 1 ? 'finanzas.periodo.facturas.uno' : 'finanzas.periodo.facturas.otros', {
                  n: r.facturado.facturas,
                })}
                icon={<Receipt className="h-4 w-4" />}
              />
              <KPICard
                label={t('finanzas.periodo.cobrado')}
                value={formatMonto(r.cobrado, idioma)}
                sub={t('finanzas.periodo.cobrado.sub')}
                tono="verde"
                icon={<Wallet className="h-4 w-4" />}
              />
            </div>
            {r.renta && (
              // La renta es lo que SALE: va como desglose, en la franja
              // secundaria del Dashboard. Lo pendiente se tiñe de ámbar.
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border border-border bg-surface-2 px-4 py-2 text-[12px]">
                <span className="font-medium text-ink">{t('finanzas.periodo.renta')}</span>
                <span className="text-muted">
                  {interpolarNodos(t('finanzas.periodo.renta.pagada'), {
                    monto: <span className="demo-num text-ink">{formatMonto(r.renta.pagada, idioma)}</span>,
                  })}
                </span>
                <span className="text-muted">
                  {interpolarNodos(t('finanzas.periodo.renta.por-pagar'), {
                    monto: (
                      <span className={cn('demo-num', r.renta.porPagar > 0 ? 'font-medium text-[#9a6700]' : 'text-ink')}>
                        {formatMonto(r.renta.porPagar, idioma)}
                      </span>
                    ),
                  })}
                </span>
              </div>
            )}
            {r.abonosSinFecha > 0 && (
              <p className="flex items-start gap-1.5 text-[11px] text-muted">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                {t('finanzas.periodo.sin-fecha', { monto: formatMonto(r.abonosSinFecha, idioma) })}
              </p>
            )}
          </div>
        )}
    </CardColapsable>
  )
}
