// ============================================================================
//  semilla-arte-demo.mjs — el ARTE inventado de los creativos de la demo.
// ----------------------------------------------------------------------------
//  Lo usa `semilla-catalogo-demo.mjs`. Genera un PNG de verdad —con su firma,
//  sus bloques IHDR/IDAT/IEND y su CRC— sin más dependencia que `node:zlib`:
//  una franja de color, un marco y el texto del anuncio en letras de bloque.
//
//  Por qué no una imagen cualquiera de internet: el arte de una campaña es
//  material de un cliente, y una demo no puede enseñar el de nadie. Por qué no
//  un rectángulo liso: la rejilla de Creativos y la orden de imprenta enseñan
//  la miniatura, y una miniatura sin texto no dice de qué campaña es.
//
//  Determinista: el mismo texto da los mismos bytes, así que la segunda corrida
//  de la semilla reconoce lo ya sembrado y una prueba puede fijar el resultado.
// ============================================================================
import { deflateSync } from 'node:zlib'

// Letras de 5x7. Solo lo que usan los textos de la demo: mayúsculas sin
// acento, cifras y tres signos. Una letra que falte sale como espacio.
const FUENTE = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '10001', '11001', '10101', '10011', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
}

const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function bloque(tipo, datos) {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const td = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([largo, td, crc])
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

/**
 * Un PNG RGB de `ancho`x`alto`: fondo, franja inferior de acento, marco y las
 * líneas de texto centradas. Devuelve los bytes.
 */
export function pngDeArte({ ancho, alto, fondo, acento, texto, lineas }) {
  const px = Buffer.alloc(ancho * alto * 3)
  const pon = (x, y, rgb) => {
    if (x < 0 || y < 0 || x >= ancho || y >= alto) return
    const i = (y * ancho + x) * 3
    px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]
  }
  const F = hex(fondo)
  const A = hex(acento)
  const T = hex(texto)
  const franja = Math.round(alto * 0.18)
  for (let y = 0; y < alto; y++)
    for (let x = 0; x < ancho; x++) pon(x, y, y >= alto - franja ? A : F)
  const marco = Math.max(2, Math.round(Math.min(ancho, alto) / 60))
  for (let y = 0; y < alto; y++)
    for (let x = 0; x < ancho; x++)
      if (x < marco || y < marco || x >= ancho - marco || y >= alto - marco) pon(x, y, A)

  // Cada línea con su propia escala: la primera grande (el anunciante), las
  // demás menores. Se encoge hasta que quepa a lo ancho.
  const zonaTexto = alto - franja
  const escalas = lineas.map((l, i) => {
    let e = Math.max(1, Math.floor((zonaTexto / (lineas.length + 1)) / (i === 0 ? 9 : 13)))
    while (e > 1 && l.length * 6 * e > ancho * 0.9) e--
    return e
  })
  const altoTotal = escalas.reduce((a, e) => a + 9 * e, 0)
  let y0 = Math.round((zonaTexto - altoTotal) / 2)
  lineas.forEach((linea, i) => {
    const e = escalas[i]
    const l = linea.toUpperCase()
    const x0 = Math.round((ancho - l.length * 6 * e) / 2)
    ;[...l].forEach((ch, k) => {
      const g = FUENTE[ch]
      if (!g) return
      for (let gy = 0; gy < 7; gy++)
        for (let gx = 0; gx < 5; gx++)
          if (g[gy][gx] === '1')
            for (let dy = 0; dy < e; dy++)
              for (let dx = 0; dx < e; dx++) pon(x0 + (k * 6 + gx) * e + dx, y0 + gy * e + dy, T)
    })
    y0 += 9 * e
  })

  const crudo = Buffer.alloc((ancho * 3 + 1) * alto)
  for (let y = 0; y < alto; y++) {
    crudo[y * (ancho * 3 + 1)] = 0
    px.copy(crudo, y * (ancho * 3 + 1) + 1, y * ancho * 3, (y + 1) * ancho * 3)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(ancho, 0)
  ihdr.writeUInt32BE(alto, 4)
  ihdr[8] = 8 // profundidad
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque('IHDR', ihdr),
    bloque('IDAT', deflateSync(crudo, { level: 9 })),
    bloque('IEND', Buffer.alloc(0)),
  ])
}

export function dataUrlDeArte(opciones) {
  return `data:image/png;base64,${pngDeArte(opciones).toString('base64')}`
}

/**
 * Copia LITERAL de `imagenAHtml` (`apps/web/lib/creativo-html.ts`): es como la
 * pantalla de Creativos guarda una imagen subida —envuelta en HTML para el
 * player—, y el servidor la reconoce comparando byte a byte. Una prueba ata
 * las dos copias: si la de la app cambia, la semilla deja de parecerse a lo
 * que sube una persona y la prueba lo dice.
 */
export function imagenAHtml(dataUrl, nombre) {
  const alt = (nombre || 'creativo').replace(/[<>&"]/g, ' ').trim()
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<style>' +
    'html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden}' +
    '.dooh-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}' +
    `.dooh-bg{position:absolute;inset:0;background:#000 center/cover no-repeat url("${dataUrl}");` +
    'filter:blur(28px) brightness(.55);transform:scale(1.15)}' +
    '.dooh-fg{position:relative;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block}' +
    '</style></head>' +
    '<body><div class="dooh-wrap">' +
    '<div class="dooh-bg"></div>' +
    `<img class="dooh-fg" src="${dataUrl}" alt="${alt}"/>` +
    '</div></body></html>'
  )
}
