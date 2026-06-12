'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

// Empty state diseñado (icono + frase + acción opcional). Nunca "No hay datos".
export function EmptyState({
  icon: Icon,
  titulo,
  detalle,
  accion,
  className,
}: {
  icon: LucideIcon
  titulo: string
  detalle?: string
  accion?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-2 text-muted">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-ink">{titulo}</p>
      {detalle ? <p className="mt-1 max-w-sm text-[13px] text-muted">{detalle}</p> : null}
      {accion ? <div className="mt-4">{accion}</div> : null}
    </div>
  )
}
