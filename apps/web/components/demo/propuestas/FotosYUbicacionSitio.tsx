'use client'

import { useState } from 'react'
import { Images, MapPin, ExternalLink, ImageOff } from 'lucide-react'
import { useIdioma } from '@/lib/i18n/contexto'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { MapView } from '@/components/demo/MapView'
import { cn } from '@/lib/cn'
import { ubicacion } from '@/lib/ubicacion'
import { puntoUtil } from '@/lib/coordenadas'
import { fotosMostrables, enlaceGoogleMaps } from '@/lib/fotos-sitio'

// ============================================================================
//  FotosYUbicacionSitio — el cuadro «Ver fotos y ubicación» de UN sitio de la
//  propuesta (FOTOS-UBIC, pedido del dueño del 18/11). Lo usan las dos caras:
//
//   · la ficha INTERNA (`/propuestas/[id]`), que pide la galería a
//     `/api/sitios/:id/media` con la sesión de siempre;
//   · la liga del CLIENTE (`/p/[token]`), que NO tiene sesión y la pide a
//     `/api/propuestas/publica/<token>/sitios/<sitioId>` — el token es la
//     autorización y la ruta solo enseña sitios de ESA propuesta.
//
//  Las dos respuestas traen `fotos: string[]`; por eso el componente recibe la
//  URL y no sabe de dónde sale. La ubicación NO se pide: ya viene en la fila de
//  quien lo pinta, y el cuadro se puede abrir aunque la galería falle.
//
//  Las fotos se piden AL ABRIR, no al pintar la tabla: son data URLs de
//  cientos de kB cada una, y una propuesta de veinte sitios bajaría megas para
//  enseñar una lista. Se recuerdan mientras la página siga abierta.
// ============================================================================

export interface UbicacionSitio {
  nombre: string
  direccion?: string | null
  alcaldia?: string | null
  ciudad?: string | null
  estado?: string | null
  lat?: number | string | null
  lng?: number | string | null
  tipoMedio?: string | null
}

type EstadoFotos = 'sin-pedir' | 'cargando' | 'error' | string[]

export function FotosYUbicacionSitio({
  sitio,
  urlFotos,
  className,
}: {
  sitio: UbicacionSitio
  /** De dónde salen las fotos: debe responder `{ fotos: string[] }`. */
  urlFotos: string
  className?: string
}) {
  const { t } = useIdioma()
  const [abierto, setAbierto] = useState(false)
  const [fotos, setFotos] = useState<EstadoFotos>('sin-pedir')
  const [actual, setActual] = useState(0)

  async function cargar() {
    setFotos('cargando')
    try {
      const r = await fetch(urlFotos)
      if (!r.ok) throw new Error(String(r.status))
      const d = (await r.json()) as { fotos?: unknown }
      setFotos(fotosMostrables(d.fotos))
      setActual(0)
    } catch {
      setFotos('error')
    }
  }

  function abrir() {
    setAbierto(true)
    // Un error se reintenta al volver a abrir; lo ya cargado, no.
    if (fotos === 'sin-pedir' || fotos === 'error') void cargar()
  }

  const punto = puntoUtil(sitio.lat ?? null, sitio.lng ?? null)
  const mapa = enlaceGoogleMaps(sitio.lat ?? null, sitio.lng ?? null)
  const zona = ubicacion([sitio.alcaldia, sitio.ciudad, sitio.estado], ' · ')
  const lista = Array.isArray(fotos) ? fotos : []
  const grande = lista[Math.min(actual, Math.max(lista.length - 1, 0))]

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={abrir}
        className={cn('min-h-7 px-2 text-[11px]', className)}
      >
        <Images className="h-3.5 w-3.5" />
        {t('propuestas.fotos.boton')}
      </Button>

      <Modal open={abierto} onOpenChange={setAbierto} title={sitio.nombre} subtitle={t('propuestas.fotos.titulo')} size="lg">
        <div className="grid gap-5 md:grid-cols-[3fr_2fr]">
          {/* Galería: la foto grande y, debajo, las miniaturas para cambiarla. */}
          <div className="min-w-0">
            {fotos === 'cargando' || fotos === 'sin-pedir' ? (
              <div className="flex aspect-video w-full animate-pulse items-center justify-center rounded border border-border bg-surface-2 text-[12px] text-muted">
                {t('propuestas.fotos.cargando')}
              </div>
            ) : fotos === 'error' || lista.length === 0 ? (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded border border-dashed border-border bg-surface-2 px-4 text-center text-[12px] text-muted">
                <ImageOff className="h-6 w-6" />
                {fotos === 'error' ? t('propuestas.fotos.error') : t('propuestas.fotos.sin-fotos')}
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded border border-border bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URLs: next/image no las optimiza */}
                  <img src={grande} alt={`${sitio.nombre} · ${t('propuestas.fotos.foto-n', { n: actual + 1, total: lista.length })}`} className="aspect-video w-full object-contain" />
                </div>
                <div className="mt-1 text-[11px] text-muted">
                  {t('propuestas.fotos.foto-n', { n: actual + 1, total: lista.length })}
                </div>
                {lista.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lista.map((f, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActual(i)}
                        aria-label={t('propuestas.fotos.ver-foto', { n: i + 1 })}
                        aria-current={i === actual || undefined}
                        className={cn(
                          'h-14 w-20 overflow-hidden rounded border bg-surface-2',
                          i === actual ? 'border-accent ring-2 ring-accent' : 'border-border hover:border-accent',
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de un data URL */}
                        <img src={f} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Ubicación: dirección, zona, coordenadas con enlace y un mapa chico. */}
          <div className="min-w-0 space-y-3">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted">{t('propuestas.fotos.ubicacion')}</div>
              <div className="mt-1 flex items-start gap-1.5 text-[13px]">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                <div className="min-w-0">
                  <div className="text-ink">{sitio.direccion || t('propuestas.fotos.sin-direccion')}</div>
                  {zona && <div className="text-[12px] text-muted">{zona}</div>}
                </div>
              </div>
            </div>
            {punto && mapa ? (
              <>
                <a
                  href={mapa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t('propuestas.fotos.abrir-mapa')}
                  <span className="demo-num text-muted">
                    ({punto.lat.toFixed(5)}, {punto.lng.toFixed(5)})
                  </span>
                </a>
                <div className="h-48 w-full overflow-hidden rounded border border-border">
                  <MapView
                    points={[
                      {
                        id: 'sitio',
                        lat: punto.lat,
                        lng: punto.lng,
                        tono: sitio.tipoMedio === 'PANTALLA_DIGITAL' ? 'azul' : 'verde',
                        label: sitio.nombre,
                      },
                    ]}
                    zoom={15}
                  />
                </div>
              </>
            ) : (
              <p className="text-[12px] text-muted">{t('propuestas.fotos.sin-coords')}</p>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}
