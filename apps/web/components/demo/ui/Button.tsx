'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'
import { guardaEnVuelo, type GuardaEnVuelo } from '@/lib/clic-unico'

// Botón base del lenguaje SET: plano, 1px, sentence case (el texto lo pone quien
// lo usa). Sin sombras ni gradientes.
type Variant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'danger'
  | 'dangerFill'
  | 'ghost'
  | 'icon'
type Size = 'sm' | 'md'

// El secundario pide `--border-input` (#94876f) y NO `--border-strong`
// (#d9d0c1). El motivo es el mismo que el de B1 con los campos de formulario
// —el comentario largo de `demo.css`—: #d9d0c1 sobre blanco da 1.53:1 y WCAG
// 2.1 (1.4.11) exige 3:1 al contorno de un control. #94876f da 3.53:1, y el
// texto en `--accent-hover` sobre la superficie blanca, 6.61:1.
//
// Va como valor arbitrario y no como `border-border-input` porque
// `--border-input` NO esta mapeado en la paleta de `tailwind.config.ts`: solo
// existe como variable CSS. Mapearlo seria otro cambio, en otro archivo de alto
// contacto, y no hace falta para esto.
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg border border-accent hover:bg-accent-hover hover:border-accent-hover',
  secondary: 'bg-surface text-accent-hover border border-[var(--border-input)] hover:bg-accent-soft hover:border-accent',
  tertiary: 'bg-transparent text-accent border border-transparent px-2.5 hover:bg-accent-soft',
  danger: 'bg-surface text-error border border-error hover:bg-error-soft',
  // El unico destructivo de relleno, y a proposito: pesa lo que pesa la accion.
  // Lo usa `ConfirmDialog`, que es donde se confirma algo irreversible.
  dangerFill: 'bg-error text-white border border-error hover:brightness-95',
  ghost: 'bg-transparent text-ink/80 border border-transparent px-2.5 hover:bg-surface-2 hover:text-ink',
  icon: 'bg-transparent text-ink/80 border border-transparent w-9 px-0 hover:bg-accent-soft hover:text-accent-hover',
}
// Alto MINIMO, no alto fijo: con `h-10` una etiqueta que hace dos renglones se
// sale del boton en vez de estirarlo.
const sizes: Record<Size, string> = {
  sm: 'min-h-8 px-3 text-[13px]',
  md: 'min-h-10 px-4 text-sm font-semibold',
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
          // Deshabilitado SOLIDO. `opacity-50` apagaba a la vez el texto y el
          // borde, y un texto ya tenue al 50 % se va por debajo del contraste
          // minimo: el estado se leia como «pantalla rota», no como «todavia
          // no».
          //
          // Y NO lleva `disabled:cursor-not-allowed`, aunque la propuesta lo
          // pedia: con `pointer-events-none` el elemento no recibe eventos de
          // puntero, asi que ese cursor no se llega a ver NUNCA. Se quedan las
          // dos cosas que si son verdad —no recibe eventos, y se ve apagado— en
          // vez de una promesa que el navegador no cumple. Se conserva
          // `pointer-events-none` y no al reves porque es lo que hay hoy: es
          // quien tapa tambien los manejadores de raton propios y los tooltips
          // de un boton inactivo, y cambiarlo por un cursor es mover
          // comportamiento sin ninguna prueba que lo sujete.
          'disabled:bg-surface-2 disabled:text-muted disabled:border-border-strong',
          'disabled:pointer-events-none',
          // El TAMANO primero y la VARIANTE despues: `cn` es twMerge y en un
          // conflicto gana la ultima. Al reves, el `px-4` de `md` borraria el
          // `px-2.5` de terciario/ghost y el `px-0` de icon, y los tres
          // saldrian con el relleno del boton normal.
          sizes[size],
          variants[variant],
          className,
        )}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
