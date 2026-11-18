// ============================================================================
//  lib/fotos-sitio.ts — Qué fotos de una pantalla se pintan en el cuadro
//  «Ver fotos y ubicación» de la propuesta (interna y liga del cliente).
// ----------------------------------------------------------------------------
//  Las fotos viven como data URLs base64 dentro de `sitios.fotos` (text[]); la
//  1.ª se copia además a `imagen_promocional`. No hay fotos «del lugar»
//  separadas de las «de la pantalla»: es UNA galería, y quien la captura sube
//  las dos cosas juntas. Por eso el cuadro las enseña todas, en su orden.
//
//  Por qué un filtro y no pintarlas tal cual: la liga del cliente es PÚBLICA,
//  y lo que se pone en un `src` debe ser una imagen y nada más. Un texto raro
//  guardado en el arreglo (un `javascript:`, un `data:text/html`, un `http`
//  plano que la CSP bloquea y deja un hueco) no debe llegar a la pantalla.
// ============================================================================

import { puntoUtil } from './coordenadas'

/** Tope de fotos por pantalla: la ruta pública no debe mandar una galería sin fin. */
export const MAX_FOTOS = 12

const ES_IMAGEN = /^(data:image\/[a-z0-9.+-]+[;,]|https:\/\/)/i

/** Las fotos que se pueden pintar: data URLs de imagen o https, sin repetir, con tope. */
export function fotosMostrables(fotos: unknown): string[] {
  if (!Array.isArray(fotos)) return []
  const vistas = new Set<string>()
  const salida: string[] = []
  for (const f of fotos) {
    if (typeof f !== 'string') continue
    const v = f.trim()
    if (!v || !ES_IMAGEN.test(v) || vistas.has(v)) continue
    vistas.add(v)
    salida.push(v)
    if (salida.length >= MAX_FOTOS) break
  }
  return salida
}

/**
 * Enlace a Google Maps por coordenadas, o `null` si no hay un punto útil.
 * Usa `puntoUtil`: el (0,0) es un hueco de captura, no un lugar.
 */
export function enlaceGoogleMaps(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined,
): string | null {
  const p = puntoUtil(lat, lng)
  return p ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` : null
}
