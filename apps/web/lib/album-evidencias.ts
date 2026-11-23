// ============================================================================
//  lib/album-evidencias.ts — «Descargar álbum» del comprobante de exhibición
//  de los medios FIJOS (FLUJO-CREA, 20/11).
// ----------------------------------------------------------------------------
//  Pedido del dueño: «comprobante de exhibición, se descarga álbum». El álbum
//  ya existía en Space Eyes; aquí se reutiliza su `.zip` sin compresión
//  (`crearZip`, `lib/space-eyes-marca.ts`) para las fotos de evidencia de las
//  OT de una campaña, con un nombre que diga de qué sitio es cada foto y de
//  qué día: «Valla_Reforma_2026-11-20.jpg». Dos del mismo sitio y día no se
//  pisan: `crearZip` las numera («… (2).jpg»).
//
//  Sin dependencias de servidor ni de `Buffer`: corre en el navegador (ficha de
//  campaña y portal del cliente). Lo que no se pueda leer (una URL firmada que
//  caducó, una `mock://` de la demo) se salta y se cuenta, como en Space Eyes.
// ============================================================================

import { crearZip } from './space-eyes-marca'
import { diaLocal } from './prioridad-imprenta'

export interface FotoAlbum {
  url: string
  sitioNombre?: string | null
  tomadaEn?: string | null
  subidaEn?: string | null
}

// Lo que Windows no acepta en un nombre, y los espacios, pasan a «_».
function limpio(s: string): string {
  return s
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

const EXT: Record<string, string> = { 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/jpeg': 'jpg' }

/** «Sitio_YYYY-MM-DD.ext»: la fecha de la toma, o la de subida, en el día local. */
export function nombreEnAlbum(f: FotoAlbum): string {
  const sitio = limpio(f.sitioNombre ?? '') || 'sitio'
  let fecha = 'sin-fecha'
  for (const v of [f.tomadaEn, f.subidaEn]) {
    const d = v ? new Date(v) : null
    if (d && !Number.isNaN(d.getTime())) {
      fecha = diaLocal(d)
      break
    }
  }
  const tipo = /^data:([^;,]+)/i.exec(f.url)?.[1]?.toLowerCase()
  return `${sitio}_${fecha}.${(tipo && EXT[tipo]) || 'jpg'}`
}

export function nombreDelAlbum(c: { folio?: string | null; nombre: string }): string {
  return `album_${limpio(c.folio || c.nombre) || 'campana'}.zip`
}

/** Los bytes de una foto guardada como data URL de imagen; null si no lo es. */
export function bytesDeDataUrl(url: string): Uint8Array | null {
  const m = /^data:(image\/[a-z0-9.+-]+)?(;[^,]*)?,([\s\S]*)$/i.exec(url)
  if (!m || !m[1]) return null
  try {
    if (/;base64/i.test(m[2] ?? '')) {
      const bin = atob(m[3].replace(/\s+/g, ''))
      return Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
    }
    return new TextEncoder().encode(decodeURIComponent(m[3]))
  } catch {
    return null
  }
}

async function leerPorRed(url: string): Promise<Uint8Array> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(String(r.status))
  return new Uint8Array(await r.arrayBuffer())
}

/**
 * Arma el .zip. `leer` baja una URL http(s) (por omisión, `fetch`); se inyecta
 * para probarlo sin red. `zip` es null si ninguna foto se pudo leer.
 */
export async function armarAlbum(
  fotos: FotoAlbum[],
  leer: (url: string) => Promise<Uint8Array> = leerPorRed,
): Promise<{ zip: Uint8Array | null; incluidas: number; fallidas: number }> {
  const entradas: { nombre: string; datos: Uint8Array }[] = []
  let fallidas = 0
  for (const f of fotos) {
    try {
      let datos: Uint8Array | null = null
      if (f.url.startsWith('data:')) datos = bytesDeDataUrl(f.url)
      else if (/^(https?:|blob:|\/)/i.test(f.url)) datos = await leer(f.url)
      if (!datos || datos.length === 0) throw new Error('sin datos')
      entradas.push({ nombre: nombreEnAlbum(f), datos })
    } catch {
      fallidas++
    }
  }
  return { zip: entradas.length ? crearZip(entradas) : null, incluidas: entradas.length, fallidas }
}
