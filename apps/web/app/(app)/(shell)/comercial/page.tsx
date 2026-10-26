'use client'

import { useMemo, useState } from 'react'
import { conteo } from '@/lib/plural'
// Alias: `toast` ya es el estado del toast local de esta página.
import { toast as sonner } from 'sonner'
import { Search, SlidersHorizontal, MapPin, Check, CheckCircle2, CalendarClock, Plus, UserRound, Download, LayoutGrid, Lock } from 'lucide-react'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { disponibilidadFila } from '@/components/demo/comercial/disponibilidad-fila'
import { MapView, type MapPoint } from '@/components/demo/MapView'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import { SiteFicha } from '@/components/demo/comercial/SiteFicha'
import { ReservaDialog } from '@/components/demo/comercial/ReservaDialog'
import { AltaSitioDialog } from '@/components/demo/comercial/AltaSitioDialog'
import { SlotsBadge } from '@/components/demo/SlotsBadge'
import { ClientesBadge } from '@/components/demo/ClientesBadge'
import {
  StatusBadge,
  pinTono,
  SITIO_LABEL,
} from '@/components/demo/StatusBadge'
import { cn } from '@/lib/cn'
import { descargarInventario } from '@/lib/inventario-export'
import { confirmarReservaApi, extenderCampanaApi } from '@/lib/data/estado-api'
import Link from 'next/link'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { TIPO_MEDIO_LABEL } from '@/lib/tipo-medio'
import { ubicacion } from '@/lib/ubicacion'
import { formatNumero } from '@/lib/formato-numero'
import {
  sitiosSinContratoCompleto,
  useSitios,
  useReservas,
  useCampanas,
  useContratos,
  useArrendadores,
  useConfigNegocio,
  tarifaDeSitio,
  rangosDePrecio,
  formatMonto,
  formatMontoCorto,
  formatFecha,
  type Sitio,
} from '@/lib/data/client'

const selectCls =
  'h-9 rounded border border-border-strong bg-surface px-2.5 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

// Leyenda del mapa en UN objeto del módulo, con los textos de `SITIO_LABEL`
// (los mismos que dice la lista). Los colores son los de los pines de
// `MapView` (`TONO_HEX`, que no se exporta y es del Dashboard, así que no se
// toca): si cambian allá, hay que cambiarlos aquí.
const LEYENDA_MAPA: { color: string; label: string }[] = [
  { color: '#0a66ff', label: 'Digital' },
  { color: '#10b981', label: SITIO_LABEL.DISPONIBLE },
  { color: '#ef4444', label: `${SITIO_LABEL.OCUPADO} o ${SITIO_LABEL.BLOQUEADO.toLowerCase()}` },
  { color: '#f59e0b', label: SITIO_LABEL.RESERVADO },
]

// Días que le quedan a una tentativa antes de caducar sola, desde `expiraEn`
// (lo pone el servidor). Sin fecha, no se inventa: la pastilla no se pinta.
function diasParaCaducar(expiraEn: string | null | undefined): number | null {
  if (!expiraEn) return null
  const t = new Date(expiraEn).getTime()
  if (isNaN(t)) return null
  return Math.max(0, Math.ceil((t - Date.now()) / 86_400_000))
}

export default function ComercialPage() {
  const sitios = useSitios()
  const reservas = useReservas()
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
  const [extender, setExtender] = useState<{ id: string; nombre: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Generar el archivo es trabajo sincrono en el navegador y puede fallar con un
  // inventario enorme. Sin este catch el error moria en la consola y el usuario
  // se quedaba mirando un boton que "no hizo nada".
  function bajarInventario(formato: 'xlsx' | 'csv') {
    try {
      descargarInventario(filtrados, formato)
      notify(`Descargadas ${filtrados.length} pantalla${filtrados.length === 1 ? '' : 's'}`)
    } catch {
      notify('No se pudo generar el archivo. Prueba a filtrar para descargar menos pantallas.')
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

  // Campañas con reservas tentativas (para confirmar/extender — Acto 3).
  const tentativas = useMemo(() => {
    const ids = new Set(
      (reservas ?? []).filter((r) => r.estatus === 'TENTATIVA').map((r) => r.campanaId),
    )
    return (campanas ?? []).filter((c) => ids.has(c.id))
  }, [reservas, campanas])

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
  const montoTentativas = (reservas ?? [])
    .filter((r) => r.estatus === 'TENTATIVA')
    .reduce((a, r) => a + r.precio, 0)
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

  async function confirmar(campId: string, nombre: string) {
    await confirmarReservaApi(campId)
    notify(`"${nombre}" confirmada · pines en ocupado`)
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl text-ink">Comercial</h1>
          <p className="mt-1 text-[13px] text-muted">Tu red en el mapa · {conteo(filtrados.length, 'sitio')}</p>
        </div>
        {puedeCrear && (
          <Button variant="success" size="sm" onClick={() => setAltaOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Nueva pantalla
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
              label="Libres para vender"
              value={formatNumero(cifras.libres)}
              sub={`de ${conteo(filtrados.length, 'pantalla')}${filtrosActivos ? ' filtradas' : ''}`}
              tono={cifras.libres > 0 ? 'verde' : 'neutro'}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <KPICard
              label="Slots digitales libres"
              value={cifras.slots == null ? '—' : formatNumero(cifras.slots)}
              sub={
                !cifras.hayDigitales
                  ? 'no hay digitales en la vista'
                  : cifras.slots == null
                    ? 'las digitales no tienen slots capturados'
                    : 'sumando las digitales de la vista'
              }
              tono="azul"
              icon={<LayoutGrid className="h-4 w-4" />}
            />
            <KPICard
              label="Tentativas por confirmar"
              value={formatNumero(tentativas.length)}
              sub={tentativas.length ? `${formatMonto(montoTentativas)}/mes · caducan solas a los 7 días` : 'ninguna reserva esperando'}
              tono={tentativas.length ? 'ambar' : 'neutro'}
              icon={<CalendarClock className="h-4 w-4" />}
            />
            <KPICard
              label="Bloqueadas por contrato"
              value={formatNumero(cifras.bloqueadas)}
              sub={cifras.bloqueadas ? 'contrato incompleto: se arreglan en Arrendadores' : 'todas con contrato completo'}
              tono={cifras.bloqueadas ? 'ambar' : 'neutro'}
              icon={<Lock className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      {/* Reservas tentativas (Acto 3: confirmar / extender). Con el lenguaje
          del Dashboard desde el 26/10: renglones en un `divide-y` y no
          tarjetas dentro de la tarjeta, y el tinte ámbar con tokens. */}
      {tentativas.length > 0 && (
        <CardColapsable
          id="comercial.tentativas"
          titulo="Reservas tentativas"
          icono={<CalendarClock className="h-4 w-4 text-warning" />}
          className="bg-warning-soft"
          headerClassName="px-3 pt-3 pb-2"
          contentClassName="px-3 pb-2"
        >
          <ul className="m-0 list-none divide-y divide-border p-0">
            {tentativas.map((c) => {
              const rs = (reservas ?? []).filter((r) => r.campanaId === c.id && r.estatus === 'TENTATIVA')
              const total = rs.reduce((a, r) => a + r.precio, 0)
              // La que antes caduca manda: es cuando la campaña empieza a
              // perder pantallas.
              const dias = rs
                .map((r) => diasParaCaducar(r.expiraEn))
                .filter((d): d is number => d != null)
                .sort((a, b) => a - b)[0]
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-ink">{c.nombre}</div>
                    <div className="demo-num text-[11px] text-muted">
                      {conteo(rs.length, 'sitio')} · {formatMonto(total)}/mes ·{' '}
                      {rs[0] ? `${formatFecha(rs[0].fechaInicio)}–${formatFecha(rs[0].fechaFin)}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {dias != null && (
                      <span
                        className={cn(
                          'shrink-0 rounded-full border bg-surface px-2 py-0.5 text-[12px] font-medium',
                          dias <= 2 ? 'border-[#ef444440] text-error' : 'border-[#f59e0b40] text-[#9a6700]',
                        )}
                      >
                        {dias === 0 ? 'caduca hoy' : `caduca en ${dias} d`}
                      </span>
                    )}
                    {puedeCrear && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => setExtender({ id: c.id, nombre: c.nombre })}>
                          Extender
                        </Button>
                        <Button size="sm" onClick={() => confirmar(c.id, c.nombre)}>
                          <Check className="h-3.5 w-3.5" /> Confirmar
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
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
            placeholder="Buscar avenida, distrito…"
            className="h-9 w-full rounded border border-border-strong bg-surface pl-8 pr-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
        <select className={selectCls} value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_MEDIO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select className={selectCls} value={fDistrito} onChange={(e) => setFDistrito(e.target.value)}>
          <option value="">Todos los distritos</option>
          {distritos.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select className={selectCls} value={fDisp} onChange={(e) => setFDisp(e.target.value)}>
          <option value="">Toda disponibilidad</option>
          <option value="DISPONIBLE">Disponible</option>
          <option value="OCUPADO">No disponible</option>
          <option value="BLOQUEADO">Bloqueado</option>
        </select>
        {rangosPrecio.length > 0 && (
          <select className={selectCls} value={fPrecio} onChange={(e) => setFPrecio(e.target.value)}>
            <option value="">Cualquier precio</option>
            {rangosPrecio.map((c) => (
              <option key={c} value={c}>
                ≤ {formatMontoCorto(c)}
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
            Limpiar ({filtrosActivos})
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
          titulo="Inventario"
          icono={<SlidersHorizontal className="h-3.5 w-3.5 text-muted" />}
          className="flex max-h-[560px] flex-col overflow-hidden"
          headerClassName="border-b border-border px-3 py-2"
          contentClassName="flex min-h-0 flex-1 flex-col px-0 pb-0"
          resumen={<span className="text-[12px] text-muted">{conteo(filtrados.length, 'resultado')}</span>}
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
                  title="Descargar estas pantallas en Excel"
                  className="rounded border-0 bg-transparent px-1.5 py-0.5 font-medium text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-muted"
                >
                  Excel
                </button>
                <button
                  onClick={() => bajarInventario('csv')}
                  disabled={filtrados.length === 0}
                  title="Descargar estas pantallas en CSV"
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
                Ninguna pantalla cumple:{' '}
                {[
                  q && `«${q}»`,
                  fTipo && `tipo «${TIPO_MEDIO_LABEL[fTipo as keyof typeof TIPO_MEDIO_LABEL] ?? fTipo}»`,
                  fDistrito && fDistrito,
                  fDisp && (fDisp === 'OCUPADO' ? 'no disponible' : fDisp.toLowerCase()),
                  cortePrecio != null && `≤ ${formatMontoCorto(cortePrecio)}`,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'sin pantallas en el inventario'}
                .{filtrosActivos > 0 && ' Quita un filtro o pulsa Limpiar.'}
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
                        aria-label={sel ? 'Quitar de selección' : 'Seleccionar para reservar'}
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
                        <div className="demo-num shrink-0 text-[13px] font-medium text-ink">{formatMonto(tarifaDeSitio(s))}</div>
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
                          <span className="demo-num shrink-0">· {formatNumero(s.spotsPorHora)} slots/h</span>
                        )}
                        <span className="shrink-0">·</span>
                        <UserRound className="h-3.5 w-3.5 shrink-0" />
                        {/* v0.12.3 · una propia no tiene arrendador, y no es un pendiente. */}
                        <span className="truncate" title={s.propio ? 'Pantalla propia' : (propietarioPorSitio.get(s.id) ?? 'Sin arrendador')}>
                          {s.propio ? 'Propia' : (propietarioPorSitio.get(s.id) ?? 'Sin arrendador')}
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
                          title="Completar el contrato en Arrendadores"
                        >
                          <StatusBadge tono="ambar" className="shrink-0 hover:underline">
                            Contrato incompleto
                          </StatusBadge>
                        </Link>
                      ) : (
                        <StatusBadge tono="ambar" className="shrink-0">
                          Contrato incompleto
                        </StatusBadge>
                      )
                    ) : (
                      // El motivo del «no», con la etiqueta fina de
                      // `SITIO_LABEL` (ocupado, bloqueado, en mantenimiento,
                      // tentativo); mismo tono que antes. En una digital el «no»
                      // es por slots, salvo que esté bloqueada.
                      <StatusBadge tono={libre ? 'verde' : 'rojo'}>
                        {libre
                          ? 'Disponible'
                          : esDigital
                            ? s.estatusComercial === 'BLOQUEADO'
                              ? SITIO_LABEL.BLOQUEADO
                              : 'Sin slots libres'
                            : SITIO_LABEL[s.estatusComercial]}
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
                {seleccion.size} sel. ·{' '}
                <span className="demo-num font-medium text-ink">{formatMonto(totalSel)}</span>/mes
              </div>
              <Button size="sm" onClick={() => setReservaOpen(true)}>
                Reservar
              </Button>
            </div>
          )}
        </CardColapsable>

        {/* Mapa */}
        <CardColapsable id="comercial.mapa" titulo="Mapa" className="overflow-hidden" contentClassName="px-0 pb-0">
          <div className="h-[560px] w-full">
            {sitios ? (
              <MapView points={puntos} selectedId={activo} onSelect={abrirFicha} zoom={11} />
            ) : (
              <div className="h-full w-full animate-pulse bg-surface-2" />
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border px-3 py-2 text-[11px] text-muted">
            {LEYENDA_MAPA.map((x) => (
              <Pin key={x.label} color={x.color} label={x.label} />
            ))}
          </div>
        </CardColapsable>
      </div>

      {/* Alta de pantalla */}
      <AltaSitioDialog
        open={altaOpen}
        onOpenChange={setAltaOpen}
        onCreado={(s) => notify(`Pantalla "${s.nombre}" dada de alta`)}
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
            sonner.error('Esa pantalla tiene el contrato de arrendamiento incompleto. Complétalo en Arrendadores para poder venderla.')
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
          notify(`Sitios reservados: "${nombre}"`)
        }}
      />

      {/* Extender campaña */}
      <ExtenderDialog
        campana={extender}
        onClose={() => setExtender(null)}
        onDone={(nombre) => notify(`"${nombre}" extendida`)}
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

function isoDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function ExtenderDialog({
  campana,
  onClose,
  onDone,
}: {
  campana: { id: string; nombre: string } | null
  onClose: () => void
  onDone: (nombre: string) => void
}) {
  const [fin, setFin] = useState(isoDate(60))
  // OBLIG-01 · la nueva fecha de fin es todo lo que pide el diálogo. Vacía,
  // `new Date('')` reventaba al pasarla a ISO sin decir por qué.
  const ob = useObligatorios({ fin }, ['fin'])
  if (!campana) return null
  function cerrar() {
    ob.reiniciar()
    onClose()
  }
  return (
    <Modal
      open={!!campana}
      onOpenChange={(v) => !v && cerrar()}
      title="Extender campaña"
      subtitle={campana.nombre}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              if (!ob.validar()) return
              await extenderCampanaApi(campana.id, new Date(fin).toISOString())
              onDone(campana.nombre)
              cerrar()
            }}
          >
            <CalendarClock className="h-3.5 w-3.5" /> Extender
          </Button>
        </div>
      }
    >
      <Campo
        label={
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-muted" /> Nueva fecha de fin
          </span>
        }
        obligatorio
        falta={ob.falta('fin')}
      >
        <input
          type="date"
          value={fin}
          onChange={(e) => setFin(e.target.value)}
          className="h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </Campo>
    </Modal>
  )
}
