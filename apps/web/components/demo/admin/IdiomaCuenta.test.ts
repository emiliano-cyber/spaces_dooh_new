import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import type { Idioma } from '@/lib/i18n/idiomas'
import { IdiomaCuenta } from './IdiomaCuenta'

// IDIOMA-USUARIO (03/11) · «Mi cuenta → Idioma». Lo que importa: con un solo
// idioma encendido (hoy, en toda la flota) NO SE PINTA, y la página «Mi
// cuenta» queda idéntica a la de antes. Con varios, ofrece «Usar el idioma del
// navegador» y SOLO los encendidos, cada uno nombrado en sí mismo.

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function pintar(idioma: Idioma, disponibles?: Idioma[]) {
  return renderToStaticMarkup(
    createElement(
      ProveedorIdioma,
      { idioma, puedeElegir: !!disponibles && disponibles.length > 1, disponibles },
      createElement(IdiomaCuenta),
    ),
  )
}

describe('IdiomaCuenta', () => {
  it('con SOLO el español encendido no pinta nada', () => {
    expect(pintar('es', ['es'])).toBe('')
    expect(pintar('es')).toBe('')
  })

  it('con varios: «navegador» y los encendidos, en sí mismos', () => {
    const html = pintar('es', ['es', 'en'])
    expect(html).toContain('Usar el idioma del navegador')
    expect(html).toContain('value="navegador"')
    expect(html).toContain('>Español<')
    expect(html).toContain('>English<')
    expect(html).not.toContain('value="it"')
  })

  it('el italiano aparece solo si está encendido', () => {
    expect(pintar('es', ['es', 'en', 'it'])).toContain('>Italiano<')
    expect(pintar('es', ['es', 'it'])).not.toContain('value="en"')
  })

  it('en inglés, los textos de la tarjeta en inglés', () => {
    const html = pintar('en', ['es', 'en'])
    expect(html).toContain('Use the browser language')
    expect(html).toContain('>Language<')
    expect(html).not.toContain('navegador<')
  })

  it('mientras carga la preferencia, el desplegable está deshabilitado', () => {
    expect(pintar('es', ['es', 'en'])).toMatch(/<select[^>]*disabled/)
  })
})
