'use client'

import { useRef, useState } from 'react'
import { Camera, ImagePlus, Trash2, Clock, Upload, Loader2 } from 'lucide-react'
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
  // Cuántas fotos se están procesando. No es un booleano porque se admiten
  // VARIAS a la vez (`multiple`), y «leyendo 6 fotos» es una espera muy
  // distinta de «leyendo 1»: decir cuántas es la diferencia entre esperar
  // tranquilo y pensar que se colgó.
  //
  // Hasta ahora no había ningún aviso. Cada foto se lee entera a base64 —hasta
  // 8 MB— y se le saca la fecha del EXIF, con lo que media docena tarda lo
  // suyo; mientras tanto la rejilla no cambiaba y el botón seguía igual, así
  // que parecía que no había pasado nada. Y se usa justo donde más importa: las
  // fotos del sitio y las evidencias de la orden de trabajo, que son las que
  // destraban la facturación.
  const [procesando, setProcesando] = useState(0)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const subidaEn = new Date().toISOString()
    // Se lee como data URL (base64), NO blob: el blob solo vive en la pestaña y
    // desaparecería al guardar/recargar. El base64 se persiste y se ve siempre.
    const leerDataUrl = (f: File) =>
      new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result as string)
        r.onerror = () => rej(new Error('No se pudo leer la imagen'))
        r.readAsDataURL(f)
      })
    // El input se limpia YA, no al final: si se deja para después, el usuario
    // no puede volver a elegir el mismo archivo mientras esto corre, y encima
    // se perdería si una lectura fallara.
    e.target.value = ''
    setProcesando(files.length)
    try {
      const nuevas = await Promise.all(
        files.map(async (f): Promise<FotoMeta> => ({
          url: await leerDataUrl(f),
          tomadaEn: await leerFechaCreacion(f),
          subidaEn,
        })),
      )
      onChange([...fotos, ...nuevas])
    } finally {
      // En `finally` porque `Promise.all` rechaza en cuanto UNA lectura falla:
      // sin esto, una foto corrupta dejaba el contador girando para siempre.
      setProcesando(0)
    }
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
        {/* El aviso ocupa la MISMA casilla del botón, dentro de la rejilla de
            fotos: es donde van a aparecer las nuevas, así que es donde se está
            mirando. */}
        <button
          type="button"
          disabled={procesando > 0}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex aspect-square flex-col items-center justify-center gap-1 rounded border border-dashed border-border-strong text-muted transition-colors duration-150',
            procesando > 0 ? 'cursor-default opacity-70' : 'hover:bg-surface-2 hover:text-ink',
          )}
        >
          {procesando > 0 ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="px-1 text-center text-[11px] leading-tight">
                {procesando === 1 ? 'Cargando foto…' : `Cargando ${procesando} fotos…`}
              </span>
            </>
          ) : (
            <>
              {capture ? <Camera className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" />}
              <span className="px-1 text-center text-[11px] leading-tight">{label}</span>
            </>
          )}
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
