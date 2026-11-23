import { describe, it, expect } from 'vitest'
import {
  truncarIp,
  sanearNombreArchivo,
  leerImagenEnvio,
  orientacionDePantalla,
  dimensionesDeImagen,
  revisarProporcionEnvio,
  TIPOS_ENVIO,
  ENVIO_MAX_MB,
  LIMITE_ENVIOS_POR_DIA,
} from './envio-creativo-cliente'

// ENVIO-CLIENTE (18/11) · las reglas puras del creativo que manda el cliente.

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('truncarIp', () => {
  it('IPv4: el último tramo en cero', () => {
    expect(truncarIp('201.141.22.87')).toBe('201.141.22.0')
  })
  it('IPv6: solo los tres primeros grupos', () => {
    expect(truncarIp('2806:10a6:1b:7f3e::12')).toBe('2806:10a6:1b::')
  })
  it('IPv4 dentro de IPv6 y basura', () => {
    expect(truncarIp('::ffff:10.0.0.9')).toBe('10.0.0.0')
    expect(truncarIp('desconocida')).toBeNull()
    expect(truncarIp('')).toBeNull()
  })
})

describe('sanearNombreArchivo', () => {
  it('quita rutas, comillas y signos de HTML, y recorta', () => {
    expect(sanearNombreArchivo('C:\\fakepath\\..\\arte "final" <b>.png')).toBe('arte final b .png')
    expect(sanearNombreArchivo('../../etc/passwd')).toBe('passwd')
    expect(sanearNombreArchivo('x'.repeat(300)).length).toBe(120)
  })
  it('vacío o solo basura: «creativo»', () => {
    expect(sanearNombreArchivo('')).toBe('creativo')
    expect(sanearNombreArchivo('   /// ')).toBe('creativo')
    expect(sanearNombreArchivo(undefined)).toBe('creativo')
  })
})

describe('leerImagenEnvio', () => {
  it('JPG, PNG y WebP; nada más', () => {
    expect(TIPOS_ENVIO).toEqual(['image/jpeg', 'image/png', 'image/webp'])
    expect(leerImagenEnvio(PNG)).toEqual({ ok: true, tipo: 'image/png', bytes: 70 })
  })
  it('tipo no permitido → 400 (SVG, PDF, HTML)', () => {
    for (const t of ['image/svg+xml', 'application/pdf', 'text/html']) {
      expect(leerImagenEnvio(`data:${t};base64,AAAA`)).toMatchObject({ ok: false, status: 400 })
    }
  })
  it('lo que no es un data URL → 400', () => {
    expect(leerImagenEnvio('https://ejemplo.com/a.png')).toMatchObject({ ok: false, status: 400 })
    expect(leerImagenEnvio(42)).toMatchObject({ ok: false, status: 400 })
  })
  it(`más de ${ENVIO_MAX_MB} MB → 413, sin decodificar`, () => {
    const grande = 'data:image/png;base64,' + 'A'.repeat(Math.ceil((ENVIO_MAX_MB * 1024 * 1024 * 4) / 3) + 8)
    expect(leerImagenEnvio(grande)).toMatchObject({ ok: false, status: 413 })
  })
  it('un tope diario por campaña razonable', () => {
    expect(LIMITE_ENVIOS_POR_DIA).toBeGreaterThanOrEqual(5)
    expect(LIMITE_ENVIOS_POR_DIA).toBeLessThanOrEqual(20)
  })
})

describe('orientacionDePantalla', () => {
  it('lona en metros: la proporción y la medida', () => {
    expect(orientacionDePantalla({ ancho: 12.9, alto: 7.2, resolucionPx: null })).toEqual({ proporcion: '16:9', medida: '12.9 × 7.2 m' })
  })
  it('pantalla en píxeles: manda la resolución', () => {
    expect(orientacionDePantalla({ ancho: null, alto: null, resolucionPx: '1080x1920' })).toEqual({ proporcion: '9:16', medida: '1080 × 1920 px' })
  })
  it('sin medida: nada', () => {
    expect(orientacionDePantalla({ ancho: null, alto: null, resolucionPx: null })).toBeNull()
  })
})

// 18/11 · decisión del dueño: el envío cuya proporción no coincide con la del
// sitio elegido SE RECHAZA. La medida se lee de la cabecera del archivo (no se
// confía en la que manda el navegador), sin dependencias.
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
const png = (w: number, h: number) =>
  Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...u32(w), ...u32(h), 8, 6, 0, 0, 0])
const jpeg = (w: number, h: number) =>
  Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0),
    0xff, 0xc0, 0x00, 0x11, 0x08, (h >> 8) & 255, h & 255, (w >> 8) & 255, w & 255, 3, ...new Array(9).fill(0),
  ])
const riff = (cuerpo: number[]) => Uint8Array.from([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP'), ...cuerpo])
const le24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255]
const webpVp8x = (w: number, h: number) => riff([...Buffer.from('VP8X'), 10, 0, 0, 0, 0, 0, 0, 0, ...le24(w - 1), ...le24(h - 1)])
const webpVp8l = (w: number, h: number) => {
  const b = (w - 1) | ((h - 1) << 14)
  return riff([...Buffer.from('VP8L'), 5, 0, 0, 0, 0x2f, b & 255, (b >>> 8) & 255, (b >>> 16) & 255, (b >>> 24) & 255])
}
const webpVp8 = (w: number, h: number) =>
  riff([...Buffer.from('VP8 '), 10, 0, 0, 0, 0, 0, 0, 0x9d, 0x01, 0x2a, w & 255, (w >> 8) & 0x3f, h & 255, (h >> 8) & 0x3f])

describe('dimensionesDeImagen', () => {
  it('PNG, JPEG y los tres WebP', () => {
    expect(dimensionesDeImagen(Buffer.from(PNG.split(',')[1], 'base64'))).toEqual({ ancho: 1, alto: 1 })
    expect(dimensionesDeImagen(png(1600, 1200))).toEqual({ ancho: 1600, alto: 1200 })
    expect(dimensionesDeImagen(jpeg(1920, 1080))).toEqual({ ancho: 1920, alto: 1080 })
    expect(dimensionesDeImagen(webpVp8x(3000, 2000))).toEqual({ ancho: 3000, alto: 2000 })
    expect(dimensionesDeImagen(webpVp8l(800, 600))).toEqual({ ancho: 800, alto: 600 })
    expect(dimensionesDeImagen(webpVp8(1024, 768))).toEqual({ ancho: 1024, alto: 768 })
  })
  it('lo que no se puede leer: null', () => {
    expect(dimensionesDeImagen(Uint8Array.from([1, 2, 3]))).toBeNull()
    expect(dimensionesDeImagen(Buffer.from('no es una imagen de verdad'))).toBeNull()
    expect(dimensionesDeImagen(Uint8Array.from([0xff, 0xd8, 0xff]))).toBeNull()
  })
})

describe('revisarProporcionEnvio', () => {
  const cuatroTercios = { ancho: null, alto: null, resolucionPx: '1024x768' }
  it('16:9 en un sitio 4:3: se rechaza, con la medida que pide', () => {
    expect(revisarProporcionEnvio(cuatroTercios, 1920, 1080)).toEqual({
      arte: '16:9',
      sitio: '4:3',
      medida: '1024 × 768 px',
      sugerido: { ancho: 1920, alto: 1440 },
    })
  })
  it('dentro de la tolerancia (3 %, la de la valoración del arte): pasa', () => {
    expect(revisarProporcionEnvio(cuatroTercios, 1440, 1080)).toBeNull()
    expect(revisarProporcionEnvio(cuatroTercios, 1450, 1080)).toBeNull() // 0,7 % de diferencia
    expect(revisarProporcionEnvio({ ancho: 12.9, alto: 7.2, resolucionPx: null }, 1920, 1080)).toBeNull()
  })
  it('un sitio vertical pide la imagen vertical', () => {
    const r = revisarProporcionEnvio({ ancho: null, alto: null, resolucionPx: '1080x1920' }, 1920, 1080)
    expect(r).toMatchObject({ arte: '16:9', sitio: '9:16', sugerido: { ancho: 1080, alto: 1920 } })
  })
  it('sin medida del sitio (o sin sitio) no se rechaza por proporción', () => {
    expect(revisarProporcionEnvio({ ancho: null, alto: null, resolucionPx: null }, 1920, 1080)).toBeNull()
    expect(revisarProporcionEnvio(null, 1920, 1080)).toBeNull()
  })
})
