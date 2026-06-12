'use client'

import { Camera, ImageOff } from 'lucide-react'

// Galería de evidencias. Fotos reales (blob:/http/data) se muestran; las urls
// mock:// (sembradas) se pintan como placeholder. Reutilizada en el detalle de
// campaña y en el portal del cliente.
export function EvidenciaGaleria({ urls }: { urls: string[] }) {
  if (urls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-8 text-center">
        <Camera className="mb-2 h-5 w-5 text-muted" />
        <p className="text-[13px] font-medium text-ink">Aún sin fotografías</p>
        <p className="mt-0.5 text-[12px] text-muted">Las evidencias se suben al cerrar la OT móvil.</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {urls.map((url, i) => {
        const real = url.startsWith('blob:') || url.startsWith('http') || url.startsWith('data:')
        return real ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={url}
            alt="evidencia"
            className="aspect-square w-full rounded border border-border object-cover"
          />
        ) : (
          <div
            key={i}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded border border-border bg-surface-2 text-muted"
          >
            <ImageOff className="h-4 w-4" />
            <span className="text-[10px]">foto</span>
          </div>
        )
      })}
    </div>
  )
}
