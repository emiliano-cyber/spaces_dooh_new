'use client'

import { useMemo, useState } from 'react'
import { Search, SlidersHorizontal, MapPin, Check, CheckCircle2, CalendarClock } from 'lucide-react'
import { MapView, type MapPoint } from '@/components/demo/MapView'
import { Card } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { SiteFicha } from '@/components/demo/comercial/SiteFicha'
import { ReservaDialog } from '@/components/demo/comercial/ReservaDialog'
import {
  StatusBadge,
  SITIO_TONO,
  SITIO_LABEL,
} from '@/components/demo/StatusBadge'
import { cn } from '@/lib/cn'
import {
  useSitios,
  useReservas,
  useCampanas,
  data,
  formatMonto,
  formatFecha,
  type Sitio,
  type TipoMedio,
} from '@/lib/data/client'

const TIPO_LABEL: Record<TipoMedio, string> = {
  ESPECTACULAR: 'Espectacular',
  PANTALLA_DIGITAL: 'Pantalla digital',
  PUENTE_PEATONAL: 'Puente peatonal',
  MOBILIARIO_URBANO: 'Mobiliario urbano',
  MURAL: 'Mural',
  VALLA: 'Valla',
  OTRO: 'Otro',
}

const selectCls =
  'h-9 rounded border border-border-strong bg-surface px-2.5 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

export default function ComercialPage() {
  const sitios = useSitios()
  const reservas = useReservas()
  const campanas = useCampanas()

  const [q, setQ] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fDistrito, setFDistrito] = useState('')
  const [fDisp, setFDisp] = useState('')
  const [fPrecio, setFPrecio] = useState('')

  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [activo, setActivo] = useState<string | null>(null)
  const [fichaOpen, setFichaOpen] = useState(false)
  const [reservaOpen, setReservaOpen] = useState(false)
  const [extender, setExtender] = useState<{ id: string; nombre: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  const distritos = useMemo(
    () => Array.from(new Set((sitios ?? []).map((s) => s.alcaldia).filter(Boolean))).sort() as string[],
    [sitios],
  )

  const filtrados = useMemo(() => {
    return (sitios ?? []).filter((s) => {
      if (q && !`${s.nombre} ${s.direccion} ${s.alcaldia}`.toLowerCase().includes(q.toLowerCase()))
        return false
      if (fTipo && s.tipoMedio !== fTipo) return false
      if (fDistrito && s.alcaldia !== fDistrito) return false
      if (fDisp && s.estatusComercial !== fDisp) return false
      if (fPrecio && s.tarifaMensual > Number(fPrecio)) return false
      return true
    })
  }, [sitios, q, fTipo, fDistrito, fDisp, fPrecio])

  const puntos: MapPoint[] = filtrados.map((s) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    tono: SITIO_TONO[s.estatusComercial],
    label: s.nombre,
  }))

  const sitioActivo = sitios?.find((s) => s.id === activo) ?? null
  const sitiosSeleccionados = (sitios ?? []).filter((s) => seleccion.has(s.id))
  const totalSel = sitiosSeleccionados.reduce((a, s) => a + s.tarifaMensual, 0)

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
    await data.confirmarReserva(campId)
    notify(`"${nombre}" confirmada · pines en ocupado`)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Comercial</h1>
        <p className="mt-1 text-[13px] text-muted">Tu red en el mapa · {filtrados.length} sitios</p>
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
                      {rs.length} sitios · {formatMonto(total)}/mes ·{' '}
                      {rs[0] ? `${formatFecha(rs[0].fechaInicio)}–${formatFecha(rs[0].fechaFin)}` : ''}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setExtender({ id: c.id, nombre: c.nombre })}>
                      Extender
                    </Button>
                    <Button size="sm" onClick={() => confirmar(c.id, c.nombre)}>
                      <Check className="h-3.5 w-3.5" /> Confirmar
                    </Button>
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
          {Object.entries(TIPO_LABEL).map(([k, v]) => (
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
          <option value="RESERVADO">Reservado</option>
          <option value="OCUPADO">Ocupado</option>
          <option value="BLOQUEADO">Bloqueado</option>
        </select>
        <select className={selectCls} value={fPrecio} onChange={(e) => setFPrecio(e.target.value)}>
          <option value="">Cualquier precio</option>
          <option value="8000">≤ S/ 8k</option>
          <option value="15000">≤ S/ 15k</option>
          <option value="25000">≤ S/ 25k</option>
        </select>
      </div>

      {/* Lista + Mapa */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        {/* Lista */}
        <Card className="flex max-h-[560px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Inventario
            </span>
            <span>{filtrados.length} resultados</span>
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
                const libre = s.estatusComercial === 'DISPONIBLE'
                const sel = seleccion.has(s.id)
                return (
                  <li
                    key={s.id}
                    className={cn(
                      'flex items-center gap-2.5 border-b border-border px-3 py-2.5 transition-colors duration-150',
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
                      <div className="truncate text-[13px] text-ink">{s.nombre}</div>
                      <div className="demo-num text-[11px] text-muted">
                        {s.alcaldia} · {formatMonto(s.tarifaMensual)}
                      </div>
                    </button>
                    <StatusBadge tono={SITIO_TONO[s.estatusComercial]}>
                      {SITIO_LABEL[s.estatusComercial]}
                    </StatusBadge>
                  </li>
                )
              })
            )}
          </ul>

          {/* Barra de acción de selección */}
          {seleccion.size > 0 && (
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
            <Pin color="#10b981" label="Disponible / confirmado" />
            <Pin color="#f59e0b" label="Reservado" />
            <Pin color="#ef4444" label="Bloqueado por incidencia" />
          </div>
        </Card>
      </div>

      {/* Ficha de sitio */}
      <SiteFicha
        sitio={sitioActivo}
        open={fichaOpen}
        onOpenChange={setFichaOpen}
        onReservar={(id) => {
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
          notify(`Reserva tentativa creada: "${nombre}"`)
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
              await data.extenderCampana(campana.id, new Date(fin).toISOString())
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
