// ============================================================================
//  lib/arte-impresion.ts — Cómo se sube el arte de una LONA.
// ----------------------------------------------------------------------------
//  Decisión del dueño (18/11): subir el tope del arte de impresión, que era el
//  mismo de un creativo de pantalla (4 MB, `IMAGEN_CREATIVO_MAX_MB`). Con 4 MB
//  un espectacular de 12,9 m no pasa de ~10 DPI.
//
//  Por qué 15 MB y no 25:
//   · 15 MB es lo que el servidor YA acepta para una imagen en `archivoUrl`
//     (`LIMITES.creatividadImagen`, `lib/server/uploads.ts`), con su tipo real
//     comprobado por magic bytes. No hace falta abrir ningún otro endpoint.
//   · La imagen se guarda como data URL en la base (no hay almacenamiento de
//     objetos para creativos): 15 MB son ~20 MB por fila y ~20 MB más en cada
//     respaldo. 25 MB serían ~33 MB, y ENVUELTA en HTML (`imagenAHtml` la
//     guarda dos veces) ~67 MB por fila y unos 250 MB de memoria de Node por
//     subida entre el texto, el JSON, el regex y la regeneración que compara.
//   · Por eso, por encima de los 4 MB de siempre la imagen viaja SOLA en
//     `archivoUrl` y no envuelta: una sola copia. `/arte/` y la publicación a
//     DOOHmain ya leen ese caso.
//
//  Solo para campañas FIJAS (OOH). Una híbrida comparte el arte con sus
//  pantallas digitales y se queda en 4 MB envueltos, como hoy.
//
//  nginx corta a 12M por servidor; las plantillas de `infra/nginx/` llevan una
//  excepción SOLO para `/api/creatividades` a `NGINX_ARTE_MAX` (prueba en
//  `arte-impresion.test.ts`). Aplicarla en cada servidor lo hace una persona.
// ============================================================================

import { imagenAHtml, IMAGEN_CREATIVO_MAX_MB } from './creativo-html'
import { medidaDeOrden } from './proporcion-pantalla'

export const ARTE_IMPRESION_MAX_MB = 15
// 15 MB en base64 son 20 MB, más el sobre JSON: 22M deja margen sin abrir más.
export const NGINX_ARTE_MAX = 22

const MB = 1024 * 1024

/** El tope de una imagen de arte según el tipo de campaña. */
export function topeArteMb(tipoCampana: string | null | undefined): number {
  return tipoCampana === 'OOH' ? ARTE_IMPRESION_MAX_MB : IMAGEN_CREATIVO_MAX_MB
}

/** El cuerpo de `POST /api/creatividades` para una imagen de arte. */
export function cuerpoArte(a: {
  campanaId: string
  nombre: string
  dataUrl: string
  tipo: string
  bytes: number
}): { campanaId: string; nombre: string; codigo?: string; archivoUrl?: string; formato: string } {
  if (a.bytes <= IMAGEN_CREATIVO_MAX_MB * MB) {
    return { campanaId: a.campanaId, nombre: a.nombre, codigo: imagenAHtml(a.dataUrl, a.nombre), formato: 'text/html' }
  }
  return { campanaId: a.campanaId, nombre: a.nombre, archivoUrl: a.dataUrl, formato: a.tipo }
}

export type LonaDeCampana = { id: string; nombre: string; ancho: number; alto: number }

/**
 * Las lonas de una campaña, para revisar el arte desde su ficha: los sitios
 * FIJOS reservados con medida. Si hay orden de impresión para ese sitio, manda
 * su medida (es lo que se imprime), igual que en Imprenta.
 */
export function lonasDeCampana(
  campanaId: string,
  reservas: { campanaId: string; sitioId: string }[],
  sitios: { id: string; nombre: string; tipoMedio: string; ancho: number | null; alto: number | null }[],
  ordenes: { campanaId: string; sitioId?: string | null; ancho?: number | null; alto?: number | null }[],
): LonaDeCampana[] {
  const vistos = new Set<string>()
  const lonas: LonaDeCampana[] = []
  for (const r of reservas) {
    if (r.campanaId !== campanaId || vistos.has(r.sitioId)) continue
    vistos.add(r.sitioId)
    const s = sitios.find((x) => x.id === r.sitioId)
    if (!s || s.tipoMedio === 'PANTALLA_DIGITAL') continue
    const oi = ordenes.find((o) => o.campanaId === campanaId && o.sitioId === s.id)
    const m = medidaDeOrden(oi ?? {}, s)
    if (m) lonas.push({ id: s.id, nombre: s.nombre, ancho: m.ancho, alto: m.alto })
  }
  return lonas
}
