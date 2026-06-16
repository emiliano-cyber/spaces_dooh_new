'use client'

import { useRef } from 'react'
import { Camera, ImagePlus, Trash2, Clock, Upload } from 'lucide-react'
import { cn } from '@/lib/cn'
import { leerFechaCreacion } from '@/lib/exif'
import { formatFechaHora } from '@/lib/data/client'
import type { FotoMeta } from '@/lib/data/types'

// ============================================================================
//  FotoUploaderMock — carga de fotografías mock con preview real. Cada imagen
//  guarda DOS fechas: `tomadaEn` (creación de la imagen, leída del EXIF o del
//  archivo) y `subidaEn` (momento de la carga). Se muestran bajo cada foto.
//  Reutilizable en ficha de sitio, evidencias de campaña, OT móvil y logo.
// ============================================================================

export function FotoUploaderMock({
  fotos,
  onChange,
  capture = false,
  label = 'Agregar foto',
  className,
}: {
  fotos: FotoMeta[]
  onChange: (fotos: FotoMeta[]) => void
  capture?: boolean
  label?: string
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const subidaEn = new Date().toISOString()
    const nuevas = await Promise.all(
      files.map(async (f): Promise<FotoMeta> => ({
        url: URL.createObjectURL(f),
        tomadaEn: await leerFechaCreacion(f),
        subidaEn,
      })),
    )
    onChange([...fotos, ...nuevas])
    e.target.value = ''
  }

  function quitar(url: string) {
    onChange(fotos.filter((f) => f.url !== url))
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-3 gap-2">
        {fotos.map((f) => (
          <div key={f.url} className="group relative">
            <div className="relative aspect-square overflow-hidden rounded border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt="evidencia" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => quitar(f.url)}
                className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded bg-black/55 text-white group-hover:flex"
                aria-label="Quitar foto"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Timestamps de la imagen */}
            <div className="mt-1 space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] text-muted">
                <Clock className="h-3 w-3 shrink-0" />
                <span className="demo-num truncate">{formatFechaHora(f.tomadaEn)}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted">
                <Upload className="h-3 w-3 shrink-0" />
                <span className="demo-num truncate">{formatFechaHora(f.subidaEn)}</span>
              </div>
            </div>
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
