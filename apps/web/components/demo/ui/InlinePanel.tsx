'use client'

import { cn } from '@/lib/cn'

// Panel plano en página (mismo cromo que Modal pero SIN overlay ni portal).
// Para flujos que viven en una pantalla propia, no en un diálogo emergente.
export function InlinePanel({
  title,
  subtitle,
  children,
  footer,
  className,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-md border border-border bg-surface', className)}>
      <div className="border-b border-border px-5 py-4">
        <div className="text-base font-semibold text-ink">{title}</div>
        {subtitle ? <div className="mt-0.5 text-[12px] text-muted">{subtitle}</div> : null}
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer ? <div className="border-t border-border px-5 py-3">{footer}</div> : null}
    </div>
  )
}
