import { describe, it, expect } from 'vitest'
import { vigenciaCampana, estadoContradiceFechas } from './derive'

// ============================================================================
//  Vigencia por fechas vs estado guardado. Hallazgo A-1 de la auditoría QA.
//
//  `estadoComercial` sigue el FLUJO (confirmar, publicar, facturar), no el
//  calendario, y nadie lo mueve al vencer la fecha fin. La auditoría vio
//  "mastercard" Completada terminando en 2026-09-27 (futuro), "prueba anual"
//  Completada con vigencia hasta 2028 y "Propuesta para cliente 1" Activa
//  habiendo terminado hacía cuatro días.
//
//  Deliberadamente NO se reescribe el estado guardado: COMPLETADA condiciona la
//  facturación y moverlo desde un job podría dar por entregado algo que nunca
//  se entregó. Lo que se hace es detectar la contradicción para mostrarla.
// ============================================================================

const dia = (offset: number) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  return d.toISOString()
}

const campana = (estado: string, desde: number, hasta: number) => ({
  estadoComercial: estado,
  fechaInicio: dia(desde),
  fechaFin: dia(hasta),
})

describe('vigenciaCampana', () => {
  it('antes del inicio: por empezar', () => {
    expect(vigenciaCampana(campana('CONFIRMADA', 5, 20))).toBe('por_empezar')
  })

  it('dentro del rango: vigente', () => {
    expect(vigenciaCampana(campana('ACTIVA', -5, 5))).toBe('vigente')
  })

  it('pasado el fin: vencida', () => {
    expect(vigenciaCampana(campana('ACTIVA', -30, -1))).toBe('vencida')
  })

  it('el día de fin cuenta completo: termina hoy y sigue vigente', () => {
    expect(vigenciaCampana(campana('ACTIVA', -10, 0))).toBe('vigente')
  })

  it('el día de inicio cuenta: empieza hoy y ya está vigente', () => {
    expect(vigenciaCampana(campana('ACTIVA', 0, 10))).toBe('vigente')
  })

  it('fechas ilegibles no revientan ni marcan vencida por accidente', () => {
    expect(vigenciaCampana({ fechaInicio: 'no-es-fecha', fechaFin: 'tampoco' })).toBe('vigente')
  })
})

describe('estadoContradiceFechas', () => {
  it('ACTIVA con la vigencia terminada: el caso "Propuesta para cliente 1"', () => {
    expect(estadoContradiceFechas(campana('ACTIVA', -30, -4))).toBe(true)
  })

  it('COMPLETADA con vigencia futura: el caso "prueba anual" (hasta 2028)', () => {
    expect(estadoContradiceFechas(campana('COMPLETADA', -10, 700))).toBe(true)
  })

  it('COMPLETADA sin haber empezado también contradice', () => {
    expect(estadoContradiceFechas(campana('COMPLETADA', 10, 40))).toBe(true)
  })

  it('ACTIVA dentro de su ventana es coherente', () => {
    expect(estadoContradiceFechas(campana('ACTIVA', -5, 5))).toBe(false)
  })

  it('COMPLETADA ya vencida es coherente: el caso normal', () => {
    expect(estadoContradiceFechas(campana('COMPLETADA', -30, -1))).toBe(false)
  })

  it('CANCELADA vencida NO es contradicción: cancelar no depende del calendario', () => {
    expect(estadoContradiceFechas(campana('CANCELADA', -30, -1))).toBe(false)
    expect(estadoContradiceFechas(campana('CANCELADA', -5, 30))).toBe(false)
  })

  it('CONFIRMADA aún por empezar es lo esperado, no una contradicción', () => {
    expect(estadoContradiceFechas(campana('CONFIRMADA', 5, 30))).toBe(false)
  })
})
