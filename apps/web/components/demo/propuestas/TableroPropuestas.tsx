'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { cn } from '@/lib/cn'
import { formatMonto, formatFecha, usePropuestas } from '@/lib/data/client'
import { esEtiquetaRango, etiquetaPeriodo, type TipoPeriodo } from '@/lib/finanzas-periodo'
import { OPCIONES_PERIODO } from '@/components/demo/finanzas/TableroPeriodo'
import { CLAVE_PERIODO } from '@/components/demo/finanzas/etiquetas'
import { resumenPropuestasApi, type RespuestaResumenPropuestas } from '@/lib/data/propuestas-resumen-api'
import { formatNumero } from '@/lib/formato-numero'
import { useIdioma } from '@/lib/i18n/contexto'
import type { Idioma } from '@/lib/i18n/idiomas'
import { porcentajeEnIdioma } from '@/lib/i18n/formato-idioma'
import { cifraEnEtiqueta } from '@/lib/i18n/cifra-en-etiqueta'

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

// Italiano (lote L2, 2026-11-03): en es y en, el «50 %» de siempre, tal cual;
// en italiano, «12,5%» (coma decimal y sin espacio, `formato-idioma.ts`).
const pct = (v: number | null, idioma: Idioma) => {
  if (v === null) return '—'
  const r = Math.round(v * 10) / 10
  return idioma === 'es' || idioma === 'en' ? `${r} %` : porcentajeEnIdioma(cifraEnEtiqueta(r, idioma), idioma)
}

export function TableroPropuestas() {
  const { t, idioma } = useIdioma()
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
      // Sin mensaje propio se guarda '' y el texto se pone AL PINTAR: asi el
      // efecto no depende de `t` y no se vuelve a pedir el tablero al cambiar
      // de idioma.
      .catch((e) => { if (vivo) setError(e instanceof Error ? e.message : '') })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [tipo, desde, hasta, listo, propuestas])

  const r = datos?.resumen
  const conGanancia = datos?.conGanancia ?? false
  // Ceros honestos (rediseño del 26/10). Si hay aprobadas pero NINGUNA trae su
  // venta calculada (la tabla de abajo dice «—» en cada una), el total sale 0 y
  // pintar «$ 0.00» afirmaría que se vendió cero. Solo cambia CÓMO se enseña:
  // la cifra que manda el servidor no se toca.
  const ventaSinCalcular =
    !!r && r.aprobadas.n > 0 && r.aprobadas.venta === 0 && r.lista.length > 0 && r.lista.every((x) => x.venta === null)
  const gananciaSinCalcular =
    !!r && r.aprobadas.n > 0 && !r.aprobadas.ganancia && r.lista.length > 0 && r.lista.every((x) => x.ganancia === null)

  return (
    // PLEG-02 · el selector de periodo va en `accion` (fuera del área que
    // pliega) y su estado vive en este componente, no en la tarjeta: plegar y
    // desplegar no devuelve el periodo a «mes».
    <CardColapsable
      id="propuestas.resumen"
      titulo={t('propuestas.tablero.titulo')}
      // Plegado al entrar desde el 26/10: va debajo de la lista y es análisis
      // por periodo; quien lo quiera lo abre con un clic.
      defaultAbierto={false}
      subtitulo={
        // Con un rango a mano la etiqueta YA son las fechas: en ingles saldrian
        // dos veces identicas («Jan 5, 2026 to Mar 9, 2026 · Jan 5, 2026 to
        // Mar 9, 2026»), asi que se pintan una. El espanol queda como siempre.
        datos && idioma !== 'es' && esEtiquetaRango(datos.periodo.etiqueta)
          ? etiquetaPeriodo(datos.periodo, idioma)
          : datos
          ? t('propuestas.tablero.subtitulo', {
              periodo: etiquetaPeriodo(datos.periodo, idioma),
              desde: formatFecha(datos.periodo.desde, idioma),
              hasta: formatFecha(datos.periodo.hasta, idioma),
            })
          : '—'
      }
      accion={
        <div className="flex flex-wrap items-center gap-1.5">
          {/* En un teléfono los seis botones desbordaban la página entera (516 px
              de contenido en 380, medido por la validación del 26/10). Mismo
              arreglo que `TableroPeriodo` de Finanzas: un `<select>` con las
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
          {tipo === 'rango' && (
            <span className="flex items-center gap-1.5">
              <input type="date" className={inputFecha} value={desde} onChange={(e) => setDesde(e.target.value)} aria-label={t('compartidos.periodo.desde')} />
              <span className="text-[12px] text-muted">{t('compartidos.periodo.a')}</span>
              <input type="date" className={inputFecha} value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label={t('compartidos.periodo.hasta')} />
            </span>
          )}
        </div>
      }
    >
        {!listo ? (
          <p className="text-[13px] text-muted">{t('compartidos.periodo.elige')}</p>
        ) : error !== null ? (
          <p className="text-[13px] text-error">{error || t('propuestas.tablero.error')}</p>
        ) : !r ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded bg-surface-2" />)}
          </div>
        ) : (
          <div className={cn('space-y-4', cargando && 'opacity-60')}>
            {/* Sin ganancia (quien no ve finanzas) son cuatro cifras: en una
                rejilla de seis dejaban dos huecos vacíos a la derecha. */}
            <div className={cn('grid grid-cols-2 gap-3', conGanancia ? 'md:grid-cols-3 xl:grid-cols-6' : 'md:grid-cols-4')}>
              <Cifra label={t('propuestas.tablero.generadas')} valor={formatNumero(r.generadas, 0, idioma)} pie={t('propuestas.tablero.generadas.pie')} />
              <Cifra
                label={t('propuestas.tablero.aprobadas')}
                valor={formatNumero(r.aprobadas.n, 0, idioma)}
                pie={
                  ventaSinCalcular
                    ? t('propuestas.tablero.aprobadas.sin-venta')
                    : t('propuestas.tablero.aprobadas.venta', { monto: formatMonto(r.aprobadas.venta, idioma) })
                }
                tono="ok"
              />
              <Cifra label={t('propuestas.tablero.rechazadas')} valor={formatNumero(r.rechazadas, 0, idioma)} pie={t('propuestas.tablero.rechazadas.pie')} tono={r.rechazadas > 0 ? 'error' : undefined} />
              {/* «del periodo» en la etiqueta: arriba hay una tasa histórica y
                  el Dashboard tiene otra de ventana fija, y sin decirlo se leían
                  dos porcentajes distintos para la misma pregunta. */}
              <Cifra
                label={t('propuestas.tablero.tasa')}
                valor={r.tasaCierre === null ? '—' : pct(r.tasaCierre * 100, idioma)}
                pie={t('propuestas.tablero.tasa.pie')}
              />
              {conGanancia && (
                <>
                  <Cifra
                    label={t('propuestas.tablero.ganancia')}
                    valor={gananciaSinCalcular ? '—' : formatMonto(r.aprobadas.ganancia ?? 0, idioma)}
                    pie={
                      gananciaSinCalcular
                        ? t('propuestas.tablero.ganancia.sin-calcular')
                        : t('propuestas.tablero.ganancia.margen', { pct: pct(r.aprobadas.margenPct, idioma) })
                    }
                    tono={gananciaSinCalcular ? undefined : 'ok'}
                  />
                  <Cifra
                    label={t('propuestas.tablero.ganancia-por-aprobada')}
                    valor={r.aprobadas.gananciaPromedio === null ? '—' : formatMonto(r.aprobadas.gananciaPromedio, idioma)}
                    pie={t('propuestas.tablero.ganancia-por-aprobada.pie')}
                  />
                </>
              )}
            </div>

            {conGanancia && r.aprobadas.sinCosto > 0 && (
              <p className="flex items-start gap-1.5 text-[11px] text-muted">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                {t(r.aprobadas.sinCosto === 1 ? 'propuestas.tablero.sin-costo.uno' : 'propuestas.tablero.sin-costo.otros', {
                  n: r.aprobadas.sinCosto,
                })}
              </p>
            )}

            {r.porVendedor.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                      <th className="py-2 pr-4 font-medium">{t('propuestas.tablero.col.vendedor')}</th>
                      <th className="py-2 pr-4 text-right font-medium">{t('propuestas.tablero.generadas')}</th>
                      <th className="py-2 pr-4 text-right font-medium">{t('propuestas.tablero.aprobadas')}</th>
                      <th className="py-2 pr-4 text-right font-medium">{t('propuestas.tablero.rechazadas')}</th>
                      <th className="py-2 pr-4 text-right font-medium">{t('propuestas.tablero.col.venta')}</th>
                      {conGanancia && <th className="py-2 text-right font-medium">{t('propuestas.tablero.ganancia')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {r.porVendedor.map((v) => (
                      <tr key={v.vendedor} className="border-b border-border last:border-0">
                        <td className="py-2 pr-4 text-ink">{v.vendedor}</td>
                        <td className="demo-num py-2 pr-4 text-right text-muted">{formatNumero(v.generadas, 0, idioma)}</td>
                        <td className="demo-num py-2 pr-4 text-right text-ink">{formatNumero(v.aprobadas, 0, idioma)}</td>
                        <td className="demo-num py-2 pr-4 text-right text-muted">{formatNumero(v.rechazadas, 0, idioma)}</td>
                        <td className="demo-num py-2 pr-4 text-right text-ink">{formatMonto(v.venta, idioma)}</td>
                        {conGanancia && <td className="demo-num py-2 text-right text-ink">{formatMonto(v.ganancia ?? 0, idioma)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {r.lista.length > 0 && (
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">{t('propuestas.tablero.aprobadas-periodo')}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                        <th className="py-2 pr-4 font-medium">{t('propuestas.tablero.col.folio')}</th>
                        <th className="py-2 pr-4 font-medium">{t('propuestas.tablero.col.propuesta')}</th>
                        <th className="py-2 pr-4 font-medium">{t('propuestas.tablero.col.vendedor')}</th>
                        <th className="py-2 pr-4 font-medium">{t('propuestas.tablero.col.aprobada')}</th>
                        <th className="py-2 pr-4 text-right font-medium">{t('propuestas.tablero.col.venta')}</th>
                        {conGanancia && <th className="py-2 pr-4 text-right font-medium">{t('propuestas.tablero.col.renta')}</th>}
                        {conGanancia && <th className="py-2 text-right font-medium">{t('propuestas.tablero.ganancia')}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {r.lista.slice(0, 10).map((x) => (
                        <tr key={x.id} className="border-b border-border last:border-0">
                          <td className="demo-num py-2 pr-4 text-ink">{x.folio}</td>
                          <td className="py-2 pr-4 text-ink">{x.nombre}</td>
                          <td className="py-2 pr-4 text-muted">{x.vendedor ?? '—'}</td>
                          <td className="demo-num py-2 pr-4 text-muted">{formatFecha(x.aprobada, idioma)}</td>
                          <td className="demo-num py-2 pr-4 text-right text-ink">{x.venta === null ? '—' : formatMonto(x.venta, idioma)}</td>
                          {conGanancia && <td className="demo-num py-2 pr-4 text-right text-muted">{x.costoRenta === null ? t('propuestas.tablero.sin-contrato') : formatMonto(x.costoRenta, idioma)}</td>}
                          {conGanancia && (
                            <td className={cn('demo-num py-2 text-right', x.ganancia !== null && x.ganancia < 0 ? 'text-error' : 'text-ink')}>
                              {x.ganancia === null ? '—' : formatMonto(x.ganancia, idioma)}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {r.lista.length > 10 && <p className="mt-1 text-[11px] text-muted">{t('propuestas.tablero.mas', { n: r.lista.length - 10 })}</p>}
              </div>
            )}
          </div>
        )}
    </CardColapsable>
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
