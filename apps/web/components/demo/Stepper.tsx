'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

// ============================================================================
//  Stepper — timeline de pipeline de campaña (sección 7.4). Etapa actual
//  destacada; completadas con check. Patrón heredado de SET.
// ============================================================================

export interface Paso {
  key: string
  label: string
  fecha?: string | null
}

export function Stepper({
  pasos,
  actualIndex,
  orientation = 'horizontal',
  className,
}: {
  pasos: Paso[]
  actualIndex: number
  orientation?: 'horizontal' | 'vertical'
  className?: string
}) {
  const vertical = orientation === 'vertical'

  const items = pasos.map((paso, i) => {
    const done = i < actualIndex
    const current = i === actualIndex
    const last = i === pasos.length - 1
    return (
      <li
        key={paso.key}
        className={cn(
          'relative flex',
          vertical ? 'min-h-[44px] gap-3' : 'flex-1 flex-col items-center px-0.5 text-center',
        )}
      >
        {/* Conector */}
        {!last && (
          <span
            className={cn(
              'absolute bg-border transition-colors duration-200',
              vertical ? 'left-[11px] top-6 h-[calc(100%-12px)] w-px' : 'left-1/2 top-3 h-px w-full',
              done && 'bg-success',
            )}
            aria-hidden
          />
        )}
        <span
          className={cn(
            'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] transition-colors duration-200',
            done && 'border-success bg-success text-white',
            current && 'border-accent bg-accent text-accent-fg',
            !done && !current && 'border-border bg-surface text-muted',
          )}
        >
          {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
        </span>
        <div className={cn(vertical ? 'pt-0.5' : 'mt-1.5 w-full')}>
          <div
            className={cn(
              'text-[12px] leading-tight',
              current ? 'font-semibold text-ink' : done ? 'text-ink' : 'text-muted',
            )}
          >
            {paso.label}
          </div>
          {paso.fecha && <div className="demo-num mt-0.5 text-[10px] text-muted">{paso.fecha}</div>}
        </div>
      </li>
    )
  })

  if (vertical) {
    return <ol className={cn('flex flex-col gap-0', className)}>{items}</ol>
  }

  // Horizontal: una sola fila dentro de un contenedor con scroll-x, con ancho
  // mínimo proporcional al número de pasos para que nunca se salga del front.
  return (
    <div className={cn('w-full overflow-x-auto pb-1', className)}>
      <ol className="flex w-full flex-row items-start" style={{ minWidth: pasos.length * 76 }}>
        {items}
      </ol>
    </div>
  )
}
