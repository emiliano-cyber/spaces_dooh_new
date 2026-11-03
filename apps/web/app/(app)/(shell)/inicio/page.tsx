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
import { useIdioma } from '@/lib/i18n/contexto'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import { interpolarNodos } from '@/lib/i18n/nodos'
import type { TipoAlerta } from '@/lib/data/derive'
import { localeDe } from '@/lib/i18n/formato-idioma'

// I18N (lote operaciones parte 2, 2026-11-02) · SOLO los textos: el diseño de
// esta pagina esta aprobado y ni una clase ni un nodo cambian. Las tablas de
// etiquetas (`TIPOS_ALERTA`, `TRAMOS_COBRANZA`, `GRANS`) siguen siendo la
// verdad en espanol; aqui se pinta la clave de cada valor.
const CLAVE_TIPO_ALERTA: Record<TipoAlerta, ClaveTexto> = {
  pago: 'inicio.tipo-alerta.pago',
  contrato: 'inicio.tipo-alerta.contrato',
  cobranza: 'inicio.tipo-alerta.cobranza',
  incidencia: 'inicio.tipo-alerta.incidencia',
  ot: 'inicio.tipo-alerta.ot',
  licencia: 'inicio.tipo-alerta.licencia',
}
const CLAVE_TRAMO: Record<string, ClaveTexto> = {
  corriente: 'inicio.tramo.corriente',
  d1_30: 'inicio.tramo.d1-30',
  d31_60: 'inicio.tramo.d31-60',
  d61_90: 'inicio.tramo.d61-90',
  d90: 'inicio.tramo.d90',
}
const CLAVE_GRAN: Record<string, ClaveTexto> = {
  dia: 'inicio.gran.dia',
  semana: 'inicio.gran.semana',
  mes: 'inicio.gran.mes',
}

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
  const { t, idioma } = useIdioma()
  const m = useDashboard(idioma)
  const sitios = useSitios()
  const [gran, setGran] = useState<Granularidad>('semana')
  const serie = useOcupacionSerie(gran, idioma)
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
  const mesActual = hoy.toLocaleDateString(localeDe(idioma), { month: 'long' })
  // ─── Por rol (DASH-REF, punto 2) ──────────────────────────────────────────
  // Sin `finanzas:ver`, `/api/estado` le manda vacías las cobranzas, los
  // contratos y las facturas, y el motor de Reportes le contesta 403. Enseñarle
  // esas tarjetas en cero sería mentirle: a VENTAS se le pinta su tablero
  // —pipeline, lo ganado y su tasa de cierre— y a DIRECCIÓN el de dinero.
  const veFinanzas = usePuede('finanzas', 'ver')
  const pnl = useDelMotor<PnlDelMes>(veFinanzas ? consultaPnlDelMes(hoy) : null, pnlDesdeRespuesta, { fase: 'cargando' })
  const precio = useDelMotor<PrecioDelMes>(veFinanzas ? consultaPrecioDelMes(hoy) : null, precioDesdeRespuesta, { fase: 'cargando' })

  const subtitulo = [
    cfg?.razonSocial ? t('inicio.razon-social', { nombre: cfg.razonSocial }) : null,
    cfg?.nombreComercial ? t('inicio.nombre-comercial', { nombre: cfg.nombreComercial }) : null,
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
    () => (propuestas ? pipelineComercial(propuestas, usuarios ?? [], hoy, yo, idioma) : null),
    [propuestas, usuarios, hoy, yo, idioma],
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
        <h1 className="text-2xl text-ink">{t('nav.dashboard')}</h1>
        {subtitulo && <p className="mt-1 text-[13px] text-muted">{subtitulo}</p>}
      </div>

      {/* KPIs — 4 columnas solo desde xl (1280px). Entre 1024 y 1279 el sidebar
          se come 240px y cada tarjeta quedaba en ~235px, demasiado angosta para
          un monto de 14 caracteres en mono; ahí van 2 columnas. */}
      <CardColapsable id="inicio.indicadores" titulo={t('inicio.indicadores')} contentClassName="space-y-3">
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
                    label={t('inicio.ingreso-de', { mes: mesActual })}
                    value={formatMonto(pnl.totales.ingreso, idioma)}
                    sub={t('inicio.ingreso-sub')}
                    tono="azul"
                    icon={<TrendingUp className="h-4 w-4" />}
                  />
                  <KPICard
                    label={t('inicio.margen-de', { mes: mesActual })}
                    value={pnl.totales.margenBrutoPct == null ? '—' : `${pnl.totales.margenBrutoPct.toFixed(0)}%`}
                    sub={t('inicio.margen-sub', { margen: formatMonto(pnl.totales.margenBruto, idioma), costo: formatMonto(pnl.totales.costoTotal, idioma) })}
                    tono={pnl.totales.margenBrutoPct == null ? 'neutro' : margenTono(pnl.totales.margenBrutoPct)}
                    icon={<Wallet className="h-4 w-4" />}
                  />
                </>
              ) : (
                <>
                  <KPICard label={t('inicio.ingreso-de', { mes: mesActual })} value="—" sub={pnl.fase === 'sin-acceso' ? t('inicio.requiere-finanzas') : t('inicio.no-calcular')} icon={<TrendingUp className="h-4 w-4" />} />
                  <KPICard label={t('inicio.margen-de', { mes: mesActual })} value="—" sub={pnl.fase === 'sin-acceso' ? t('inicio.requiere-finanzas') : t('inicio.no-calcular')} icon={<Wallet className="h-4 w-4" />} />
                </>
              )
            ) : (
              <>
                <KPICard
                  label={t('inicio.pipeline-abierto')}
                  value={formatMonto(pipeline.abierto.valor, idioma)}
                  sub={t('inicio.pipeline-sub', {
                    propuestas: t(pipeline.abierto.n === 1 ? 'inicio.propuestas.uno' : 'inicio.propuestas.otros', { n: formatNumero(pipeline.abierto.n) }),
                    enviadas: t(pipeline.abierto.enviadas === 1 ? 'inicio.enviadas.uno' : 'inicio.enviadas.otros', { n: pipeline.abierto.enviadas }),
                  })}
                  tono="ambar"
                  icon={<Briefcase className="h-4 w-4" />}
                />
                <KPICard
                  label={t('inicio.tasa')}
                  value={tasa}
                  sub={t('inicio.tasa-sub', { n: VENTANA_TASA_DIAS })}
                  icon={<Target className="h-4 w-4" />}
                />
              </>
            )}
            <KPICard
              label={t('inicio.ganado-en', { mes: mesActual })}
              value={formatMonto(pipeline.ganadoMes.valor, idioma)}
              sub={t(pipeline.ganadoMes.n === 1 ? 'inicio.aprobadas-propuestas.uno' : 'inicio.aprobadas-propuestas.otros', { n: formatNumero(pipeline.ganadoMes.n) })}
              tono="verde"
              icon={<Trophy className="h-4 w-4" />}
            />
            {/* % ponderado por capacidad: cada slot de una digital y cada cara
                de una fija cuentan como un espacio. El subtítulo lleva el dato
                crudo (espacios) y el reparto digital/fija, porque un mismo % se
                lee muy distinto si viene de slots o de espectaculares. */}
            <KPICard
              label={t('inicio.ocupacion-red')}
              value={`${m.ocupacionPct.toFixed(0)}%`}
              sub={t('inicio.ocupacion-red-sub', {
                ocupados: formatNumero(m.espaciosOcupados),
                capacidad: formatNumero(m.capacidadRed),
                dOcupados: formatNumero(m.ocupacionDigitales.ocupados),
                dCapacidad: formatNumero(m.ocupacionDigitales.capacidad),
                fOcupados: formatNumero(m.ocupacionFijas.ocupados),
                fCapacidad: formatNumero(m.ocupacionFijas.capacidad),
              })}
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
            <span className="font-medium text-ink">{t('inicio.costos-de', { mes: mesActual })}</span>
            <CostoItem label={t('inicio.costo.renta')} valor={formatMonto(pnl.totales.costoEspacio, idioma)} />
            <CostoItem label={t('inicio.costo.operacion')} valor={formatMonto(pnl.totales.costoOperacion, idioma)} />
            <CostoItem label={t('inicio.costo.luz')} valor={formatMonto(pnl.totales.costoEnergia, idioma)} />
            <CostoItem label={t('inicio.costo.total')} valor={formatMonto(pnl.totales.costoTotal, idioma)} fuerte />
            <CostoItem label={t('inicio.costo.impresion')} valor={formatMonto(m.costoImpresionMes, idioma)} />
            <Link href={rutaReportesDelMes(hoy)} className="ml-auto text-accent hover:underline">
              {t('inicio.ver-por-pantalla')}
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="font-medium text-ink">{t('inicio.rendimiento')}</span>
            <CostoItem
              label={t('inicio.renta-ingreso')}
              valor={pnl.totales.ingreso > 0 ? `${Math.round((pnl.totales.costoEspacio / pnl.totales.ingreso) * 100)}%` : '—'}
            />
            <CostoItem
              label={t('inicio.tarifa-cobrada')}
              valor={precio.fase === 'datos' ? `${precio.pct}%` : '—'}
            />
            <span className="text-muted">
              {precio.fase === 'datos'
                ? `${t(precio.conTarifa === 1 ? 'inicio.de-ventas.uno' : 'inicio.de-ventas.otros', { n: formatNumero(precio.conTarifa) })}${precio.sinTarifa ? t('inicio.sin-tarifa', { n: precio.sinTarifa }) : ''}`
                : precio.fase === 'sin-datos'
                  ? t('inicio.sin-ventas')
                  : precio.fase === 'cargando'
                    ? ''
                    : t('inicio.no-calcular')}
            </span>
          </div>
        </div>
      )}
      </CardColapsable>

      {/* Ocupación + Pipeline comercial */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <CardColapsable
          id="inicio.ocupacion"
          titulo={t('inicio.ocupacion')}
          className="lg:col-span-2"
          subtitulo={
            serie ? (
              <>
                {t('inicio.ocupacion-sub', { ocupados: formatNumero(serie.diasOcupados), disponibles: formatNumero(serie.diasDisponibles) })}
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
          titulo={t('inicio.pipeline')}
          accion={
            <Link href="/propuestas" className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline">
              {t('nav.propuestas')} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {!pipeline ? (
            <div className="h-[150px] animate-pulse rounded bg-surface-2" />
          ) : (
            <div className="space-y-3 text-[12px]">
              <div className="grid grid-cols-2 gap-3">
                <Dato label={t('inicio.abierto')} valor={formatMonto(pipeline.abierto.valor, idioma)} sub={t(pipeline.abierto.n === 1 ? 'inicio.propuestas.uno' : 'inicio.propuestas.otros', { n: formatNumero(pipeline.abierto.n) })} />
                <Dato label={t('inicio.ganado-en', { mes: mesActual })} valor={formatMonto(pipeline.ganadoMes.valor, idioma)} sub={t(pipeline.ganadoMes.n === 1 ? 'inicio.aprobadas.uno' : 'inicio.aprobadas.otros', { n: formatNumero(pipeline.ganadoMes.n) })} />
                <Dato label={t('inicio.tasa')} valor={tasa} sub={t('inicio.ultimos', { n: VENTANA_TASA_DIAS })} />
              </div>
              <div>
                <div className="mb-1 font-medium text-ink">{t('inicio.por-vendedor')}</div>
                {pipeline.porVendedor.length === 0 ? (
                  <p className="text-muted">{t('inicio.nada-aprobado', { mes: mesActual })}</p>
                ) : (
                  <ul className="space-y-1">
                    {pipeline.porVendedor.map((v) => (
                      <li key={v.nombre} className="flex items-center justify-between gap-2">
                        <span className="truncate text-ink">{v.nombre}</span>
                        <span className="demo-num shrink-0 text-muted">
                          {formatMonto(v.valor, idioma)} · {v.n}
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
        <CardColapsable id="inicio.alertas" titulo={t('inicio.alertas')} accion={<ConfigAlertas cfg={alertasCfg} />}>
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
                      ? t('inicio.sin-alertas')
                      : t('inicio.sin-alertas-tipo')}
                  </p>
                )
              }
              const rojas = visibles.filter((a) => a.nivel === 'rojo').length
              const porTipo = TIPOS_ALERTA.map((ta) => ({ ...ta, n: visibles.filter((a) => a.tipo === ta.tipo).length })).filter((ta) => ta.n > 0)
              const mostradas = todasLasAlertas ? visibles : visibles.slice(0, ALERTAS_A_LA_VISTA)
              return (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {rojas > 0 && (
                    <span className="rounded-full border border-[#ef444440] px-2 py-0.5 font-medium text-error">
                      {t(rojas === 1 ? 'inicio.urgentes.uno' : 'inicio.urgentes.otros', { n: formatNumero(rojas) })}
                    </span>
                  )}
                  {porTipo.map((ta) => (
                    <span key={ta.tipo} className="rounded-full border border-border px-2 py-0.5 text-muted">
                      {t(CLAVE_TIPO_ALERTA[ta.tipo])} · {ta.n}
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
                    {todasLasAlertas ? t('inicio.ver-menos') : t('inicio.ver-todas', { n: visibles.length })}
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
          titulo={t('inicio.huecos')}
          className="lg:col-span-2"
          subtitulo={t('inicio.huecos-sub', { n: VENTANA_HUECOS_DIAS })}
        >
          {!huecos ? (
            <div className="h-20 animate-pulse rounded bg-surface-2" />
          ) : huecos.length === 0 ? (
            <p className="text-[13px] text-muted">
              {t('inicio.huecos-nada', { n: VENTANA_HUECOS_DIAS })}
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
                          {h.digital ? (h.slots ? t(h.slots === 1 ? 'inicio.slots-libres.uno' : 'inicio.slots-libres.otros', { n: h.slots }) : t('inicio.slots-libres')) : t('inicio.cara-libre')}
                        </span>
                      </div>
                      <div className="demo-num truncate text-[11px] text-muted">
                        {interpolarNodos(t('inicio.sale'), {
                          cliente: h.clienteNombre ?? t('inicio.sin-cliente'),
                          campana: (
                            <Link href={`/campanas/${h.campanaId}`} className="hover:underline">
                              {h.campanaNombre}
                            </Link>
                          ),
                          fecha: formatFecha(h.fechaFin, idioma),
                        })}
                      </div>
                      {/* TENT-PROP: quién ya la está pidiendo. No cierra el hueco
                          (una propuesta puede no cerrarse), pero dice a quién llamar. */}
                      {h.enPropuesta.length > 0 && (
                        <div className="truncate text-[11px] text-[#9a6700]">{t('inicio.en-propuesta-lista', { lista: h.enPropuesta.join(', ') })}</div>
                      )}
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full border px-2 py-0.5 text-[12px] font-medium',
                        h.dias <= 7 ? 'border-[#ef444440] text-error' : 'border-[#f59e0b40] text-[#9a6700]',
                      )}
                    >
                      {h.dias === 0 ? t('inicio.hoy') : t('inicio.en-dias', { n: h.dias })}
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
                  {todosLosHuecos ? t('inicio.ver-menos') : t('inicio.ver-todos', { n: huecos.length })}
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
            titulo={t('inicio.por-cobrar')}
            accion={
              <Link href="/finanzas" className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline">
                {t('nav.finanzas')} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {!antiguedad ? (
              <div className="h-32 animate-pulse rounded bg-surface-2" />
            ) : antiguedad.total === 0 ? (
              <p className="text-[13px] text-muted">{t('inicio.sin-saldos')}</p>
            ) : (
              <div className="space-y-3 text-[12px]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <HandCoins className="h-4 w-4" /> {t('inicio.costo.total')}
                  </span>
                  <span className="demo-num text-[18px] text-ink">{formatMonto(antiguedad.total, idioma)}</span>
                </div>
                {/* Una barra por tramo, un solo color: es una comparación de
                    magnitudes, no de categorías. La etiqueta y el monto van en
                    texto, así que el color no carga el significado. */}
                <ul className="list-none space-y-1.5 pl-0">
                  {antiguedad.tramos.map((tr) => (
                    <li
                      key={tr.clave}
                      title={t(tr.n === 1 ? 'inicio.tramo-titulo.uno' : 'inicio.tramo-titulo.otros', {
                        tramo: t(CLAVE_TRAMO[tr.clave]),
                        monto: formatMonto(tr.monto, idioma),
                        n: formatNumero(tr.n),
                      })}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(tr.clave === 'corriente' ? 'text-muted' : 'text-ink')}>{t(CLAVE_TRAMO[tr.clave])}</span>
                        <span className="demo-num text-ink">{formatMonto(tr.monto, idioma)}</span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full rounded-full bg-surface-2">
                        <div
                          className="h-1.5 rounded-full bg-info"
                          style={{ width: `${antiguedad.total > 0 ? (tr.monto / antiguedad.total) * 100 : 0}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-muted">
                  {interpolarNodos(t('inicio.vencido'), {
                    monto: <span className="demo-num text-error">{formatMonto(antiguedad.vencido, idioma)}</span>,
                  })}
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
          titulo={t('inicio.mapa')}
          className={veFinanzas ? 'lg:col-span-2' : 'lg:col-span-3'}
          accion={
            <Link
              href="/comercial"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline"
            >
              {t('inicio.ver-comercial')} <ArrowRight className="h-3.5 w-3.5" />
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
              <LeyendaPin color="#0a66ff" label={t('inicio.leyenda.digital')} />
              <LeyendaPin color="#10b981" label={t('inicio.leyenda.libre')} />
              <LeyendaPin color="#ef4444" label={t('inicio.leyenda.ocupado')} />
              {/* El ámbar es «en propuesta» desde TENT-PROP (ver `tonoPinHoy`). */}
              <LeyendaPin color="#f59e0b" label={t('inicio.leyenda.en-propuesta')} />
            </div>
        </CardColapsable>
      </div>
    </div>
  )
}

// Menú para elegir qué tipos de alerta se muestran en pantalla. Todas encendidas
// por default; la preferencia se guarda por navegador (localStorage).
function ConfigAlertas({ cfg }: { cfg: ReturnType<typeof useAlertasVisibles> }) {
  const t = useIdioma().t
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t('inicio.config-alertas')}
          title={t('inicio.elegir-alertas')}
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
          <div className="px-2 py-1.5 text-[12px] font-medium text-ink">{t('inicio.alertas-a-mostrar')}</div>
          <div className="my-1 h-px bg-border" />
          {TIPOS_ALERTA.map((ta) => {
            const activo = cfg.esVisible(ta.tipo)
            return (
              <DropdownMenu.Item
                key={ta.tipo}
                onSelect={(e) => {
                  e.preventDefault() // no cerrar el menú al alternar
                  cfg.alternar(ta.tipo)
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
                {t(CLAVE_TIPO_ALERTA[ta.tipo])}
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
  const t = useIdioma().t
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
          {t(CLAVE_GRAN[g.value])}
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
