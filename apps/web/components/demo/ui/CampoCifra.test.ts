import { describe, it, expect } from 'vitest'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CampoCifra, type CampoCifraProps } from './CampoCifra'

// ============================================================================
//  CampoCifra · lo que se puede comprobar SIN DOM: el `<input>` que sale.
//  Las reglas de lectura y el cursor están probados en lib/captura-cifra.test.ts;
//  aquí queda fijado que el campo las usa y que no es un `type="number"` (que
//  no admite comas y da el campo por vacío). Lo que necesita un navegador —
//  teclear, el cursor, el blur— no se finge aquí.
// ============================================================================

function rendir(p: Partial<CampoCifraProps>): string {
  const props: CampoCifraProps = { valor: '', onCambio: () => {}, ...p }
  return renderToStaticMarkup(React.createElement(CampoCifra, props))
}

describe('CampoCifra', () => {
  it('pinta el valor del formulario con su coma de miles', () => {
    expect(rendir({ valor: '212500' })).toContain('value="212,500"')
    expect(rendir({ valor: 212500.5 })).toContain('value="212,500.5"')
    expect(rendir({ valor: '12000.00' })).toContain('value="12,000.00"')
  })

  it('vacío y null se pintan vacíos, NUNCA como 0', () => {
    expect(rendir({ valor: '' })).toContain('value=""')
    expect(rendir({ valor: null })).toContain('value=""')
  })

  it('es type="text" con teclado numérico: decimal para dinero, numeric para enteros', () => {
    const dinero = rendir({ valor: '1' })
    expect(dinero).toContain('type="text"')
    expect(dinero).not.toContain('type="number"')
    expect(dinero).toContain('inputMode="decimal"')
    expect(rendir({ valor: '1', decimales: 0 })).toContain('inputMode="numeric"')
  })

  it('NEGATIVO · un valor que no se entiende se enseña con su motivo, no se reinterpreta', () => {
    const html = rendir({ valor: '2,50' })
    expect(html).toContain('value="2,50"')
    expect(html).toContain('role="alert"')
    expect(html).toContain('aria-invalid="true"')
  })

  it('un valor válido no pinta error', () => {
    expect(rendir({ valor: '212500' })).not.toContain('role="alert"')
  })

  it('respeta las clases y el placeholder del formulario', () => {
    const html = rendir({ valor: '', className: 'demo-num x', placeholder: 'Ej. 8000' })
    expect(html).toContain('class="demo-num x aria-[invalid=true]:border-error"')
    expect(html).toContain('placeholder="Ej. 8000"')
  })
})

// P-L2-1 (04/11): en italiano el campo pinta y entiende punto de millar y coma
// decimal. El formulario guarda lo mismo que en español («1500.5»).
describe('CampoCifra en italiano', () => {
  it('pinta lo guardado con punto de millar y coma decimal', () => {
    expect(rendir({ valor: '1500.5', idioma: 'it' })).toContain('value="1.500,5"')
    expect(rendir({ valor: 12.9, idioma: 'it' })).toContain('value="12,9"')
    expect(rendir({ valor: '212500', idioma: 'it' })).toContain('value="212.500"')
  })

  it('NEGATIVO · lo que no se entiende en italiano se enseña con su motivo italiano', () => {
    const html = rendir({ valor: 'NaN', idioma: 'it' })
    expect(html).toContain('role="alert"')
    expect(html).toContain('Scrivi solo cifre: il punto separa le migliaia e la virgola i decimali')
  })

  it('en español e inglés, como siempre', () => {
    expect(rendir({ valor: '1500.5', idioma: 'es' })).toContain('value="1,500.5"')
    expect(rendir({ valor: '1500.5', idioma: 'en' })).toContain('value="1,500.5"')
  })
})
