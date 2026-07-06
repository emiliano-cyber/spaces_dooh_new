'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, Search, Info } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useDisponibilidad, type GranDisponibilidad, type EstadoCelda } from '@/lib/data/client'

// Calendario de disponibilidad futura: responde "¿qué tengo libre en septiembre?".
// Cruza reservas vigentes (tentativas + confirmadas) contra una rejilla de
// catorcenas o meses y pinta cada pantalla × periodo como libre / parcial / ocupado.

const selectCls =
  'h-9 rounded border border-border-strong bg-surface px-2.5 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

const TONO_CELDA: Record<EstadoCelda, string> = {
  LIBRE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PARCIAL: 'bg-amber-50 text-amber-700 border-amber-200',
  OCUPADO: 'bg-rose-50 text-rose-700 border-rose-200',
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

  // Resumen del primer periodo: cuántas pantallas quedan libres.
  const resumenPrimer = useMemo(() => {
    if (!disp || disp.periodos.length === 0) return null
    const libres = disp.filas.filter((f) => f.celdas[0]?.estado === 'LIBRE').length
    return { periodo: disp.periodos[0].label, libres, total: disp.filas.length }
  }, [disp])

  return (
    <div className="w-full space-y-4 p-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink">
          <CalendarRange className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-ink">Disponibilidad</h1>
          <p className="text-[13px] text-muted">
            Ocupación futura por catorcena o mes. Cruza reservas vigentes (tentativas y
            confirmadas) contra el inventario para ver qué tienes libre más adelante.
          </p>
        </div>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[12px] text-muted">
          Desde
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className={selectCls}
          />
        </label>

        <div className="flex flex-col gap-1 text-[12px] text-muted">
          Vista
          <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
            {(['catorcena', 'mes'] as GranDisponibilidad[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGran(g)}
                className={cn(
                  'rounded px-3 py-1.5 text-[13px] capitalize transition-colors duration-150',
                  gran === g ? 'bg-surface-2 font-medium text-ink' : 'text-muted hover:text-ink',
                )}
              >
                {g === 'catorcena' ? 'Catorcena' : 'Mes'}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1 text-[12px] text-muted">
          Periodos
          <select
            value={nPeriodos}
            onChange={(e) => setNPeriodos(Number(e.target.value))}
            className={selectCls}
          >
            {[4, 6, 8, 12].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[12px] text-muted">
          Buscar pantalla
          <span className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre o clave…"
              className={cn(selectCls, 'w-56 pl-7')}
            />
          </span>
        </label>

        <label className="flex items-center gap-2 pb-1.5 text-[13px] text-ink">
          <input
            type="checkbox"
            checked={soloDisponibles}
            onChange={(e) => setSoloDisponibles(e.target.checked)}
            className="h-3.5 w-3.5 accent-accent"
          />
          Solo con hueco libre
        </label>
      </div>

      {/* Resumen */}
      {resumenPrimer && (
        <p className="text-[13px] text-muted">
          <span className="font-medium text-ink">{resumenPrimer.libres}</span> de{' '}
          {resumenPrimer.total} pantallas libres en{' '}
          <span className="font-medium text-ink">{resumenPrimer.periodo}</span>.
        </p>
      )}

      {/* Rejilla */}
      {!disp ? (
        <div className="rounded-md border border-border bg-surface p-8 text-center text-[13px] text-muted">
          Cargando disponibilidad…
        </div>
      ) : filas.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-8 text-center text-[13px] text-muted">
          Sin pantallas que coincidan.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
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
                    <div className="text-[11px] text-muted">
                      {f.clave}
                      {f.digital && (
                        <span className="ml-1 rounded bg-surface-2 px-1 text-[10px] text-muted">
                          digital{f.totalSpots != null ? ` · ${f.totalSpots} slots` : ''}
                        </span>
                      )}
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
                            .join('\n')
                        : 'Libre'
                    return (
                      <td key={i} className="px-1 py-1 text-center">
                        <div
                          title={titulo}
                          className={cn(
                            'mx-auto flex h-8 min-w-[64px] items-center justify-center rounded border px-1 text-[11px] font-medium',
                            TONO_CELDA[c.estado],
                            soloTentativa && 'border-dashed',
                          )}
                        >
                          {c.estado === 'LIBRE'
                            ? '·'
                            : f.digital
                              ? `${c.spotsUsados}${c.spotsTotal != null ? `/${c.spotsTotal}` : ''}`
                              : soloTentativa
                                ? 'Tent.'
                                : 'Ocup.'}
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

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className={cn('inline-block h-3 w-4 rounded border', TONO_CELDA.LIBRE)} /> Libre
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('inline-block h-3 w-4 rounded border', TONO_CELDA.PARCIAL)} /> Parcial
          (digital con slots)
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('inline-block h-3 w-4 rounded border', TONO_CELDA.OCUPADO)} /> Ocupado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded border border-dashed border-rose-300" />{' '}
          Borde punteado = solo tentativa
        </span>
        <span className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" /> Las reservas tentativas caducan solas a los 7 días y
          liberan el inventario.
        </span>
      </div>
    </div>
  )
}
