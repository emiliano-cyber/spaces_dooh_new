// pi-agent/src/huella.js
//
// Huella visual de una imagen (64 bits), en JavaScript puro.
//
// Sirve para reconocer si lo que hay en la pantalla ya se habia visto antes sin
// mandar la imagen a ningun lado: la huella son 8 bytes y una foto son 1.5 MB.
//
// COMO SE CALCULA
//
// La imagen se reduce a una rejilla de 8x8 celdas de luminancia, y cada celda se
// compara contra la mediana de las 64. Mas clara que la mediana = 1, mas oscura
// = 0. De ahi salen los 64 bits.
//
// POR QUE ASI Y NO CON LA DCT (que es lo habitual)
//
// El pHash clasico transforma la imagen con la DCT y compara coeficientes contra
// su mediana. Funciona bien con fotografias, que estan llenas de textura, pero un
// anuncio de espectacular es lo contrario: manchas grandes de color plano. En una
// imagen asi casi todos los coeficientes valen casi cero, quedan pegados a la
// mediana, y el signo de la mitad de los bits lo decide el ruido y no el
// contenido. Medido con anuncios de prueba, el MISMO creativo cambiaba hasta 24
// bits entre el dia y la noche: suficiente para que el sistema lo tomara por uno
// nuevo y gastara una foto.
//
// Comparar el brillo de cada zona contra la mediana no tiene ese problema: una
// zona oscura queda muy por debajo de la mediana y ahi se queda. Ademas aguanta
// el cambio de luz por construccion: si toda la escena se oscurece a la mitad, la
// mediana se oscurece igual y ninguna comparacion cambia de lado. Eso es
// exactamente lo que pasa entre el mediodia y la madrugada.

// 16x16 celdas = 256 bits (64 caracteres hexadecimales).
//
// Con 8x8 la huella resultaba demasiado gruesa: dos anuncios iguales salvo por
// el TAMAÑO del elemento brillante quedaban a 8 bits, o sea confundidos, y ese
// cambio de creativo habria pasado inadvertido. Con 16x16 cada celda sigue
// midiendo unos 60 pixeles de lado -bastante para que el temblor de la camara no
// la mueva- pero ya distingue esas diferencias. Cuesta 32 bytes por huella en vez
// de 8: una docena de creativos siguen siendo menos de un kilobyte por recorrido.
const REJILLA = 16;
const TRABAJO = 64;   // miniatura intermedia, para promediar en dos pasos

// Contraste minimo (desviacion estandar de la miniatura, en niveles de gris).
//
// Una imagen casi lisa -pantalla apagada, noche cerrada, lente empañado, niebla-
// no tiene forma que reconocer: todas las celdas valen casi lo mismo, la mediana
// cae en medio y los bits se vuelven una moneda al aire que cambia sola de un
// recorrido a otro. Sin este filtro, una pantalla apagada de madrugada inventa
// "creativos nuevos" toda la noche, y cada uno cuesta una foto.
const CONTRASTE_MINIMO = 6;

/**
 * Reduce una imagen en escala de grises a una rejilla de `lado`x`lado`
 * promediando bloques. Promediar (y no tomar un pixel de cada tantos) hace que
 * el ruido del sensor y el temblor de la camara no muevan la huella.
 */
function rejilla(gris, ancho, alto, lado) {
  const salida = new Float64Array(lado * lado);
  for (let y = 0; y < lado; y++) {
    const y0 = Math.floor((y * alto) / lado);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * alto) / lado));
    for (let x = 0; x < lado; x++) {
      const x0 = Math.floor((x * ancho) / lado);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * ancho) / lado));
      let suma = 0, n = 0;
      for (let j = y0; j < y1; j++) {
        for (let i = x0; i < x1; i++) { suma += gris[j * ancho + i]; n++; }
      }
      salida[y * lado + x] = n ? suma / n : 0;
    }
  }
  return salida;
}

/** Desviacion estandar: que tanta forma hay que reconocer. */
function contraste(valores) {
  let suma = 0;
  for (const v of valores) suma += v;
  const media = suma / valores.length;
  let acumulado = 0;
  for (const v of valores) acumulado += (v - media) * (v - media);
  return Math.sqrt(acumulado / valores.length);
}

/**
 * Huella de 64 bits en hexadecimal (16 caracteres).
 * `gris` es un arreglo de luminancia (0-255), fila por fila.
 * Devuelve null si la imagen no tiene suficiente contraste para reconocerla.
 */
function calcular(gris, ancho, alto) {
  if (!gris || !ancho || !alto || gris.length < ancho * alto) return null;

  // Dos pasos: primero a 32x32 y de ahi a 8x8. Bajar de golpe deja cada celda
  // decidida por el trozo de imagen que le toco; pasando por 32x32 cada celda
  // final es el promedio de 16 promedios, mas estable ante un corrimiento.
  const media = rejilla(gris, ancho, alto, TRABAJO);
  if (contraste(media) < CONTRASTE_MINIMO) return null;

  const celdas = rejilla(media, TRABAJO, TRABAJO, REJILLA);

  // Mediana y no promedio: un cielo muy brillante o una sombra muy negra en una
  // esquina arrastran el promedio y voltean bits en el resto de la imagen.
  const ordenadas = Float64Array.from(celdas).sort();
  const medio = ordenadas.length / 2;
  const mediana = (ordenadas[medio - 1] + ordenadas[medio]) / 2;

  // Zona muerta alrededor de la mediana.
  //
  // Cuando la imagen tiene un fondo dominante -una pantalla encendida contra el
  // cielo negro de madrugada, por ejemplo- la mediana cae DENTRO de ese fondo, y
  // las decenas de celdas que valen practicamente lo mismo quedan decidiendose
  // por el ruido: la misma escena daba huellas a 14 bits de distancia entre una
  // toma y la siguiente, y cada falsa alarma cuesta una foto. Con la zona muerta,
  // todo lo que no destaca claramente da un 0 fijo, y solo mandan las zonas que
  // de verdad resaltan. Se pierde algo de detalle a cambio de que la huella no se
  // mueva sola.
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

const BITS = REJILLA * REJILLA;

// Bits que pueden diferir para seguir siendo "el mismo creativo". Medido con
// anuncios de prueba (npm run probar:huella): el mismo creativo entre el dia y
// la noche se mueve como mucho 16 bits, y dos creativos distintos quedan a 75 o
// mas. 24 deja margen a ambos lados.
const TOLERANCIA = 24;

/** Bits distintos entre dos huellas. 0 = identicas, 256 = opuestas. */
function distancia(a, b) {
  if (!a || !b || a.length !== b.length) return BITS;
  let d = 0;
  // De 4 en 4 caracteres (16 bits) para no depender de BigInt.
  for (let i = 0; i < a.length; i += 4) {
    let x = parseInt(a.slice(i, i + 4), 16) ^ parseInt(b.slice(i, i + 4), 16);
    while (x) { d += x & 1; x >>>= 1; }
  }
  return d;
}

/** La huella conocida mas parecida, o null si ninguna se acerca lo suficiente. */
function parecida(huella, conocidas, tolerancia) {
  let mejor = null;
  let mejorD = tolerancia + 1;
  for (const c of conocidas || []) {
    const d = distancia(huella, c);
    if (d < mejorD) { mejorD = d; mejor = c; }
  }
  return mejor;
}

module.exports = { calcular, distancia, parecida, CONTRASTE_MINIMO, REJILLA, BITS, TOLERANCIA };
