'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, Loader2, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { telemetriaApi, type PuntoTelemetria, type Telemetria } from '@/lib/data/space-eyes-api'

// ============================================================================
//  Historial del equipo — batería y señal, por hora.
//
//  DOS GRÁFICAS Y NO UNA. Batería (0–100 %) y señal (−120 a −50 dBm) no
//  comparten escala, y meterlas en un eje doble es la forma más común de
//  mentir con una gráfica: cualquiera de las dos líneas puede quedar «arriba»
//  de la otra según dónde se pongan los topes, y el cruce que se ve no
//  significa nada. Dos gráficas apiladas comparten el eje del tiempo, que es lo
//  único que de verdad comparten.
//
//  EL EJE DE LA BATERÍA VA DE 0 A 100 SIEMPRE. Ajustarlo al mínimo del rango
//  convertiría una caída de 100% a 96% en un precipicio.
//
//  LOS HUECOS SE QUEDAN HUECOS. Si el equipo no reportó entre las 2 y las 6 de
//  la mañana, la línea se CORTA. Unir esos dos puntos dibujaría cuatro horas de
//  datos que nadie midió, y justo en las horas en que un equipo se muere.
//
//  SE PIDE AL ABRIR, no al pintar la ficha: es información secundaria y la
//  fotografía es lo que la gente viene a ver.
// ============================================================================

const RANGOS = [
  { horas: 24 as const, etiqueta: '24 h' },
  { horas: 168 as const, etiqueta: '7 d' },
  { horas: 720 as const, etiqueta: '30 d' },
]

// Los mismos umbrales con los que Space Eye levanta alertas. Si aquí fueran
// otros, la línea de peligro y el aviso se contradirían.
const BATERIA_MIN = 20
const SENAL_MIN = -105

export function Historial({ id }: { id: number }) {
  const [abierto, setAbierto] = useState(false)
  const [horas, setHoras] = useState<24 | 168 | 720>(24)
  const [datos, setDatos] = useState<Telemetria | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const traer = useCallback(async (h: 24 | 168 | 720) => {
    setCargando(true)
    setError(null)
    try {
      setDatos(await telemetriaApi(id, h))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el histórico')
    }
    setCargando(false)
  }, [id])

  useEffect(() => {
    if (abierto) void traer(horas)
  }, [abierto, horas, traer])

  const serie = datos?.serie ?? []
  const hayDatos = serie.some((p) => p.battery_pct != null || p.signal_dbm != null)

  return (
    <div className="rounded-md border border-border bg-surface">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-2 p-3 text-left"
      >
        <span className="flex-1 text-[11px] uppercase tracking-wide text-muted">
          Histórico del equipo
        </span>
        {cargando && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
        <ChevronDown className={cn('h-4 w-4 text-muted transition-transform', abierto && 'rotate-180')} />
      </button>

      {abierto && (
        <div className="border-t border-border p-3">
          {/* Los filtros, en una fila sobre las gráficas */}
          <div className="flex items-center gap-1.5">
            {RANGOS.map((r) => (
              <button
                key={r.horas}
                type="button"
                onClick={() => setHoras(r.horas)}
                className={cn(
                  'h-7 rounded-md border px-2.5 text-[12px]',
                  horas === r.horas
                    ? 'border-ink bg-ink text-bg'
                    : 'border-border-strong bg-surface text-ink hover:bg-surface-2',
                )}
              >
                {r.etiqueta}
              </button>
            ))}
            {datos?.muestras != null && (
              <span className="ml-auto text-[11px] text-muted">{datos.muestras} reportes</span>
            )}
          </div>

          {error ? (
            <p className="mt-3 text-[12px] text-muted">{error}</p>
          ) : !datos && cargando ? (
            <div className="mt-3 h-40 animate-pulse rounded-md bg-surface-2" />
          ) : !hayDatos ? (
            <p className="mt-3 text-[12px] text-muted">
              Este equipo no reportó nada en el rango elegido, así que no hay nada que dibujar. Prueba con un rango más
              amplio.
            </p>
          ) : (
            <>
              <Grafica
                titulo="Batería"
                unidad="%"
                serie={serie}
                valor={(p) => p.battery_pct}
                dominio={[0, 100]}
                umbral={BATERIA_MIN}
                umbralTexto="20% · batería baja"
                peorEs="min"
              />
              <Grafica
                titulo="Señal"
                unidad="dBm"
                serie={serie}
                valor={(p) => p.signal_dbm}
                dominio={[-120, -50]}
                umbral={SENAL_MIN}
                umbralTexto="−105 dBm · señal débil"
                peorEs="min"
                className="mt-4"
              />

              {/* Los avisos que ya calcula Space Eye. Icono + texto, nunca solo color */}
              {datos?.alertas && datos.alertas.length > 0 && (
                <ul className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3">
                  {datos.alertas.map((a, i) => (
                    <li key={`${a.type}-${i}`} className="flex items-start gap-2 text-[12px]">
                      {a.level === 'critical' ? (
                        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error" strokeWidth={1.9} />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" strokeWidth={1.9} />
                      )}
                      <span className="text-ink">{a.message}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Los mismos números, legibles sin ver la gráfica */}
              <details className="mt-3">
                <summary className="cursor-pointer text-[12px] text-muted hover:text-ink">Ver los datos</summary>
                <div className="mt-2 max-h-52 overflow-auto">
                  <table className="w-full text-[11px]">
                    <caption className="sr-only">Batería y señal por hora</caption>
                    <thead className="sticky top-0 bg-surface text-left text-muted">
                      <tr>
                        <th scope="col" className="py-1 pr-2 font-medium">Hora</th>
                        <th scope="col" className="py-1 pr-2 font-medium">Batería</th>
                        <th scope="col" className="py-1 font-medium">Señal</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums text-ink">
                      {serie.map((p) => (
                        <tr key={p.bucket} className="border-t border-border">
                          <td className="py-1 pr-2">{horaCorta(p.bucket, horas)}</td>
                          <td className="py-1 pr-2">{p.battery_pct != null ? `${p.battery_pct}%` : '—'}</td>
                          <td className="py-1">{p.signal_dbm != null ? `${p.signal_dbm} dBm` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Una gráfica: una serie, línea de 2px, umbral punteado y hueco donde falta ──
function Grafica({
  titulo,
  unidad,
  serie,
  valor,
  dominio,
  umbral,
  umbralTexto,
  peorEs,
  className,
}: {
  titulo: string
  unidad: string
  serie: PuntoTelemetria[]
  valor: (p: PuntoTelemetria) => number | null
  dominio: [number, number]
  umbral: number
  umbralTexto: string
  peorEs: 'min' | 'max'
  className?: string
}) {
  const [activo, setActivo] = useState<number | null>(null)

  const W = 600
  const H = 96
  const PAD_Y = 8

  const puntos = useMemo(() => serie.map(valor), [serie, valor])
  const conValor = puntos.filter((v): v is number => v != null)
  const ultimo = [...puntos].reverse().find((v): v is number => v != null) ?? null
  const peor = conValor.length
    ? peorEs === 'min'
      ? Math.min(...conValor)
      : Math.max(...conValor)
    : null

  const x = (i: number) => (serie.length <= 1 ? W / 2 : (i / (serie.length - 1)) * W)
  const y = (v: number) => {
    const [lo, hi] = dominio
    const t = (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)
    return H - PAD_Y - t * (H - PAD_Y * 2)
  }

  // Tramos: cada corte de datos abre uno nuevo, así la línea no cruza el hueco.
  const tramos: string[] = []
  let actual: string[] = []
  puntos.forEach((v, i) => {
    if (v == null) {
      if (actual.length > 1) tramos.push(actual.join(' '))
      actual = []
      return
    }
    actual.push(`${actual.length === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
  })
  if (actual.length > 1) tramos.push(actual.join(' '))
  // Un punto solo no dibuja línea: se marca con un círculo para que se vea.
  const sueltos = puntos
    .map((v, i) => ({ v, i }))
    .filter(({ v, i }) => v != null && puntos[i - 1] == null && puntos[i + 1] == null) as { v: number; i: number }[]

  const activoPunto = activo != null ? serie[activo] : null
  const activoValor = activo != null ? puntos[activo] : null

  return (
    <figure className={cn('m-0', className)}>
      <figcaption className="flex items-baseline gap-2">
        <span className="text-[12px] font-medium text-ink">{titulo}</span>
        <span className="text-[11px] text-muted">
          {peor != null ? `peor ${peor}${unidad === '%' ? '%' : ` ${unidad}`}` : 'sin dato'}
        </span>
        {ultimo != null && (
          <span className="ml-auto text-[12px] tabular-nums text-ink">
            {ultimo}
            {unidad === '%' ? '%' : ` ${unidad}`}
          </span>
        )}
      </figcaption>

      <div className="relative mt-1.5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block h-24 w-full touch-none"
          role="img"
          aria-label={`${titulo} por hora. Peor valor del rango: ${peor ?? 'sin dato'} ${unidad}.`}
          onMouseLeave={() => setActivo(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            const t = (e.clientX - r.left) / r.width
            setActivo(Math.max(0, Math.min(serie.length - 1, Math.round(t * (serie.length - 1)))))
          }}
        >
          {/* Suelo y techo, recesivos */}
          <line x1="0" y1={H - PAD_Y} x2={W} y2={H - PAD_Y} stroke="var(--border)" strokeWidth="1" />
          {/* El umbral: es un estado, y por eso lleva el color de aviso */}
          <line
            x1="0"
            y1={y(umbral)}
            x2={W}
            y2={y(umbral)}
            stroke="var(--warning)"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.65"
          />
          {tramos.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}
          {sueltos.map(({ v, i }) => (
            <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill="var(--accent)" />
          ))}
          {activo != null && activoValor != null && (
            <>
              <line x1={x(activo)} y1={PAD_Y} x2={x(activo)} y2={H - PAD_Y} stroke="var(--border-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <circle cx={x(activo)} cy={y(activoValor)} r="3.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>

        <span className="pointer-events-none absolute left-0 top-0 text-[10.5px] text-muted">{umbralTexto}</span>

        {activoPunto && activoValor != null && (
          <div
            className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-[11px] shadow-[0_2px_8px_rgba(28,22,18,.12)]"
            style={{ left: `${(x(activo!) / W) * 100}%` }}
          >
            <span className="tabular-nums text-ink">
              {activoValor}
              {unidad === '%' ? '%' : ` ${unidad}`}
            </span>
            <span className="ml-1.5 text-muted">{horaCorta(activoPunto.bucket, 24)}</span>
          </div>
        )}
      </div>
    </figure>
  )
}

// "14:00" en un día; "mar 14 h" en rangos largos, donde la hora suelta no ubica.
function horaCorta(bucket: string, horas: number): string {
  const d = new Date(bucket.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return bucket
  return horas <= 24
    ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit' })
}
