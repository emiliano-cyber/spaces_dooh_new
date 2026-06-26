'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

// Ancho máximo en desktop. En móvil siempre es w-full (se topa con el viewport),
// así que el tamaño en celular no cambia entre variantes.
type ModalSize = 'md' | 'lg' | 'xl'
const SIZE_MAX: Record<ModalSize, string> = {
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
}

// Modal centrado plano, 1px. Para formularios cortos (p. ej. reservar).
export function Modal({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: ModalSize
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className={cn(
          'demo-root fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-surface data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          SIZE_MAX[size],
        )}>
          <div className="flex items-start justify-between border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
              {subtitle ? (
                <Dialog.Description className="mt-0.5 text-[12px] text-muted">
                  {subtitle}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close className="flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-surface-2">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="px-5 py-4">{children}</div>
          {footer ? <div className="border-t border-border px-5 py-3">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
