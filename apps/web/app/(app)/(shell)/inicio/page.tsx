'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  TrendingUp,
  Wallet,
  Gauge,
  HandCoins,
  AlertTriangle,
  ArrowRight,
  SlidersHorizontal,
  Check,
  Trophy,
  Briefcase,
  Target,
} from 'lucide-react'
import { useAlertasVisibles, TIPOS_ALERTA } from '@/lib/alertas-visibles'
import { formatNumero } from '@/lib/formato-numero'
import { conteo } from '@/lib/plural'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { OcupacionChart } from '@/components/demo/charts'
import { MapView, type MapPoint } from '@/components/demo/MapView'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { type Tono } from '@/components/demo/StatusBadge'
import { itemsEnPropuesta } from '@/lib/data/en-propuesta'
import { cn } from '@/lib/cn'
import { usePuede, useSesionCtx } from '@/components/demo/shell/SesionContext'
import {
  consultaPnlDelMes,
  consultaPrecioDelMes,
  pnlDesdeRespuesta,
  rutaReportesDelMes,
  type PnlDelMes,
} from '@/components/demo/inicio/pnl-del-mes'
import {
  antiguedadCobranza,
  pipelineComercial,
  huecosProximos,
  ordenarAlertas,
  tonoPinHoy,
  precioDesdeRespuesta,
  VENTANA_HUECOS_DIAS,
  VENTANA_TASA_DIAS,
  type PrecioDelMes,
} from '@/components/demo/inicio/indicadores'
import {
  useDashboard,
  useOcupacionSerie,
  useSitios,
  useCampanas,
  useClientes,
  useReservas,
  usePropuestas,
  useFacturas,
  useCobranzas,
  useUsuarios,
  useConfigNegocio,
  formatMonto,
  formatFecha,
  type Granularidad,
} from '@/lib/data/client'

function margenTono(pct: number): Tono {
  if (pct >= 30) return 'verde'
  if (pct >= 10) return 'neutro'
  return 'rojo'
}

// Una consulta al motor de Reportes para el mes en curso, traducida a lo que se
// pinta. El ingreso y el margen salen de aquí desde DASH-PERIODO (26/10) y la
// tarifa cobrada desde DASH-REF: ver `components/demo/inicio/pnl-del-mes.ts`.
//
// `url` null = no se pide: el rol no ve Finanzas y el endpoint le contestaría
// 403 (dos errores rojos en la consola de cada vendedor, visto al sembrar la
// demo el 26/10). Su tablero no pinta estas cifras de todos modos.
function useDelMotor<T>(url: string | null, traducir: (status: number, cuerpo: unknown) => T, inicial: T): T {
  const [v, setV] = useState<T>(inicial)
  useEffect(() => {
    if (!url) return
    const control = new AbortController()
    void (async () => {
      try {
        const r = await fetch(url, { cache: 'no-store', signal: control.signal })
        // `catch` propio: detrás de nginx un 500 puede venir en HTML.
        const cuerpo = await r.json().catch(() => null)
        if (!control.signal.aborted) setV(traducir(r.status, cuerpo))
      } catch {
        if (!control.signal.aborted) setV(traducir(0, null))
      }
    })()
    return () => control.abort()
    // `url` cambia solo al cambiar de mes; `traducir` es una función de módulo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])
  return v
}

const GRANS: { value: Granularidad; label: string }[] = [
  { value: 'dia', label: 'Día' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
]

// Cuántas alertas se ven antes de «Ver todas». Antes era un corte duro en 6 sin
// forma de ver el resto.
const ALERTAS_A_LA_VISTA = 6
const HUECOS_A_LA_VISTA = 8

export default function DashboardPage() {
  const m = useDashboard()
  const sitios = useSitios()
  const [gran, setGran] = useState<Granularidad>('semana')
  const serie = useOcupacionSerie(gran)
  const campanas = useCampanas()
  const clientes = useClientes()
  const reservas = useReservas()
  const propuestas = usePropuestas()
  const facturas = useFacturas()
  const cobranzas = useCobranzas()
  const usuarios = useUsuarios()
  const cfg = useConfigNegocio()
  const alertasCfg = useAlertasVisibles()
  const [todasLasAlertas, setTodasLasAlertas] = useState(false)
  const [todosLosHuecos, setTodosLosHuecos] = useState(false)

  const hoy = useMemo(() => new Date(), [])
  const mesActual = hoy.toLocaleDateString('es-MX', { month: 'long' })
  // ─── Por rol (DASH-REF, punto 2) ──────────────────────────────────────────
  // Sin `finanzas:ver`, `/api/estado` le manda vacías las cobranzas, los
  // contratos y las facturas, y el motor de Reportes le contesta 403. Enseñarle
  // esas tarjetas en cero sería mentirle: a VENTAS se le pinta su tablero
  // —pipeline, lo ganado y su tasa de cierre— y a DIRECCIÓN el de dinero.
  const veFinanzas = usePuede('finanzas', 'ver')
  const pnl = useDelMotor<PnlDelMes>(veFinanzas ? consultaPnlDelMes(hoy) : null, pnlDesdeRespuesta, { fase: 'cargando' })
  const precio = useDelMotor<PrecioDelMes>(veFinanzas ? consultaPrecioDelMes(hoy) : null, precioDesdeRespuesta, { fase: 'cargando' })

  const subtitulo = [
    cfg?.razonSocial ? `Razón social: ${cfg.razonSocial}` : null,
    cfg?.nombreComercial ? `Nombre comercial: ${cfg.nombreComercial}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  // TENT-PROP (26/10) · lo tentativo: lo que piden las propuestas abiertas.
  const enVeremos = useMemo(() => itemsEnPropuesta(propuestas ?? [], clientes ?? []), [propuestas, clientes])

  const puntos: MapPoint[] =
    sitios?.map((s) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      tono: tonoPinHoy(s, reservas ?? [], hoy, enVeremos),
      label: s.nombre,
    })) ?? []

  const yo = useSesionCtx().sesion?.usuario ?? null
  const pipeline = useMemo(
    () => (propuestas ? pipelineComercial(propuestas, usuarios ?? [], hoy, yo) : null),
    [propuestas, usuarios, hoy, yo],
  )
  const antiguedad = useMemo(
    () => (cobranzas && facturas ? antiguedadCobranza(cobranzas, facturas, hoy) : null),
    [cobranzas, facturas, hoy],
  )
  const huecos = useMemo(
    () =>
      sitios && reservas && campanas && clientes
        ? huecosProximos({ sitios, reservas, campanas, clientes, enPropuesta: enVeremos }, hoy)
        : null,
    [sitios, reservas, campanas, clientes, enVeremos, hoy],
  )

  const tasa = pipeline?.tasaCierre == null ? '—' : `${Math.round(pipeline.tasaCierre * 100)}%`

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="text-2xl text-ink">Dashboard</h1>
        {subtitulo && <p className="mt-1 text-[13px] text-muted">{subtitulo}</p>}
      </div>

      {/* KPIs — 4 columnas solo desde xl (1280px). Entre 1024 y 1279 el sidebar
          se come 240px y cada tarjeta quedaba en ~235px, demasiado angosta para
          un monto de 14 caracteres en mono; ahí van 2 columnas. */}
      <CardColapsable id="inicio.indicadores" titulo="Indicadores del mes" contentClassName="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!m || !pipeline ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            {veFinanzas ? (
              // Ingreso y margen DEL MES, del motor de Reportes. Con error se
              // dice, con una raya: un cero afirmaría un mes sin ventas.
              pnl.fase === 'cargando' ? (
                <>
                  <KPICardSkeleton />
                  <KPICardSkeleton />
                </>
              ) : pnl.fase === 'datos' ? (
                <>
                  <KPICard
                    label={`Ingreso de ${mesActual}`}
                    value={formatMonto(pnl.totales.ingreso)}
                    sub="lo que se devenga este mes, prorrateado por días"
                    tono="azul"
                    icon={<TrendingUp className="h-4 w-4" />}
                  />
                  <KPICard
                    label={`Margen de ${mesActual}`}
                    value={pnl.totales.margenBrutoPct == null ? '—' : `${pnl.totales.margenBrutoPct.toFixed(0)}%`}
                    sub={`${formatMonto(pnl.totales.margenBruto)} · costo ${formatMonto(pnl.totales.costoTotal)}`}
                    tono={pnl.totales.margenBrutoPct == null ? 'neutro' : margenTono(pnl.totales.margenBrutoPct)}
                    icon={<Wallet className="h-4 w-4" />}
                  />
                </>
              ) : (
                <>
                  <KPICard label={`Ingreso de ${mesActual}`} value="—" sub={pnl.fase === 'sin-acceso' ? 'requiere permiso de Finanzas' : 'no se pudo calcular'} icon={<TrendingUp className="h-4 w-4" />} />
                  <KPICard label={`Margen de ${mesActual}`} value="—" sub={pnl.fase === 'sin-acceso' ? 'requiere permiso de Finanzas' : 'no se pudo calcular'} icon={<Wallet className="h-4 w-4" />} />
                </>
              )
            ) : (
              <>
                <KPICard
                  label="Pipeline abierto"
                  value={formatMonto(pipeline.abierto.valor)}
                  sub={`${conteo(pipeline.abierto.n, 'propuesta', 'propuestas')} · ${pipeline.abierto.enviadas} enviada${pipeline.abierto.enviadas === 1 ? '' : 's'}`}
                  tono="ambar"
                  icon={<Briefcase className="h-4 w-4" />}
                />
                <KPICard
                  label="Tasa de cierre"
                  value={tasa}
                  sub={`aprobadas de las decididas en ${VENTANA_TASA_DIAS} días`}
                  icon={<Target className="h-4 w-4" />}
                />
              </>
            )}
            <KPICard
              label={`Ganado en ${mesActual}`}
              value={formatMonto(pipeline.ganadoMes.valor)}
              sub={conteo(pipeline.ganadoMes.n, 'propuesta aprobada', 'propuestas aprobadas')}
              tono="verde"
              icon={<Trophy className="h-4 w-4" />}
            />
            {/* % ponderado por capacidad: cada slot de una digital y cada cara
                de una fija cuentan como un espacio. El subtítulo lleva el dato
                crudo (espacios) y el reparto digital/fija, porque un mismo % se
                lee muy distinto si viene de slots o de espectaculares. */}
            <KPICard
              label="Ocupación de la red"
              value={`${m.ocupacionPct.toFixed(0)}%`}
              sub={`${formatNumero(m.espaciosOcupados)} de ${formatNumero(m.capacidadRed)} espacios · digital ${formatNumero(m.ocupacionDigitales.ocupados)}/${formatNumero(m.ocupacionDigitales.capacidad)} · fijas ${formatNumero(m.ocupacionFijas.ocupados)}/${formatNumero(m.ocupacionFijas.capacidad)}`}
              tono="azul"
              icon={<Gauge className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      {/* Desglose del costo del mes: las tres fuentes del motor de Reportes
          (renta, operación y luz) y, aparte, la impresión, que ese motor no
          cuenta y por eso NO entra en el total ni en el margen. Detrás, las dos
          medidas del sector que el motor ya sabe dar: la renta como parte del
          ingreso y cuánto de la tarifa publicada se cobra. */}
      {m && veFinanzas && pnl.fase === 'datos' && (
        <div className="space-y-1.5 rounded-md border border-border bg-surface-2 px-4 py-2 text-[12px]">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="font-medium text-ink">Costos de {mesActual}</span>
            <CostoItem label="Renta" valor={formatMonto(pnl.totales.costoEspacio)} />
            <CostoItem label="Operación" valor={formatMonto(pnl.totales.costoOperacion)} />
            <CostoItem label="Luz" valor={formatMonto(pnl.totales.costoEnergia)} />
            <CostoItem label="Total" valor={formatMonto(pnl.totales.costoTotal)} fuerte />
            <CostoItem label="Impresión (aparte)" valor={formatMonto(m.costoImpresionMes)} />
            <Link href={rutaReportesDelMes(hoy)} className="ml-auto text-accent hover:underline">
              Ver por pantalla
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="font-medium text-ink">Rendimiento</span>
            <CostoItem
              label="Renta / ingreso"
              valor={pnl.totales.ingreso > 0 ? `${Math.round((pnl.totales.costoEspacio / pnl.totales.ingreso) * 100)}%` : '—'}
            />
            <CostoItem
              label="Tarifa publicada cobrada"
              valor={precio.fase === 'datos' ? `${precio.pct}%` : '—'}
            />
            <span className="text-muted">
              {precio.fase === 'datos'
                ? `de ${conteo(precio.conTarifa, 'venta con tarifa publicada', 'ventas con tarifa publicada')}${precio.sinTarifa ? ` · ${precio.sinTarifa} sin tarifa con qué comparar` : ''}`
                : precio.fase === 'sin-datos'
                  ? 'sin ventas con tarifa publicada este mes'
                  : precio.fase === 'cargando'
                    ? ''
                    : 'no se pudo calcular'}
            </span>
          </div>
        </div>
      )}
      </CardColapsable>

      {/* Ocupación + Pipeline comercial */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <CardColapsable
          id="inicio.ocupacion"
          titulo="Ocupación"
          className="lg:col-span-2"
          subtitulo={
            serie ? (
              <>
                {formatNumero(serie.diasOcupados)} espacios·día ocupados de{' '}
                {formatNumero(serie.diasDisponibles)} disponibles
              </>
            ) : undefined
          }
          accion={<Segmented value={gran} onChange={setGran} />}
        >
            {!serie ? (
              <div className="h-[180px] animate-pulse rounded bg-surface-2" />
            ) : (
              <OcupacionChart puntos={serie.puntos} />
            )}
        </CardColapsable>

        {/* Sustituye a «Tentativas vs confirmadas», que comparaba propuestas
            abiertas contra el acumulado HISTÓRICO de reservas. */}
        <CardColapsable
          id="inicio.pipeline"
          titulo="Pipeline comercial"
          accion={
            <Link href="/propuestas" className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline">
              Propuestas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {!pipeline ? (
            <div className="h-[150px] animate-pulse rounded bg-surface-2" />
          ) : (
            <div className="space-y-3 text-[12px]">
              <div className="grid grid-cols-2 gap-3">
                <Dato label="Abierto" valor={formatMonto(pipeline.abierto.valor)} sub={conteo(pipeline.abierto.n, 'propuesta', 'propuestas')} />
                <Dato label={`Ganado en ${mesActual}`} valor={formatMonto(pipeline.ganadoMes.valor)} sub={conteo(pipeline.ganadoMes.n, 'aprobada', 'aprobadas')} />
                <Dato label="Tasa de cierre" valor={tasa} sub={`últimos ${VENTANA_TASA_DIAS} días`} />
              </div>
              <div>
                <div className="mb-1 font-medium text-ink">Ganado por vendedor</div>
                {pipeline.porVendedor.length === 0 ? (
                  <p className="text-muted">Nada aprobado en {mesActual} todavía.</p>
                ) : (
                  <ul className="space-y-1">
                    {pipeline.porVendedor.map((v) => (
                      <li key={v.nombre} className="flex items-center justify-between gap-2">
                        <span className="truncate text-ink">{v.nombre}</span>
                        <span className="demo-num shrink-0 text-muted">
                          {formatMonto(v.valor)} · {v.n}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </CardColapsable>
      </div>

      {/* Alertas + Huecos y renovaciones */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <CardColapsable id="inicio.alertas" titulo="Alertas" accion={<ConfigAlertas cfg={alertasCfg} />}>
            {(() => {
              if (!m) return <div className="h-32 animate-pulse rounded bg-surface-2" />
              // Solo los tipos encendidos, y las ROJAS primero: antes salían en
              // el orden en que se generan —rentas, contratos, licencias,
              // cobranza, incidencias, OT— y se cortaban en 6, así que las de
              // renta empujaban fuera una factura vencida o una OT fuera de plazo.
              const visibles = ordenarAlertas(m.alertas.filter((al) => alertasCfg.esVisible(al.tipo)))
              if (visibles.length === 0) {
                return (
                  <p className="text-[13px] text-muted">
                    {m.alertas.length === 0
                      ? 'Sin alertas activas.'
                      : 'No hay alertas de los tipos que elegiste mostrar.'}
                  </p>
                )
              }
              const rojas = visibles.filter((a) => a.nivel === 'rojo').length
              const porTipo = TIPOS_ALERTA.map((t) => ({ ...t, n: visibles.filter((a) => a.tipo === t.tipo).length })).filter((t) => t.n > 0)
              const mostradas = todasLasAlertas ? visibles : visibles.slice(0, ALERTAS_A_LA_VISTA)
              return (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {rojas > 0 && (
                    <span className="rounded-full border border-[#ef444440] px-2 py-0.5 font-medium text-error">
                      {conteo(rojas, 'urgente', 'urgentes')}
                    </span>
                  )}
                  {porTipo.map((t) => (
                    <span key={t.tipo} className="rounded-full border border-border px-2 py-0.5 text-muted">
                      {t.label} · {t.n}
                    </span>
                  ))}
                </div>
                <ul className="space-y-2.5">
                  {mostradas.map((al) => (
                    <li key={al.id} className="flex items-start gap-2.5">
                      <AlertTriangle
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0',
                          al.nivel === 'rojo' ? 'text-error' : 'text-warning',
                        )}
                        strokeWidth={1.75}
                      />
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-ink">{al.titulo}</div>
                        <div className="text-[12px] text-muted">{al.detalle}</div>
                      </div>
                    </li>
                  ))}
                </ul>
                {visibles.length > ALERTAS_A_LA_VISTA && (
                  <button
                    type="button"
                    onClick={() => setTodasLasAlertas((v) => !v)}
                    className="text-[12px] font-medium text-info hover:underline"
                  >
                    {todasLasAlertas ? 'Ver menos' : `Ver todas (${visibles.length})`}
                  </button>
                )}
              </div>
              )
            })()}
        </CardColapsable>

        {/* Sustituye a «Campañas por finalizar»: no basta con saber que una
            campaña termina, hay que saber que la cara se queda VACÍA y a quién
            ofrecerle renovar. Ver `huecosProximos`. */}
        <CardColapsable
          id="inicio.huecos"
          titulo="Huecos y renovaciones"
          className="lg:col-span-2"
          subtitulo={`lo que se queda sin campaña en los próximos ${VENTANA_HUECOS_DIAS} días`}
        >
          {!huecos ? (
            <div className="h-20 animate-pulse rounded bg-surface-2" />
          ) : huecos.length === 0 ? (
            <p className="text-[13px] text-muted">
              Nada se queda libre en los próximos {VENTANA_HUECOS_DIAS} días.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {(todosLosHuecos ? huecos : huecos.slice(0, HUECOS_A_LA_VISTA)).map((h) => (
                  <li key={`${h.sitioId}-${h.campanaId}-${h.fechaFin}`} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] text-ink">
                        {h.sitioNombre}
                        <span className="text-muted">
                          {' · '}
                          {h.digital ? (h.slots ? `${h.slots} slot${h.slots === 1 ? '' : 's'} libre${h.slots === 1 ? '' : 's'}` : 'slots libres') : 'cara libre'}
                        </span>
                      </div>
                      <div className="demo-num truncate text-[11px] text-muted">
                        Sale {h.clienteNombre ?? 'sin cliente'} ·{' '}
                        <Link href={`/campanas/${h.campanaId}`} className="hover:underline">
                          {h.campanaNombre}
                        </Link>
                        {' · '}termina {formatFecha(h.fechaFin)}
                      </div>
                      {/* TENT-PROP: quién ya la está pidiendo. No cierra el hueco
                          (una propuesta puede no cerrarse), pero dice a quién llamar. */}
                      {h.enPropuesta.length > 0 && (
                        <div className="truncate text-[11px] text-[#9a6700]">En propuesta: {h.enPropuesta.join(', ')}</div>
                      )}
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full border px-2 py-0.5 text-[12px] font-medium',
                        h.dias <= 7 ? 'border-[#ef444440] text-error' : 'border-[#f59e0b40] text-[#9a6700]',
                      )}
                    >
                      {h.dias === 0 ? 'hoy' : `en ${h.dias} d`}
                    </span>
                  </li>
                ))}
              </ul>
              {huecos.length > HUECOS_A_LA_VISTA && (
                <button
                  type="button"
                  onClick={() => setTodosLosHuecos((v) => !v)}
                  className="mt-2 text-[12px] font-medium text-info hover:underline"
                >
                  {todosLosHuecos ? 'Ver menos' : `Ver todos (${huecos.length})`}
                </button>
              )}
            </>
          )}
        </CardColapsable>
      </div>

      {/* Cobranza por antigüedad (solo quien ve Finanzas) + mapa */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        {veFinanzas && (
          <CardColapsable
            id="inicio.cobranza"
            titulo="Por cobrar por antigüedad"
            accion={
              <Link href="/finanzas" className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline">
                Finanzas <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {!antiguedad ? (
              <div className="h-32 animate-pulse rounded bg-surface-2" />
            ) : antiguedad.total === 0 ? (
              <p className="text-[13px] text-muted">No hay saldos por cobrar.</p>
            ) : (
              <div className="space-y-3 text-[12px]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <HandCoins className="h-4 w-4" /> Total
                  </span>
                  <span className="demo-num text-[18px] text-ink">{formatMonto(antiguedad.total)}</span>
                </div>
                {/* Una barra por tramo, un solo color: es una comparación de
                    magnitudes, no de categorías. La etiqueta y el monto van en
                    texto, así que el color no carga el significado. */}
                <ul className="list-none space-y-1.5 pl-0">
                  {antiguedad.tramos.map((t) => (
                    <li key={t.clave} title={`${t.label}: ${formatMonto(t.monto)} en ${conteo(t.n, 'cuota', 'cuotas')}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(t.clave === 'corriente' ? 'text-muted' : 'text-ink')}>{t.label}</span>
                        <span className="demo-num text-ink">{formatMonto(t.monto)}</span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full rounded-full bg-surface-2">
                        <div
                          className="h-1.5 rounded-full bg-info"
                          style={{ width: `${antiguedad.total > 0 ? (t.monto / antiguedad.total) * 100 : 0}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-muted">
                  Vencido: <span className="demo-num text-error">{formatMonto(antiguedad.vencido)}</span>
                </p>
              </div>
            )}
          </CardColapsable>
        )}

        {/* El mapa baja de 460 a 300 px: en la mañana importan más los números,
            y el detalle está en Comercial. El pin sale de lo que pasa HOY
            (`tonoPinHoy`), no del estatus guardado del sitio. */}
        <CardColapsable
          id="inicio.mapa"
          titulo="Tu red en el mapa"
          className={veFinanzas ? 'lg:col-span-2' : 'lg:col-span-3'}
          accion={
            <Link
              href="/comercial"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline"
            >
              Ver comercial <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
            <div className="h-[300px] w-full overflow-hidden rounded border border-border">
              {sitios ? (
                <MapView points={puntos} zoom={10.4} />
              ) : (
                <div className="h-full w-full animate-pulse bg-surface-2" />
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted">
              <LeyendaPin color="#0a66ff" label="Digital" />
              <LeyendaPin color="#10b981" label="Libre hoy" />
              <LeyendaPin color="#ef4444" label="Ocupado hoy" />
              {/* El ámbar es «en propuesta» desde TENT-PROP (ver `tonoPinHoy`). */}
              <LeyendaPin color="#f59e0b" label="En propuesta" />
            </div>
        </CardColapsable>
      </div>
    </div>
  )
}

// Menú para elegir qué tipos de alerta se muestran en pantalla. Todas encendidas
// por default; la preferencia se guarda por navegador (localStorage).
function ConfigAlertas({ cfg }: { cfg: ReturnType<typeof useAlertasVisibles> }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Configurar alertas"
          title="Elegir qué alertas ver"
          className="relative inline-flex h-8 w-8 items-center justify-center rounded border border-border-strong bg-white text-muted transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} />
          {cfg.listo && cfg.ocultos > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-semibold text-white">
              {cfg.ocultos}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-64 rounded-md border border-border bg-surface p-1 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="px-2 py-1.5 text-[12px] font-medium text-ink">Alertas a mostrar</div>
          <div className="my-1 h-px bg-border" />
          {TIPOS_ALERTA.map((t) => {
            const activo = cfg.esVisible(t.tipo)
            return (
              <DropdownMenu.Item
                key={t.tipo}
                onSelect={(e) => {
                  e.preventDefault() // no cerrar el menú al alternar
                  cfg.alternar(t.tipo)
                }}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2"
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    activo ? 'border-accent bg-accent text-white' : 'border-border-strong bg-white',
                  )}
                >
                  {activo && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                {t.label}
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function Segmented({
  value,
  onChange,
}: {
  value: Granularidad
  onChange: (g: Granularidad) => void
}) {
  return (
    <div className="inline-flex rounded border border-border p-0.5">
      {GRANS.map((g) => (
        <button
          key={g.value}
          type="button"
          onClick={() => onChange(g.value)}
          className={cn(
            'rounded px-2.5 py-1 text-[12px] font-medium transition-colors duration-150',
            value === g.value ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink',
          )}
        >
          {g.label}
        </button>
      ))}
    </div>
  )
}

// Etiqueta, monto y aclaración en renglones, no en una fila: en media columna
// el monto en mono no cabe junto a la etiqueta.
function Dato({ label, valor, sub }: { label: string; valor: string; sub: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-muted">{label}</div>
      <div className="demo-num mt-0.5 truncate text-[14px] text-ink">{valor}</div>
      <div className="truncate text-[11px] text-muted">{sub}</div>
    </div>
  )
}

function LeyendaPin({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function CostoItem({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-muted">{label}</span>
      <span className={`demo-num ${fuerte ? 'font-semibold text-ink' : 'text-ink'}`}>{valor}</span>
    </span>
  )
}
