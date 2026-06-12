'use client'

import { cn } from '@/lib/cn'
import type { Tono } from './StatusBadge'

// ============================================================================
//  KPICard — tarjeta de indicador grande, legible a 3 metros (proyector).
//  Número en JetBrains Mono (dato técnico). Plano, 1px, sin sombra.
// ============================================================================

const TONO_NUM: Record<Tono, string> = {
  verde: 'text-success',
  ambar: 'text-warning',
  rojo: 'text-error',
  azul: 'text-info',
  neutro: 'text-ink',
}

export function KPICard({
  label,
  value,
  sub,
  tono = 'neutro',
  icon,
  className,
}: {
  label: string
  value: string
  sub?: string
  tono?: Tono
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-md border border-border bg-surface p-4', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        {icon ? <span className="text-muted">{icon}</span> : null}
      </div>
      <div
        className={cn(
          'demo-num mt-2 text-3xl font-semibold leading-none tracking-tight',
          TONO_NUM[tono],
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-1.5 text-[12px] text-muted">{sub}</div> : null}
    </div>
  )
}

export function KPICardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-md border border-border bg-surface p-4', className)}>
      <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
      <div className="mt-3 h-8 w-32 animate-pulse rounded bg-surface-2" />
      <div className="mt-2 h-2.5 w-20 animate-pulse rounded bg-surface-2" />
    </div>
  )
}
