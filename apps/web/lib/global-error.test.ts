import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ErrorGlobal from '../app/global-error'

// ADR 0048 · con la base caida el layout raiz falla (fail-closed) y lo que se
// ve es ESTE componente. Tiene que hablar en espanol, ofrecer reintentar y no
// ensenar el error, que puede llevar detalles de la conexion.
describe('app/global-error.tsx', () => {
  const html = renderToStaticMarkup(
    createElement(ErrorGlobal, {
      error: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432 spaces_app'), { digest: '1' }),
      reset: () => {},
    }),
  )

  it('trae su propio <html lang="es"> (sustituye al layout entero)', () => {
    expect(html).toMatch(/^<html lang="es">/)
  })

  it('dice en espanol que el sistema no esta disponible y deja reintentar', () => {
    expect(html).toContain('El sistema no está disponible en este momento')
    expect(html).toContain('Intentar de nuevo')
  })

  it('NEGATIVO · no ensena nada del error ni de la conexion', () => {
    expect(html).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|spaces_app|5432/)
  })
})
