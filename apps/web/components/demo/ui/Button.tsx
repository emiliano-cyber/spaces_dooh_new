'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'

// Botón base del lenguaje SET: plano, 1px, sentence case (el texto lo pone quien
// lo usa). Sin sombras ni gradientes.
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg border border-transparent hover:bg-accent-hover',
  secondary: 'bg-surface text-ink border border-border-strong hover:bg-surface-2 hover:border-ink/25',
  ghost: 'bg-transparent text-ink border border-transparent hover:bg-surface-2',
  danger: 'bg-error text-white border border-transparent hover:brightness-95',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded font-medium',
          'transition-[background,opacity,border-color] duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
          'disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
