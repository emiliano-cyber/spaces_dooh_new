import { describe, it, expect, vi } from 'vitest'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NotasDeVersion, SIN_NOTAS } from './NotasDeVersion'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import type { Idioma } from '@/lib/i18n/idiomas'

// El proveedor de idioma pide el router de Next, que fuera de la app no existe.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))

// ============================================================================
//  Lo que pinta una version: sus notas agrupadas por tipo. Lo usan el dialogo
//  de despues de instalar, la pagina de Novedades y el panel de
//  Actualizaciones, asi que se rinde el componente de verdad (sin jsdom, con
//  `renderToStaticMarkup`, como `Button.test.ts`).
// ============================================================================

const rendir = (p: React.ComponentProps<typeof NotasDeVersion>) =>
  renderToStaticMarkup(React.createElement(NotasDeVersion, p))

describe('NotasDeVersion', () => {
  it('agrupa por tipo, en el orden Nuevo, Ajustado, Corregido', () => {
    const html = rendir({
      notas: {
        version: 'v0.9.2',
        fecha: '2026-10-01',
        items: [
          { tipo: 'CORREGIDO', texto: 'Arreglo uno' },
          { tipo: 'NUEVO', texto: 'Funcion nueva' },
          { tipo: 'AJUSTADO', texto: 'Ajuste uno' },
        ],
      },
    })
    const i = (s: string) => html.indexOf(s)
    expect(i('Nuevo')).toBeGreaterThan(-1)
    expect(i('Nuevo')).toBeLessThan(i('Ajustado'))
    expect(i('Ajustado')).toBeLessThan(i('Corregido'))
    expect(i('Funcion nueva')).toBeLessThan(i('Ajuste uno'))
    expect(i('Ajuste uno')).toBeLessThan(i('Arreglo uno'))
  })

  it('un grupo sin items no aparece', () => {
    const html = rendir({ notas: { version: 'v0.9.2', fecha: '2026-10-01', items: [{ tipo: 'NUEVO', texto: 'x' }] } })
    expect(html).not.toContain('Corregido')
    expect(html).not.toContain('Ajustado')
  })

  it('NEGATIVO: sin notas lo dice, en vez de pintar una caja vacia', () => {
    expect(SIN_NOTAS).toBe('Esta versión no trae notas')
    expect(rendir({ notas: null })).toContain(SIN_NOTAS)
  })

  it('el texto del item se escapa: es texto, nunca HTML', () => {
    const html = rendir({
      notas: { version: 'v0.9.2', fecha: '2026-10-01', items: [{ tipo: 'NUEVO', texto: '<img src=x onerror=alert(1)>' }] },
    })
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })
})

// ─── 2026-11-05 · las notas en el idioma de quien lee ──────────────────────
describe('NotasDeVersion · en el idioma de la persona', () => {
  const NOTAS = {
    version: 'v0.9.2',
    fecha: '2026-10-01',
    items: [
      { tipo: 'NUEVO' as const, texto: 'Funcion nueva', en: 'New feature', it: 'Nuova funzione' },
      { tipo: 'CORREGIDO' as const, texto: 'Arreglo viejo' },
    ],
  }
  const en = (idioma: Idioma) =>
    renderToStaticMarkup(
      React.createElement(ProveedorIdioma, { idioma, puedeElegir: true, disponibles: ['es', 'en', 'it'] }, React.createElement(NotasDeVersion, { notas: NOTAS })),
    )

  it('ingles e italiano pintan su traduccion; un item sin ella sale en espanol', () => {
    expect(en('en')).toContain('<li>New feature</li>')
    expect(en('it')).toContain('<li>Nuova funzione</li>')
    expect(en('en')).not.toContain('Funcion nueva')
    expect(en('it')).not.toContain('Funcion nueva')
    expect(en('it')).toContain('<li>Arreglo viejo</li>')
  })

  it('ESPANOL · el mismo HTML que sin traducciones, byte a byte', () => {
    const sin = { ...NOTAS, items: NOTAS.items.map(({ tipo, texto }) => ({ tipo, texto })) }
    const html = renderToStaticMarkup(
      React.createElement(ProveedorIdioma, { idioma: 'es', puedeElegir: true }, React.createElement(NotasDeVersion, { notas: sin })),
    )
    expect(en('es')).toBe(html)
    expect(en('es')).toContain('<li>Funcion nueva</li>')
  })
})
