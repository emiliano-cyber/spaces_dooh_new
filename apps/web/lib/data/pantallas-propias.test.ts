import { describe, it, expect } from 'vitest'
import { sitiosSinContratoCompleto } from './derive'
import { notaDeArrendador } from '@/components/demo/reportes/tabla'

describe('Reportes: una propia dice «propia», no «sin contrato»', () => {
  it('propia', () => {
    expect(notaDeArrendador('sitio' as never, false, null, true)).toBe('propia')
  })
  it('una rentada sin contrato sigue diciendo «sin contrato»', () => {
    expect(notaDeArrendador('sitio' as never, false, null, false)).toBe('sin contrato')
  })
})

// ============================================================================
//  v0.12.3 · pantallas PROPIAS: se venden sin contrato.
// ----------------------------------------------------------------------------
//  Pedido del dueño el 2026-10-22: pantallas o lugares propios, sin renta
//  mensual; solo luz y operación. El espejo del guard en el navegador
//  (`sitiosSinContratoCompleto`) tiene que dar el mismo veredicto que el del
//  servidor (`exigirContratoCompleto`): si dijeran cosas distintas, la ficha
//  dejaría reservar algo que el servidor rechaza, o al revés.
// ============================================================================

describe('sitiosSinContratoCompleto con pantallas propias', () => {
  it('una propia SIN ningún contrato no está bloqueada', () => {
    expect(sitiosSinContratoCompleto([{ id: 'p', propio: true }], []).has('p')).toBe(false)
  })

  it('una rentada sin contrato sigue bloqueada, como siempre', () => {
    expect(sitiosSinContratoCompleto([{ id: 'r' }], []).has('r')).toBe(true)
  })

  it('una propia con un contrato INCOMPLETO viejo tampoco se bloquea', () => {
    const bloqueadas = sitiosSinContratoCompleto(
      [{ id: 'p', propio: true }],
      [{ estatus: 'INCOMPLETO', predioId: null, sitioId: 'p' }],
    )
    expect(bloqueadas.has('p')).toBe(false)
  })
})
