import { describe, it, expect } from 'vitest'
import {
  truncarIp,
  sanearNombreArchivo,
  leerImagenEnvio,
  orientacionDePantalla,
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
