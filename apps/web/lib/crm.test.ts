import { describe, it, expect } from 'vitest'
import {
  ETAPAS_OPORTUNIDAD,
  PROBABILIDAD_POR_ETAPA,
  etapaOportunidadCerrada,
  probabilidadEfectiva,
  problemaCambioEtapa,
  problemaPresupuesto,
  problemaFechas,
} from './crm'

// ADR 0051 §1 y §2: las reglas de la oportunidad que NO dependen de la base.
// El repo las aplica con la fila bloqueada; aquí se prueban sueltas.

describe('las etapas de una oportunidad', () => {
  it('son seis, en el orden del embudo', () => {
    expect(ETAPAS_OPORTUNIDAD).toEqual(['CONTACTO', 'NECESIDAD', 'COTIZANDO', 'NEGOCIANDO', 'GANADA', 'PERDIDA'])
  })

  it('solo GANADA y PERDIDA cierran', () => {
    expect(ETAPAS_OPORTUNIDAD.filter(etapaOportunidadCerrada)).toEqual(['GANADA', 'PERDIDA'])
  })
})

describe('la probabilidad', () => {
  it('por omisión es la de la etapa (10 · 25 · 50 · 75 · 100 · 0)', () => {
    expect(PROBABILIDAD_POR_ETAPA).toEqual({
      CONTACTO: 10, NECESIDAD: 25, COTIZANDO: 50, NEGOCIANDO: 75, GANADA: 100, PERDIDA: 0,
    })
    expect(probabilidadEfectiva('COTIZANDO', null)).toBe(50)
  })

  it('la que puso el vendedor manda mientras está abierta', () => {
    expect(probabilidadEfectiva('COTIZANDO', 65)).toBe(65)
    expect(probabilidadEfectiva('CONTACTO', 0)).toBe(0)
  })

  it('cerrada no hay duda: ganada es 100 y perdida 0, diga lo que diga la columna', () => {
    expect(probabilidadEfectiva('GANADA', 40)).toBe(100)
    expect(probabilidadEfectiva('PERDIDA', 90)).toBe(0)
  })
})

describe('el cambio de etapa', () => {
  it('se puede avanzar y también regresar mientras está abierta', () => {
    expect(problemaCambioEtapa('CONTACTO', 'COTIZANDO', null)).toBeNull()
    expect(problemaCambioEtapa('NEGOCIANDO', 'COTIZANDO', null)).toBeNull()
    expect(problemaCambioEtapa('NEGOCIANDO', 'GANADA', null)).toBeNull()
  })

  it('a la misma etapa no es un cambio', () => {
    expect(problemaCambioEtapa('COTIZANDO', 'COTIZANDO', null)).toBe('MISMA')
  })

  it('una cerrada ya no se mueve: lo que vuelva es otra oportunidad', () => {
    expect(problemaCambioEtapa('GANADA', 'NEGOCIANDO', null)).toBe('CERRADA')
    expect(problemaCambioEtapa('PERDIDA', 'CONTACTO', null)).toBe('CERRADA')
  })

  it('perderla exige decir por qué, y un motivo en blanco no cuenta', () => {
    expect(problemaCambioEtapa('NEGOCIANDO', 'PERDIDA', null)).toBe('SIN_MOTIVO')
    expect(problemaCambioEtapa('NEGOCIANDO', 'PERDIDA', '   ')).toBe('SIN_MOTIVO')
    expect(problemaCambioEtapa('NEGOCIANDO', 'PERDIDA', 'Se fue con la competencia')).toBeNull()
  })
})

describe('el presupuesto y las fechas', () => {
  it('el mínimo no puede pasar del máximo; cualquiera de los dos puede faltar', () => {
    expect(problemaPresupuesto(50_000, 80_000)).toBe(false)
    expect(problemaPresupuesto(null, 80_000)).toBe(false)
    expect(problemaPresupuesto(50_000, null)).toBe(false)
    expect(problemaPresupuesto(90_000, 80_000)).toBe(true)
  })

  it('el inicio deseado no puede ir después del fin', () => {
    expect(problemaFechas('2026-12-01', '2026-12-31')).toBe(false)
    expect(problemaFechas('2026-12-01', null)).toBe(false)
    expect(problemaFechas('2027-01-01', '2026-12-31')).toBe(true)
  })
})
