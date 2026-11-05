import { describe, it, expect } from 'vitest'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EntradaCifra, type EntradaCifraProps } from './EntradaCifra'
import { cifraIlegible, ejemploCifra, CRUDO_INVALIDO } from '@/lib/captura-cifra'

// ============================================================================
//  EntradaCifra (P-L2-1, 04/11) · en español e inglés, el `<input>` de antes
//  byte a byte; en italiano, un `CampoCifra` con punto de millar y coma
//  decimal. Lo que recibe el formulario: lo tecleado (es/en) o la cifra
//  canónica (it).
// ============================================================================

const nada = () => {}
const rendir = (p: Partial<EntradaCifraProps>) =>
  renderToStaticMarkup(
    React.createElement(EntradaCifra, { valor: '', onCambio: nada, decimales: 2, minimo: 0, ...p } as EntradaCifraProps),
  )
const plano = (p: React.InputHTMLAttributes<HTMLInputElement>) => renderToStaticMarkup(React.createElement('input', p))

describe('EntradaCifra · español e inglés: el mismo <input> de antes', () => {
  for (const idioma of ['es', 'en'] as const) {
    it(`${idioma}: mismo HTML, mismos atributos y en el mismo orden`, () => {
      expect(rendir({ idioma, className: 'x', inputMode: 'decimal', valor: '12.9', placeholder: 'Ej. 12.9' })).toBe(
        plano({ className: 'x', inputMode: 'decimal', value: '12.9', onChange: nada, placeholder: 'Ej. 12.9' }),
      )
      expect(
        rendir({ idioma, type: 'number', inputMode: 'numeric', min: 0, valor: '3', className: 'demo-num y', decimales: 0 }),
      ).toBe(plano({ type: 'number', inputMode: 'numeric', min: 0, value: '3', onChange: nada, className: 'demo-num y' }))
      expect(rendir({ idioma, valor: '12,9' })).toBe(plano({ value: '12,9', onChange: nada }))
    })
  }

  it('sin idioma y sin proveedor es español', () => {
    expect(rendir({ valor: '1.5' })).toBe(plano({ value: '1.5', onChange: nada }))
  })
})

describe('EntradaCifra · italiano: CampoCifra con los signos italianos', () => {
  it('pinta la cifra guardada a la italiana, como texto', () => {
    const html = rendir({ idioma: 'it', type: 'number', min: 0, step: '0.01', valor: '1500.5', className: 'x' })
    expect(html).toContain('value="1.500,5"')
    expect(html).toContain('type="text"')
    expect(html).not.toContain('step=')
    expect(html).not.toContain('min=')
  })

  it('NEGATIVO · lo ilegible se ve en rojo con su motivo italiano', () => {
    const html = rendir({ idioma: 'it', valor: CRUDO_INVALIDO })
    expect(html).toContain('role="alert"')
    expect(html).toContain('aria-invalid="true"')
  })

  it('respeta los decimales: un entero no admite coma', () => {
    expect(rendir({ idioma: 'it', valor: '3', decimales: 0 })).toContain('inputMode="numeric"')
  })
})

describe('cifraIlegible · solo bloquea en italiano', () => {
  it('italiano: solo el NaN del campo', () => {
    expect(cifraIlegible(CRUDO_INVALIDO, 'it')).toBe(true)
    expect(cifraIlegible('12.9', 'it')).toBe(false)
    expect(cifraIlegible('', 'it')).toBe(false)
  })
  it('español e inglés: nunca (lo de siempre, también con «NaN» tecleado a mano)', () => {
    expect(cifraIlegible(CRUDO_INVALIDO, 'es')).toBe(false)
    expect(cifraIlegible(CRUDO_INVALIDO, 'en')).toBe(false)
  })
})

describe('ejemploCifra · los ejemplos de ayuda con los signos de quien lee', () => {
  it('italiano los intercambia; español e inglés no los tocan', () => {
    expect(ejemploCifra('15,000.50', 'it')).toBe('15.000,50')
    expect(ejemploCifra('12.9', 'it')).toBe('12,9')
    expect(ejemploCifra('15000', 'it')).toBe('15000')
    for (const idioma of ['es', 'en'] as const) {
      expect(ejemploCifra('15,000.50', idioma)).toBe('15,000.50')
      expect(ejemploCifra('12.9', idioma)).toBe('12.9')
    }
  })
})
