// ============================================================================
//  La pantalla dentro de la foto: la misma geometría que usa el equipo
//  (android/.../pantalla/Geometria.kt) y el panel de Space Eye
//  (frontend/src/js/pantalla.js). Sirve para dibujar los gabinetes donde el
//  equipo los ve y para saber qué gabinete se tocó con el ratón.
//
//  Todo en fracciones de la foto (0..1). Si cambia la fórmula allá, cambia aquí.
// ============================================================================

export type Punto = [number, number]
export type Celda = [number, number] // [fila, columna]

export interface MarcaPantalla {
  esquinas: Punto[]
  filas: number
  columnas: number
}

/**
 * Homografía de (0,0),(1,0),(1,1),(0,1) a las 4 esquinas (arriba-izq,
 * arriba-der, abajo-der, abajo-izq). Fórmula cerrada (Heckbert).
 */
export function homografia(q: Punto[]): number[] {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3
  let g = 0, h = 0
  if (dx3 !== 0 || dy3 !== 0) {
    const det = dx1 * dy2 - dx2 * dy1
    g = (dx3 * dy2 - dx2 * dy3) / det
    h = (dx1 * dy3 - dx3 * dy1) / det
  }
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1]
}

export function aplicar(H: number[], u: number, v: number): Punto {
  const w = H[6] * u + H[7] * v + H[8]
  return [(H[0] * u + H[1] * v + H[2]) / w, (H[3] * u + H[4] * v + H[5]) / w]
}

/** Inversa de una matriz 3x3 (para pasar de la foto a la pantalla enderezada). */
export function inversa(m: number[]): number[] | null {
  const [a, b, c, d, e, f, g, h, i] = m
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g
  const det = a * A + b * B + c * C
  if (!det) return null
  return [
    A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det,
  ]
}

/** El gabinete bajo un punto de la foto, o null si cae fuera de la pantalla. */
export function celdaEn(p: MarcaPantalla, x: number, y: number): Celda | null {
  const inv = inversa(homografia(p.esquinas))
  if (!inv) return null
  const [u, v] = aplicar(inv, x, y)
  if (!Number.isFinite(u) || !Number.isFinite(v)) return null
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return null
  return [Math.floor(v * p.filas), Math.floor(u * p.columnas)]
}

/** Contorno de un gabinete en la foto, como "x,y x,y ..." para un <polygon>. */
export function contorno(p: MarcaPantalla, f: number, c: number): string {
  const H = homografia(p.esquinas)
  const u0 = c / p.columnas, u1 = (c + 1) / p.columnas, v0 = f / p.filas, v1 = (f + 1) / p.filas
  return ([[u0, v0], [u1, v0], [u1, v1], [u0, v1]] as Punto[])
    .map(([u, v]) => aplicar(H, u, v).join(','))
    .join(' ')
}

/** Líneas de la cuadrícula (entre gabinetes), como [[x1,y1,x2,y2], ...]. */
export function lineas(p: MarcaPantalla): [number, number, number, number][] {
  const H = homografia(p.esquinas)
  const out: [number, number, number, number][] = []
  for (let c = 1; c < p.columnas; c++) out.push([...aplicar(H, c / p.columnas, 0), ...aplicar(H, c / p.columnas, 1)])
  for (let f = 1; f < p.filas; f++) out.push([...aplicar(H, 0, f / p.filas), ...aplicar(H, 1, f / p.filas)])
  return out
}

/**
 * Acomoda las esquinas como arriba-izq, arriba-der, abajo-der, abajo-izq, se
 * hayan tocado en el orden que sea. Igual que `ordenarEsquinas` del servidor.
 */
export function ordenar(q: Punto[]): Punto[] {
  const cx = q.reduce((s, p) => s + p[0], 0) / q.length
  const cy = q.reduce((s, p) => s + p[1], 0) / q.length
  const orden = [...q].sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx))
  const inicio = orden.reduce((m, p, i) => (p[0] + p[1] < orden[m][0] + orden[m][1] ? i : m), 0)
  return [...orden.slice(inicio), ...orden.slice(0, inicio)]
}

/** Número de gabinete (1..N, por renglones) de una celda, como lo dice el equipo. */
export function numeroGabinete(columnas: number, [f, c]: Celda): number {
  return f * columnas + c + 1
}

/** La hora del horario de la pantalla: HH:MM de 00:00 a 24:00 (igual que el servidor). */
export const HORA = /^([01]\d|2[0-4]):[0-5]\d$/
