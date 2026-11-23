'use client'

import { useState } from 'react'
import { Code2, Images } from 'lucide-react'
import { useIdioma } from '@/lib/i18n/contexto'
import type { Idioma } from '@/lib/i18n/idiomas'
import { formatNumero } from '@/lib/formato-numero'
import {
  ajusteEnMarco,
  nombreProporcion,
  proporcionDeResolucion,
  proporcionDibujable,
  type Ajuste,
} from '@/lib/proporcion-pantalla'
import type { CreativoDeImpresion } from '@/lib/data/types'

// ============================================================================
//  ArteEnSitio — un creativo dentro de un marco con la proporción del sitio.
// ----------------------------------------------------------------------------
//  IMP-CREA (17/11). El arte se pinta A SANGRE (`object-cover`), que es como
//  sale una lona: lo que no cabe se pierde. El modo «completo» (`contain`) es
//  para ver el arte entero y las franjas que dejaría. Cuánto se recorta se dice
//  además en texto (`ajusteEnMarco`), porque en una miniatura de 90 px un 20 %
//  de recorte no se ve.
//
//  Sin medida (ni la orden ni el sitio la tienen) el marco es 16:9 punteado y
//  no se calcula ningún recorte: no se inventa una proporción.
// ============================================================================

export function esHtml(cr: { formato?: string | null }): boolean {
  const f = (cr.formato ?? '').toLowerCase()
  return f === 'html' || f.startsWith('text/html')
}

export function ArteEnSitio({
  creativo,
  proporcion,
  alto,
  modo = 'cover',
  onAjuste,
}: {
  creativo: CreativoDeImpresion
  // ancho / alto del sitio; null = sin medida.
  proporcion: number | null
  // Alto del marco en px; el ancho sale de la proporción.
  alto: number
  modo?: 'cover' | 'contain'
  onAjuste?: (a: Ajuste | null) => void
}) {
  const t = useIdioma().t
  const dibujada = proporcionDibujable(proporcion ?? 16 / 9)
  const ancho = Math.round(alto * dibujada)
  // `esImagen` manda (como en Creativos): una imagen envuelta en HTML se sirve
  // como imagen por `/arte/`, y montarla como documento cuesta ~1 MB cada una.
  const imagen = creativo.esImagen || !esHtml(creativo)
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-sm bg-[#111] ${
        proporcion == null ? 'outline-dashed outline-1 outline-border-strong' : 'ring-1 ring-border'
      }`}
      style={{ width: ancho, height: alto }}
    >
      {!creativo.archivoUrl ? (
        <div className="flex h-full w-full items-center justify-center text-muted">
          <Images className="h-5 w-5" />
        </div>
      ) : imagen ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={creativo.archivoUrl}
          alt={creativo.nombre}
          loading="lazy"
          className={`h-full w-full ${modo === 'cover' ? 'object-cover' : 'object-contain'}`}
          onLoad={(e) => {
            if (!onAjuste) return
            const im = e.currentTarget
            const arte =
              im.naturalWidth > 0 && im.naturalHeight > 0
                ? im.naturalWidth / im.naturalHeight
                : proporcionDeResolucion(creativo.resolucion)
            onAjuste(proporcion != null && arte != null ? ajusteEnMarco(proporcion, arte) : null)
          }}
        />
      ) : (
        <>
          <iframe
            title={creativo.nombre}
            src={creativo.archivoUrl}
            sandbox=""
            loading="lazy"
            className="pointer-events-none h-full w-full border-0 bg-white"
          />
          <span
            className="absolute right-1 top-1 inline-flex items-center gap-0.5 rounded bg-black/60 px-1 text-[10px] text-white"
            title={t('operaciones.imprenta.arte.html')}
          >
            <Code2 className="h-2.5 w-2.5" /> HTML
          </span>
        </>
      )}
    </div>
  )
}

/** «Ajusta» / «Se recorta 23 % por los costados», o nada si no se pudo medir. */
export function TextoAjuste({ ajuste }: { ajuste: Ajuste | null | undefined }) {
  const { t, idioma } = useIdioma()
  if (!ajuste) return null
  if (ajuste.tipo === 'ajusta') {
    return <span className="text-[11px] text-[#146c39]">{t('operaciones.imprenta.arte.ajusta')}</span>
  }
  const pct = formatNumero(Math.round(ajuste.pierde * 100), 0, idioma)
  return (
    <span className="text-[11px] text-[#9a6700]">
      {t(
        ajuste.por === 'costados'
          ? 'operaciones.imprenta.arte.recorta-costados'
          : 'operaciones.imprenta.arte.recorta-arriba',
        { pct },
      )}
    </span>
  )
}

/** «12,9 × 7,2 m · 16:9» con su origen, o el aviso de que no hay medida. */
export function TextoMedida({
  medida,
}: {
  medida: { ancho: number; alto: number; origen: 'orden' | 'sitio' } | null
}) {
  const { t, idioma } = useIdioma()
  if (!medida) return <span className="text-[11px] text-muted">{t('operaciones.imprenta.arte.sin-medida')}</span>
  const prop = nombreProporcion(medida.ancho / medida.alto) ?? ''
  // Solo cifras y símbolos, iguales en los cuatro idiomas: no lleva clave (una
  // clave idéntica en todos la marcan las pruebas de costura como sin traducir).
  // La coma o el punto decimal sí cambian, y eso lo pone `formatNumero`.
  const a = formatNumero(medida.ancho, decimalesDe(medida.ancho), idioma)
  const h = formatNumero(medida.alto, decimalesDe(medida.alto), idioma)
  return (
    <span className="demo-num text-[11px] text-muted">
      {`${a} × ${h} m · ${prop}`}
      {medida.origen === 'sitio' && ` · ${t('operaciones.imprenta.arte.medida-sitio')}`}
    </span>
  )
}

// 12 → «12», 12,9 → «12,9», 3,25 → «3,25»: sin ceros de relleno.
export function decimalesDe(n: number): number {
  if (Number.isInteger(n)) return 0
  return Number.isInteger(n * 10) ? 1 : 2
}

/**
 * «12,9 × 7,2 m» en el idioma de quien lee. La fila de una orden de impresión
 * lo pintaba con `${ancho} × ${alto} m`, que deja el punto decimal en italiano
 * («12.9 × 7.2 m» junto al «12,9 × 7,2 m» del arte: recorrido del 18/11). En
 * español e inglés sale idéntico a la plantilla de antes.
 */
export function medidaEnIdioma(ancho: number, alto: number, idioma: Idioma): string {
  return `${formatNumero(ancho, decimalesDe(ancho), idioma)} × ${formatNumero(alto, decimalesDe(alto), idioma)} m`
}

/** Miniatura + su ajuste debajo, para la fila de la orden. */
export function MiniaturaArte({
  creativo,
  proporcion,
  onAbrir,
}: {
  creativo: CreativoDeImpresion
  proporcion: number | null
  onAbrir: () => void
}) {
  const [ajuste, setAjuste] = useState<Ajuste | null>(null)
  return (
    <button
      type="button"
      onClick={onAbrir}
      title={creativo.nombre}
      className={`flex flex-col items-start gap-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        creativo.estatusValidacion === 'RECHAZADA' ? 'opacity-50' : ''
      }`}
    >
      <ArteEnSitio creativo={creativo} proporcion={proporcion} alto={72} onAjuste={setAjuste} />
      <TextoAjuste ajuste={ajuste} />
    </button>
  )
}
