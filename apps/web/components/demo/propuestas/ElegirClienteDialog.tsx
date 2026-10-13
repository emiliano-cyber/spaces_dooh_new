'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import type { Cliente } from '@/lib/data/types'

// Una propuesta se puede aprobar sin cliente, pero sin él no se genera la
// campaña (no habría a quién facturar), y aprobada ya no se edita. Este diálogo
// sale al pulsar «Generar campaña» en ese caso (13/10). Las reglas —solo si
// falta, solo anunciante, mismo IVA con el que se aprobó— las aplica el
// servidor (`asignarClienteAPropuestaAprobada`); su mensaje se enseña tal cual.
export function ElegirClienteDialog({
  open,
  onOpenChange,
  clientes,
  onElegir,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  clientes: Cliente[] | undefined
  onElegir: (clienteId: string) => Promise<void>
}) {
  const [clienteId, setClienteId] = useState('')
  const [enviando, setEnviando] = useState(false)
  useEffect(() => {
    if (open) setClienteId('')
  }, [open])

  // Mismo filtro que el selector al crear la propuesta: las agencias van aparte.
  const anunciantes = (clientes ?? []).filter((c) => c.tipo !== 'AGENCIA')

  async function confirmar() {
    if (!clienteId) return
    setEnviando(true)
    try {
      await onElegir(clienteId)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="¿A qué cliente se le factura?"
      subtitle="La propuesta se aprobó sin cliente. Elígelo para generar la campaña; después ya no se cambia."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" disabled={!clienteId || enviando} onClick={() => void confirmar()}>
            {enviando ? 'Generando…' : 'Poner cliente y generar campaña'}
          </Button>
        </div>
      }
    >
      {anunciantes.length === 0 ? (
        <p className="text-[13px] text-muted">
          No hay clientes. Créalo primero en Clientes y vuelve a esta propuesta.
        </p>
      ) : (
        <label className="block text-[12px] font-medium text-muted">
          Cliente
          <select
            className="mt-1 h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            autoFocus
          >
            <option value="">— Elige el cliente —</option>
            {anunciantes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}{c.ivaPct !== 16 ? ` (IVA ${c.ivaPct} %)` : ''}
              </option>
            ))}
          </select>
        </label>
      )}
    </Modal>
  )
}
