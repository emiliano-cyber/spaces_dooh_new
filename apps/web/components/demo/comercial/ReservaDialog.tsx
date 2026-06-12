'use client'

import { useState } from 'react'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { data, formatMonto, type Sitio } from '@/lib/data/client'

// Modal de reserva (Acto 3): captura cliente + fechas y crea una reserva
// TENTATIVA sobre los sitios seleccionados. Llama a data.reservar (mock).

function isoDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

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
  const [enviando, setEnviando] = useState(false)

  const total = sitios.reduce((s, x) => s + x.tarifaMensual, 0)

  async function submit() {
    if (!cliente.trim() || sitios.length === 0) return
    setEnviando(true)
    const camp = await data.reservar({
      clienteNombre: cliente.trim(),
      nombreCampana: nombre.trim() || `${cliente.trim()} — campaña`,
      sitioIds: sitios.map((s) => s.id),
      fechaInicio: new Date(inicio).toISOString(),
      fechaFin: new Date(fin).toISOString(),
    })
    setEnviando(false)
    onReserved(camp.id, camp.nombre)
    setCliente('')
    setNombre('')
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
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={submit} disabled={enviando || !cliente.trim()}>
              {enviando ? 'Reservando…' : 'Reservar (tentativo)'}
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
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Inicio">
            <input type="date" className={inputCls} value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </Campo>
          <Campo label="Fin">
            <input type="date" className={inputCls} value={fin} onChange={(e) => setFin(e.target.value)} />
          </Campo>
        </div>
        <div className="rounded border border-border bg-surface-2 p-2.5">
          <ul className="space-y-1 text-[12px]">
            {sitios.map((s) => (
              <li key={s.id} className="flex items-center justify-between">
                <span className="truncate text-ink">{s.nombre}</span>
                <span className="demo-num text-muted">{formatMonto(s.tarifaMensual)}</span>
              </li>
            ))}
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
