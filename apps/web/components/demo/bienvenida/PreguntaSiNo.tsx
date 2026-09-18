'use client'

import { cn } from '@/lib/cn'

// ============================================================================
//  Una pregunta de sí/no del cuestionario de bienvenida.
// ----------------------------------------------------------------------------
//  Tres estados y no dos: `null` es «sin contestar», y no es lo mismo que «no».
//  El servidor hace la misma distinción (`lib/cuestionario-entidades.ts`), y
//  tiene que hacerla: si «sin contestar» valiera como «no», abrir la pantalla y
//  no tocar nada afirmaría que la empresa tiene una sola razón social.
//
//  Son dos botones y no un `<select>` porque son dos opciones y porque así se
//  ve de un golpe qué está contestado y qué no — que es lo que hace que el paso
//  3 aparezca cuando tiene sentido.
// ============================================================================

export function PreguntaSiNo({
  numero,
  pregunta,
  ayuda,
  valor,
  onCambio,
  deshabilitado,
}: {
  numero: number
  pregunta: string
  ayuda?: string
  valor: boolean | null
  onCambio: (v: boolean) => void
  deshabilitado?: boolean
}) {
  const opcion = (v: boolean, texto: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={valor === v}
      disabled={deshabilitado}
      onClick={() => onCambio(v)}
      className={cn(
        'h-10 min-w-[5.5rem] rounded border px-4 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:opacity-50 disabled:pointer-events-none',
        valor === v
          ? 'border-transparent bg-accent text-accent-fg'
          : 'border-border-strong bg-surface text-ink hover:bg-surface-2',
      )}
    >
      {texto}
    </button>
  )

  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-2 block text-sm font-medium text-ink">
        <span className="mr-2 text-muted">{numero}.</span>
        {pregunta}
      </legend>
      {ayuda && <p className="mb-3 text-[13px] leading-relaxed text-muted">{ayuda}</p>}
      <div role="radiogroup" aria-label={pregunta} className="flex gap-2">
        {opcion(true, 'Sí')}
        {opcion(false, 'No')}
      </div>
    </fieldset>
  )
}
