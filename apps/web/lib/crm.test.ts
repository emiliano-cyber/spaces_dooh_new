import { describe, it, expect } from 'vitest'
import {
  ETAPAS_OPORTUNIDAD,
  etapaOportunidadCerrada,
  problemaCambioEtapa,
  problemaPresupuesto,
  problemaFechas,
  diasPorEtapa,
  diasNegociando,
  cotejoPresupuesto,
  cotejoFechas,
  agruparEmbudo,
  montoReferencia,
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

// ─── Fase 4 · lo que pinta la pantalla ──────────────────────────────────────

describe('los días en cada etapa', () => {
  const dia = (d: number) => new Date(Date.UTC(2026, 10, d, 12)).toISOString()

  it('cada fila ETAPA abre una etapa; la abierta corre hasta hoy', () => {
    const r = diasPorEtapa(
      [
        { tipo: 'ETAPA', etapaNueva: 'CONTACTO', creadoEn: dia(1) },
        { tipo: 'NOTA', etapaNueva: null, creadoEn: dia(2) },
        { tipo: 'ETAPA', etapaNueva: 'COTIZANDO', creadoEn: dia(4) },
      ],
      new Date(dia(10)),
    )
    expect(r).toEqual({ CONTACTO: 3, COTIZANDO: 6 })
  })

  it('volver a una etapa SUMA, y la etapa de cierre no cuenta días', () => {
    const r = diasPorEtapa(
      [
        { tipo: 'ETAPA', etapaNueva: 'CONTACTO', creadoEn: dia(1) },
        { tipo: 'ETAPA', etapaNueva: 'NEGOCIANDO', creadoEn: dia(3) },
        { tipo: 'ETAPA', etapaNueva: 'COTIZANDO', creadoEn: dia(5) },
        { tipo: 'ETAPA', etapaNueva: 'NEGOCIANDO', creadoEn: dia(6) },
        { tipo: 'ETAPA', etapaNueva: 'GANADA', creadoEn: dia(9) },
      ],
      new Date(dia(30)),
    )
    expect(r).toEqual({ CONTACTO: 2, NEGOCIANDO: 5, COTIZANDO: 1 })
  })

  it('sin filas ETAPA no inventa nada', () => {
    expect(diasPorEtapa([], new Date(dia(5)))).toEqual({})
  })
})

describe('el presupuesto contra lo cotizado', () => {
  it('dentro del rango: diferencia 0', () => {
    expect(cotejoPresupuesto(100, 200, 150)).toEqual({ posicion: 'DENTRO', diferencia: 0, pct: 0 })
  })

  it('por encima del máximo: cuánto y qué porcentaje del máximo', () => {
    expect(cotejoPresupuesto(100, 200, 250)).toEqual({ posicion: 'ENCIMA', diferencia: 50, pct: 25 })
  })

  it('por debajo del mínimo: negativo', () => {
    expect(cotejoPresupuesto(100, 200, 80)).toEqual({ posicion: 'DEBAJO', diferencia: -20, pct: -20 })
  })

  it('con un solo extremo se compara contra ése', () => {
    expect(cotejoPresupuesto(null, 200, 250).posicion).toBe('ENCIMA')
    expect(cotejoPresupuesto(100, null, 250).posicion).toBe('DENTRO')
    expect(cotejoPresupuesto(100, null, 50).posicion).toBe('DEBAJO')
  })

  it('sin presupuesto no hay cotejo', () => {
    expect(cotejoPresupuesto(null, null, 250)).toEqual({ posicion: 'SIN_PRESUPUESTO', diferencia: null, pct: null })
  })
})

describe('las fechas pedidas contra las cotizadas', () => {
  it('iguales', () => {
    expect(cotejoFechas('2026-12-01', '2026-12-31', '2026-12-01', '2026-12-31')).toEqual({
      estado: 'IGUAL', inicioDias: 0, finDias: 0,
    })
  })

  it('distintas: cuántos días se movió cada extremo (+ = después)', () => {
    expect(cotejoFechas('2026-12-01', '2026-12-31', '2026-12-05', '2026-12-29')).toEqual({
      estado: 'DISTINTO', inicioDias: 4, finDias: -2,
    })
  })

  it('las cotizadas llegan como ISO completo (así las serializa propuestas-repo): no da NaN, y la zona no mueve el día', () => {
    // Visto en el navegador el 17/11: «Movidas: inicio NaN, fin NaN días».
    // México (medianoche local = 06:00Z) y una zona al este (23:00Z del día antes).
    expect(cotejoFechas('2026-12-01', '2026-12-31', '2026-12-01T06:00:00.000Z', '2026-12-31T06:00:00.000Z')).toEqual({
      estado: 'IGUAL', inicioDias: 0, finDias: 0,
    })
    expect(cotejoFechas('2026-12-01', '2026-12-31', '2026-12-04T23:00:00.000Z', '2026-12-28T23:00:00.000Z')).toEqual({
      estado: 'DISTINTO', inicioDias: 4, finDias: -2,
    })
  })

  it('si el cliente no pidió fechas, no se compara', () => {
    expect(cotejoFechas(null, null, '2026-12-05', '2026-12-29').estado).toBe('SIN_FECHAS')
  })
})

describe('el embudo', () => {
  it('agrupa por etapa en el orden del embudo, con el total de cada columna (sin ponderar: el dueño quitó la probabilidad)', () => {
    const ops = [
      { etapa: 'COTIZANDO' as const, presupuestoMin: 100, presupuestoMax: 200 },
      { etapa: 'COTIZANDO' as const, presupuestoMin: null, presupuestoMax: null },
      { etapa: 'CONTACTO' as const, presupuestoMin: 80, presupuestoMax: null },
    ]
    const e = agruparEmbudo(ops)
    expect(e.map((c) => c.etapa)).toEqual(['CONTACTO', 'NECESIDAD', 'COTIZANDO', 'NEGOCIANDO', 'GANADA', 'PERDIDA'])
    const cot = e.find((c) => c.etapa === 'COTIZANDO')!
    expect(cot.oportunidades).toHaveLength(2)
    expect(cot.total).toBe(200)
    expect(e.find((c) => c.etapa === 'CONTACTO')!.total).toBe(80)
    expect(Object.keys(cot)).not.toContain('ponderado')
  })

  it('el monto de referencia es el máximo, o el mínimo si no hay máximo', () => {
    expect(montoReferencia(100, 200)).toBe(200)
    expect(montoReferencia(100, null)).toBe(100)
    expect(montoReferencia(null, null)).toBeNull()
  })
})

describe('los días negociando (tarjeta de Seguimiento)', () => {
  const ahora = new Date('2026-11-10T18:00:00.000Z')
  it('abierta: del alta hasta hoy, en días completos', () => {
    expect(diasNegociando({ creadoEn: '2026-11-01T18:00:00.000Z', ganadaEn: null, perdidaEn: null }, ahora)).toBe(9)
    expect(diasNegociando({ creadoEn: '2026-11-10T08:00:00.000Z', ganadaEn: null, perdidaEn: null }, ahora)).toBe(0)
  })
  it('cerrada: se para el día que se ganó o se perdió, no sigue contando', () => {
    expect(diasNegociando({ creadoEn: '2026-11-01T18:00:00.000Z', ganadaEn: '2026-11-04T18:00:00.000Z', perdidaEn: null }, ahora)).toBe(3)
    expect(diasNegociando({ creadoEn: '2026-11-01T18:00:00.000Z', ganadaEn: null, perdidaEn: '2026-11-06T18:00:00.000Z' }, ahora)).toBe(5)
  })
  it('nunca negativo, aunque el reloj del navegador vaya atrasado', () => {
    expect(diasNegociando({ creadoEn: '2026-11-12T18:00:00.000Z', ganadaEn: null, perdidaEn: null }, ahora)).toBe(0)
  })
})
