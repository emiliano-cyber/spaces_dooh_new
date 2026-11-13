import { describe, it, expect } from 'vitest'
import { asuntoCorreoAviso, htmlCorreoAviso, enlaceDelAviso } from './correo-aviso'

// ============================================================================
//  AVISOS-CANAL (12/11) · el correo de UN aviso de la campana.
// ============================================================================

const ORG = { nombreOrg: 'Pixeled', replyTo: null, logoUrl: null }

describe('enlaceDelAviso', () => {
  it('la ruta interna se vuelve absoluta, con el basePath y la barra final', () => {
    expect(enlaceDelAviso('https://app.ej.com/', '/finanzas')).toBe('https://app.ej.com/spaces-dooh/finanzas/')
    expect(enlaceDelAviso('https://app.ej.com', '/propuestas/abc')).toBe('https://app.ej.com/spaces-dooh/propuestas/abc/')
  })
  it('sin base o sin ruta no hay enlace: mejor sin boton que un boton a localhost', () => {
    expect(enlaceDelAviso('', '/finanzas')).toBeNull()
    expect(enlaceDelAviso('https://app.ej.com', null)).toBeNull()
  })
  it('solo rutas internas: un enlace que no empieza por una sola «/» no se sigue', () => {
    expect(enlaceDelAviso('https://app.ej.com', 'https://otro.com/x')).toBeNull()
    expect(enlaceDelAviso('https://app.ej.com', '//otro.com/x')).toBeNull()
  })
})

describe('el correo de un aviso', () => {
  const aviso = { titulo: 'Factura emitida', detalle: 'F-0012 · 11,600', link: '/finanzas' }

  it('el asunto es el titulo del aviso, con la organizacion', () => {
    expect(asuntoCorreoAviso(aviso, ORG, 'es')).toBe('Factura emitida · Pixeled')
  })
  it('en ingles el titulo se traduce igual que en la campana', () => {
    expect(asuntoCorreoAviso(aviso, ORG, 'en')).toBe('Invoice issued · Pixeled')
  })
  it('lleva titulo, detalle, boton y el pie que explica por que le llega', () => {
    const html = htmlCorreoAviso(aviso, ORG, 'https://app.ej.com/spaces-dooh/finanzas/', 'es')
    expect(html).toContain('Factura emitida')
    expect(html).toContain('F-0012 · 11,600')
    expect(html).toContain('href="https://app.ej.com/spaces-dooh/finanzas/"')
    expect(html).toContain('Configuración → Avisos')
  })
  it('sin enlace, sin boton', () => {
    expect(htmlCorreoAviso(aviso, ORG, null, 'es')).not.toContain('href=')
  })
  it('lo que escribe una persona va escapado', () => {
    const html = htmlCorreoAviso(
      { titulo: 'Propuesta aceptada por el cliente', detalle: '<img src=x onerror=alert(1)>', link: null },
      { ...ORG, nombreOrg: '<b>Org</b>' },
      null,
      'es',
    )
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('<b>Org</b>')
  })
})
