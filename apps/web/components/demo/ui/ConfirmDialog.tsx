'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'

// Diálogo de confirmación en el lenguaje de la app (reemplaza a window.confirm).
// Controlado: `open` + `onOpenChange`. `onConfirm` ejecuta la acción; `busy`
// bloquea mientras corre.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  busy = false,
  onConfirm,
  confirmarEscribiendo,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  children: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'primary' | 'danger'
  busy?: boolean
  onConfirm: () => void
  // Confirmación TIPADA: el usuario tiene que escribir este texto para poder
  // confirmar (B7 de la auditoría). Se reserva para lo irreversible: obliga a
  // leer QUÉ se está borrando, que es justo lo que un clic reflejo no hace.
  // Sin esta prop, el diálogo se comporta como siempre.
  confirmarEscribiendo?: string
}) {
  const [tecleado, setTecleado] = useState('')
  // Al cerrarlo se limpia: si no, reabrirlo para OTRA pantalla llegaría con el
  // nombre de la anterior ya escrito y el botón activo — exactamente el borrado
  // accidental que esto viene a evitar.
  useEffect(() => { if (!open) setTecleado('') }, [open])
  const coincide =
    !confirmarEscribiendo || tecleado.trim().toLowerCase() === confirmarEscribiendo.trim().toLowerCase()

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !busy && onOpenChange(v)}
      title={title}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button size="sm" variant={variant} disabled={busy || !coincide} onClick={onConfirm}>
            {busy ? 'Procesando…' : confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={
            variant === 'danger'
              ? 'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-error-soft text-error'
              : 'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent'
          }
        >
          <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-muted">
          {children}
          {confirmarEscribiendo && (
            <label className="mt-3 block">
              <span className="block text-[12px] text-ink">
                Escribe <span className="font-medium">{confirmarEscribiendo}</span> para confirmar
              </span>
              <input
                value={tecleado}
                onChange={(e) => setTecleado(e.target.value)}
                disabled={busy}
                autoComplete="off"
                className="mt-1 h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </label>
          )}
        </div>
      </div>
    </Modal>
  )
}
