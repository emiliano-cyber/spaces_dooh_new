'use client'

import type { ReactNode } from 'react'
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
}) {
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
          <Button size="sm" variant={variant} disabled={busy} onClick={onConfirm}>
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
        <div className="text-[13px] leading-relaxed text-muted">{children}</div>
      </div>
    </Modal>
  )
}
