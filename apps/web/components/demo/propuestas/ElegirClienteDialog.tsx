'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import type { Cliente } from '@/lib/data/types'
import { useTexto } from '@/lib/i18n/contexto'

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
  const t = useTexto()
  const [clienteId, setClienteId] = useState('')
  const [enviando, setEnviando] = useState(false)
  // OBLIG-01 · el cliente es lo único que pide el diálogo: sin él no hay a quién
  // facturar. El botón ya no se apaga por eso; se pulsa y el selector sale en rojo.
  const ob = useObligatorios({ clienteId }, ['clienteId'])
  const { reiniciar } = ob
  useEffect(() => {
    if (open) {
      setClienteId('')
      reiniciar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Mismo filtro que el selector al crear la propuesta: las agencias van aparte.
  const anunciantes = (clientes ?? []).filter((c) => c.tipo !== 'AGENCIA')

  async function confirmar() {
    if (!ob.validar()) return
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
      title={t('propuestas.elegir-cliente.titulo')}
      subtitle={t('propuestas.elegir-cliente.subtitulo')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>{t('comun.cancelar')}</Button>
          <Button size="sm" disabled={enviando || anunciantes.length === 0} onClick={() => void confirmar()}>
            {enviando ? t('propuestas.comun.generando') : t('propuestas.elegir-cliente.confirmar')}
          </Button>
        </div>
      }
    >
      {anunciantes.length === 0 ? (
        <p className="text-[13px] text-muted">
          {t('propuestas.elegir-cliente.sin-clientes')}
        </p>
      ) : (
        <Campo label={t('propuestas.comun.cliente')} obligatorio falta={ob.falta('clienteId')}>
          <select
            className="h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            autoFocus
          >
            <option value="">{t('propuestas.elegir-cliente.elige')}</option>
            {anunciantes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}{c.ivaPct !== 16 ? t('propuestas.elegir-cliente.iva', { pct: c.ivaPct }) : ''}
              </option>
            ))}
          </select>
        </Campo>
      )}
    </Modal>
  )
}
