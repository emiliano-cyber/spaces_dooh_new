'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'
import { guardaEnVuelo, type GuardaEnVuelo } from '@/lib/clic-unico'

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

// ─── El botón se ocupa del clic en vuelo (A5 / INC-07) ──────────────────────
//
// Si el `onClick` devuelve una promesa, el botón queda bloqueado hasta que se
// resuelva. Quien lo usa no cambia nada: la API pública es la misma y un
// `onClick` normal se comporta exactamente como antes.
//
// Por qué aquí y no en cada formulario. Los doce formularios de alta YA llevan
// su `useState` («guardando», «enviando», «ocupado») y su botón deshabilitado
// —eso estaba bien hecho, y por eso este cambio NO toca ninguno—, pero ese
// patrón deja una rendija:
//
//   `setGuardando(true)` no deshabilita el botón AHORA, sino en el render
//   siguiente. Entre el primer clic y ese render cabe un segundo clic, y su
//   manejador todavía lee `guardando === false`, que es el valor del render
//   anterior. Un doble clic rápido de verdad se cuela.
//
// La guarda de aquí es un `ref`, y un ref sí es síncrono: el segundo clic se
// encuentra `enVuelo.current === true` en el mismo instante y no llega a
// disparar nada.
//
// NO pinta spinner. Los formularios ya cambian su propio texto a «Guardando…»
// o «Creando…»; añadir aquí un segundo indicador sería ruido, y quitárselo a
// los doce sería mover pantallas sin arreglar ningún defecto.
//
// Y es solo la mitad de la solución. Una guarda de navegador no cubre dos
// pestañas, dos dispositivos ni un reintento de red. La otra mitad —que la base
// no acepte el duplicado— vive en el servidor.
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', onClick, disabled, ...props }, ref) => {
    const [enCurso, setEnCurso] = React.useState(false)
    // Estos formularios cierran su modal al guardar, así que el componente se
    // desmonta con la promesa aún en vuelo. Sin esto, React avisa por poner
    // estado en algo que ya no existe.
    const vivo = React.useRef(true)
    React.useEffect(() => {
      // Se vuelve a poner a `true` al montar, no solo a `false` al desmontar.
      // En modo estricto React monta, desmonta y vuelve a montar: sin esta
      // línea, `vivo` se quedaría en `false` desde el primer render y el botón
      // no se reactivaría nunca al terminar el guardado — en desarrollo.
      vivo.current = true
      return () => { vivo.current = false }
    }, [])

    const guarda = React.useRef<GuardaEnVuelo | null>(null)
    if (!guarda.current) {
      guarda.current = guardaEnVuelo((v) => { if (vivo.current) setEnCurso(v) })
    }

    const alPulsar = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (guarda.current!.ocupado()) return
      guarda.current!.seguir(onClick?.(e))
    }

    return (
      <button
        ref={ref}
        disabled={disabled || enCurso}
        aria-busy={enCurso || undefined}
        onClick={alPulsar}
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
