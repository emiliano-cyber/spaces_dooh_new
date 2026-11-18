// ============================================================================
//  lib/valoracion-arte.ts — ¿Sirve este arte para esta lona?
// ----------------------------------------------------------------------------
//  Pedido del dueño (18/11): «en la pantalla de Imprenta debemos tener cambios
//  a la hora de la valoración del arte a subir, ya que se debe dejar en claro y
//  mostrar el ejemplo de cómo se vería el arte en el tamaño de la lona».
//
//  El 17/11 (IMP-CREA) la pantalla ya pintaba el arte en la proporción del
//  sitio y decía «Se recorta 23 %». Faltaba lo que decide si se imprime o no:
//  cuántos CENTÍMETROS se pierden de verdad, si los píxeles alcanzan para el
//  tamaño real (un 1920 × 1080 estirado a 12,9 m sale pixelado aunque «ajuste»),
//  y el formato y el peso del archivo. Todo aquí es puro y en metros; la
//  pantalla solo lo dibuja (`components/operaciones/ValoracionArte.tsx`).
//
//  Convención de impresión: A SANGRE (`cover`), como en IMP-CREA — la lona se
//  llena y lo que sobra se pierde. La imprenta NO estira el arte (deformarlo no
//  es una opción que el repo contemple); «sin recortar» (`contain`) se ofrece
//  solo para ver el arte entero y las franjas en blanco que dejaría.
// ============================================================================

import { TOLERANCIA_AJUSTE } from './proporcion-pantalla'

export type Semaforo = 'verde' | 'ambar' | 'rojo'
export type Lona = { ancho: number; alto: number } // metros
export type Modo = 'cover' | 'contain'

/**
 * Margen de seguridad ORIENTATIVO: 5 cm por lado. El repo no tenía convención
 * de sangrado; esta es la guía habitual de lona en bastidor (lo que queda en
 * esos 5 cm puede quedar doblado o tapado por el marco). Se dibuja y se rotula
 * como orientativo: cada imprenta tiene la suya.
 */
export const MARGEN_SEGURIDAD_M = 0.05

/**
 * Una lona con un lado de 6 m o más se trata como gran formato (espectacular,
 * vista desde la calle a decenas de metros); por debajo, como lona cercana
 * (muro, valla, puente peatonal: se ve a pocos metros).
 */
export const LADO_GRAN_FORMATO_M = 6

/**
 * DPI efectivos a tamaño real (píxeles ÷ pulgadas impresas). ORIENTATIVOS:
 *
 * - Gran formato: la guía de la industria de exterior es «72 dpi al 10 % de
 *   escala», o sea ~7 DPI a tamaño real; 10 se toma como «sirve» y 5 como
 *   el mínimo antes de que el pixelado se note a distancia de calle. Se eligió
 *   10 y no 20–30 porque el tope de subida es de 4 MB
 *   (`IMAGEN_CREATIVO_MAX_MB`): 20 DPI en 12,9 m son ~10 200 px de ancho, que
 *   no caben en 4 MB, y un semáforo que nunca da verde enseña a no mirarlo.
 * - Cercana: se ve a pocos metros, así que pide el triple.
 */
export const UMBRALES_DPI = {
  gran: { verde: 10, ambar: 5 },
  cercana: { verde: 30, ambar: 15 },
} as const

/** Hasta este recorte (fracción del arte) es ámbar; por encima, rojo. */
export const RECORTE_AMBAR_MAX = 0.15

const PULGADA_M = 0.0254

/** Dónde cae el arte respecto a la lona, en metros (origen: esquina superior izquierda de la lona). */
export function colocarArte(
  lona: Lona,
  proporcionArte: number,
  modo: Modo,
): { x: number; y: number; ancho: number; alto: number } {
  const marco = lona.ancho / lona.alto
  // A sangre se escala por el lado que deja sobrar; sin recortar, por el que deja faltar.
  const porAlto = modo === 'cover' ? proporcionArte > marco : proporcionArte <= marco
  const ancho = porAlto ? lona.alto * proporcionArte : lona.ancho
  const alto = porAlto ? lona.alto : lona.ancho / proporcionArte
  return { x: (lona.ancho - ancho) / 2, y: (lona.alto - alto) / 2, ancho, alto }
}

export type ValorProporcion = {
  semaforo: Semaforo
  // Fracción del arte que se pierde a sangre (0..1).
  pierde: number
  // De qué lados; null si ajusta.
  por: 'costados' | 'arriba-abajo' | null
  // Centímetros que se pierden por CADA lado afectado, a sangre.
  cmPorLado: number
  // Centímetros que quedarían en blanco por cada lado, sin recortar.
  rellenoCmPorLado: number
}

export function valorarProporcion(lona: Lona, anchoPx: number, altoPx: number): ValorProporcion {
  const arte = anchoPx / altoPx
  const marco = lona.ancho / lona.alto
  const sangre = colocarArte(lona, arte, 'cover')
  const completo = colocarArte(lona, arte, 'contain')
  const porCostados = arte > marco
  const pierde = porCostados ? 1 - marco / arte : 1 - arte / marco
  const cmPorLado = (porCostados ? -sangre.x : -sangre.y) * 100
  const rellenoCmPorLado = (porCostados ? completo.y : completo.x) * 100
  const semaforo: Semaforo =
    pierde <= TOLERANCIA_AJUSTE ? 'verde' : pierde <= RECORTE_AMBAR_MAX ? 'ambar' : 'rojo'
  return {
    semaforo,
    pierde,
    por: semaforo === 'verde' ? null : porCostados ? 'costados' : 'arriba-abajo',
    cmPorLado,
    rellenoCmPorLado,
  }
}

export type ValorResolucion = {
  semaforo: Semaforo
  pxPorMetro: number
  dpi: number
  escala: 'gran' | 'cercana'
  // Píxeles que haría falta tener para llegar a verde, con la medida de la lona.
  minimoPx: { ancho: number; alto: number }
}

export function valorarResolucion(lona: Lona, anchoPx: number, altoPx: number): ValorResolucion {
  // A sangre el arte cubre la lona: manda el lado con menos píxeles por metro,
  // que es el que se estira más.
  const pxPorMetro = Math.min(anchoPx / lona.ancho, altoPx / lona.alto)
  const dpi = pxPorMetro * PULGADA_M
  const escala = Math.max(lona.ancho, lona.alto) >= LADO_GRAN_FORMATO_M ? 'gran' : 'cercana'
  const u = UMBRALES_DPI[escala]
  const pxmVerde = u.verde / PULGADA_M
  return {
    semaforo: dpi >= u.verde ? 'verde' : dpi >= u.ambar ? 'ambar' : 'rojo',
    pxPorMetro,
    dpi,
    escala,
    minimoPx: { ancho: Math.ceil(lona.ancho * pxmVerde), alto: Math.ceil(lona.alto * pxmVerde) },
  }
}

const IMAGENES: Record<string, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'image/jpg': 'JPG',
  'image/webp': 'WEBP',
}

/** PNG/JPG/WebP sirven; un PDF u otro tipo no se puede medir aquí (ámbar). */
export function valorarFormato(tipo: string | null | undefined): { semaforo: Semaforo; nombre: string } | null {
  if (tipo == null) return null
  const t = tipo.toLowerCase().trim()
  if (IMAGENES[t]) return { semaforo: 'verde', nombre: IMAGENES[t] }
  if (t === 'application/pdf') return { semaforo: 'ambar', nombre: 'PDF' }
  return { semaforo: 'ambar', nombre: (t.split('/')[1] ?? t).toUpperCase() || '?' }
}

/** Hasta el tope de subida verde; por encima rojo (el servidor lo rechazaría). */
export function valorarPeso(bytes: number | null | undefined, maxMb: number): { semaforo: Semaforo; mb: number } | null {
  if (bytes == null || !Number.isFinite(bytes)) return null
  const mb = bytes / (1024 * 1024)
  return { semaforo: mb <= maxMb ? 'verde' : 'rojo', mb }
}

const ORDEN: Semaforo[] = ['verde', 'ambar', 'rojo']

export function peorSemaforo(s: (Semaforo | null | undefined)[]): Semaforo | null {
  let peor: Semaforo | null = null
  for (const x of s) if (x && (peor == null || ORDEN.indexOf(x) > ORDEN.indexOf(peor))) peor = x
  return peor
}

export type Valoracion = {
  general: Semaforo | null
  proporcion: ValorProporcion | null
  resolucion: ValorResolucion | null
  formato: { semaforo: Semaforo; nombre: string } | null
  peso: { semaforo: Semaforo; mb: number } | null
  // Faltó algo para valorar (medida de la lona o dimensiones del archivo).
  parcial: boolean
}

export function valorarArte(
  lona: Lona | null,
  archivo: { anchoPx: number | null; altoPx: number | null; tipo?: string | null; bytes?: number | null },
  maxMb = 4,
): Valoracion {
  const medible =
    lona != null &&
    lona.ancho > 0 &&
    lona.alto > 0 &&
    archivo.anchoPx != null &&
    archivo.altoPx != null &&
    archivo.anchoPx > 0 &&
    archivo.altoPx > 0
  const proporcion = medible ? valorarProporcion(lona!, archivo.anchoPx!, archivo.altoPx!) : null
  const resolucion = medible ? valorarResolucion(lona!, archivo.anchoPx!, archivo.altoPx!) : null
  const formato = valorarFormato(archivo.tipo)
  const peso = valorarPeso(archivo.bytes, maxMb)
  return {
    general: peorSemaforo([proporcion?.semaforo, resolucion?.semaforo, formato?.semaforo, peso?.semaforo]),
    proporcion,
    resolucion,
    formato,
    peso,
    parcial: !medible,
  }
}
