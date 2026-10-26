'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, Search, Monitor, LayoutGrid, Clock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { SlotsBadge } from '@/components/demo/SlotsBadge'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { useDisponibilidad, type GranDisponibilidad, type EstadoCelda } from '@/lib/data/client'

// Calendario de disponibilidad futura: responde "¿qué tengo libre en septiembre?".
// Cruza reservas vigentes (tentativas + confirmadas) contra una rejilla de
// catorcenas o meses y pinta cada pantalla × periodo como libre / parcial / ocupado.

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
// Solo tentativas: ámbar con borde punteado. Antes llevaba el mismo rosa que
// «Ocupado» y solo lo distinguía el punteado. El texto ámbar es el oscuro del
// Dashboard (`text-warning` sobre su tinte no se lee a 11 px).
const TONO_TENTATIVA = 'bg-warning-soft text-[#9a6700] border-dashed border-warning'

function hoyISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export default function DisponibilidadPage() {
  // `desde` se fija en el cliente tras montar para no romper la hidratación.
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
    const t = busqueda.trim().toLowerCase()
    if (!t) return disp.filas
    return disp.filas.filter(
      (f) => f.nombre.toLowerCase().includes(t) || f.clave.toLowerCase().includes(t),
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
      periodo: disp.periodos[0].label,
      libres: estaticas.filter((f) => f.celdas[0]?.estado === 'LIBRE').length,
      estaticas: estaticas.length,
      digitales: digitales.length,
      slots: digitales.reduce((acc, f) => acc + (f.celdas[0]?.spotsLibres ?? 0), 0),
    }
  }, [disp])

  return (
    // Sin el `p-6` propio: el shell ya pone el margen, y con los dos esta
    // pantalla quedaba 17 px desalineada del resto y con margen doble en móvil.
    <div className="w-full space-y-5">
      {/* Encabezado con el patrón del Dashboard: título y una línea, sin icono. */}
      <div>
        <h1 className="text-2xl text-ink">Disponibilidad</h1>
        <p className="mt-1 text-[13px] text-muted">
          Ocupación futura por catorcena o mes: cruza las reservas vigentes (tentativas y
          confirmadas) contra el inventario para ver qué tienes libre más adelante.
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
                label="Estáticas libres"
                value={`${resumenPrimer.libres} de ${resumenPrimer.estaticas}`}
                sub={`en ${resumenPrimer.periodo}`}
                tono={resumenPrimer.libres > 0 ? 'verde' : 'neutro'}
                icon={<CalendarRange className="h-4 w-4" />}
              />
              <KPICard
                label="Digitales con lugar"
                value={String(resumenPrimer.digitales)}
                sub={`no llenas en ${resumenPrimer.periodo}`}
                tono="azul"
                icon={<Monitor className="h-4 w-4" />}
              />
              <KPICard
                label="Slots libres"
                value={resumenPrimer.digitales > 0 ? String(resumenPrimer.slots) : '—'}
                sub={
                  resumenPrimer.digitales > 0
                    ? 'sumando las digitales con lugar'
                    : 'ninguna digital con lugar en el periodo'
                }
                icon={<LayoutGrid className="h-4 w-4" />}
              />
              <KPICard
                label="Estáticas ocupadas o tentativas"
                value={String(resumenPrimer.estaticas - resumenPrimer.libres)}
                sub="las tentativas caducan solas a los 7 días y liberan el inventario"
                tono={resumenPrimer.estaticas - resumenPrimer.libres > 0 ? 'ambar' : 'neutro'}
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
          aria-label="Desde"
          title="Desde"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className={selectCls}
        />

        <div className="inline-flex rounded-md border border-border bg-surface p-0.5" role="group" aria-label="Vista">
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
              {g === 'catorcena' ? 'Catorcena' : 'Mes'}
            </button>
          ))}
        </div>

        <select
          aria-label="Periodos"
          title="Periodos a mostrar"
          value={nPeriodos}
          onChange={(e) => setNPeriodos(Number(e.target.value))}
          className={selectCls}
        >
          {[4, 6, 8, 12].map((v) => (
            <option key={v} value={v}>
              {v} periodos
            </option>
          ))}
        </select>

        <span className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            aria-label="Buscar pantalla"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar pantalla: nombre o clave…"
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
          Solo con hueco libre
        </label>
      </div>

      {/* Rejilla — plegable (pedido del 20/10). Los controles de arriba y la
          búsqueda viven en la página, fuera de la tarjeta: plegar no los pierde. */}
      <CardColapsable
        id="disponibilidad.calendario"
        titulo="Calendario por pantalla"
        subtitulo="Cada celda dice su estado; pasa el cursor para ver qué campaña la ocupa."
        contentClassName="px-0 pb-0"
      >
      {!disp ? (
        <div className="border-t border-border p-8 text-center text-[13px] text-muted">
          Cargando disponibilidad…
        </div>
      ) : filas.length === 0 ? (
        <div className="border-t border-border p-8 text-center text-[13px] text-muted">
          Sin pantallas que coincidan.
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 min-w-[220px] bg-surface px-3 py-2 text-left font-medium text-muted">
                  Pantalla
                </th>
                {disp.periodos.map((p) => (
                  <th
                    key={p.clave}
                    className="min-w-[76px] px-2 py-2 text-center font-medium text-muted"
                    title={`${p.inicio} → ${p.fin}`}
                  >
                    {p.label}
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
                        <span className="rounded bg-surface-2 px-1 text-[10px] text-muted">digital</span>
                      ) : null}
                      {/* Cuánto del horizonte visible está libre (patrón LMX),
                          contado de las celdas ya cargadas. */}
                      <span className="demo-num rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                        {f.celdas.filter((c) => c.estado === 'LIBRE').length} de {f.celdas.length} libres
                      </span>
                    </div>
                  </td>
                  {f.celdas.map((c, i) => {
                    const soloTentativa =
                      c.ocupantes.length > 0 && c.ocupantes.every((o) => o.estatus === 'TENTATIVA')
                    const titulo =
                      c.ocupantes.length > 0
                        ? c.ocupantes
                            .map(
                              (o) =>
                                `${o.campana} (${o.estatus === 'TENTATIVA' ? 'tentativa' : 'confirmada'}${
                                  o.spots != null ? `, ${o.spots} slots` : ''
                                })`,
                            )
                            .join('\n') +
                          (c.spotsLibres != null ? `\nQuedan ${c.spotsLibres} de ${c.spotsTotal} slots` : '')
                        : c.spotsLibres != null
                          ? `Libre: ${c.spotsLibres} slots`
                          : 'Libre'
                    return (
                      <td key={i} className="px-1 py-1 text-center">
                        <div
                          title={titulo}
                          className={cn(
                            'mx-auto flex h-8 min-w-[64px] items-center justify-center rounded border px-1 text-[11px] font-medium',
                            soloTentativa ? TONO_TENTATIVA : TONO_CELDA[c.estado],
                          )}
                        >
                          {f.digital && c.spotsLibres != null
                            ? c.spotsLibres > 0
                              ? `${c.spotsLibres} ${c.spotsLibres === 1 ? 'libre' : 'libres'}`
                              : 'Lleno'
                            : c.estado === 'LIBRE'
                            ? 'Libre'
                            : f.digital
                              ? `${c.spotsUsados} usados`
                              : soloTentativa
                                ? 'Tentativa'
                                : 'Ocupada'}
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

      {/* Leyenda: los mismos cuatro estados que pinta la rejilla. La nota de
          caducidad de las tentativas vive ahora en su tarjeta de arriba. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className={cn('inline-block h-3 w-4 rounded border', TONO_CELDA.LIBRE)} /> Libre
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('inline-block h-3 w-4 rounded border', TONO_TENTATIVA)} /> Tentativa
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('inline-block h-3 w-4 rounded border', TONO_CELDA.PARCIAL)} /> Parcial
          (digital: el número son los slots que quedan libres)
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('inline-block h-3 w-4 rounded border', TONO_CELDA.OCUPADO)} /> Ocupada
        </span>
      </div>
    </div>
  )
}
