'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

// Panel lateral derecho (drawer) plano, 1px. Para fichas de detalle.
export function Sheet({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="demo-root fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l border-border bg-surface data-[state=open]:animate-in data-[state=open]:slide-in-from-right">
          <div className="flex items-start justify-between border-b border-border px-5 py-4">
            <div className="min-w-0">
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
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <div className="border-t border-border px-5 py-3">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
