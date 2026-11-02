import { describe, it, expect } from 'vitest'
import { leerDinero } from './simbolo-en-pantalla'

// El lector de las pruebas de pantallas. Si se equivoca hacia el verde, esas
// pruebas dejan de ver un `$` que se lee como dolar: por eso lleva sus casos.
describe('leerDinero · el simbolo de cada importe contra la tabla de dinero.ts', () => {
  it('MXN en ingles: solo vale MX$', () => {
    expect(leerDinero('<b>MX$ 1,000.00</b> y (MX$ 5.00) y − MX$1', 'en', 'MXN')).toEqual({ importes: 3, ajenos: [] })
    const r = leerDinero('<b>$ 1,000.00</b> y US$ 2.00', 'en', 'MXN')
    expect(r.importes).toBe(2)
    expect(r.ajenos).toHaveLength(2)
    expect(r.ajenos[0]).toContain('«$»')
    expect(r.ajenos[1]).toContain('«US$»')
  })

  it('MXN en espanol: solo vale el $ a secas', () => {
    expect(leerDinero('$ 1,000.00 · ($ 4.9M)', 'es', 'MXN').ajenos).toEqual([])
    expect(leerDinero('MX$ 1,000.00', 'es', 'MXN').ajenos).toHaveLength(1)
  })

  it('USD: el ingles escribe $ y el espanol US$', () => {
    expect(leerDinero('$ 1,000.00', 'en', 'USD').ajenos).toEqual([])
    expect(leerDinero('US$ 1,000.00', 'en', 'USD').ajenos).toHaveLength(1)
    expect(leerDinero('US$ 1,000.00', 'es', 'USD').ajenos).toEqual([])
    expect(leerDinero('$ 1,000.00', 'es', 'USD').ajenos).toHaveLength(1)
  })

  it('un $ que no va delante de una cifra no es un importe', () => {
    expect(leerDinero('precio en $ · sin cifra $x', 'en', 'MXN').importes).toBe(0)
    expect(leerDinero('sin dinero', 'en', 'MXN')).toEqual({ importes: 0, ajenos: [] })
  })
})
