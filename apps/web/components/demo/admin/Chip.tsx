import * as React from 'react'
import { cn } from '@/lib/cn'

// ============================================================================
//  Chip de estado y de conteo del grupo «Sistema» (Administración, Razones
//  sociales, Integraciones, Actividad, Novedades). Es la pastilla del
//  Dashboard —`rounded-full border px-2 py-0.5 text-[11px]`— con un tono.
//
//  ─── Por qué los tonos NO son `bg-success/10 border-success/30` ───────────
//  Era lo que pedía la investigación y lo que ya usaban `ActualizacionesPanel`
//  y `TicketsPanel`, y NO PINTA NADA. Los colores de `tailwind.config.ts`
//  están declarados como `var(--success)` sin `<alpha-value>`, y con eso
//  Tailwind 3.4 no sabe aplicar el modificador de opacidad: la clase no se
//  genera, sin aviso. Medido el 2026-10-26 compilando las dos clases con la
//  CLI de Tailwind contra este mismo config: salida vacía para las dos. Los
//  chips «verdes» de esos paneles se veían, en realidad, sin fondo ni borde.
//
//  Por eso el fondo usa los tonos `*-soft`, que sí están en el config, y el
//  borde mezcla el token con transparente (`color-mix`) — sigue siendo el
//  token, no un hexadecimal suelto, y se mueve solo si alguien cambia la
//  paleta.
//
//  El color nunca va solo: todo chip lleva su texto. Y el texto va en `ink`
//  y no en el color del tono porque `--success` y `--warning` sobre su
//  fondo suave no llegan al contraste mínimo de WCAG para texto.
// ============================================================================

export type Tono = 'neutro' | 'exito' | 'aviso' | 'error' | 'acento'

export const TONO: Record<Tono, string> = {
  neutro: 'border-border bg-surface-2 text-muted',
  exito: 'border-[color:color-mix(in_srgb,var(--success)_40%,transparent)] bg-success-soft text-ink',
  aviso: 'border-[color:color-mix(in_srgb,var(--warning)_50%,transparent)] bg-warning-soft text-ink',
  error: 'border-[color:color-mix(in_srgb,var(--error)_40%,transparent)] bg-error-soft text-error',
  acento: 'border-[color:color-mix(in_srgb,var(--accent)_40%,transparent)] bg-accent-soft text-accent-hover',
}

const PUNTO: Record<Tono, string> = {
  neutro: 'bg-muted',
  exito: 'bg-success',
  aviso: 'bg-warning',
  error: 'bg-error',
  acento: 'bg-accent',
}

export function Chip({
  tono = 'neutro',
  punto = false,
  title,
  className,
  children,
}: {
  tono?: Tono
  /** Punto de color delante: para estados binarios (activo/inactivo). */
  punto?: boolean
  title?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium',
        TONO[tono],
        className,
      )}
    >
      {punto && <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', PUNTO[tono])} />}
      {children}
    </span>
  )
}

/** Franja de aviso a ancho completo (icono + texto), con los mismos tonos. */
export const FRANJA_AVISO = cn('flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]', TONO.aviso)
