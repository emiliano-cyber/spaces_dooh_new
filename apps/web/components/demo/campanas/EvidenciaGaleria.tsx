'use client'

import { Camera, ImageOff, Clock, Upload } from 'lucide-react'
import { formatFechaHora } from '@/lib/data/client'
import { useIdioma } from '@/lib/i18n/contexto'

// Galería de evidencias. Cada foto muestra su fecha de creación (tomada) y de
// subida. Fotos reales (blob:/http/data) se muestran; las urls mock:// se
// pintan como placeholder. Reutilizada en el detalle de campaña y el portal.
export interface EvidenciaFoto {
  url: string
  tomadaEn?: string
  subidaEn?: string
}

export function EvidenciaGaleria({ fotos }: { fotos: EvidenciaFoto[] }) {
  const { t, idioma } = useIdioma()
  if (fotos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-8 text-center">
        <Camera className="mb-2 h-5 w-5 text-muted" />
        <p className="text-[13px] font-medium text-ink">{t('campanas.evidencia.vacia')}</p>
        <p className="mt-0.5 text-[12px] text-muted">{t('campanas.evidencia.vacia.texto')}</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {fotos.map((f, i) => {
        const real = f.url.startsWith('blob:') || f.url.startsWith('http') || f.url.startsWith('data:')
        return (
          <div key={i}>
            {real ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={f.url}
                alt={t('campanas.evidencia.alt')}
                className="aspect-square w-full rounded border border-border object-cover"
              />
            ) : (
              <div className="flex aspect-square flex-col items-center justify-center gap-1 rounded border border-border bg-surface-2 text-muted">
                <ImageOff className="h-4 w-4" />
                <span className="text-[10px]">{t('campanas.evidencia.foto')}</span>
              </div>
            )}
            {(f.tomadaEn || f.subidaEn) && (
              <div className="mt-1 space-y-0.5">
                <div className="flex items-center gap-1 text-[10px] text-muted" title={t('campanas.evidencia.tomada')}>
                  <Clock className="h-3 w-3 shrink-0" />
                  <span className="demo-num truncate">{formatFechaHora(f.tomadaEn ?? '', idioma)}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted" title={t('campanas.evidencia.subida')}>
                  <Upload className="h-3 w-3 shrink-0" />
                  <span className="demo-num truncate">{formatFechaHora(f.subidaEn ?? '', idioma)}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
