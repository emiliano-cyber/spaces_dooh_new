// backend/src/utils/huella.ts
//
// Huella visual de 256 bits de lo que hay en la pantalla.
//
// Port de android/.../creativos/Huella.kt y de pi-agent/vision/huella.py, y
// tiene que seguir siendolo: el servidor compara las huellas de todos los
// agentes con la misma regla (creativos.controller.ts), y el catalogo de un
// sitio sobrevive a un cambio de equipo solo si todos calculan igual. La
// prueba compara contra las huellas exactas que espera el telefono
// (npm run prueba:huella), con las mismas dos fotos de MANUEL DUBLAN.
//
// Hasta aqui la huella la calculaba SOLO el agente y viajaba pegada a la foto.
// Eso dejaba al servidor sin poder decir nada de una imagen que le llega sin
// huella -una captura manual, o una de creative_change cuyo creativo se
// borro-, y es la razon de que 71 de las 130 fotos de creativo de g500 esten
// guardadas sin que nadie las use.
//
//   1. La imagen en gris se promedia a 64x64 y de ahi a 16x16 celdas.
//   2. Cada celda vale 1 si es claramente mas clara que la mediana de las 256
//      (mediana + un cuarto de la desviacion), y 0 si no.
//   3. Si la imagen casi no tiene contraste no hay huella: pantalla apagada,
//      lente tapada o noche cerrada no son un creativo y no deben gastar foto.

export const REJILLA = 16;
export const BITS = REJILLA * REJILLA;
const TRABAJO = 64;
const CONTRASTE_MINIMO = 6.0;
/** Bits que pueden diferir para seguir siendo el mismo creativo. */
export const TOLERANCIA = 24;

/**
 * Promedia `v` (ancho x alto) en una rejilla de `lado` x `lado`.
 *
 * Suma en el MISMO orden que el telefono -fila por fila dentro de cada celda-
 * porque el resultado se compara bit a bit con el suyo y el redondeo en punto
 * flotante no es asociativo: sumar en otro orden cambia algun bit.
 */
function rejilla(v: ArrayLike<number>, ancho: number, alto: number, lado: number): number[] {
  const salida = new Array<number>(lado * lado).fill(0);
  for (let y = 0; y < lado; y++) {
    const y0 = Math.floor((y * alto) / lado);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * alto) / lado));
    for (let x = 0; x < lado; x++) {
      const x0 = Math.floor((x * ancho) / lado);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * ancho) / lado));
      let suma = 0;
      let n = 0;
      for (let j = y0; j < y1; j++) {
        const fila = j * ancho;
        for (let i = x0; i < x1; i++) { suma += v[fila + i]; n++; }
      }
      salida[y * lado + x] = n > 0 ? suma / n : 0;
    }
  }
  return salida;
}

function contraste(v: number[]): number {
  let media = 0;
  for (const x of v) media += x;
  media /= v.length;
  let acc = 0;
  for (const x of v) acc += (x - media) * (x - media);
  return Math.sqrt(acc / v.length);
}

/**
 * Huella en hexadecimal (64 caracteres), o null si la imagen no tiene forma
 * que reconocer. `gris` es luminancia 0..255, fila por fila.
 */
export function calcular(gris: ArrayLike<number>, ancho: number, alto: number): string | null {
  if (ancho <= 0 || alto <= 0 || gris.length < ancho * alto) return null;
  const media = rejilla(gris, ancho, alto, TRABAJO);
  if (contraste(media) < CONTRASTE_MINIMO) return null;
  const celdas = rejilla(media, TRABAJO, TRABAJO, REJILLA);

  const ordenadas = [...celdas].sort((a, b) => a - b);
  const medio = ordenadas.length >> 1;
  const mediana = (ordenadas[medio - 1] + ordenadas[medio]) / 2;
  const zonaMuerta = contraste(celdas) * 0.25;

  let hex = '';
  let acumulado = 0;
  let bits = 0;
  for (const v of celdas) {
    acumulado = (acumulado << 1) | (v > mediana + zonaMuerta ? 1 : 0);
    if (++bits === 4) { hex += acumulado.toString(16); acumulado = 0; bits = 0; }
  }
  return hex;
}

/** Bits distintos entre dos huellas. 0 = identicas. */
export function distancia(a: string | null, b: string | null): number {
  if (!a || !b || a.length !== b.length) return BITS;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    if (Number.isNaN(x)) return BITS;
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}
