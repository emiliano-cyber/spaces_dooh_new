import { describe, it, expect } from 'vitest'
import { inicioMinimoContrato, sumarDias, type ContratoPrevio } from './contrato-vigencia'

// ============================================================================
//  Desde cuándo puede empezar un contrato nuevo sobre un espacio con historial.
//
//  Un predio (o una pantalla suelta) es UN espacio: no puede estar arrendado dos
//  veces a la vez. El guard que ya existía solo frena los contratos ACTIVOS, así
//  que con uno VENCIDO se podía firmar otro solapándolo, y entonces:
//
//   · `contratoVigentePorSitio` tiene dos candidatos y elige uno — el P&L
//     reporta una renta y esconde la otra.
//   · el calendario genera cuotas de AMBOS para los días repetidos: se le paga
//     dos veces al propietario por el mismo periodo.
//
//  El día siguiente y no el mismo, porque `fecha_fin` es INCLUSIVA en todo el
//  módulo (`estatusPorFechas` marca VENCIDO solo con días < 0, y el generador
//  del calendario itera `while (cursor <= fin)`).
// ============================================================================

const c = (over: Partial<ContratoPrevio>): ContratoPrevio => ({
  estatus: 'VENCIDO', fechaFin: '2026-06-30', predioId: null, sitioId: null, ...over,
})

describe('sumarDias', () => {
  it('avanza un día', () => {
    expect(sumarDias('2026-06-30', 1)).toBe('2026-07-01')
  })

  it('cruza fin de mes, fin de año y años bisiestos', () => {
    expect(sumarDias('2026-01-31', 1)).toBe('2026-02-01')
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29') // 2028 es bisiesto
  })

  it('no se corre un día por zona horaria', () => {
    // `new Date('2026-06-30')` es medianoche UTC; en México (UTC−6) cae en el 29
    // y toda la cuenta se corría. Por eso se opera en UTC.
    expect(sumarDias('2026-06-30', 0)).toBe('2026-06-30')
  })
})

describe('ancla en el PREDIO', () => {
  const contratos = [
    c({ predioId: 'P1', fechaFin: '2026-06-30' }),
    c({ predioId: 'P1', fechaFin: '2025-06-30' }), // uno más viejo
    c({ predioId: 'P2', fechaFin: '2027-12-31' }), // otro predio: no cuenta
  ]

  it('toma el fin MÁS RECIENTE del predio y suma un día', () => {
    const r = inicioMinimoContrato(contratos, { predioId: 'P1' })
    expect(r).toEqual({ desde: '2026-07-01', ultimoFin: '2026-06-30' })
  })

  it('no se contamina con el historial de otro predio', () => {
    const r = inicioMinimoContrato(contratos, { predioId: 'P2' })
    expect(r?.ultimoFin).toBe('2027-12-31')
  })

  it('un predio sin historial no impone mínimo', () => {
    expect(inicioMinimoContrato(contratos, { predioId: 'P9' })).toBeNull()
  })
})

describe('ancla en la PANTALLA suelta', () => {
  it('usa el contrato propio de la pantalla cuando no hay predio', () => {
    const contratos = [c({ sitioId: 'S1', predioId: null, fechaFin: '2026-03-15' })]
    const r = inicioMinimoContrato(contratos, { sitioId: 'S1' })
    expect(r).toEqual({ desde: '2026-03-16', ultimoFin: '2026-03-15' })
  })

  it('un contrato DE PREDIO no cuenta como historial de una pantalla suelta', () => {
    // El discriminador es el mismo del resto del módulo: si el contrato tiene
    // predio, cubre por predio y no por pantalla.
    const contratos = [c({ sitioId: 'S1', predioId: 'P1', fechaFin: '2026-03-15' })]
    expect(inicioMinimoContrato(contratos, { sitioId: 'S1' })).toBeNull()
  })

  it('manda el predio cuando se dan los dos', () => {
    const contratos = [
      c({ predioId: 'P1', fechaFin: '2026-06-30' }),
      c({ sitioId: 'S1', predioId: null, fechaFin: '2027-01-01' }),
    ]
    const r = inicioMinimoContrato(contratos, { predioId: 'P1', sitioId: 'S1' })
    expect(r?.ultimoFin).toBe('2026-06-30')
  })
})

describe('qué contratos NO reservan el calendario', () => {
  it('un CANCELADO no obliga a esperar', () => {
    // Hubo acuerdo y se rompió: el espacio queda libre. Obligar a esperar a su
    // fin nominal impediría re-arrendarlo tras una cancelación temprana.
    const contratos = [c({ predioId: 'P1', estatus: 'CANCELADO', fechaFin: '2030-12-31' })]
    expect(inicioMinimoContrato(contratos, { predioId: 'P1' })).toBeNull()
  })

  it('un INCOMPLETO tampoco: no tiene vigencia que respetar', () => {
    const contratos = [c({ predioId: 'P1', estatus: 'INCOMPLETO', fechaFin: null })]
    expect(inicioMinimoContrato(contratos, { predioId: 'P1' })).toBeNull()
  })

  it('pero un CANCELADO no tapa a un VENCIDO real del mismo predio', () => {
    const contratos = [
      c({ predioId: 'P1', estatus: 'CANCELADO', fechaFin: '2030-12-31' }),
      c({ predioId: 'P1', estatus: 'VENCIDO', fechaFin: '2026-06-30' }),
    ]
    expect(inicioMinimoContrato(contratos, { predioId: 'P1' })?.ultimoFin).toBe('2026-06-30')
  })

  it('los estatus activos SÍ reservan', () => {
    // Aunque el alta ya los bloquea antes, la regla debe sostenerse sola.
    for (const estatus of ['VIGENTE', 'POR_VENCER', 'RENOVADO', 'VENCIDO']) {
      const contratos = [c({ predioId: 'P1', estatus, fechaFin: '2026-06-30' })]
      expect(inicioMinimoContrato(contratos, { predioId: 'P1' })?.desde, estatus).toBe('2026-07-01')
    }
  })
})

describe('casos borde', () => {
  it('sin ancla no hay mínimo', () => {
    expect(inicioMinimoContrato([c({ predioId: 'P1' })], {})).toBeNull()
    expect(inicioMinimoContrato([c({ predioId: 'P1' })], { predioId: null, sitioId: null })).toBeNull()
  })

  it('sin contratos no hay mínimo', () => {
    expect(inicioMinimoContrato([], { predioId: 'P1' })).toBeNull()
  })

  it('tolera una fecha con hora (timestamptz del servidor)', () => {
    const contratos = [c({ predioId: 'P1', fechaFin: '2026-06-30T00:00:00.000Z' })]
    expect(inicioMinimoContrato(contratos, { predioId: 'P1' })?.desde).toBe('2026-07-01')
  })
})
