import { describe, it, expect } from 'vitest'
import {
  ETAPAS_OPORTUNIDAD,
  PROBABILIDAD_POR_ETAPA,
  etapaOportunidadCerrada,
  probabilidadEfectiva,
  problemaCambioEtapa,
  problemaPresupuesto,
  problemaFechas,
  diasPorEtapa,
  cotejoPresupuesto,
  cotejoFechas,
  agruparEmbudo,
  montoReferencia,
  tablaProbabilidades,
  sanearProbabilidades,
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

describe('la probabilidad la fija cada instancia (decisión del dueño, 17/11)', () => {
  it('lo que guardó la instancia manda en las etapas abiertas; lo que no, es el de fábrica', () => {
    const tabla = tablaProbabilidades({ CONTACTO: 5, COTIZANDO: 40 })
    expect(tabla).toEqual({ CONTACTO: 5, NECESIDAD: 25, COTIZANDO: 40, NEGOCIANDO: 75, GANADA: 100, PERDIDA: 0 })
    expect(probabilidadEfectiva('CONTACTO', null, tabla)).toBe(5)
    // La que puso el vendedor a mano sigue mandando sobre la de la instancia.
    expect(probabilidadEfectiva('CONTACTO', 30, tabla)).toBe(30)
  })

  it('GANADA y PERDIDA no se configuran: 100 y 0 siempre', () => {
    const tabla = tablaProbabilidades({ GANADA: 80, PERDIDA: 20 } as any)
    expect(probabilidadEfectiva('GANADA', null, tabla)).toBe(100)
    expect(probabilidadEfectiva('PERDIDA', null, tabla)).toBe(0)
  })

  it('el saneo tira lo que no sirve en vez de dejarlo pasar o convertirlo en 0', () => {
    // La columna es jsonb: la puede tocar una corrección a mano, y una base sin
    // la migración devuelve undefined. En todos los casos, la de fábrica.
    for (const basura of [undefined, null, '[]', [], 7, 'hola']) {
      expect(sanearProbabilidades(basura)).toEqual({})
    }
    expect(
      sanearProbabilidades({ CONTACTO: '15', NECESIDAD: -1, COTIZANDO: 101, NEGOCIANDO: 33.5, GANADA: 90, OTRA: 50, PERDIDA: null }),
    ).toEqual({ CONTACTO: 15 })
    // El 0 es un valor de verdad («aquí no cuento nada todavía»), no «sin configurar».
    expect(sanearProbabilidades({ CONTACTO: 0 })).toEqual({ CONTACTO: 0 })
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
  it('agrupa por etapa en el orden del embudo, con el total y el ponderado de cada columna', () => {
    const ops = [
      { etapa: 'COTIZANDO' as const, presupuestoMin: 100, presupuestoMax: 200, probabilidad: 50 },
      { etapa: 'COTIZANDO' as const, presupuestoMin: null, presupuestoMax: null, probabilidad: 50 },
      { etapa: 'CONTACTO' as const, presupuestoMin: 80, presupuestoMax: null, probabilidad: 10 },
    ]
    const e = agruparEmbudo(ops)
    expect(e.map((c) => c.etapa)).toEqual(['CONTACTO', 'NECESIDAD', 'COTIZANDO', 'NEGOCIANDO', 'GANADA', 'PERDIDA'])
    const cot = e.find((c) => c.etapa === 'COTIZANDO')!
    expect(cot.oportunidades).toHaveLength(2)
    expect(cot.total).toBe(200)
    expect(cot.ponderado).toBe(100)
    expect(e.find((c) => c.etapa === 'CONTACTO')!.ponderado).toBe(8)
  })

  it('el monto de referencia es el máximo, o el mínimo si no hay máximo', () => {
    expect(montoReferencia(100, 200)).toBe(200)
    expect(montoReferencia(100, null)).toBe(100)
    expect(montoReferencia(null, null)).toBeNull()
  })
})
