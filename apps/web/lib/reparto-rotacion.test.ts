import { describe, it, expect } from 'vitest'
import { rotacionEnSpot, esRotacionAutomatica, autollenadoDeSpot } from './reparto-creativos'

// ============================================================================
//  v0.12.3 · varios creativos en un mismo spot ROTAN, sin escribir números.
// ----------------------------------------------------------------------------
//  Pedido del dueño el 2026-10-22: «en la pantalla de creativo me pidió sí o sí
//  que seleccionara cuántos espacios, y como eran 2 creativos para un spot
//  debí seleccionar 2 de 1, pero debe de ser autoseleccionable ya que pueden
//  ser varios creativos». Eligió: «todos rotan en partes iguales».
// ============================================================================

describe('rotacionEnSpot: cada creativo elegido entra, en partes iguales', () => {
  it('con spots de sobra, se reparten como siempre', () => {
    expect(rotacionEnSpot(['a', 'b'], 6)).toEqual([
      { creatividadId: 'a', veces: 3 },
      { creatividadId: 'b', veces: 3 },
    ])
  })

  it('con MENOS spots que creativos, todos entran con 1 y rotan: «2 de 1» ya no deja a uno fuera', () => {
    // Antes `asignacionDePantalla(['a','b'], 1)` daba [{a,1}] y B no salía nunca.
    expect(rotacionEnSpot(['a', 'b'], 1)).toEqual([
      { creatividadId: 'a', veces: 1 },
      { creatividadId: 'b', veces: 1 },
    ])
  })

  it('sin pauta (0 o null), una marca de 1 por creativo: el CMS pone los que quepan', () => {
    expect(rotacionEnSpot(['a', 'b', 'c'], null)).toEqual([
      { creatividadId: 'a', veces: 1 },
      { creatividadId: 'b', veces: 1 },
      { creatividadId: 'c', veces: 1 },
    ])
  })

  it('sin creativos, nada', () => {
    expect(rotacionEnSpot([], 6)).toEqual([])
  })
})

describe('esRotacionAutomatica: ¿lo llenó el sistema o lo ajustó una persona?', () => {
  it('sí, si tiene exactamente esos creativos con el reparto automático', () => {
    expect(esRotacionAutomatica([{ creatividadId: 'a', veces: 6 }], ['a'], 6)).toBe(true)
    expect(esRotacionAutomatica([{ creatividadId: 'b', veces: 3 }, { creatividadId: 'a', veces: 3 }], ['a', 'b'], 6)).toBe(true)
  })

  it('no, si alguien cambió las veces a mano', () => {
    expect(esRotacionAutomatica([{ creatividadId: 'a', veces: 3 }], ['a'], 6)).toBe(false)
  })

  it('no, si tiene otros creativos', () => {
    expect(esRotacionAutomatica([{ creatividadId: 'a', veces: 6 }], ['a', 'b'], 6)).toBe(false)
  })
})

describe('autollenadoDeSpot: qué recibe cada spot al aprobar un creativo', () => {
  const antes = ['a'] // aprobados ANTES del que se acaba de aprobar
  const ahora = ['a', 'b']

  it('un spot VACÍO recibe todos los aprobados, rotando', () => {
    expect(autollenadoDeSpot({ actual: [], aprobadosAntes: antes, aprobadosAhora: ahora, spots: 6 })).toEqual([
      { creatividadId: 'a', veces: 3 },
      { creatividadId: 'b', veces: 3 },
    ])
  })

  it('uno con el reparto automático de antes suma al nuevo', () => {
    expect(
      autollenadoDeSpot({ actual: [{ creatividadId: 'a', veces: 6 }], aprobadosAntes: antes, aprobadosAhora: ahora, spots: 6 }),
    ).toEqual([
      { creatividadId: 'a', veces: 3 },
      { creatividadId: 'b', veces: 3 },
    ])
  })

  it('uno ajustado a mano NO se toca: null', () => {
    expect(
      autollenadoDeSpot({ actual: [{ creatividadId: 'a', veces: 2 }], aprobadosAntes: antes, aprobadosAhora: ahora, spots: 6 }),
    ).toBeNull()
  })

  it('volver a aprobar el mismo, sin nada nuevo, no cambia nada: null', () => {
    expect(
      autollenadoDeSpot({ actual: [{ creatividadId: 'a', veces: 6 }], aprobadosAntes: ['a'], aprobadosAhora: ['a'], spots: 6 }),
    ).toBeNull()
  })
})
