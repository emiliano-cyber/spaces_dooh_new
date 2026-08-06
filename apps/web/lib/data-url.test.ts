import { describe, it, expect } from 'vitest'
import { decodificarDataUrl } from './data-url'

// ============================================================================
//  Decodificar el logo para poder SERVIRLO.
//
//  Esta función es la que separa «hay logo» de «hay algo en la columna». La
//  columna `logo_url` es un `text` sin restricción, así que puede contener una
//  URL http de cuando el logo se hospedaba fuera, un data URL de un tipo que ya
//  no se sirve, o basura de una corrección a mano en la base. En todos esos
//  casos la ruta pública tiene que contestar 404 y no un 500: que no se pueda
//  decodificar un logo no es un fallo del servidor.
// ============================================================================

// PNG de 1x1 transparente, el más corto que existe.
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('decodificarDataUrl', () => {
  it('decodifica un PNG y conserva su tipo', () => {
    const r = decodificarDataUrl(PNG_1PX)
    expect(r).not.toBeNull()
    expect(r!.tipo).toBe('image/png')
    expect(r!.bytes.length).toBeGreaterThan(0)
    // Firma PNG: los bytes son los de verdad, no la cadena base64.
    expect(r!.bytes.subarray(0, 4).toString('hex')).toBe('89504e47')
  })

  it('acepta SVG, que es lo que más se sube como logo', () => {
    const svg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')}`
    expect(decodificarDataUrl(svg)?.tipo).toBe('image/svg+xml')
  })

  it('normaliza el tipo a minúsculas', () => {
    const raro = PNG_1PX.replace('image/png', 'IMAGE/PNG')
    expect(decodificarDataUrl(raro)?.tipo).toBe('image/png')
  })

  it('rechaza un tipo que no es imagen servible', () => {
    const html = `data:text/html;base64,${Buffer.from('<h1>hola</h1>').toString('base64')}`
    expect(decodificarDataUrl(html)).toBeNull()
  })

  it('rechaza una URL http, que es lo que pudo quedar guardado de antes', () => {
    expect(decodificarDataUrl('https://cdn.ejemplo.com/logo.png')).toBeNull()
  })

  it('rechaza un data URL sin base64 (el de texto plano)', () => {
    expect(decodificarDataUrl('data:image/svg+xml,<svg/>')).toBeNull()
  })

  it('rechaza base64 vacío en vez de devolver un buffer de cero bytes', () => {
    // Un `<img>` apuntando a una respuesta de 0 bytes se ve como imagen rota,
    // que es peor que no pintar el `<img>`: el membrete ya sabe qué hacer si no
    // hay logo, pero no si el logo existe y está vacío.
    expect(decodificarDataUrl('data:image/png;base64,')).toBeNull()
  })

  it('null, undefined y vacío no lanzan', () => {
    expect(decodificarDataUrl(null)).toBeNull()
    expect(decodificarDataUrl(undefined)).toBeNull()
    expect(decodificarDataUrl('')).toBeNull()
  })
})
