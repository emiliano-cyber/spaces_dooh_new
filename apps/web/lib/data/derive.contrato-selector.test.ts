// ============================================================================
//  sitiosSinContratoCompleto() — el predicado que el selector del comercial usa
//  para tachar pantallas. Es el ESPEJO en cliente de exigirContratoCompleto()
//  del servidor (ADR 0003); si divergen, el selector deja elegir algo que la API
//  rechaza, o tacha algo que sí era vendible. Estos tests fijan esa equivalencia.
// ============================================================================
import { describe, it, expect } from 'vitest'
import { sitiosSinContratoCompleto } from './derive'

const sitio = (id: string, predioId: string | null = null) => ({ id, predioId })
const contrato = (sitioId: string, estatus: string, predioId: string | null = null) => ({
  sitioId,
  estatus,
  predioId,
})

describe('sitiosSinContratoCompleto', () => {
  it('bloquea la pantalla sin ningún contrato', () => {
    expect(sitiosSinContratoCompleto([sitio('S1')], [])).toEqual(new Set(['S1']))
  })

  it('bloquea la pantalla cuyo único contrato está INCOMPLETO', () => {
    const out = sitiosSinContratoCompleto([sitio('S1')], [contrato('S1', 'INCOMPLETO')])
    expect(out).toEqual(new Set(['S1']))
  })

  it('bloquea la pantalla cuyo único contrato está CANCELADO', () => {
    const out = sitiosSinContratoCompleto([sitio('S1')], [contrato('S1', 'CANCELADO')])
    expect(out).toEqual(new Set(['S1']))
  })

  it.each(['VIGENTE', 'POR_VENCER', 'RENOVADO', 'VENCIDO'])(
    'deja pasar la pantalla con contrato %s',
    (estatus) => {
      const out = sitiosSinContratoCompleto([sitio('S1')], [contrato('S1', estatus)])
      expect(out.size).toBe(0)
    },
  )

  it('VENCIDO cuenta como completo: está caducado, no incompleto', () => {
    // Es la diferencia con contratoActivo(), que sí lo excluye. Si alguien
    // reemplaza este predicado por contratoActivo(), este test lo caza.
    expect(sitiosSinContratoCompleto([sitio('S1')], [contrato('S1', 'VENCIDO')]).size).toBe(0)
  })

  it('el contrato del predio cubre a TODAS sus pantallas', () => {
    const sitios = [sitio('S1', 'P1'), sitio('S2', 'P1'), sitio('S3', 'P2')]
    const contratos = [contrato('S1', 'VIGENTE', 'P1')]
    // S1 y S2 comparten predio contratado; S3 está en otro predio sin contrato.
    expect(sitiosSinContratoCompleto(sitios, contratos)).toEqual(new Set(['S3']))
  })

  it('un contrato CON predio no cubre a una pantalla suelta con el mismo sitioId', () => {
    // El discriminador es predioId, no sitioId: un contrato de predio arrastra
    // un sitio_id por histórico (la columna es NOT NULL) y no debe acreditar a
    // una pantalla que no pertenece a ese predio.
    const sitios = [sitio('S1', null)]
    const contratos = [contrato('S1', 'VIGENTE', 'P1')]
    expect(sitiosSinContratoCompleto(sitios, contratos)).toEqual(new Set(['S1']))
  })

  it('con varios contratos basta UNO completo para desbloquear', () => {
    const contratos = [contrato('S1', 'INCOMPLETO'), contrato('S1', 'VIGENTE')]
    expect(sitiosSinContratoCompleto([sitio('S1')], contratos).size).toBe(0)
  })

  it('sin pantallas devuelve un conjunto vacío', () => {
    expect(sitiosSinContratoCompleto([], [contrato('S1', 'VIGENTE')])).toEqual(new Set())
  })
})
