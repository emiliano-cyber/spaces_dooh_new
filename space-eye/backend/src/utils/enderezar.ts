// backend/src/utils/enderezar.ts
//
// La pantalla "de frente", desde una foto cualquiera del sitio.
//
// Port de android/.../pantalla/Enderezador.kt (_enderezar) y de
// pi-agent/vision/enderezador.py, y tiene que seguir siendolo: lo que sale de
// aqui se le pasa a utils/huella.ts, y esa huella se compara contra las que
// calcularon los agentes. Si este port se desvia, el servidor ve "creativos
// nuevos" donde el equipo ve el de siempre.
//
// POR QUE EL SERVIDOR NECESITA ESTO
// ---------------------------------
// El catalogo de creativos guarda la PRIMERA foto de cada anuncio y, desde la
// 029, tambien la mas reciente: "como aparecio" y "como se ve ahora". Lo
// segundo nunca ocurre, porque la unica foto que un equipo manda de un creativo
// es la del hallazgo: al que ya conoce no lo vuelve a fotografiar, y ningun
// agente implementa `creative_refoto_h`. Medido en g500: 323 creativos, 55 con
// su primera foto, CERO con la de ahora.
//
// Arreglarlo en los equipos significa publicar APK, y las que hay estan en la
// calle. Pero el sitio ya toma fotos por horario, y en ellas aparece la misma
// pantalla: si el servidor endereza esa foto y le saca la huella, puede
// reconocer el anuncio sin pedir ni un byte mas de datos moviles.
//
// LAS ESQUINAS Y EL GIRO
// ----------------------
// `devices.pantalla.esquinas` son fracciones de la foto TAL COMO LA GUARDA EL
// EQUIPO, antes del giro del encuadre (migracion 018). La foto que llega al
// servidor ya viene con ese giro HORNEADO en los pixeles (bakeRotation). Asi
// que antes de usarlas hay que girar las esquinas lo mismo, o se recorta un
// trozo de cielo. Eso es `girarEsquinas`.
import sharp from 'sharp';

/** Lo que mide la pantalla enderezada, igual que los agentes. */
export const ANCHO_PANTALLA = 320;

export type Punto = [number, number];
export type Gris = { datos: Uint8Array; ancho: number; alto: number };

/**
 * Redondeo al entero como lo hace el telefono (Kotlin `roundToInt`): .5 hacia
 * arriba SIEMPRE, no al par. Importa porque decide el alto de la pantalla
 * enderezada, y un pixel de diferencia mueve la rejilla de la huella.
 */
function redondea(v: number): number {
  return Math.floor(v + 0.5);
}

function largo(a: Punto, b: Punto): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * Las esquinas giradas los mismos grados que el equipo le horneo a la foto.
 * En fracciones, asi que el giro es sobre el cuadrado unidad y hay que
 * intercambiar los ejes en 90 y 270.
 */
export function girarEsquinas(esquinas: Punto[], grados: number): Punto[] {
  const g = ((Math.round(grados / 90) * 90) % 360 + 360) % 360;
  if (g === 0) return esquinas;
  return esquinas.map(([x, y]): Punto => {
    if (g === 90) return [1 - y, x];
    if (g === 180) return [1 - x, 1 - y];
    return [y, 1 - x]; // 270
  });
}

/**
 * Resuelve el sistema de 8x8 por eliminacion gaussiana con pivoteo parcial.
 * Devuelve null si es singular (tres esquinas en linea, o dos iguales).
 */
function resolver(m: number[][], b: number[]): number[] | null {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    let mejor = col;
    for (let f = col + 1; f < n; f++) if (Math.abs(m[f][col]) > Math.abs(m[mejor][col])) mejor = f;
    if (Math.abs(m[mejor][col]) < 1e-9) return null;
    [m[col], m[mejor]] = [m[mejor], m[col]];
    [b[col], b[mejor]] = [b[mejor], b[col]];
    for (let f = 0; f < n; f++) {
      if (f === col) continue;
      const k = m[f][col] / m[col][col];
      if (!k) continue;
      for (let c = col; c < n; c++) m[f][c] -= k * m[col][c];
      b[f] -= k * b[col];
    }
  }
  return b.map((v, i) => v / m[i][i]);
}

/**
 * La transformacion que lleva un punto del DESTINO (la pantalla enderezada) al
 * ORIGEN (la foto). Se resuelve en ese sentido a proposito: asi el muestreo
 * recorre el destino pixel a pixel y no hace falta invertir nada, que es lo
 * mismo que hace cv2.warpPerspective por dentro.
 */
function transformacion(destino: Punto[], origen: Punto[]): number[] | null {
  const m: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = destino[i];
    const [u, v] = origen[i];
    m.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    m.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }
  return resolver(m, b);
}

/** Gris Rec. 601 en ENTEROS, la misma cuenta que hacen los tres agentes. */
function aGris(rgb: Buffer, ancho: number, alto: number, canales: number): Uint8Array {
  const salida = new Uint8Array(ancho * alto);
  for (let i = 0, p = 0; i < salida.length; i++, p += canales) {
    salida[i] = Math.floor((rgb[p] * 299 + rgb[p + 1] * 587 + rgb[p + 2] * 114) / 1000);
  }
  return salida;
}

/**
 * La pantalla de una foto, enderezada a 320 px de ancho y en gris.
 *
 * `grados` es el giro que la foto YA trae horneado; las esquinas se giran lo
 * mismo antes de usarlas. Devuelve null si la foto no se puede leer o si las
 * esquinas no forman un cuadrilatero.
 */
export async function enderezarPantalla(
  jpeg: Buffer,
  esquinas: Punto[],
  grados = 0,
): Promise<Gris | null> {
  if (!Array.isArray(esquinas) || esquinas.length !== 4) return null;

  let crudo: { data: Buffer; info: sharp.OutputInfo };
  try {
    // Sin `.rotate()`: los agentes decodifican IGNORANDO la orientacion EXIF
    // (BitmapFactory en el telefono, IMREAD_IGNORE_ORIENTATION en la Pi) porque
    // el giro ya viene horneado. Pedirselo a sharp lo giraria dos veces.
    crudo = await sharp(jpeg, { failOn: 'none' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  } catch {
    return null;
  }
  const { width: w, height: h, channels } = crudo.info;
  if (!w || !h || w < 8 || h < 8) return null;

  const gris = aGris(crudo.data, w, h, channels);
  const q = girarEsquinas(esquinas, grados).map(([x, y]): Punto => [x * w, y * h]);

  // Ancho y alto de la pantalla en la foto: el promedio de sus dos lados
  // opuestos, como en los agentes.
  const anchoReal = (largo(q[0], q[1]) + largo(q[3], q[2])) / 2;
  const altoReal = (largo(q[0], q[3]) + largo(q[1], q[2])) / 2;
  if (!(anchoReal > 1) || !(altoReal > 1)) return null;
  const alto = Math.max(8, redondea((ANCHO_PANTALLA * altoReal) / anchoReal));

  const destino: Punto[] = [[0, 0], [ANCHO_PANTALLA, 0], [ANCHO_PANTALLA, alto], [0, alto]];
  const t = transformacion(destino, q);
  if (!t) return null;
  const [a, b2, c, d, e, f, g2, h2] = t;

  const salida = new Uint8Array(ANCHO_PANTALLA * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ANCHO_PANTALLA; x++) {
      const den = g2 * x + h2 * y + 1;
      // Un denominador que se anula es un punto en el horizonte de la
      // perspectiva: no esta en la foto.
      if (Math.abs(den) < 1e-12) continue;
      const sx = (a * x + b2 * y + c) / den;
      const sy = (d * x + e * y + f) / den;
      // Fuera de la foto queda en 0, como el borde por omision de
      // cv2.warpPerspective (BORDER_CONSTANT).
      if (sx < 0 || sy < 0 || sx > w - 1 || sy > h - 1) continue;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, w - 1);
      const y1 = Math.min(y0 + 1, h - 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const p00 = gris[y0 * w + x0];
      const p01 = gris[y0 * w + x1];
      const p10 = gris[y1 * w + x0];
      const p11 = gris[y1 * w + x1];
      const arriba = p00 + (p01 - p00) * fx;
      const abajo = p10 + (p11 - p10) * fx;
      salida[y * ANCHO_PANTALLA + x] = Math.round(arriba + (abajo - arriba) * fy);
    }
  }
  return { datos: salida, ancho: ANCHO_PANTALLA, alto };
}

// --- ¿Esta pantalla esta apagada? ---------------------------------------------
//
// Los mismos numeros de apagada_rapida.py y ApagadaRapida.kt, medidos en campo:
//
//   · negra o casi, y sin apenas variacion -> de noche, o a la sombra;
//   · PAREJA aunque no sea oscura -> de dia una pantalla LED apagada refleja el
//     cielo y sale gris (brillo 64 medido en Santa Monica el 14-sep), pero
//     queda lisa, sin contenido.
//
// POR QUE HACE FALTA AQUI. El agente solo descarta un creativo cuando la huella
// no se puede calcular, y eso pasa con contraste < 6. El detector de pantalla
// apagada usa una vara mas ancha, y entre las dos queda un hueco: brillo bajo
// con algo de textura -una pantalla apagada de noche con reflejos, las franjas
// del LED- da huella, no casa con el catalogo, y entra como CREATIVO NUEVO.
// Gasta una foto de datos moviles y ensucia el catalogo del sitio. Es lo que el
// dueno reporto de TLALPAN el 9-nov-2026: "me dice creativo nuevo mientras la
// pantalla esta apagada".
//
// El margen es holgado: medidas sobre las 43 fotos del catalogo de g500, la
// desviacion mas baja de un creativo de verdad es 22.9 y el brillo mas bajo
// 45.2. Ningun anuncio real se acerca a estos umbrales.
export const BRILLO_MAX = 40.0;
export const DESVIACION_MAX = 14.0;
export const DESVIACION_PAREJA = 6.0;

export type Medida = { brillo: number; desv: number; apagada: boolean };

export function medirPantalla(gris: Gris): Medida {
  const n = gris.datos.length;
  let suma = 0;
  for (let i = 0; i < n; i++) suma += gris.datos[i];
  const brillo = suma / n;
  let acc = 0;
  for (let i = 0; i < n; i++) { const d = gris.datos[i] - brillo; acc += d * d; }
  const desv = Math.sqrt(acc / n);
  return {
    brillo,
    desv,
    apagada: (brillo < BRILLO_MAX && desv < DESVIACION_MAX) || desv < DESVIACION_PAREJA,
  };
}
