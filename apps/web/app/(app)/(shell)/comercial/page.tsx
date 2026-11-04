'use client'

import { useMemo, useState } from 'react'
import { conteo } from '@/lib/plural'
// Alias: `toast` ya es el estado del toast local de esta página.
import { toast as sonner } from 'sonner'
import { Search, SlidersHorizontal, Check, CheckCircle2, FileText, Plus, UserRound, Download, LayoutGrid, Lock } from 'lucide-react'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { disponibilidadFila } from '@/components/demo/comercial/disponibilidad-fila'
import { MapView, type MapPoint } from '@/components/demo/MapView'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { SiteFicha } from '@/components/demo/comercial/SiteFicha'
import { ReservaDialog } from '@/components/demo/comercial/ReservaDialog'
import { AltaSitioDialog } from '@/components/demo/comercial/AltaSitioDialog'
import { SlotsBadge } from '@/components/demo/SlotsBadge'
import { ClientesBadge } from '@/components/demo/ClientesBadge'
import {
  StatusBadge,
  pinTono,
} from '@/components/demo/StatusBadge'
import { useIdioma } from '@/lib/i18n/contexto'
import { interpolarNodos } from '@/lib/i18n/nodos'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import { CLAVE_ESTATUS } from '@/components/demo/propuestas/estatus'
import { CLAVE_SITIO_ESTATUS, CLAVE_TIPO_MEDIO } from '@/components/demo/comercial/claves'
import { cn } from '@/lib/cn'
import { descargarInventario } from '@/lib/inventario-export'
import { itemsEnPropuesta, agruparPorPropuesta, type PropuestaEnVeremos } from '@/lib/data/en-propuesta'
import Link from 'next/link'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { TIPO_MEDIO_LABEL } from '@/lib/tipo-medio'
import { ubicacion } from '@/lib/ubicacion'
import { formatNumero } from '@/lib/formato-numero'
import {
  sitiosSinContratoCompleto,
  useSitios,
  useCampanas,
  useContratos,
  useArrendadores,
  useConfigNegocio,
  usePropuestas,
  useClientes,
  tarifaDeSitio,
  rangosDePrecio,
  formatMonto,
  formatMontoCorto,
  formatFecha,
  type Sitio,
} from '@/lib/data/client'

const selectCls =
  'h-9 rounded border border-border-strong bg-surface px-2.5 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

// Leyenda del mapa en UN lugar del módulo, con los textos de `SITIO_LABEL`
// (los mismos que dice la lista; aquí por sus claves de traducción, ver
// `components/demo/comercial/claves.ts`). Los colores son los de los pines de
// `MapView` (`TONO_HEX`, que no se exporta y es del Dashboard, así que no se
// toca): si cambian allá, hay que cambiarlos aquí.
function leyendaMapa(t: (c: ClaveTexto, v?: Record<string, string | number>) => string): { color: string; label: string }[] {
  return [
    { color: '#0a66ff', label: t('comercial.pagina.leyenda.digital') },
    { color: '#10b981', label: t(CLAVE_SITIO_ESTATUS.DISPONIBLE) },
    {
      color: '#ef4444',
      label: t('comercial.pagina.leyenda.no-libre', {
        ocupado: t(CLAVE_SITIO_ESTATUS.OCUPADO),
        bloqueado: t(CLAVE_SITIO_ESTATUS.BLOQUEADO).toLowerCase(),
      }),
    },
    { color: '#f59e0b', label: t(CLAVE_SITIO_ESTATUS.RESERVADO) },
  ]
}

// El chip de cada propuesta abierta: el MISMO texto que la lista de
// Propuestas (`CLAVE_ESTATUS`, «Borrador» / «Enviada»).
const ESTATUS_PROPUESTA_CLAVE: Record<PropuestaEnVeremos['estatus'], ClaveTexto> = {
  BORRADOR: CLAVE_ESTATUS.BORRADOR,
  ENVIADA: CLAVE_ESTATUS.ENVIADA,
}

export default function ComercialPage() {
  const { t, idioma } = useIdioma()
  const nPantallas = (n: number) => conteo(n, t('comercial.unidad.pantalla'), t('comercial.unidad.pantallas'))
  const sitios = useSitios()
  const propuestas = usePropuestas()
  const clientes = useClientes()
  const campanas = useCampanas()
  const contratos = useContratos()
  const arrendadores = useArrendadores()
  // Default global del cupo de clientes (ADR 0008): la pantalla que no lleva el
  // suyo hereda éste.
  const config = useConfigNegocio()
  const puedeCrear = usePuede('comercial', 'crear')
  const puedeArrendadores = usePuede('arrendadores', 'ver')

  // Propietario por sitio: del contrato vigente preferente (dueño del predio).
  const propietarioPorSitio = useMemo(() => {
    const PR: Record<string, number> = { VIGENTE: 0, POR_VENCER: 1, RENOVADO: 2, VENCIDO: 3, CANCELADO: 4 }
    const arrById = new Map((arrendadores ?? []).map((a) => [a.id, a.nombre]))
    const m = new Map<string, string>()
    for (const c of (contratos ?? []).slice().sort((a, b) => (PR[a.estatus] ?? 9) - (PR[b.estatus] ?? 9))) {
      // Un INCOMPLETO nacido antes del ADR 0002 puede no tener arrendador; los
      // nuevos siempre lo traen, porque el alta lo exige. Sin él queda «—».
      if (!m.has(c.sitioId)) m.set(c.sitioId, (c.arrendadorId ? arrById.get(c.arrendadorId) : null) ?? '—')
    }
    return m
  }, [contratos, arrendadores])

  // ADR 0003: pantallas que la API rechazará por contrato incompleto. Se marcan
  // aquí para que el comercial lo vea ANTES de armar la selección, en vez de
  // descubrirlo al reservar con el cliente ya comprometido.
  const sinContrato = useMemo(
    () => sitiosSinContratoCompleto(sitios ?? [], contratos ?? []),
    [sitios, contratos],
  )

  const [q, setQ] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fDistrito, setFDistrito] = useState('')
  const [fDisp, setFDisp] = useState('')
  const [fPrecio, setFPrecio] = useState('')

  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [activo, setActivo] = useState<string | null>(null)
  const [fichaOpen, setFichaOpen] = useState(false)
  const [reservaOpen, setReservaOpen] = useState(false)
  const [altaOpen, setAltaOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Generar el archivo es trabajo sincrono en el navegador y puede fallar con un
  // inventario enorme. Sin este catch el error moria en la consola y el usuario
  // se quedaba mirando un boton que "no hizo nada".
  function bajarInventario(formato: 'xlsx' | 'csv') {
    try {
      descargarInventario(filtrados, formato)
      notify(t(filtrados.length === 1 ? 'comercial.pagina.descargadas.uno' : 'comercial.pagina.descargadas.otros', { n: filtrados.length }))
    } catch {
      notify(t('comercial.pagina.descarga-error'))
    }
  }

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  const distritos = useMemo(
    () => Array.from(new Set((sitios ?? []).map((s) => s.alcaldia).filter(Boolean))).sort() as string[],
    [sitios],
  )

  // Los cortes salen del inventario que se está viendo, no de una lista escrita
  // a mano (M-6). Ver `rangosDePrecio` en derive.ts.
  const rangosPrecio = useMemo(
    () => rangosDePrecio((sitios ?? []).map(tarifaDeSitio)),
    [sitios],
  )

  // El corte se valida AL LEER y no con un efecto que limpie el estado: si el
  // inventario cambia (alta, baja, edición de tarifa), el corte elegido puede
  // dejar de existir, y seguir aplicándolo filtraría por un número que ya no
  // aparece en pantalla — un «0 resultados» sin causa visible. Es el mismo
  // criterio con que M-7 acota la página al leerla.
  const cortePrecio =
    fPrecio && rangosPrecio.includes(Number(fPrecio)) ? Number(fPrecio) : null

  const filtrados = useMemo(() => {
    return (sitios ?? []).filter((s) => {
      if (q && !`${s.nombre} ${s.direccion} ${s.alcaldia}`.toLowerCase().includes(q.toLowerCase()))
        return false
      if (fTipo && s.tipoMedio !== fTipo) return false
      if (fDistrito && s.alcaldia !== fDistrito) return false
      if (fDisp && s.estatusComercial !== fDisp) return false
      if (cortePrecio != null && tarifaDeSitio(s) > cortePrecio) return false
      return true
    })
  }, [sitios, q, fTipo, fDistrito, fDisp, cortePrecio])

  const puntos: MapPoint[] = filtrados.map((s) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    tono: pinTono(s),
    label: s.nombre,
  }))

  const sitioActivo = sitios?.find((s) => s.id === activo) ?? null
  const sitiosSeleccionados = (sitios ?? []).filter((s) => seleccion.has(s.id))
  const totalSel = sitiosSeleccionados.reduce((a, s) => a + tarifaDeSitio(s), 0)

  // TENT-PROP (26/10) · lo tentativo son las pantallas que piden propuestas
  // abiertas (borrador o enviada), no un estado de la reserva. Esta tarjeta era
  // «Reservas tentativas» con Confirmar/Extender, y no podía aparecer nunca:
  // ningún flujo creaba reservas TENTATIVA. Solo avisa: no bloquea vender.
  const enVeremos = useMemo(() => {
    const items = itemsEnPropuesta(propuestas ?? [], clientes ?? [])
    const d = new Date()
    const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const props = agruparPorPropuesta(items, hoy)
    const vivas = new Set(props.map((p) => p.propuestaId))
    return { props, pantallas: new Set(items.filter((i) => vivas.has(i.propuestaId)).map((i) => i.sitioId)).size }
  }, [propuestas, clientes])

  // Cifras de arriba (rediseño del 26/10), sobre lo YA cargado y con los
  // filtros aplicados. La regla de «libre» es la misma función que usa cada
  // fila (`disponibilidadFila`), para que las tarjetas no contradigan a la
  // lista de abajo.
  const cifras = useMemo(() => {
    const filas = filtrados.map((s) => ({ s, d: disponibilidadFila(s, sinContrato) }))
    const digitales = filas.filter((x) => x.d.esDigital && x.s.spotsDisponibles != null)
    return {
      libres: filas.filter((x) => x.d.libre).length,
      hayDigitales: filas.some((x) => x.d.esDigital),
      slots: digitales.length ? digitales.reduce((a, x) => a + (x.s.spotsDisponibles ?? 0), 0) : null,
      bloqueadas: filas.filter((x) => x.d.bloqueadaPorContrato).length,
    }
  }, [filtrados, sinContrato])
  const filtrosActivos = [q, fTipo, fDistrito, fDisp, cortePrecio != null ? fPrecio : ''].filter(Boolean).length
  function limpiarFiltros() {
    setQ('')
    setFTipo('')
    setFDistrito('')
    setFDisp('')
    setFPrecio('')
  }

  function toggleSel(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function abrirFicha(id: string) {
    setActivo(id)
    setFichaOpen(true)
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl text-ink">{t('comercial.pagina.titulo')}</h1>
          <p className="mt-1 text-[13px] text-muted">
            {t('comercial.pagina.subtitulo', {
              sitios: conteo(filtrados.length, t('comercial.unidad.sitio'), t('comercial.unidad.sitios')),
            })}
          </p>
        </div>
        {puedeCrear && (
          <Button variant="success" size="sm" onClick={() => setAltaOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> {t('comercial.pagina.nueva-pantalla')}
          </Button>
        )}
      </div>

      {/* Lo primero que necesita saber quien vende, sobre el recorte filtrado. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!sitios ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              label={t('comercial.pagina.kpi.libres')}
              value={formatNumero(cifras.libres, 0, idioma)}
              sub={t(filtrosActivos ? 'comercial.pagina.kpi.libres.sub-filtradas' : 'comercial.pagina.kpi.libres.sub', {
                pantallas: nPantallas(filtrados.length),
              })}
              tono={cifras.libres > 0 ? 'verde' : 'neutro'}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <KPICard
              label={t('comercial.pagina.kpi.slots')}
              value={cifras.slots == null ? '—' : formatNumero(cifras.slots, 0, idioma)}
              sub={
                !cifras.hayDigitales
                  ? t('comercial.pagina.kpi.slots.sin-digitales')
                  : cifras.slots == null
                    ? t('comercial.pagina.kpi.slots.sin-capturar')
                    : t('comercial.pagina.kpi.slots.sub')
              }
              tono="azul"
              icon={<LayoutGrid className="h-4 w-4" />}
            />
            <KPICard
              label={t('comercial.pagina.en-propuesta')}
              value={formatNumero(enVeremos.pantallas, 0, idioma)}
              sub={
                enVeremos.props.length
                  ? t('comercial.pagina.kpi.propuesta.sub', {
                      propuestas: conteo(
                        enVeremos.props.length,
                        t('comercial.unidad.propuesta-abierta'),
                        t('comercial.unidad.propuestas-abiertas'),
                      ),
                    })
                  : t('comercial.pagina.kpi.propuesta.ninguna')
              }
              tono={enVeremos.props.length ? 'ambar' : 'neutro'}
              icon={<FileText className="h-4 w-4" />}
            />
            <KPICard
              label={t('comercial.pagina.kpi.bloqueadas')}
              value={formatNumero(cifras.bloqueadas, 0, idioma)}
              sub={cifras.bloqueadas ? t('comercial.pagina.kpi.bloqueadas.sub') : t('comercial.pagina.kpi.bloqueadas.ninguna')}
              tono={cifras.bloqueadas ? 'ambar' : 'neutro'}
              icon={<Lock className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      {/* En propuesta (TENT-PROP, 26/10): las propuestas abiertas y qué
          pantallas piden. Sustituye a «Reservas tentativas», que listaba un
          estado de reserva que nada creaba. No hay Confirmar aquí: lo que
          confirma una pantalla es aprobar la propuesta y generar la campaña,
          y eso vive en Propuestas. */}
      {enVeremos.props.length > 0 && (
        <CardColapsable
          id="comercial.en-propuesta"
          titulo={t('comercial.pagina.en-propuesta')}
          subtitulo={t('comercial.pagina.en-propuesta.sub')}
          icono={<FileText className="h-4 w-4 text-[#9a6700]" />}
          className="bg-warning-soft"
          headerClassName="px-3 pt-3 pb-2"
          contentClassName="px-3 pb-2"
        >
          <ul className="m-0 list-none divide-y divide-border p-0">
            {enVeremos.props.map((p) => (
              <li key={p.propuestaId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <Link href={`/propuestas/${p.propuestaId}`} className="text-[13px] font-medium text-ink hover:underline">
                    {p.folio}
                  </Link>
                  <span className="text-[13px] text-muted"> · {p.clienteNombre ?? t('comercial.pagina.en-propuesta.sin-cliente')}</span>
                  <div className="demo-num text-[11px] text-muted">
                    {nPantallas(p.pantallas)} · {formatFecha(p.desde, idioma)}–{formatFecha(p.hasta, idioma)}
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-[#f59e0b40] bg-surface px-2 py-0.5 text-[12px] font-medium text-[#9a6700]">
                  {t(ESTATUS_PROPUESTA_CLAVE[p.estatus])}
                </span>
              </li>
            ))}
          </ul>
        </CardColapsable>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('comercial.pagina.buscar')}
            className="h-9 w-full rounded border border-border-strong bg-surface pl-8 pr-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
        <select className={selectCls} value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
          <option value="">{t('comercial.pagina.filtro.tipos')}</option>
          {Object.keys(TIPO_MEDIO_LABEL).map((k) => (
            <option key={k} value={k}>{t(CLAVE_TIPO_MEDIO[k as keyof typeof CLAVE_TIPO_MEDIO])}</option>
          ))}
        </select>
        <select className={selectCls} value={fDistrito} onChange={(e) => setFDistrito(e.target.value)}>
          <option value="">{t('comercial.pagina.filtro.distritos')}</option>
          {distritos.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select className={selectCls} value={fDisp} onChange={(e) => setFDisp(e.target.value)}>
          <option value="">{t('comercial.pagina.filtro.disponibilidad')}</option>
          <option value="DISPONIBLE">{t(CLAVE_SITIO_ESTATUS.DISPONIBLE)}</option>
          <option value="OCUPADO">{t('comercial.comun.no-disponible')}</option>
          <option value="BLOQUEADO">{t(CLAVE_SITIO_ESTATUS.BLOQUEADO)}</option>
        </select>
        {rangosPrecio.length > 0 && (
          <select className={selectCls} value={fPrecio} onChange={(e) => setFPrecio(e.target.value)}>
            <option value="">{t('comercial.pagina.filtro.precio')}</option>
            {rangosPrecio.map((c) => (
              <option key={c} value={c}>
                ≤ {formatMontoCorto(c, idioma)}
              </option>
            ))}
          </select>
        )}
        {/* Quita los cinco filtros de una vez; solo aparece si hay alguno. Un
            corte de precio olvidado era el «0 resultados» que nadie entendía. */}
        {filtrosActivos > 0 && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="h-9 rounded border border-border bg-transparent px-3 text-[13px] font-medium text-info hover:bg-surface-2"
          >
            {t('comercial.pagina.limpiar', { n: filtrosActivos })}
          </button>
        )}
      </div>

      {/* Lista + Mapa. La columna de la lista crece hasta 520 px: a 440 el
          renglón «código · alcaldía · tarifa» se partía en dos o tres líneas. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(440px,520px)_1fr]">
        {/* Lista */}
        {/* Plegable (pedido del 20/10). Filtros y selección viven en la página,
            fuera de la tarjeta: plegar la lista no los pierde. */}
        <CardColapsable
          id="comercial.inventario"
          titulo={t('comercial.pagina.inventario')}
          icono={<SlidersHorizontal className="h-3.5 w-3.5 text-muted" />}
          className="flex max-h-[560px] flex-col overflow-hidden"
          headerClassName="border-b border-border px-3 py-2"
          contentClassName="flex min-h-0 flex-1 flex-col px-0 pb-0"
          resumen={<span className="text-[12px] text-muted">{conteo(filtrados.length, t('comercial.unidad.resultado'), t('comercial.unidad.resultados'))}</span>}
          accion={
              /* Baja lo que hay en pantalla, con los filtros aplicados. Aqui
                  eso es lo util: se filtra por zona o disponibilidad para armar
                  una propuesta, y el archivo tiene que ser ESE recorte, no el
                  inventario entero. Mismo formato que la plantilla de carga, asi
                  que tambien sirve para editar en masa y volver a subirlo. */
              <span className="flex items-center gap-1 text-[12px] text-muted">
                <Download className="h-3.5 w-3.5" />
                <button
                  onClick={() => bajarInventario('xlsx')}
                  disabled={filtrados.length === 0}
                  title={t('comercial.pagina.descargar-excel')}
                  className="rounded border-0 bg-transparent px-1.5 py-0.5 font-medium text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-muted"
                >
                  Excel
                </button>
                <button
                  onClick={() => bajarInventario('csv')}
                  disabled={filtrados.length === 0}
                  title={t('comercial.pagina.descargar-csv')}
                  className="rounded border-0 bg-transparent px-1.5 py-0.5 font-medium text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-muted"
                >
                  CSV
                </button>
              </span>
          }
        >
          <ul className="m-0 flex-1 list-none overflow-y-auto p-0">
            {!sitios ? (
              Array.from({ length: 8 }).map((_, i) => (
                <li key={i} className="border-b border-border px-3 py-3">
                  <div className="h-3 w-40 animate-pulse rounded bg-surface-2" />
                  <div className="mt-2 h-2.5 w-24 animate-pulse rounded bg-surface-2" />
                </li>
              ))
            ) : filtrados.length === 0 ? (
              <li className="px-4 py-10 text-center text-[13px] text-muted">
                {/* Dice QUÉ filtros estorban, en vez de un «ninguno» a secas. */}
                {t('comercial.pagina.vacio', {
                  filtros:
                    [
                      q && t('comercial.pagina.vacio.busqueda', { q }),
                      fTipo &&
                        t('comercial.pagina.vacio.tipo', {
                          tipo:
                            fTipo in CLAVE_TIPO_MEDIO
                              ? t(CLAVE_TIPO_MEDIO[fTipo as keyof typeof CLAVE_TIPO_MEDIO])
                              : fTipo,
                        }),
                      fDistrito && fDistrito,
                      fDisp &&
                        (fDisp === 'OCUPADO'
                          ? t('comercial.pagina.vacio.no-disponible')
                          : fDisp === 'DISPONIBLE' || fDisp === 'BLOQUEADO'
                            ? t(CLAVE_SITIO_ESTATUS[fDisp]).toLowerCase()
                            : fDisp.toLowerCase()),
                      cortePrecio != null && `≤ ${formatMontoCorto(cortePrecio, idioma)}`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || t('comercial.pagina.vacio.inventario-vacio'),
                })}
                {filtrosActivos > 0 && t('comercial.pagina.vacio.quitar-filtro')}
              </li>
            ) : (
              filtrados.map((s) => {
                // La regla de qué se puede vender vive en `disponibilidadFila`
                // (la misma que cuentan las tarjetas de arriba); sus comentarios
                // explican el porqué de cada condición.
                const { esDigital, bloqueadaPorContrato, libre } = disponibilidadFila(s, sinContrato)
                const sel = seleccion.has(s.id)
                return (
                  <li
                    key={s.id}
                    className={cn(
                      'flex items-center gap-2.5 border-b border-border px-3 py-3 transition-colors duration-150',
                      activo === s.id ? 'bg-surface-2' : 'hover:bg-surface-2',
                    )}
                  >
                    {libre ? (
                      <button
                        type="button"
                        onClick={() => toggleSel(s.id)}
                        className={cn(
                          'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border',
                          sel ? 'border-accent bg-accent text-accent-fg' : 'border-border-strong bg-surface',
                        )}
                        style={{ height: 18, width: 18 }}
                        aria-label={sel ? t('comercial.pagina.quitar-seleccion') : t('comercial.pagina.seleccionar')}
                      >
                        {sel && <Check className="h-3 w-3" strokeWidth={3} />}
                      </button>
                    ) : (
                      <span className="h-[18px] w-[18px] shrink-0" />
                    )}
                    {/* Fondo, borde y relleno explícitos: con `preflight: false`
                        el botón pintaba el gris del navegador detrás del texto. */}
                    <button
                      type="button"
                      onClick={() => abrirFicha(s.id)}
                      className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left"
                    >
                      {/* B2: los nombres largos se cortaban («AUTOPISTA MEX…») y no
                          había forma de leerlos enteros sin abrir la ficha. El
                          `title` los da al pasar el ratón; se deja el truncado
                          porque la tarjeta tiene que caber en la rejilla. */}
                      {/* Renglón 1: nombre y, a la derecha, la tarifa, que es lo
                          que más se compara entre pantallas (antes iba al final
                          del renglón gris). */}
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="truncate text-[15px] font-medium text-ink" title={s.nombre}>{s.nombre}</div>
                        <div className="demo-num shrink-0 text-[13px] font-medium text-ink">{formatMonto(tarifaDeSitio(s), idioma)}</div>
                      </div>
                      {/* Renglón 2: código · alcaldía · propietario. La ciudad va
                          en el `title`: en una red de una ciudad es redundante. */}
                      <div
                        className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[12px] text-muted"
                        title={ubicacion([s.alcaldia, s.ciudad])}
                      >
                        <span className="demo-num shrink-0">{s.codigoProveedor}</span>
                        {s.alcaldia && <span className="shrink-0">· {s.alcaldia}</span>}
                        {esDigital && s.totalSpots == null && s.spotsPorHora != null && (
                          <span className="demo-num shrink-0">· {formatNumero(s.spotsPorHora, 0, idioma)}{t('comercial.pagina.slots-hora')}</span>
                        )}
                        <span className="shrink-0">·</span>
                        <UserRound className="h-3.5 w-3.5 shrink-0" />
                        {/* v0.12.3 · una propia no tiene arrendador, y no es un pendiente. */}
                        <span className="truncate" title={s.propio ? t('comercial.comun.pantalla-propia') : (propietarioPorSitio.get(s.id) ?? t('comercial.pagina.sin-arrendador'))}>
                          {s.propio ? t('comercial.pagina.propia') : (propietarioPorSitio.get(s.id) ?? t('comercial.pagina.sin-arrendador'))}
                        </span>
                      </div>
                    </button>
                    {/* Disponibilidad por spots: las digitales muestran X/12 y las
                        fijas Disponible/No disponible. Sin estado "tentativo".
                        (Desde el 26/10 el «No disponible» de una fija dice su
                        motivo, que puede ser «Reservado · tentativo»: ver abajo.) */}
                    {esDigital && s.totalSpots != null && (
                      <SlotsBadge disponibles={s.spotsDisponibles ?? null} total={s.totalSpots} />
                    )}
                    {/* ADR 0008: segundo eje. La pantalla puede tener slots
                        libres y aun así no admitir un cliente NUEVO. No bloquea
                        la selección a propósito: aquí todavía no se sabe para
                        qué cliente se va a reservar, y uno que ya está en la
                        pantalla sí cabe. El diálogo de reserva lo avisa cuando
                        ya hay nombre, y el servidor es quien decide. */}
                    <ClientesBadge
                      ocupados={s.clientesActivos ?? 0}
                      cupo={s.maxClientes ?? config?.maxClientesPantalla ?? null}
                    />
                    {/* El motivo importa: "no disponible" (sin slots / ya
                        vendida) se arregla eligiendo otra pantalla; "contrato
                        incompleto" se arregla en Arrendadores. Mismo badge con
                        el mismo texto mandaría al comercial al sitio equivocado,
                        así que el bloqueo contractual lleva su propio tono. */}
                    {bloqueadaPorContrato ? (
                      // Para quien puede entrar a Arrendadores, el badge es la
                      // liga que lleva a arreglarlo: el comercial que topa con
                      // esta pantalla bloqueada es quien más prisa tiene por
                      // que se complete. Sin permiso queda como aviso a secas.
                      puedeArrendadores ? (
                        <Link
                          href="/arrendadores"
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0"
                          title={t('comercial.pagina.completar-contrato')}
                        >
                          <StatusBadge tono="ambar" className="shrink-0 hover:underline">
                            {t('comercial.pagina.contrato-incompleto')}
                          </StatusBadge>
                        </Link>
                      ) : (
                        <StatusBadge tono="ambar" className="shrink-0">
                          {t('comercial.pagina.contrato-incompleto')}
                        </StatusBadge>
                      )
                    ) : (
                      // El motivo del «no», con la etiqueta fina de
                      // `SITIO_LABEL` (ocupado, bloqueado, en mantenimiento,
                      // tentativo); mismo tono que antes. En una digital el «no»
                      // es por slots, salvo que esté bloqueada.
                      <StatusBadge tono={libre ? 'verde' : 'rojo'}>
                        {libre
                          ? t(CLAVE_SITIO_ESTATUS.DISPONIBLE)
                          : esDigital
                            ? s.estatusComercial === 'BLOQUEADO'
                              ? t(CLAVE_SITIO_ESTATUS.BLOQUEADO)
                              : t('comercial.pagina.sin-slots')
                            : t(CLAVE_SITIO_ESTATUS[s.estatusComercial])}
                      </StatusBadge>
                    )}
                  </li>
                )
              })
            )}
          </ul>

          {/* Barra de acción de selección */}
          {seleccion.size > 0 && puedeCrear && (
            <div className="flex items-center justify-between border-t border-border bg-surface px-3 py-2.5">
              <div className="text-[12px] text-muted">
                {interpolarNodos(t('comercial.pagina.seleccion'), {
                  n: seleccion.size,
                  total: <span className="demo-num font-medium text-ink">{formatMonto(totalSel, idioma)}</span>,
                })}
              </div>
              <Button size="sm" onClick={() => setReservaOpen(true)}>
                {t('comercial.pagina.reservar')}
              </Button>
            </div>
          )}
        </CardColapsable>

        {/* Mapa */}
        <CardColapsable id="comercial.mapa" titulo={t('comercial.pagina.mapa')} className="overflow-hidden" contentClassName="px-0 pb-0">
          <div className="h-[560px] w-full">
            {sitios ? (
              <MapView points={puntos} selectedId={activo} onSelect={abrirFicha} zoom={11} />
            ) : (
              <div className="h-full w-full animate-pulse bg-surface-2" />
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border px-3 py-2 text-[11px] text-muted">
            {leyendaMapa(t).map((x) => (
              <Pin key={x.label} color={x.color} label={x.label} />
            ))}
          </div>
        </CardColapsable>
      </div>

      {/* Alta de pantalla */}
      <AltaSitioDialog
        open={altaOpen}
        onOpenChange={setAltaOpen}
        onCreado={(s) => notify(t('comercial.pagina.alta-hecha', { nombre: s.nombre }))}
      />

      {/* Ficha de sitio */}
      <SiteFicha
        sitio={sitioActivo}
        open={fichaOpen}
        onOpenChange={setFichaOpen}
        onReservar={(id) => {
          // La ficha puentea el checkbox de la lista, así que el bloqueo por
          // contrato hay que repetirlo aquí: si no, esta es la puerta por la que
          // una pantalla incompleta llega al diálogo de reserva y muere en la API.
          if (sinContrato.has(id)) {
            // sonner.error, NO notify(): el toast local de esta página
            // lleva palomita verde de éxito, y un bloqueo con palomita verde se
            // lee como "listo, hecho".
            sonner.error(t('comercial.pagina.sin-contrato-error'))
            return
          }
          setSeleccion(new Set([id]))
          setFichaOpen(false)
          setReservaOpen(true)
        }}
      />

      {/* Modal de reserva */}
      <ReservaDialog
        open={reservaOpen}
        onOpenChange={setReservaOpen}
        sitios={sitiosSeleccionados}
        onReserved={(_, nombre) => {
          setSeleccion(new Set())
          notify(t('comercial.pagina.reservados', { nombre }))
        }}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-md border border-border bg-ink px-4 py-2.5 text-[13px] text-white">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> {toast}
          </span>
        </div>
      )}
    </div>
  )
}

function Pin({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}
