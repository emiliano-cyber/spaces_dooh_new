'use client'

import { cn } from '@/lib/cn'

// ============================================================================
//  Chip de conteo con la forma del Dashboard (`inicio/page.tsx`, «Alertas»):
//  `rounded-full border px-2 py-0.5 text-[11px]`, etiqueta + « · » + número.
// ----------------------------------------------------------------------------
//  Sustituye al `Conteo` de punto de color de Finanzas (rediseño del
//  2026-10-26). El punto llevaba el significado SOLO con el color —un hex
//  suelto por estado— y el Dashboard ya había fijado otra forma para lo mismo.
//  Aquí el texto dice el estado y el color solo lo refuerza.
//
//  Vive en `components/demo/finanzas/` y no en `ui/` a propósito: `ui/` es
//  compartido con el Dashboard y el shell, y no se toca en este trabajo.
// ============================================================================

export type TonoChip = 'error' | 'ambar' | 'verde' | 'neutro'

// Clases escritas enteras: Tailwind solo genera las que encuentra literales.
// Los hex de borde y del texto ámbar/verde son los MISMOS del Dashboard y de
// `StatusBadge`; no se inventa ninguno.
const CLASE: Record<TonoChip, string> = {
  error: 'border-[#ef444440] text-error',
  ambar: 'border-[#f59e0b40] text-[#9a6700]',
  verde: 'border-[#1da85040] text-[#146c39]',
  neutro: 'border-border text-muted',
}

export function ChipConteo({ label, n, tono = 'neutro', title }: { label: string; n: number; tono?: TonoChip; title?: string }) {
  return (
    <span
      title={title}
      className={cn('inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium', CLASE[tono])}
    >
      {label} · <span className="demo-num ml-1">{n}</span>
    </span>
  )
}
