'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { reservarApi } from '@/lib/data/estado-api'
import {
  formatMonto,
  tarifaDeSitio,
  useConfigNegocio,
  useReservas,
  useCampanas,
  useClientes,
  clientesEnPantalla,
  cupoDePantalla,
  type Sitio,
} from '@/lib/data/client'

// Modal de reserva (Acto 3): captura cliente + fechas y crea una reserva
// TENTATIVA sobre los sitios seleccionados. Llama a data.reservar (mock).

function isoDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

const TIPO_LABEL: Record<'DOOH' | 'OOH' | 'HIBRIDA', string> = {
  DOOH: 'Digital',
  OOH: 'Fijo',
  HIBRIDA: 'Híbrida',
}

// Una pantalla es digital (con inventario de spots) por su medio/exhibición.
function esDigital(s: Sitio): boolean {
  return (
    s.tipoMedio === 'PANTALLA_DIGITAL' ||
    s.esRotativo ||
    s.exhibicion === 'digital' ||
    s.exhibicion === 'rotativo'
  )
}
// Spots disponibles del sitio (cae a total si no hay disponibles, o 0).
function dispOf(s: Sitio): number {
  return s.spotsDisponibles ?? s.totalSpots ?? 0
}

export function ReservaDialog({
  open,
  onOpenChange,
  sitios,
  onReserved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  sitios: Sitio[]
  onReserved: (campanaId: string, nombre: string) => void
}) {
  const [cliente, setCliente] = useState('')
  const [nombre, setNombre] = useState('')
  const [inicio, setInicio] = useState(isoDate(7))
  const [fin, setFin] = useState(isoDate(37))
  const [tipo, setTipo] = useState<'AUTO' | 'DOOH' | 'OOH' | 'HIBRIDA'>('AUTO')
  // Spots a reservar por sitio digital (sitioId → cantidad). Si no hay valor,
  // el default es reservar todos los disponibles.
  const [spots, setSpots] = useState<Record<string, number>>({})
  const [enviando, setEnviando] = useState(false)
  const config = useConfigNegocio()
  const spotsPorLoop = config && config.spotSeg > 0 ? Math.floor(config.loopSeg / config.spotSeg) : 0
  // Pantallas de esta reserva cuyo número de slots NO es el del loop global.
  // Son las que hacen que el recuadro de arriba parezca contradecirse (M12).
  const conSlotsPropios = sitios.filter(
    (s) => (s.totalSpots ?? 0) > 0 && s.totalSpots !== spotsPorLoop && esDigital(s),
  )

  const reservedOf = (s: Sitio) => spots[s.id] ?? dispOf(s)

  // ─── ADR 0008 · aviso de cupo de clientes ─────────────────────────────────
  // Aquí ya se sabe PARA QUIÉN se reserva, así que se puede decir por adelantado
  // qué pantallas va a rechazar el servidor: las que tienen el cupo lleno y no
  // cuentan todavía a este cliente. El servidor sigue siendo quien decide (esto
  // es el mismo cálculo, no una autorización); el aviso solo evita el viaje.
  const reservas = useReservas()
  const campanas = useCampanas()
  const clientes = useClientes()
  // Mismo criterio de nombre que usa el servidor al deduplicar clientes.
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

  const sinCupo = useMemo(() => {
    if (!cliente.trim() || !reservas || !campanas || !clientes) return []
    const desde = new Date(`${inicio}T00:00:00`).getTime()
    const hasta = new Date(`${fin}T23:59:59`).getTime()
    if (isNaN(desde) || isNaN(hasta)) return []
    const nombrePorCliente = new Map(clientes.map((c) => [c.id, c.nombre]))
    // El cliente tecleado puede ser uno que YA existe: el servidor reutiliza la
    // ficha por nombre normalizado en vez de crear otra, así que aquí se busca
    // igual. Si es de verdad nuevo, no ocupa cupo en ninguna pantalla todavía.
    const idsDelCliente = new Set(
      clientes.filter((c) => norm(c.nombre) === norm(cliente)).map((c) => c.id),
    )

    const avisos: { nombre: string; cupo: number; ocupantes: string[] }[] = []
    for (const s of sitios) {
      const cupo = cupoDePantalla(s, config)
      if (cupo == null) continue
      const ocupantes = clientesEnPantalla({ reservas, campanas }, s.id, desde, hasta)
      const yaEsta = ocupantes.some((id) => idsDelCliente.has(id))
      if (!yaEsta && ocupantes.length >= cupo) {
        avisos.push({
          nombre: s.nombre,
          cupo,
          ocupantes: ocupantes.map((id) => nombrePorCliente.get(id) ?? '—'),
        })
      }
    }
    return avisos
  }, [cliente, inicio, fin, sitios, reservas, campanas, clientes, config])

  const total = sitios.reduce((s, x) => s + tarifaDeSitio(x), 0)

  // Tipo que se asignaría en modo "Automático", según el medio de los sitios
  // seleccionados (pantallas digitales → DOOH; estáticas → OOH; mezcla → HIBRIDA).
  const digitales = sitios.filter(esDigital).length
  const autoTipo: 'DOOH' | 'OOH' | 'HIBRIDA' =
    sitios.length > 0 && digitales === sitios.length
      ? 'DOOH'
      : digitales === 0
        ? 'OOH'
        : 'HIBRIDA'

  // Spots a reservar por cada pantalla digital seleccionada.
  const spotsPorSitio: Record<string, number> = {}
  for (const s of sitios) if (esDigital(s)) spotsPorSitio[s.id] = reservedOf(s)
  const totalSpotsReservados = Object.values(spotsPorSitio).reduce((a, b) => a + b, 0)

  async function submit() {
    if (!cliente.trim() || sitios.length === 0) return
    setEnviando(true)
    const camp = await reservarApi({
      clienteNombre: cliente.trim(),
      nombreCampana: nombre.trim() || `${cliente.trim()} — campaña`,
      sitioIds: sitios.map((s) => s.id),
      fechaInicio: new Date(inicio).toISOString(),
      fechaFin: new Date(fin).toISOString(),
      tipoCampana: tipo === 'AUTO' ? undefined : tipo,
      spotsPorSitio: Object.keys(spotsPorSitio).length ? spotsPorSitio : undefined,
    })
    setEnviando(false)
    onReserved(camp.id, camp.nombre)
    setCliente('')
    setNombre('')
    setTipo('AUTO')
    setSpots({})
    onOpenChange(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Reservar sitios"
      subtitle={`${sitios.length} sitio${sitios.length === 1 ? '' : 's'} seleccionado${sitios.length === 1 ? '' : 's'}`}
      footer={
        <div className="flex items-center justify-between">
          <div className="text-[12px] text-muted">
            Total mensual{' '}
            <span className="demo-num font-semibold text-ink">{formatMonto(total)}</span>
            {totalSpotsReservados > 0 && (
              <>
                {' · '}
                <span className="demo-num font-semibold text-ink">{totalSpotsReservados}</span> slots
                {config && (
                  <>
                    {' · '}
                    <span className="demo-num font-semibold text-ink">{config.spotSeg}s</span> c/u
                  </>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={submit} disabled={enviando || !cliente.trim()}>
              {enviando ? 'Reservando…' : 'Reservar (tentativa)'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <Campo label="Cliente">
          <input
            className={inputCls}
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder="p. ej. Seguros Andinos"
            autoFocus
          />
        </Campo>
        <Campo label="Nombre de campaña (opcional)">
          <input
            className={inputCls}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="p. ej. Lanzamiento Q3"
          />
        </Campo>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Inicio">
            <input type="date" className={inputCls} value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </Campo>
          <Campo label="Fin">
            <input type="date" className={inputCls} value={fin} onChange={(e) => setFin(e.target.value)} />
          </Campo>
        </div>
        <Campo label="Tipo de campaña">
          <select
            className={inputCls}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as typeof tipo)}
          >
            <option value="AUTO">Automático ({TIPO_LABEL[autoTipo]} — según sitios)</option>
            <option value="DOOH">Digital (DOOH) — sin imprenta</option>
            <option value="OOH">Fijo (OOH) — con imprenta</option>
            <option value="HIBRIDA">Híbrida — con imprenta</option>
          </select>
        </Campo>
        {/* Estructura del loop digital (de Ajustes) — solo si hay pantallas digitales.
            M12: este número es de REFERENCIA. Lo que se aparta son los slots de
            cada pantalla (`totalSpots`), y la auditoría vio «6 slots por loop»
            aquí mientras se reservaban pantallas de 10 y 12 — sin nada que
            dijera cuál de los dos mandaba. Ahora se avisa cuando difieren. */}
        {digitales > 0 && config && (
          <div className="rounded-md border border-[#0a66ff33] bg-[#0a66ff0a] px-3 py-2 text-[12px] text-ink">
            Loop de <span className="demo-num font-medium">{config.loopSeg}s</span> · slot de{' '}
            <span className="demo-num font-medium">{config.spotSeg}s</span> →{' '}
            <span className="demo-num font-semibold">{spotsPorLoop}</span> slots por loop
            <span className="ml-1 text-muted">(referencia, de Administración → Configuración)</span>
            {conSlotsPropios.length > 0 && (
              <div className="mt-1 text-muted">
                {conSlotsPropios.length === 1
                  ? `${conSlotsPropios[0].nombre} tiene ${conSlotsPropios[0].totalSpots} slots propios y manda sobre este número.`
                  : `${conSlotsPropios.length} de las pantallas elegidas tienen su propio número de slots, y manda el suyo.`}
              </div>
            )}
          </div>
        )}

        {/* ADR 0008: el rechazo del servidor es de toda la reserva, así que más
            vale decirlo antes y nombrar la pantalla que hay que quitar. */}
        {sinCupo.length > 0 && (
          <div className="rounded-md border border-[#f59e0b66] bg-warning-soft px-3 py-2 text-[12px] text-[#9a6700]">
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <span className="font-semibold">
                  {sinCupo.length === 1 ? 'Una pantalla ya llegó a su cupo de clientes' : `${sinCupo.length} pantallas ya llegaron a su cupo de clientes`}
                </span>
                <ul className="mt-1 space-y-0.5">
                  {sinCupo.map((a) => (
                    <li key={a.nombre}>
                      <span className="font-medium">{a.nombre}</span> — {a.cupo}{' '}
                      {a.cupo === 1 ? 'cliente' : 'clientes'} en esas fechas ({a.ocupantes.join(', ')})
                    </li>
                  ))}
                </ul>
                <p className="mt-1">
                  La reserva se rechazará completa. Quita esas pantallas, cambia las fechas, o sube su
                  cupo desde su ficha.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded border border-border bg-surface-2 p-2.5">
          <ul className="space-y-2 text-[12px]">
            {sitios.map((s) => {
              const digital = esDigital(s)
              const disp = dispOf(s)
              const reservados = Math.min(reservedOf(s), disp)
              const quedan = Math.max(0, disp - reservados)
              return (
                <li key={s.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-ink">{s.nombre}</span>
                    <span className="demo-num text-muted">{formatMonto(tarifaDeSitio(s))}</span>
                  </div>
                  {digital && (
                    <div className="flex items-center justify-between gap-2 pl-1">
                      <span className="text-[11px] text-muted">
                        Reserva{' '}
                        <input
                          type="number"
                          min={0}
                          max={disp}
                          value={reservados}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(disp, Math.round(Number(e.target.value) || 0)))
                            setSpots((prev) => ({ ...prev, [s.id]: v }))
                          }}
                          className="demo-num mx-1 h-7 w-16 rounded border border-border-strong bg-surface px-2 text-right text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        />{' '}
                        de {disp} slots
                      </span>
                      <span className="text-[11px] text-muted">
                        Quedan <span className="demo-num font-semibold text-ink">{quedan}</span>
                      </span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </Modal>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-ink">{label}</span>
      {children}
    </label>
  )
}
