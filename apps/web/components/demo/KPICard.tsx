'use client'

import { cn } from '@/lib/cn'
import type { Tono } from './StatusBadge'

// ============================================================================
//  KPICard — tarjeta de indicador grande, legible a 3 metros (proyector).
//  Número en Inter con cifras tabulares (.demo-num). Plano, 1px, sin sombra.
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
    <div className={cn('kpi-card rounded-md border border-border bg-surface p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-[13px] font-medium text-muted">{label}</span>
        {icon ? <span className="shrink-0 text-muted">{icon}</span> : null}
      </div>
      {/* El número nunca se parte en dos renglones: se encoge con la tarjeta.
          9cqi = 9% del ancho de .kpi-card, acotado entre 20 y 30 px. A 30 px
          (tarjeta ancha) se lee igual que antes; en la tarjeta más angosta del
          dashboard toca el piso de 20 px, donde todavía caben 16 caracteres
          ("$ 999,999,999.00") sin tocar el borde. */}
      <div
        className={cn(
          'demo-num mt-2 whitespace-nowrap text-[length:clamp(1.25rem,9cqi,1.875rem)] font-semibold leading-none tracking-tight',
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
