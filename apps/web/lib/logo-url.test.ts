import { describe, it, expect } from 'vitest'
import { rutaLogo, urlLogo } from './logo-url'

// ============================================================================
//  La URL del logo público.
//
//  Lo que importa probar es que `urlLogo` sea ABSOLUTA. Una ruta relativa en un
//  correo no falla ruidosamente: el cliente de correo la resuelve contra su
//  propio dominio, no encuentra nada, y el logo sale como imagen rota. Es
//  exactamente el modo de fallo silencioso que hace que nadie se entere hasta
//  que un cliente lo comenta.
// ============================================================================

describe('rutaLogo', () => {
  it('cuelga del basePath de la app', () => {
    expect(rutaLogo('abc123')).toBe('/spaces-dooh/api/logo/abc123')
  })

  it('sin token no hay ruta', () => {
    expect(rutaLogo(null)).toBeNull()
    expect(rutaLogo(undefined)).toBeNull()
    expect(rutaLogo('')).toBeNull()
  })
})

describe('urlLogo', () => {
  it('devuelve una URL absoluta, que es lo único que sirve dentro de un correo', () => {
    expect(urlLogo('https://demo.space-os.io', 'abc123')).toBe(
      'https://demo.space-os.io/spaces-dooh/api/logo/abc123',
    )
  })

  it('no duplica la barra si la base ya la trae', () => {
    // `APP_URL` la escribe una persona en un `.env`; la barra final sobra tanto
    // como falta, y '//spaces-dooh' es un 404.
    expect(urlLogo('https://demo.space-os.io/', 'abc')).toBe(
      'https://demo.space-os.io/spaces-dooh/api/logo/abc',
    )
    expect(urlLogo('https://demo.space-os.io///', 'abc')).toBe(
      'https://demo.space-os.io/spaces-dooh/api/logo/abc',
    )
  })

  it('sin token o sin base devuelve null, y el membrete no pinta el <img>', () => {
    expect(urlLogo('https://demo.space-os.io', null)).toBeNull()
    expect(urlLogo('', 'abc')).toBeNull()
  })
})
