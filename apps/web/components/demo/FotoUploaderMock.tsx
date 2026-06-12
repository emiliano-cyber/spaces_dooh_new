'use client'

import { useRef } from 'react'
import { Camera, ImagePlus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'

// ============================================================================
//  FotoUploaderMock — carga de fotografías mock con preview real (usa el file
//  picker del navegador + URL.createObjectURL). Reutilizable en ficha de sitio,
//  evidencias de campaña y OT móvil (con `capture` para abrir cámara).
// ============================================================================

export function FotoUploaderMock({
  fotos,
  onChange,
  capture = false,
  label = 'Agregar foto',
  className,
}: {
  fotos: string[]
  onChange: (fotos: string[]) => void
  capture?: boolean
  label?: string
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const urls = files.map((f) => URL.createObjectURL(f))
    onChange([...fotos, ...urls])
    e.target.value = ''
  }

  function quitar(url: string) {
    onChange(fotos.filter((u) => u !== url))
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-3 gap-2">
        {fotos.map((url) => (
          // eslint-disable-next-line @next/next/no-img-element
          <div key={url} className="group relative aspect-square overflow-hidden rounded border border-border">
            <img src={url} alt="evidencia" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => quitar(url)}
              className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded bg-black/55 text-white group-hover:flex"
              aria-label="Quitar foto"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex aspect-square flex-col items-center justify-center gap-1 rounded border border-dashed border-border-strong text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink',
          )}
        >
          {capture ? <Camera className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" />}
          <span className="px-1 text-center text-[11px] leading-tight">{label}</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        {...(capture ? { capture: 'environment' as const } : {})}
        onChange={onPick}
        className="hidden"
      />
    </div>
  )
}
