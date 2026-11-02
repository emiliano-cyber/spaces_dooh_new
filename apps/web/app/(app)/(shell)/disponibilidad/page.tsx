'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, Search, Monitor, LayoutGrid, Clock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { SlotsBadge } from '@/components/demo/SlotsBadge'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { useDisponibilidad, formatFecha, type GranDisponibilidad, type EstadoCelda } from '@/lib/data/client'
import { useIdioma } from '@/lib/i18n/contexto'
import type { Idioma } from '@/lib/i18n/idiomas'

// Calendario de disponibilidad futura: responde "¿qué tengo libre en septiembre?".
// Cruza las reservas confirmadas contra una rejilla de catorcenas o meses y
// pinta cada pantalla × periodo como libre / parcial / ocupado. Desde TENT-PROP
// (26/10) avisa además qué está «en propuesta»: lo tentativo es lo que pide una
// propuesta abierta (`lib/data/en-propuesta.ts`), y solo avisa, no bloquea.

const selectCls =
  'h-9 rounded border border-border-strong bg-surface px-2.5 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

// Código de color ÚNICO del grupo Comercial (rediseño del 26/10, tomado de
// Broadsign): LIBRE va SIN relleno porque es el fondo de la rejilla —antes iba
// en verde y el ojo se iba a lo que no importa—, PARCIAL y TENTATIVA en ámbar,
// OCUPADO en rojo suave. El texto de la celda sigue diciendo el estado: el color
// nunca carga el significado solo. `CalendarioDisponibilidad` usa el mismo
// código, para que «verde» no signifique libre aquí y confirmada allá.
const TONO_CELDA: Record<EstadoCelda, string> = {
  LIBRE: 'bg-surface text-muted border-border',
  PARCIAL: 'bg-warning-soft text-[#9a6700] border-border',
  OCUPADO: 'bg-error-soft text-error border-border',
}
// En propuesta (TENT-PROP, 26/10): ámbar con borde punteado. Hasta hoy era el
// tono de la reserva TENTATIVA, un estado que ningún flujo creaba; lo tentativo
// es ahora lo que pide una propuesta abierta, y la celda sigue VENDIBLE. El
// texto ámbar es el oscuro del Dashboard (`text-warning` no se lee a 11 px).
const TONO_EN_PROPUESTA = 'bg-warning-soft text-[#9a6700] border-dashed border-warning'

// La etiqueta de cada periodo la arma `lib/data/derive.ts` en espanol
// («1/3–14/3», «mar 26»). En ingles se rehace AQUI con las mismas fechas
// (`inicio` y `fin`), en el orden y con los nombres de `en-US`; el espanol
// sigue siendo la etiqueta de siempre.
function etiquetaPeriodo(p: { label: string; inicio: string; fin: string }, gran: GranDisponibilidad, idioma: Idioma): string {
  if (idioma === 'es') return p.label
  const [y, m, d] = p.inicio.split('-').map(Number)
  if (gran === 'mes') return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  const [, m2, d2] = p.fin.split('-').map(Number)
  return `${m}/${d}–${m2}/${d2}`
}

function hoyISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export default function DisponibilidadPage() {
  // `desde` se fija en el cliente tras montar para no romper la hidratación.
  const { t, idioma } = useIdioma()
  const [desde, setDesde] = useState('')
  const [gran, setGran] = useState<GranDisponibilidad>('catorcena')
  const [nPeriodos, setNPeriodos] = useState(8)
  const [soloDisponibles, setSoloDisponibles] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    if (!desde) setDesde(hoyISO())
  }, [desde])

  const disp = useDisponibilidad({
    desde: desde || hoyISO(),
    periodos: nPeriodos,
    gran,
    soloDisponibles,
  })

  const filas = useMemo(() => {
    if (!disp) return []
    const q = busqueda.trim().toLowerCase()
    if (!q) return disp.filas
    return disp.filas.filter(
      (f) => f.nombre.toLowerCase().includes(q) || f.clave.toLowerCase().includes(q),
    )
  }, [disp, busqueda])

  // Resumen del primer periodo: cuántas pantallas quedan libres. Las digitales
  // se cuentan aparte, por slots: una con 7 de 10 libres no está «libre», pero
  // se puede vender, y es lo que pidió el dueño ver (06/10).
  const resumenPrimer = useMemo(() => {
    if (!disp || disp.periodos.length === 0) return null
    const estaticas = disp.filas.filter((f) => !f.digital)
    const digitales = disp.filas.filter((f) => f.digital && f.celdas[0]?.estado !== 'OCUPADO')
    return {
      periodo: etiquetaPeriodo(disp.periodos[0], gran, idioma),
      libres: estaticas.filter((f) => f.celdas[0]?.estado === 'LIBRE').length,
      estaticas: estaticas.length,
      digitales: digitales.length,
      slots: digitales.reduce((acc, f) => acc + (f.celdas[0]?.spotsLibres ?? 0), 0),
      // Pantallas que alguna propuesta abierta pide en el primer periodo, y
      // cuántas propuestas distintas. NO resta de «libres»: no bloquea.
      enPropuesta: disp.filas.filter((f) => (f.celdas[0]?.enPropuesta.length ?? 0) > 0).length,
      propuestas: new Set(disp.filas.flatMap((f) => (f.celdas[0]?.enPropuesta ?? []).map((x) => x.propuestaId))).size,
    }
  }, [disp, gran, idioma])

  return (
    // Sin el `p-6` propio: el shell ya pone el margen, y con los dos esta
    // pantalla quedaba 17 px desalineada del resto y con margen doble en móvil.
    <div className="w-full space-y-5">
      {/* Encabezado con el patrón del Dashboard: título y una línea, sin icono. */}
      <div>
        <h1 className="text-2xl text-ink">{t('operaciones.disponibilidad.titulo')}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {t('operaciones.disponibilidad.descripcion')}
        </p>
      </div>

      {/* Lo que tengo libre en el PRIMER periodo, como tarjetas. Antes era una
          frase gris y es justo la pregunta de la pantalla. Mismas cifras que
          `resumenPrimer`: aquí no se recalcula nada. */}
      {(!disp || resumenPrimer) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {!resumenPrimer ? (
            <>
              <KPICardSkeleton />
              <KPICardSkeleton />
              <KPICardSkeleton />
              <KPICardSkeleton />
            </>
          ) : (
            <>
              <KPICard
                label={t('operaciones.disponibilidad.kpi.estaticas')}
                value={t('operaciones.disponibilidad.kpi.de', { n: resumenPrimer.libres, total: resumenPrimer.estaticas })}
                sub={t('operaciones.disponibilidad.kpi.en-periodo', { periodo: resumenPrimer.periodo })}
                tono={resumenPrimer.libres > 0 ? 'verde' : 'neutro'}
                icon={<CalendarRange className="h-4 w-4" />}
              />
              <KPICard
                label={t('operaciones.disponibilidad.kpi.digitales')}
                value={String(resumenPrimer.digitales)}
                sub={t('operaciones.disponibilidad.kpi.no-llenas', { periodo: resumenPrimer.periodo })}
                tono="azul"
                icon={<Monitor className="h-4 w-4" />}
              />
              <KPICard
                label={t('operaciones.disponibilidad.kpi.slots')}
                value={resumenPrimer.digitales > 0 ? String(resumenPrimer.slots) : '—'}
                sub={
                  resumenPrimer.digitales > 0
                    ? t('operaciones.disponibilidad.kpi.sumando')
                    : t('operaciones.disponibilidad.kpi.ninguna-digital')
                }
                icon={<LayoutGrid className="h-4 w-4" />}
              />
              <KPICard
                label={t('operaciones.disponibilidad.kpi.en-propuesta')}
                value={String(resumenPrimer.enPropuesta)}
                sub={
                  resumenPrimer.enPropuesta > 0
                    ? t(
                        resumenPrimer.propuestas === 1
                          ? 'operaciones.disponibilidad.kpi.piden.uno'
                          : 'operaciones.disponibilidad.kpi.piden.otros',
                        { n: resumenPrimer.propuestas },
                      )
                    : t('operaciones.disponibilidad.kpi.ninguna-pide')
                }
                tono={resumenPrimer.enPropuesta > 0 ? 'ambar' : 'neutro'}
                icon={<Clock className="h-4 w-4" />}
              />
            </>
          )}
        </div>
      )}

      {/* Controles en UNA fila: las etiquetas apiladas pasan a aria-label y
          placeholder. Mismos estados y mismos efectos que antes. */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          aria-label={t('operaciones.disponibilidad.desde')}
          title={t('operaciones.disponibilidad.desde')}
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className={selectCls}
        />

        <div className="inline-flex rounded-md border border-border bg-surface p-0.5" role="group" aria-label={t('operaciones.disponibilidad.vista')}>
          {(['catorcena', 'mes'] as GranDisponibilidad[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGran(g)}
              className={cn(
                // Fondo y borde explícitos: con `preflight: false` el botón
                // hereda el gris del navegador.
                'rounded border-0 px-3 py-1.5 text-[13px] capitalize transition-colors duration-150',
                gran === g ? 'bg-surface-2 font-medium text-ink' : 'bg-transparent text-muted hover:text-ink',
              )}
            >
              {g === 'catorcena' ? t('operaciones.disponibilidad.catorcena') : t('operaciones.disponibilidad.mes')}
            </button>
          ))}
        </div>

        <select
          aria-label={t('operaciones.disponibilidad.periodos')}
          title={t('operaciones.disponibilidad.periodos-title')}
          value={nPeriodos}
          onChange={(e) => setNPeriodos(Number(e.target.value))}
          className={selectCls}
        >
          {[4, 6, 8, 12].map((v) => (
            <option key={v} value={v}>
              {t('operaciones.disponibilidad.n-periodos', { n: v })}
            </option>
          ))}
        </select>

        <span className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            aria-label={t('operaciones.disponibilidad.buscar-aria')}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={t('operaciones.disponibilidad.buscar')}
            className={cn(selectCls, 'w-64 pl-7')}
          />
        </span>

        {/* Con aspecto de chip, pero sigue siendo la misma casilla. */}
        <label
          className={cn(
            'flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-[13px] transition-colors',
            soloDisponibles
              ? 'border-accent bg-accent-soft text-ink'
              : 'border-border bg-surface text-muted hover:text-ink',
          )}
        >
          <input
            type="checkbox"
            checked={soloDisponibles}
            onChange={(e) => setSoloDisponibles(e.target.checked)}
            className="h-3.5 w-3.5 accent-accent"
          />
          {t('operaciones.disponibilidad.solo-hueco')}
        </label>
      </div>

      {/* Rejilla — plegable (pedido del 20/10). Los controles de arriba y la
          búsqueda viven en la página, fuera de la tarjeta: plegar no los pierde. */}
      <CardColapsable
        id="disponibilidad.calendario"
        titulo={t('operaciones.disponibilidad.calendario')}
        subtitulo={t('operaciones.disponibilidad.calendario-sub')}
        contentClassName="px-0 pb-0"
      >
      {!disp ? (
        <div className="border-t border-border p-8 text-center text-[13px] text-muted">
          {t('operaciones.disponibilidad.cargando')}
        </div>
      ) : filas.length === 0 ? (
        <div className="border-t border-border p-8 text-center text-[13px] text-muted">
          {t('operaciones.disponibilidad.sin-coincidencias')}
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 min-w-[220px] bg-surface px-3 py-2 text-left font-medium text-muted">
                  {t('operaciones.disponibilidad.pantalla')}
                </th>
                {disp.periodos.map((p) => (
                  <th
                    key={p.clave}
                    className="min-w-[76px] px-2 py-2 text-center font-medium text-muted"
                    title={`${p.inicio} → ${p.fin}`}
                  >
                    {etiquetaPeriodo(p, gran, idioma)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.sitioId} className="border-b border-border last:border-0">
                  <td className="sticky left-0 z-10 bg-surface px-3 py-1.5">
                    <div className="truncate font-medium text-ink" title={f.nombre}>
                      {f.nombre}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-muted">{f.clave}</span>
                      {f.digital && f.totalSpots != null ? (
                        <SlotsBadge total={f.totalSpots} disponibles={f.celdas[0]?.spotsLibres} />
                      ) : f.digital ? (
                        <span className="rounded bg-surface-2 px-1 text-[10px] text-muted">{t('operaciones.disponibilidad.digital')}</span>
                      ) : null}
                      {/* Cuánto del horizonte visible está libre (patrón LMX),
                          contado de las celdas ya cargadas. */}
                      <span className="demo-num rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                        {t('operaciones.disponibilidad.libres-de', { n: f.celdas.filter((c) => c.estado === 'LIBRE').length, total: f.celdas.length })}
                      </span>
                    </div>
                  </td>
                  {f.celdas.map((c, i) => {
                    // En propuesta y todavía vendible: la celda lo avisa en ámbar
                    // punteado. En una OCUPADA lo dice solo el `title`: ahí lo
                    // que manda es que ya está vendida.
                    const avisoPropuesta = c.enPropuesta.length > 0 && c.estado !== 'OCUPADO'
                    const titulo = [
                      c.ocupantes.length > 0
                        ? c.ocupantes
                            .map((o) =>
                              o.spots != null
                                ? t('operaciones.disponibilidad.ocupante-slots', { campana: o.campana, spots: o.spots })
                                : t('operaciones.disponibilidad.ocupante', { campana: o.campana }),
                            )
                            .join('\n') +
                          (c.spotsLibres != null
                            ? `\n${t('operaciones.disponibilidad.quedan', { libres: c.spotsLibres, total: String(c.spotsTotal) })}`
                            : '')
                        : c.spotsLibres != null
                          ? t('operaciones.disponibilidad.libre-slots', { n: c.spotsLibres })
                          : t('operaciones.disponibilidad.libre'),
                      ...c.enPropuesta.map((x) =>
                        t('operaciones.disponibilidad.en-propuesta-titulo', {
                          folio: x.folio,
                          cliente: x.clienteNombre ? ` · ${x.clienteNombre}` : '',
                          desde: formatFecha(x.fechaInicio, idioma),
                          hasta: formatFecha(x.fechaFin, idioma),
                          spots: x.spots != null ? t('operaciones.disponibilidad.en-propuesta-spots', { n: x.spots }) : '',
                        }),
                      ),
                    ].join('\n')
                    return (
                      <td key={i} className="px-1 py-1 text-center">
                        <div
                          title={titulo}
                          className={cn(
                            'mx-auto flex h-8 min-w-[64px] items-center justify-center rounded border px-1 text-[11px] font-medium',
                            avisoPropuesta ? TONO_EN_PROPUESTA : TONO_CELDA[c.estado],
                          )}
                        >
                          {f.digital && c.spotsLibres != null
                            ? c.spotsLibres > 0
                              ? t(
                                  c.spotsLibres === 1
                                    ? 'operaciones.disponibilidad.celda.libres.uno'
                                    : 'operaciones.disponibilidad.celda.libres.otros',
                                  { n: c.spotsLibres },
                                )
                              : t('operaciones.disponibilidad.celda.lleno')
                            : c.estado === 'LIBRE'
                            ? avisoPropuesta
                              ? t('operaciones.disponibilidad.celda.en-propuesta')
                              : t('operaciones.disponibilidad.libre')
                            : f.digital
                              ? t('operaciones.disponibilidad.celda.usados', { n: c.spotsUsados })
                              : t('operaciones.disponibilidad.celda.ocupada')}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </CardColapsable>

      {/* Leyenda: los mismos cuatro estados que pinta la rejilla. «En propuesta»
          sustituye a «Tentativa» desde TENT-PROP (26/10). */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className={cn('inline-block h-3 w-4 rounded border', TONO_CELDA.LIBRE)} /> {t('operaciones.disponibilidad.leyenda.libre')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('inline-block h-3 w-4 rounded border', TONO_EN_PROPUESTA)} /> {t('operaciones.disponibilidad.leyenda.en-propuesta')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('inline-block h-3 w-4 rounded border', TONO_CELDA.PARCIAL)} /> {t('operaciones.disponibilidad.leyenda.parcial')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('inline-block h-3 w-4 rounded border', TONO_CELDA.OCUPADO)} /> {t('operaciones.disponibilidad.leyenda.ocupada')}
        </span>
      </div>
    </div>
  )
}
