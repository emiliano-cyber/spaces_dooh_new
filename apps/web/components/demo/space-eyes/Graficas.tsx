'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  Download,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { ErrorSE, seApi, urlSE } from '@/lib/data/space-eyes-se'
import { estaEnLinea, PildoraConexion } from './piezas'

// ============================================================================
//  Space Eyes — Gráficas.
//
//  La telemetría histórica de UN equipo: temperaturas, batería, señal,
//  almacenamiento y memoria, más su consumo de datos (chip / WiFi). Es el
//  módulo «Gráficas» de Space Eye, portado tal cual: mismo endpoint, mismos
//  periodos, mismas alertas (las calcula Space Eye, aquí solo se enseñan).
//
//  Cada gráfica tiene SU eje: batería (0–100 %) y señal (dBm) no comparten
//  escala, y un eje doble haría que cualquier cruce pareciera significar algo.
//  Los umbrales de Space Eye se dibujan punteados en el color de aviso.
// ============================================================================

type Rango = '24h' | '7d' | '30d' | 'custom'

type Equipo = { id: number; name: string; online: boolean; last_seen_at: string | null }

type Alerta = { level: 'critical' | 'warning' | string; type: string; message: string; value: unknown }

type Punto = {
  bucket?: string
  reported_at?: string
  cpu_temp?: number | string | null
  battery_temp?: number | string | null
  battery_pct?: number | string | null
  signal_dbm?: number | string | null
  storage_free_mb?: number | string | null
  ram_free_mb?: number | string | null
}

type Umbrales = {
  cpu_temp_max: number
  battery_temp_max: number
  battery_pct_min: number
  signal_dbm_min: number
  storage_free_min_mb: number
}

type RespuestaTelemetria = {
  summary?: {
    cpu_temp_max?: number | string | null
    battery_pct_min?: number | string | null
    samples?: number | string | null
  }
  alerts?: Alerta[]
  series?: Punto[]
  thresholds?: Umbrales
}

type Consumo = Record<string, number | string | null>

type RespuestaEquipo = {
  device?: { online?: boolean; last_seen_at?: string | null }
  data_usage?: Consumo | null
}

type Datos = {
  resumen: NonNullable<RespuestaTelemetria['summary']>
  alertas: Alerta[]
  serie: Punto[]
  umbrales: Umbrales | null
  enLinea: boolean
  consumo: Consumo | null
  granularidad: 'raw' | 'hour'
}

const PERIODOS: { valor: Rango; etiqueta: string }[] = [
  { valor: '24h', etiqueta: 'Hoy (24 h)' },
  { valor: '7d', etiqueta: 'Semana' },
  { valor: '30d', etiqueta: 'Mes' },
  { valor: 'custom', etiqueta: 'Personalizado' },
]

const FILAS_CONSUMO: [string, string][] = [
  ['Hoy', 'today'],
  ['Semana', 'week'],
  ['Mes', 'month'],
  ['Total', 'total'],
]

// Colores: solo tokens del tema, como variables CSS (recharts las acepta).
const C = {
  borde: 'var(--border)',
  bordeFuerte: 'var(--border-strong)',
  texto: 'var(--muted)',
  acento: 'var(--accent)',
  exito: 'var(--success)',
  aviso: 'var(--warning)',
  error: 'var(--error)',
  tinta: 'var(--ink)',
}

const ejeTick = { fontSize: 11, fill: C.texto }

const H = 3600e3

function calcularRango(rango: Rango, desde: string, hasta: string) {
  const ahora = new Date()
  let from: Date
  let to = ahora
  let granularidad: 'raw' | 'hour' = 'raw'
  if (rango === '24h') from = new Date(ahora.getTime() - 24 * H)
  else if (rango === '7d') {
    from = new Date(ahora.getTime() - 7 * 24 * H)
    granularidad = 'hour'
  } else if (rango === '30d') {
    from = new Date(ahora.getTime() - 30 * 24 * H)
    granularidad = 'hour'
  } else {
    from = desde ? new Date(desde) : new Date(ahora.getTime() - 24 * H)
    to = hasta ? new Date(hasta) : ahora
    granularidad = to.getTime() - from.getTime() > 2 * 24 * H ? 'hour' : 'raw'
  }
  return { fromISO: from.toISOString(), toISO: to.toISOString(), granularidad }
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function fmtBytes(n: unknown): string {
  const b = num(n)
  if (b == null) return 'n/d'
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`
  return `${(b / 1073741824).toFixed(2)} GB`
}

function etiquetaTiempo(p: Punto, granularidad: 'raw' | 'hour'): string {
  const crudo = p.bucket ?? p.reported_at ?? ''
  const d = new Date(crudo.includes('T') ? crudo : crudo.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return crudo
  return granularidad === 'hour'
    ? d.toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit' })
    : d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

const mensajeError = (e: unknown, defecto: string) =>
  e instanceof ErrorSE ? e.message : e instanceof Error ? e.message : defecto

export function Graficas() {
  const [equipos, setEquipos] = useState<Equipo[] | null>(null)
  const [errorEquipos, setErrorEquipos] = useState<string | null>(null)
  const [equipoId, setEquipoId] = useState('')
  const [rango, setRango] = useState<Rango>('24h')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [datos, setDatos] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)
  const [errorCsv, setErrorCsv] = useState<string | null>(null)
  // Solo la última petición pinta: cambiar de equipo rápido no debe dejar en
  // pantalla los datos de uno anterior que contestó tarde.
  const peticion = useRef(0)

  const cargar = useCallback(async (id: string, r: Rango, d: string, h: string) => {
    if (!id) return
    const mia = ++peticion.current
    const { fromISO, toISO, granularidad } = calcularRango(r, d, h)
    setCargando(true)
    setError(null)
    try {
      const [tel, dev] = await Promise.all([
        seApi<RespuestaTelemetria>(
          `devices/${id}/telemetry?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&granularity=${granularidad}`,
        ),
        seApi<RespuestaEquipo>(`devices/${id}`),
      ])
      if (mia !== peticion.current) return
      setDatos({
        resumen: tel.summary ?? {},
        alertas: tel.alerts ?? [],
        serie: tel.series ?? [],
        umbrales: tel.thresholds ?? null,
        enLinea: estaEnLinea(!!dev.device?.online, dev.device?.last_seen_at ?? null),
        consumo: dev.data_usage ?? null,
        granularidad,
      })
    } catch (e) {
      if (mia !== peticion.current) return
      setError(mensajeError(e, 'No se pudo leer la telemetría'))
    }
    if (mia === peticion.current) setCargando(false)
  }, [])

  const cargarEquipos = useCallback(async () => {
    setErrorEquipos(null)
    try {
      const r = await seApi<{ devices?: Equipo[] }>('devices')
      const lista = r.devices ?? []
      setEquipos(lista)
      if (lista.length) {
        // Preseleccionar el primero en línea, o el primero.
        const enLinea = lista.find((d) => d.online)
        const id = String((enLinea ?? lista[0]).id)
        setEquipoId(id)
        void cargar(id, '24h', '', '')
      }
    } catch (e) {
      setErrorEquipos(mensajeError(e, 'No se pudo consultar Space Eyes'))
      setEquipos([])
    }
  }, [cargar])

  useEffect(() => {
    void cargarEquipos()
  }, [cargarEquipos])

  const cambiarEquipo = (id: string) => {
    setEquipoId(id)
    void cargar(id, rango, desde, hasta)
  }

  const cambiarRango = (r: Rango) => {
    setRango(r)
    if (r !== 'custom') void cargar(equipoId, r, desde, hasta)
  }

  const exportarCsv = async () => {
    if (!equipoId) return
    const { fromISO, toISO } = calcularRango(rango, desde, hasta)
    setExportando(true)
    setErrorCsv(null)
    try {
      const r = await fetch(
        urlSE(`devices/${equipoId}/telemetry/export?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`),
        { cache: 'no-store' },
      )
      if (!r.ok) throw new Error(`Space Eye respondió ${r.status}`)
      const blob = await r.blob()
      const equipo = equipos?.find((d) => String(d.id) === equipoId)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `telemetria_${(equipo?.name ?? 'equipo').replace(/\s+/g, '_')}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    } catch (e) {
      setErrorCsv(`No se pudo exportar el CSV. ${mensajeError(e, '')}`.trim())
    }
    setExportando(false)
  }

  const muestras = num(datos?.resumen.samples) ?? 0

  const puntos = useMemo(
    () =>
      (datos?.serie ?? []).map((p) => ({
        t: etiquetaTiempo(p, datos?.granularidad ?? 'raw'),
        cpu: num(p.cpu_temp),
        batTemp: num(p.battery_temp),
        bat: num(p.battery_pct),
        senal: num(p.signal_dbm),
        storage: num(p.storage_free_mb),
        ram: num(p.ram_free_mb),
      })),
    [datos],
  )

  const consumoBarras = useMemo(() => {
    const du = datos?.consumo
    if (!du) return []
    const mb = (v: unknown) => (num(v) ?? 0) / 1048576
    return FILAS_CONSUMO.map(([etiqueta, k]) => ({
      etiqueta,
      movil: Number(mb(du[`mobile_${k}`]).toFixed(1)),
      wifi: Number(mb(du[`wifi_${k}`]).toFixed(1)),
    }))
  }, [datos])

  const u = datos?.umbrales
  const cpuMax = num(datos?.resumen.cpu_temp_max)
  const batMin = num(datos?.resumen.battery_pct_min)

  return (
    <div className="w-full space-y-4 p-6">
      <Link href="/space-eyes" className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-ink">
        <ChevronLeft className="h-3.5 w-3.5" /> Space Eyes
      </Link>

      {/* Encabezado, el mismo patrón del listado */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink">
          <BarChart3 className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-ink">Gráficas</h1>
          <p className="text-[13px] text-muted">Estadísticas y telemetría de cada equipo: cómo ha estado y cuánto consume.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void cargar(equipoId, rango, desde, hasta)}
            disabled={cargando || !equipoId}
          >
            {cargando ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Actualizar
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void exportarCsv()} disabled={exportando || !equipoId}>
            {exportando ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            Exportar CSV
          </Button>
        </div>
      </div>

      {errorEquipos ? (
        <Aviso titulo="No se pudo consultar Space Eyes" texto={errorEquipos} />
      ) : equipos === null ? (
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded-md bg-surface-2" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-surface-2" />
            ))}
          </div>
        </div>
      ) : equipos.length === 0 ? (
        <div className="rounded-md border border-border bg-surface-2 px-3 py-10 text-center text-[13px] text-muted">
          Todavía no hay equipos Space Eyes dados de alta para esta cuenta.
        </div>
      ) : (
        <>
          {/* Filtros */}
          <div className="rounded-md border border-border bg-surface p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Campo etiqueta="Dispositivo" htmlFor="gr-equipo">
                <select
                  id="gr-equipo"
                  value={equipoId}
                  onChange={(e) => cambiarEquipo(e.target.value)}
                  className={claseControl}
                >
                  {equipos.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.name}
                      {d.online ? '' : ' · sin conexión'}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Periodo" htmlFor="gr-periodo">
                <select
                  id="gr-periodo"
                  value={rango}
                  onChange={(e) => cambiarRango(e.target.value as Rango)}
                  className={claseControl}
                >
                  {PERIODOS.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.etiqueta}
                    </option>
                  ))}
                </select>
              </Campo>
              {rango === 'custom' && (
                <>
                  <Campo etiqueta="Desde" htmlFor="gr-desde">
                    <input
                      id="gr-desde"
                      type="datetime-local"
                      value={desde}
                      onChange={(e) => setDesde(e.target.value)}
                      className={claseControl}
                    />
                  </Campo>
                  <Campo etiqueta="Hasta" htmlFor="gr-hasta">
                    <input
                      id="gr-hasta"
                      type="datetime-local"
                      value={hasta}
                      onChange={(e) => setHasta(e.target.value)}
                      className={claseControl}
                    />
                  </Campo>
                  <div className="flex items-end">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void cargar(equipoId, rango, desde, hasta)}
                      disabled={cargando}
                    >
                      Aplicar
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          {errorCsv && <Aviso titulo="Exportación fallida" texto={errorCsv} />}

          {error ? (
            <Aviso titulo="No se pudo leer la telemetría" texto={error} />
          ) : !datos ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-surface-2" />
              ))}
            </div>
          ) : (
            <div className={cn('space-y-4 transition-opacity', cargando && 'opacity-60')}>
              {/* Estado */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-md border border-border bg-surface p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted">Estado</div>
                  <PildoraConexion online={datos.enLinea} className="mt-1.5" />
                </div>
                <Indicador
                  titulo="Temp CPU máx"
                  valor={cpuMax != null ? `${cpuMax.toFixed(1)} °C` : 'n/d'}
                  alerta={cpuMax != null && u != null && cpuMax > u.cpu_temp_max}
                />
                <Indicador
                  titulo="Batería mín"
                  valor={batMin != null ? `${batMin} %` : 'n/d'}
                  alerta={batMin != null && u != null && batMin < u.battery_pct_min}
                />
                <Indicador titulo="Muestras" valor={String(muestras)} />
              </div>

              {/* Alertas: icono + texto, nunca solo color */}
              {datos.alertas.length > 0 && (
                <ul className="space-y-1.5">
                  {datos.alertas.map((a, i) => (
                    <li
                      key={`${a.type}-${i}`}
                      className={cn(
                        'flex items-start gap-2 rounded-md px-3 py-2 text-[13px] text-ink',
                        a.level === 'critical' ? 'bg-error-soft' : 'bg-warning-soft',
                      )}
                    >
                      {a.level === 'critical' ? (
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-error" strokeWidth={1.9} />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.9} />
                      )}
                      <span>{a.message}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Consumo de datos */}
              <section className="rounded-md border border-border bg-surface p-4">
                <h2 className="text-sm font-semibold text-ink">Consumo de datos (chip / WiFi)</h2>
                {!datos.consumo ? (
                  <p className="mt-2 text-[13px] text-muted">
                    Sin datos de consumo (requiere la app v0.7.0 en el equipo).
                  </p>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={consumoBarras} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                        <CartesianGrid stroke={C.borde} vertical={false} />
                        <XAxis dataKey="etiqueta" tick={ejeTick} tickLine={false} axisLine={{ stroke: C.borde }} />
                        <YAxis tick={ejeTick} tickLine={false} axisLine={false} />
                        <Tooltip content={<CajaTooltip unidad="MB" />} cursor={{ fill: 'var(--surface-2)' }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
                        <Bar dataKey="movil" name="Móvil (MB)" fill={C.acento} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="wifi" name="WiFi (MB)" fill={C.exito} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <table className="self-center text-[13px]">
                      <caption className="sr-only">Consumo de datos por periodo</caption>
                      <thead>
                        <tr className="text-[12px] text-muted">
                          <th scope="col" className="pb-1 text-left font-medium">
                            <span className="sr-only">Periodo</span>
                          </th>
                          <th scope="col" className="pb-1 text-right font-medium">Móvil</th>
                          <th scope="col" className="pb-1 text-right font-medium">WiFi</th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {FILAS_CONSUMO.map(([etiqueta, k]) => (
                          <tr key={k} className="border-t border-border">
                            <th scope="row" className="py-1.5 text-left font-normal text-muted">{etiqueta}</th>
                            <td className="py-1.5 text-right font-medium text-ink">
                              {fmtBytes(datos.consumo?.[`mobile_${k}`])}
                            </td>
                            <td className="py-1.5 text-right text-ink">{fmtBytes(datos.consumo?.[`wifi_${k}`])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Gráficas de telemetría */}
              {muestras > 0 && puntos.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Tarjeta titulo="Temperatura (CPU / batería)">
                    <GraficaLinea
                      datos={puntos}
                      unidad="°C"
                      series={[
                        { clave: 'cpu', nombre: 'Temp CPU °C', color: C.error },
                        { clave: 'batTemp', nombre: 'Temp batería °C', color: C.aviso },
                      ]}
                      umbral={u?.cpu_temp_max}
                    />
                  </Tarjeta>
                  <Tarjeta titulo="Nivel de batería">
                    <GraficaLinea
                      datos={puntos}
                      unidad="%"
                      dominio={[0, 100]}
                      series={[{ clave: 'bat', nombre: 'Batería %', color: C.exito }]}
                      umbral={u?.battery_pct_min}
                    />
                  </Tarjeta>
                  <Tarjeta titulo="Intensidad de señal">
                    <GraficaLinea
                      datos={puntos}
                      unidad="dBm"
                      series={[{ clave: 'senal', nombre: 'Señal dBm', color: C.acento }]}
                      umbral={u?.signal_dbm_min}
                    />
                  </Tarjeta>
                  <Tarjeta titulo="Almacenamiento y memoria libres">
                    <GraficaLinea
                      datos={puntos}
                      unidad="MB"
                      series={[
                        { clave: 'storage', nombre: 'Storage MB', color: C.acento },
                        { clave: 'ram', nombre: 'RAM MB', color: C.tinta, punteada: true },
                      ]}
                      umbral={u?.storage_free_min_mb}
                    />
                  </Tarjeta>
                </div>
              ) : (
                <p className="rounded-md border border-border bg-surface-2 px-3 py-10 text-center text-[13px] text-muted">
                  Sin telemetría en el periodo seleccionado para este dispositivo.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const claseControl =
  'h-9 w-full rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

function Campo({ etiqueta, htmlFor, children }: { etiqueta: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-[12px] text-muted">
        {etiqueta}
      </label>
      {children}
    </div>
  )
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-error-soft p-3 text-[12px]">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
      <div>
        <div className="font-medium text-ink">{titulo}</div>
        <div className="text-muted">{texto}</div>
      </div>
    </div>
  )
}

function Indicador({ titulo, valor, alerta = false }: { titulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted">{titulo}</div>
      <div className={cn('mt-1.5 text-lg font-semibold leading-none tabular-nums', alerta ? 'text-error' : 'text-ink')}>
        {valor}
      </div>
    </div>
  )
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <h2 className="mb-2 text-[13px] font-medium text-ink">{titulo}</h2>
      {children}
    </section>
  )
}

type PuntoGrafica = Record<string, string | number | null>

function GraficaLinea({
  datos,
  series,
  unidad,
  dominio,
  umbral,
}: {
  datos: PuntoGrafica[]
  series: { clave: string; nombre: string; color: string; punteada?: boolean }[]
  unidad: string
  dominio?: [number, number]
  umbral?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={datos} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={C.borde} vertical={false} />
        <XAxis
          dataKey="t"
          tick={ejeTick}
          tickLine={false}
          axisLine={{ stroke: C.borde }}
          minTickGap={24}
        />
        <YAxis
          tick={ejeTick}
          tickLine={false}
          axisLine={false}
          domain={dominio ?? ['auto', 'auto']}
          width={48}
        />
        <Tooltip content={<CajaTooltip unidad={unidad} />} cursor={{ stroke: C.bordeFuerte }} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
        {umbral != null && (
          <ReferenceLine y={umbral} stroke={C.aviso} strokeDasharray="4 4" strokeOpacity={0.7} ifOverflow="hidden" />
        )}
        {series.map((s) => (
          <Line
            key={s.clave}
            type="monotone"
            dataKey={s.clave}
            name={s.nombre}
            stroke={s.color}
            strokeWidth={1.75}
            strokeDasharray={s.punteada ? '5 3' : undefined}
            dot={false}
            activeDot={{ r: 3, fill: s.color }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function CajaTooltip({ active, payload, label, unidad }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border border-border bg-surface px-2.5 py-1.5 text-[12px]">
      <div className="text-muted">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-1.5 tabular-nums text-ink">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted">{p.name}:</span>
          <span className="font-medium">
            {p.value == null ? '—' : Number(p.value).toLocaleString('es-MX', { maximumFractionDigits: 1 })} {unidad}
          </span>
        </div>
      ))}
    </div>
  )
}
