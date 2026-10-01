import { describe, it, expect } from 'vitest'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NotasDeVersion, SIN_NOTAS } from './NotasDeVersion'

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
