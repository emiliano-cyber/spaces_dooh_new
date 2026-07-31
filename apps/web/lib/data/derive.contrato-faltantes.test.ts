import { describe, it, expect } from 'vitest'
import { faltantesDeContrato, faltaEnContratos } from './derive'

// ============================================================================
//  Qué le falta a un contrato INCOMPLETO (ADR 0001).
//
//  El aviso de la pantalla daba por hecho que lo que faltaba era el importe. La
//  vía real por la que nacen la mayoría de los incompletos —el alta de la
//  pantalla, ADR 0002— los abre CON el importe que trae el Excel del import y
//  sin vigencia ni periodicidad, así que el aviso mandaba a capturar algo que ya
//  estaba capturado. Estas pruebas fijan que lo que falta se DERIVA.
// ============================================================================

describe('faltantesDeContrato', () => {
  const completo = {
    arrendadorId: 'a1',
    fechaFin: '2027-01-01',
    montoRenta: 1000,
    periodicidad: 'MENSUAL',
  }

  it('no encuentra nada que falte en un contrato completo', () => {
    expect(faltantesDeContrato(completo)).toEqual([])
  })

  // El caso real: el alta de la pantalla (ADR 0002) abre el contrato con el
  // importe que trae el Excel y sin vigencia ni periodicidad.
  it('con importe capturado NO pide el importe', () => {
    const c = { ...completo, fechaFin: null, periodicidad: null }
    expect(faltantesDeContrato(c)).toEqual(['vigencia', 'periodicidad'])
  })

  it('un importe 0 cuenta como capturado y un null no', () => {
    expect(faltantesDeContrato({ ...completo, montoRenta: 0 })).toEqual([])
    expect(faltantesDeContrato({ ...completo, montoRenta: null })).toEqual(['importe'])
  })

  it('enumera los cuatro cuando el contrato está vacío', () => {
    expect(faltantesDeContrato({})).toEqual(['arrendador', 'vigencia', 'importe', 'periodicidad'])
  })
})

describe('faltaEnContratos', () => {
  it('junta lo que falta en todo el grupo sin repetir', () => {
    const r = faltaEnContratos([
      { arrendadorId: 'a1', montoRenta: 100, fechaFin: null, periodicidad: null },
      { arrendadorId: 'a1', montoRenta: 200, fechaFin: null, periodicidad: 'MENSUAL' },
    ])
    expect(r).toBe('vigencia y periodicidad')
  })

  it('una sola carencia va sin conjunción', () => {
    expect(
      faltaEnContratos([{ arrendadorId: 'a1', montoRenta: 100, fechaFin: null, periodicidad: 'MENSUAL' }]),
    ).toBe('vigencia')
  })

  it('respeta el orden de captura, no el de aparición', () => {
    const r = faltaEnContratos([
      { arrendadorId: 'a1', montoRenta: null, fechaFin: '2027-01-01', periodicidad: 'MENSUAL' },
      { arrendadorId: null, montoRenta: 100, fechaFin: '2027-01-01', periodicidad: 'MENSUAL' },
    ])
    expect(r).toBe('arrendador y importe')
  })

  // Sin carencias no hay frase: el llamador tiene que poder omitir el aviso en
  // vez de imprimir «falta capturar » con el hueco al final.
  it('devuelve cadena vacía si no falta nada', () => {
    expect(faltaEnContratos([])).toBe('')
    expect(
      faltaEnContratos([
        { arrendadorId: 'a1', montoRenta: 1, fechaFin: '2027-01-01', periodicidad: 'MENSUAL' },
      ]),
    ).toBe('')
  })
})
