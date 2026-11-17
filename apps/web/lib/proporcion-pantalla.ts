// ============================================================================
//  lib/proporcion-pantalla.ts — Cómo cae un creativo en la medida de un sitio.
// ----------------------------------------------------------------------------
//  Pedido del dueño (17/11): que en Imprenta «se vean los creativos y cómo se
//  verían en las proporciones de cada pantalla». Un espectacular de 12,9 × 7,2 m
//  y un muro de 3 × 9 m no se comen el mismo arte: si el creativo es 16:9 y el
//  sitio es vertical, la lona sale recortada (o con franjas), y eso hay que
//  verlo ANTES de mandarla a imprimir, no al montarla.
//
//  La vista previa pinta el arte A SANGRE (`object-cover`) dentro de un marco
//  con la proporción del sitio, que es como queda impreso. Esto calcula la
//  proporción y cuánto del arte se pierde por los lados, para decirlo en texto
//  y no solo con la imagen.
// ============================================================================

// Por debajo de esta diferencia el arte «ajusta»: un 3 % de recorte no se nota
// en una lona y avisar de todo enseña a no leer los avisos.
export const TOLERANCIA_AJUSTE = 0.03

/** Proporción ancho/alto de una medida, o null si no hay medida usable. */
export function proporcion(ancho: number | null | undefined, alto: number | null | undefined): number | null {
  const a = Number(ancho)
  const h = Number(alto)
  if (!Number.isFinite(a) || !Number.isFinite(h) || a <= 0 || h <= 0) return null
  return a / h
}

/**
 * La medida que manda para una orden: la de la orden si la tiene, y si no la
 * del sitio. La orden manda porque es lo que se va a imprimir; el sitio es la
 * estructura, y una orden puede cubrir solo una cara o un tramo.
 */
export function medidaDeOrden(
  orden: { ancho?: number | null; alto?: number | null },
  sitio?: { ancho?: number | null; alto?: number | null } | null,
): { ancho: number; alto: number; origen: 'orden' | 'sitio' } | null {
  if (proporcion(orden.ancho, orden.alto) != null) {
    return { ancho: Number(orden.ancho), alto: Number(orden.alto), origen: 'orden' }
  }
  if (sitio && proporcion(sitio.ancho, sitio.alto) != null) {
    return { ancho: Number(sitio.ancho), alto: Number(sitio.alto), origen: 'sitio' }
  }
  return null
}

/** Proporción de una resolución escrita «1920x1080», «1920 × 1080» o «1920*1080». */
export function proporcionDeResolucion(res: string | null | undefined): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/i.exec(String(res ?? ''))
  if (!m) return null
  return proporcion(Number(m[1].replace(',', '.')), Number(m[2].replace(',', '.')))
}

export type Ajuste =
  | { tipo: 'ajusta' }
  // `pierde` es la fracción del arte que queda fuera (0..1), y `por` dice de
  // qué lados: un arte más ancho que el sitio pierde los costados; uno más
  // alto pierde arriba y abajo.
  | { tipo: 'recorta'; pierde: number; por: 'costados' | 'arriba-abajo' }

/** Cómo cae un arte de proporción `arte` en un marco de proporción `marco`, a sangre. */
export function ajusteEnMarco(marco: number, arte: number): Ajuste {
  if (!(marco > 0) || !(arte > 0)) return { tipo: 'ajusta' }
  if (arte > marco) {
    // El arte es más ancho: se escala por alto y sobra ancho.
    const pierde = 1 - marco / arte
    return pierde <= TOLERANCIA_AJUSTE ? { tipo: 'ajusta' } : { tipo: 'recorta', pierde, por: 'costados' }
  }
  const pierde = 1 - arte / marco
  return pierde <= TOLERANCIA_AJUSTE ? { tipo: 'ajusta' } : { tipo: 'recorta', pierde, por: 'arriba-abajo' }
}

// Proporciones con nombre, para escribir «16:9» y no «1.78». Si no se parece a
// ninguna (±2 %), se escribe la cifra con dos decimales.
const CONOCIDAS: [string, number][] = [
  ['1:1', 1],
  ['4:3', 4 / 3],
  ['3:4', 3 / 4],
  ['3:2', 3 / 2],
  ['2:3', 2 / 3],
  ['16:9', 16 / 9],
  ['9:16', 9 / 16],
  ['2:1', 2],
  ['1:2', 1 / 2],
  ['3:1', 3],
  ['1:3', 1 / 3],
]

export function nombreProporcion(r: number | null): string | null {
  if (r == null || !(r > 0)) return null
  for (const [n, v] of CONOCIDAS) if (Math.abs(r / v - 1) <= 0.02) return n
  return r >= 1 ? `${r.toFixed(2)}:1` : `1:${(1 / r).toFixed(2)}`
}

// El marco en pantalla: una proporción extrema (un muro de 30 × 2 m) dejaría
// una tira de 8 px de alto. Se acota la proporción DIBUJADA, nunca la que se
// calcula ni la que se dice en texto.
export function proporcionDibujable(r: number): number {
  return Math.min(4, Math.max(0.35, r))
}
