import { describe, it, expect } from 'vitest'
import {
  recordatoriosDeContratos,
  resumenRecordatorios,
  diasHasta,
  DIAS_AVISO_VENCIMIENTO,
  type ContratoParaAviso,
} from './recordatorios-contratos'

// ============================================================================
//  Recordatorios de contratos.
//
//  Un aviso diario solo sirve si NO grita todos los días por lo mismo ni por lo
//  que no toca. La mitad de estas pruebas son casos que NO deben avisar: un
//  contrato vigente y sano no tiene por qué aparecer en el correo de nadie.
// ============================================================================

const HOY = new Date(2026, 7, 3) // 2026-08-03

const c = (over: Partial<ContratoParaAviso>): ContratoParaAviso => ({
  id: 'c1', estatus: 'VIGENTE', fechaFin: '2027-01-01',
  arrendadorNombre: 'Predios SA', sitioNombre: 'Pantalla A', predioNombre: null,
  ...over,
})

describe('lo que NO debe avisar', () => {
  it('un contrato vigente y lejos de vencer no aparece', () => {
    expect(recordatoriosDeContratos([c({ fechaFin: '2027-01-01' })], HOY)).toEqual([])
  })

  it('un cancelado no aparece aunque este vencido', () => {
    expect(
      recordatoriosDeContratos([c({ estatus: 'CANCELADO', fechaFin: '2020-01-01' })], HOY),
    ).toEqual([])
  })

  it('justo fuera de la ventana (4 dias) todavia no avisa', () => {
    expect(recordatoriosDeContratos([c({ fechaFin: '2026-08-07' })], HOY)).toEqual([])
  })
})

describe('por vencer', () => {
  it('avisa dentro de la ventana de 3 dias', () => {
    const r = recordatoriosDeContratos([c({ fechaFin: '2026-08-06' })], HOY)
    expect(r).toHaveLength(1)
    expect(r[0].motivo).toBe('POR_VENCER')
    expect(r[0].dias).toBe(3)
    expect(DIAS_AVISO_VENCIMIENTO).toBe(3)
  })

  it('el que vence HOY lo dice asi, no "en 0 dias"', () => {
    const r = recordatoriosDeContratos([c({ fechaFin: '2026-08-03' })], HOY)
    expect(r[0].dias).toBe(0)
    expect(r[0].titulo).toContain('vence HOY')
  })

  it('singular y plural bien escritos', () => {
    const uno = recordatoriosDeContratos([c({ fechaFin: '2026-08-04' })], HOY)[0]
    expect(uno.titulo).toContain('en 1 día:')
    const dos = recordatoriosDeContratos([c({ fechaFin: '2026-08-05' })], HOY)[0]
    expect(dos.titulo).toContain('en 2 días:')
  })
})

describe('vencidos', () => {
  it('avisa y dice cuanto hace que vencio', () => {
    const r = recordatoriosDeContratos([c({ fechaFin: '2026-07-24' })], HOY)
    expect(r[0].motivo).toBe('VENCIDO')
    expect(r[0].dias).toBe(-10)
    expect(r[0].detalle).toContain('10 días')
    expect(r[0].nivel).toBe('error')
  })

  it('sigue avisando por mucho que lleve vencido', () => {
    // Dejar de avisar cuando mas falta hace seria justo al reves.
    const r = recordatoriosDeContratos([c({ fechaFin: '2024-01-01' })], HOY)
    expect(r).toHaveLength(1)
    expect(r[0].motivo).toBe('VENCIDO')
  })
})

describe('incompletos', () => {
  it('avisa aunque no tenga fecha: es una deuda de captura sin reloj', () => {
    const r = recordatoriosDeContratos(
      [c({ estatus: 'INCOMPLETO', fechaFin: null })], HOY,
    )
    expect(r).toHaveLength(1)
    expect(r[0].motivo).toBe('INCOMPLETO')
    expect(r[0].dias).toBeNull()
  })

  it('nombra el predio cuando lo hay, que es de lo que se habla al negociar', () => {
    const r = recordatoriosDeContratos(
      [c({ estatus: 'INCOMPLETO', fechaFin: null, predioNombre: 'Plaza Insurgentes' })], HOY,
    )
    expect(r[0].titulo).toContain('Plaza Insurgentes')
    expect(r[0].titulo).toContain('Predios SA')
  })

  it('no se cae si no hay ni predio ni pantalla ni arrendador', () => {
    const r = recordatoriosDeContratos(
      [{ id: 'x', estatus: 'INCOMPLETO', fechaFin: null }], HOY,
    )
    expect(r[0].titulo).toContain('un espacio')
  })
})

describe('orden y resumen', () => {
  it('primero lo vencido, luego lo que esta a punto, al final lo incompleto', () => {
    const r = recordatoriosDeContratos(
      [
        c({ id: 'inc', estatus: 'INCOMPLETO', fechaFin: null }),
        c({ id: 'pv', fechaFin: '2026-08-05' }),
        c({ id: 'ven', fechaFin: '2026-07-30' }),
      ],
      HOY,
    )
    expect(r.map((x) => x.contratoId)).toEqual(['ven', 'pv', 'inc'])
  })

  it('entre vencidos, primero el mas antiguo', () => {
    const r = recordatoriosDeContratos(
      [c({ id: 'reciente', fechaFin: '2026-08-01' }), c({ id: 'viejo', fechaFin: '2025-01-01' })],
      HOY,
    )
    expect(r[0].contratoId).toBe('viejo')
  })

  it('el resumen del asunto cuenta cada motivo', () => {
    const r = recordatoriosDeContratos(
      [
        c({ id: 'a', fechaFin: '2026-07-01' }),
        c({ id: 'b', fechaFin: '2026-08-04' }),
        c({ id: 'c', estatus: 'INCOMPLETO', fechaFin: null }),
        c({ id: 'd', estatus: 'INCOMPLETO', fechaFin: null }),
      ],
      HOY,
    )
    expect(resumenRecordatorios(r)).toBe('1 vencido · 1 por vencer · 2 sin capturar')
  })
})

describe('diasHasta', () => {
  it('cuenta dias completos, no milisegundos', () => {
    expect(diasHasta('2026-08-10', HOY)).toBe(7)
    expect(diasHasta('2026-08-03', HOY)).toBe(0)
    expect(diasHasta('2026-08-01', HOY)).toBe(-2)
  })

  it('tolera una fecha con hora y una basura', () => {
    expect(diasHasta('2026-08-10T23:59:00Z', HOY)).toBe(7)
    expect(diasHasta('manana', HOY)).toBeNull()
  })

  // El driver de Postgres devuelve las columnas `date` como Date, no como
  // texto. Toda la logica se probaba con cadenas y por eso el barrido real
  // reventaba con "v.slice is not a function" en el primer contrato.
  it('acepta un Date, que es lo que devuelve Postgres', () => {
    expect(diasHasta(new Date(2026, 7, 10), HOY)).toBe(7)
    expect(diasHasta(new Date(2026, 7, 3), HOY)).toBe(0)
    expect(diasHasta(new Date(2026, 7, 1), HOY)).toBe(-2)
  })

  it('un Date de medianoche local NO se corre un dia al convertirlo', () => {
    // Con toISOString() esta fecha se volveria el dia 9 en cualquier huso al
    // oeste de Greenwich, y el aviso saldria un dia antes de tiempo.
    expect(diasHasta(new Date(2026, 7, 10, 0, 0, 0), HOY)).toBe(7)
  })
})

describe('el barrido real (fechas como las da Postgres)', () => {
  it('clasifica bien con objetos Date', () => {
    const r = recordatoriosDeContratos(
      [
        c({ id: 'ven', fechaFin: new Date(2026, 6, 30) }),
        c({ id: 'pv', fechaFin: new Date(2026, 7, 5) }),
        c({ id: 'ok', fechaFin: new Date(2027, 0, 1) }),
      ],
      HOY,
    )
    expect(r.map((x) => `${x.contratoId}:${x.motivo}`)).toEqual(['ven:VENCIDO', 'pv:POR_VENCER'])
  })
})
