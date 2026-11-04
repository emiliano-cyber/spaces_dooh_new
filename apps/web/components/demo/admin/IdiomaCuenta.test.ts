import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import type { Idioma } from '@/lib/i18n/idiomas'
import { IdiomaCuenta, idiomaTrasGuardar, avisoIdiomaGuardado } from './IdiomaCuenta'

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

// B69 (pulido del italiano, 04/11) · el aviso «Idioma guardado» salia en el
// idioma de ANTES del cambio: el `t` de la pantalla es el de antes, y el nuevo
// llega con el `router.refresh()`. Al pasar a italiano decia «Language saved».
// Ahora se dice en el idioma al que se pasa; sin cambio, el de siempre.
describe('B69 · el aviso de idioma guardado, en el idioma NUEVO', () => {
  const todos = ['es', 'en', 'it'] as const
  const base = { disponibles: todos, cookie: null, navegador: [] as string[] }

  it('al elegir un idioma, es ese', () => {
    expect(idiomaTrasGuardar('it', { ...base, actual: 'en' })).toBe('it')
    expect(idiomaTrasGuardar('es', { ...base, actual: 'it' })).toBe('es')
    expect(idiomaTrasGuardar('en', { ...base, actual: 'es' })).toBe('en')
  })

  it('sin cambio de idioma, el mismo de antes', () => {
    expect(idiomaTrasGuardar('en', { ...base, actual: 'en' })).toBe('en')
    expect(idiomaTrasGuardar('es', { ...base, actual: 'es' })).toBe('es')
  })

  it('un idioma apagado no se cree: se queda el de ahora', () => {
    expect(idiomaTrasGuardar('it', { ...base, disponibles: ['es', 'en'], actual: 'en' })).toBe('en')
  })

  it('«Usar el idioma del navegador»: cookie > navegador > español, entre los encendidos', () => {
    expect(idiomaTrasGuardar('navegador', { ...base, actual: 'es', cookie: 'it' })).toBe('it')
    expect(idiomaTrasGuardar('navegador', { ...base, actual: 'es', navegador: ['en-US', 'es'] })).toBe('en')
    expect(idiomaTrasGuardar('navegador', { ...base, actual: 'it', navegador: ['fr-FR'] })).toBe('es')
    expect(idiomaTrasGuardar('navegador', { ...base, disponibles: ['es', 'en'], actual: 'en', cookie: 'it' })).toBe('es')
  })

  it('el texto del aviso, en cada idioma', () => {
    expect(avisoIdiomaGuardado('it')).toBe('Lingua salvata')
    expect(avisoIdiomaGuardado('en')).toBe('Language saved')
    expect(avisoIdiomaGuardado('es')).toBe('Idioma guardado')
  })

  // Sin DOM no se puede pulsar el desplegable: se mira que la tarjeta dice el
  // aviso con el idioma de destino y no con el `t` de la pantalla.
  it('la tarjeta lanza el aviso con el idioma de destino', () => {
    const fuente = readFileSync(join(__dirname, 'IdiomaCuenta.tsx'), 'utf8')
    expect(fuente).toMatch(/toast\.success\(avisoIdiomaGuardado\(idiomaTrasGuardar\(valor,/)
    expect(fuente).not.toContain("toast.success(t('idioma.cuenta.toast'))")
  })
})
