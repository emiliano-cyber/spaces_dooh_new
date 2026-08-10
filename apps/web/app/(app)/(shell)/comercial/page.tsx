'use client'

import { useMemo, useState } from 'react'
import { conteo } from '@/lib/plural'
// Alias: `toast` ya es el estado del toast local de esta página.
import { toast as sonner } from 'sonner'
import { Search, SlidersHorizontal, MapPin, Check, CheckCircle2, CalendarClock, Plus, UserRound, Download } from 'lucide-react'
import { MapView, type MapPoint } from '@/components/demo/MapView'
import { Card } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { SiteFicha } from '@/components/demo/comercial/SiteFicha'
import { ReservaDialog } from '@/components/demo/comercial/ReservaDialog'
import { AltaSitioDialog } from '@/components/demo/comercial/AltaSitioDialog'
import { SlotsBadge } from '@/components/demo/SlotsBadge'
import { ClientesBadge } from '@/components/demo/ClientesBadge'
import {
  StatusBadge,
  pinTono,
} from '@/components/demo/StatusBadge'
import { cn } from '@/lib/cn'
import { descargarInventario } from '@/lib/inventario-export'
import { confirmarReservaApi, extenderCampanaApi } from '@/lib/data/estado-api'
import Link from 'next/link'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { TIPO_MEDIO_LABEL } from '@/lib/tipo-medio'
import { ubicacion } from '@/lib/ubicacion'
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
          <Button size="sm" onClick={() => setAltaOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Nueva pantalla
          </Button>
        )}
      </div>

      {/* Reservas tentativas (Acto 3: confirmar / extender) */}
      {tentativas.length > 0 && (
        <Card className="border-[#f59e0b40] bg-[#f59e0b0a] p-3">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-ink">
            <CalendarClock className="h-4 w-4 text-warning" /> Reservas tentativas
          </div>
          <ul className="space-y-2">
            {tentativas.map((c) => {
              const rs = (reservas ?? []).filter((r) => r.campanaId === c.id && r.estatus === 'TENTATIVA')
              const total = rs.reduce((a, r) => a + r.precio, 0)
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-surface px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-ink">{c.nombre}</div>
                    <div className="demo-num text-[11px] text-muted">
                      {conteo(rs.length, 'sitio')} · {formatMonto(total)}/mes ·{' '}
                      {rs[0] ? `${formatFecha(rs[0].fechaInicio)}–${formatFecha(rs[0].fechaFin)}` : ''}
                    </div>
                  </div>
                  <div className="flex gap-2">
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
        </Card>
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
      </div>

      {/* Lista + Mapa */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[440px_1fr]">
        {/* Lista */}
        <Card className="flex max-h-[560px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Inventario
            </span>
            <span className="inline-flex items-center gap-2">
              <span>{conteo(filtrados.length, 'resultado')}</span>
              {/* Baja lo que hay en pantalla, con los filtros aplicados. Aqui
                  eso es lo util: se filtra por zona o disponibilidad para armar
                  una propuesta, y el archivo tiene que ser ESE recorte, no el
                  inventario entero. Mismo formato que la plantilla de carga, asi
                  que tambien sirve para editar en masa y volver a subirlo. */}
              <span className="flex items-center gap-1 border-l border-border pl-2">
                <Download className="h-3.5 w-3.5" />
                <button
                  onClick={() => bajarInventario('xlsx')}
                  disabled={filtrados.length === 0}
                  title="Descargar estas pantallas en Excel"
                  className="rounded px-1.5 py-0.5 font-medium text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-muted"
                >
                  Excel
                </button>
                <button
                  onClick={() => bajarInventario('csv')}
                  disabled={filtrados.length === 0}
                  title="Descargar estas pantallas en CSV"
                  className="rounded px-1.5 py-0.5 font-medium text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-muted"
                >
                  CSV
                </button>
              </span>
            </span>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {!sitios ? (
              Array.from({ length: 8 }).map((_, i) => (
                <li key={i} className="border-b border-border px-3 py-3">
                  <div className="h-3 w-40 animate-pulse rounded bg-surface-2" />
                  <div className="mt-2 h-2.5 w-24 animate-pulse rounded bg-surface-2" />
                </li>
              ))
            ) : filtrados.length === 0 ? (
              <li className="px-4 py-10 text-center text-[13px] text-muted">
                Ningún sitio coincide con los filtros.
              </li>
            ) : (
              filtrados.map((s) => {
                // Ocupación de una pantalla DIGITAL = por slots: es seleccionable
                // mientras le queden slots libres (sin importar el flag heredado),
                // y deja de serlo cuando llega a 0. Las estáticas van por estatus.
                const esDigital =
                  s.tipoMedio === 'PANTALLA_DIGITAL' ||
                  s.esRotativo ||
                  s.exhibicion === 'digital' ||
                  s.exhibicion === 'rotativo'
                const slotsLibres = s.spotsDisponibles ?? s.totalSpots ?? null
                const disponible = esDigital
                  ? s.estatusComercial !== 'BLOQUEADO' && (slotsLibres == null || slotsLibres > 0)
                  : s.estatusComercial === 'DISPONIBLE'
                // Sin contrato completo no hay derecho que vender, aunque el
                // inventario diga que está libre (ADR 0003).
                const bloqueadaPorContrato = sinContrato.has(s.id)
                const libre = disponible && !bloqueadaPorContrato
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
                          sel ? 'border-accent bg-accent text-accent-fg' : 'border-border-strong',
                        )}
                        style={{ height: 18, width: 18 }}
                        aria-label={sel ? 'Quitar de selección' : 'Seleccionar para reservar'}
                      >
                        {sel && <Check className="h-3 w-3" strokeWidth={3} />}
                      </button>
                    ) : (
                      <span className="h-[18px] w-[18px] shrink-0" />
                    )}
                    <button
                      type="button"
                      onClick={() => abrirFicha(s.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      {/* B2: los nombres largos se cortaban («AUTOPISTA MEX…») y no
                          había forma de leerlos enteros sin abrir la ficha. El
                          `title` los da al pasar el ratón; se deja el truncado
                          porque la tarjeta tiene que caber en la rejilla. */}
                      <div className="truncate text-[15px] font-medium text-ink" title={s.nombre}>{s.nombre}</div>
                      <div className="demo-num mt-0.5 text-[12.5px] text-muted">
                        {s.codigoProveedor} · {ubicacion([s.alcaldia, s.ciudad])} · {formatMonto(tarifaDeSitio(s))}
                        {esDigital && s.totalSpots == null && s.spotsPorHora != null && (
                          <> · {s.spotsPorHora} slots/h</>
                        )}
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1.5 truncate text-[12px] text-muted">
                        <UserRound className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate" title={propietarioPorSitio.get(s.id) ?? 'Sin arrendador'}>
                          {propietarioPorSitio.get(s.id) ?? 'Sin arrendador'}
                        </span>
                      </div>
                    </button>
                    {/* Disponibilidad por spots: las digitales muestran X/12 y las
                        fijas Disponible/No disponible. Sin estado "tentativo". */}
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
                      <StatusBadge tono={libre ? 'verde' : 'rojo'}>
                        {libre ? 'Disponible' : 'No disponible'}
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
        </Card>

        {/* Mapa */}
        <Card className="overflow-hidden">
          <div className="h-[560px] w-full">
            {sitios ? (
              <MapView points={puntos} selectedId={activo} onSelect={abrirFicha} zoom={11} />
            ) : (
              <div className="h-full w-full animate-pulse bg-surface-2" />
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border px-3 py-2 text-[11px] text-muted">
            <Pin color="#0a66ff" label="Digital" />
            <Pin color="#10b981" label="Disponible" />
            <Pin color="#ef4444" label="Ocupado" />
            <Pin color="#f59e0b" label="Reservado · tentativo" />
          </div>
        </Card>
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
  if (!campana) return null
  return (
    <Modal
      open={!!campana}
      onOpenChange={(v) => !v && onClose()}
      title="Extender campaña"
      subtitle={campana.nombre}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              await extenderCampanaApi(campana.id, new Date(fin).toISOString())
              onDone(campana.nombre)
              onClose()
            }}
          >
            <CalendarClock className="h-3.5 w-3.5" /> Extender
          </Button>
        </div>
      }
    >
      <label className="block">
        <span className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-ink">
          <MapPin className="h-3.5 w-3.5 text-muted" /> Nueva fecha de fin
        </span>
        <input
          type="date"
          value={fin}
          onChange={(e) => setFin(e.target.value)}
          className="h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
    </Modal>
  )
}
