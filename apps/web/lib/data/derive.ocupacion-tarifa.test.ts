import { describe, it, expect } from 'vitest'
import { sitiosOcupadosHoy, tarifaDeSitio } from './derive'
import type { DemoState } from './types'

// ============================================================================
//  Ocupación y tarifa: una sola definición de cada una.
//  Hallazgos A-2 y A-8 de la auditoría QA del 04/08/2026. Los dos son el mismo
//  patrón que C-3: un concepto calculado en dos sitios que divergen.
//
//   • A-2: el KPI contaba `estatusComercial === 'OCUPADO'` (columna almacenada)
//     y la gráfica contaba reservas CONFIRMADAS solapando el periodo. En
//     producción los 12 sitios de G500 estaban en 'RESERVADO' y ninguno en
//     'OCUPADO', así que el KPI decía 0% junto a una gráfica marcando 42%.
//   • A-8: `tarifaPublicada` y `tarifaMensual` son el MISMO número en la MISMA
//     unidad; tres pantallas de G500 quedaron con 45 000 en una y 85 000 en la
//     otra, y Comercial leía una mientras Network leía la otra.
// ============================================================================

const HOY = new Date()
const dia = (offset: number) => {
  const d = new Date(HOY)
  d.setDate(d.getDate() + offset)
  return d.toISOString()
}

function estado(over: Partial<DemoState>): DemoState {
  return { sitios: [], reservas: [], ...over } as unknown as DemoState
}

const sitio = (id: string) => ({ id, estatusComercial: 'RESERVADO' })
const reserva = (sitioId: string, estatus: string, desde: number, hasta: number) => ({
  id: `r-${sitioId}-${desde}`, sitioId, estatus,
  fechaInicio: dia(desde), fechaFin: dia(hasta),
})

describe('sitiosOcupadosHoy — A-2', () => {
  it('cuenta el sitio con reserva CONFIRMADA vigente, aunque no esté en OCUPADO', () => {
    // El caso exacto de producción: estatusComercial='RESERVADO', reserva viva.
    const s = estado({
      sitios: [sitio('s1')] as any,
      reservas: [reserva('s1', 'CONFIRMADA', -5, 5)] as any,
    })
    expect(sitiosOcupadosHoy(s).has('s1')).toBe(true)
  })

  it('ignora las TENTATIVAS: reservar no es vender', () => {
    const s = estado({
      sitios: [sitio('s1')] as any,
      reservas: [reserva('s1', 'TENTATIVA', -5, 5)] as any,
    })
    expect(sitiosOcupadosHoy(s).size).toBe(0)
  })

  it('ignora reservas que ya terminaron y las que aún no empiezan', () => {
    const s = estado({
      sitios: [sitio('s1'), sitio('s2')] as any,
      reservas: [
        reserva('s1', 'CONFIRMADA', -30, -10),
        reserva('s2', 'CONFIRMADA', 10, 30),
      ] as any,
    })
    expect(sitiosOcupadosHoy(s).size).toBe(0)
  })

  it('no cuenta dos veces un sitio con varias reservas vigentes', () => {
    const s = estado({
      sitios: [sitio('s1')] as any,
      reservas: [
        reserva('s1', 'CONFIRMADA', -5, 5),
        reserva('s1', 'CONFIRMADA', -2, 8),
      ] as any,
    })
    expect(sitiosOcupadosHoy(s).size).toBe(1)
  })

  it('no cuenta reservas de sitios que ya no existen: la ocupación no pasa del 100%', () => {
    const s = estado({
      sitios: [sitio('s1')] as any,
      reservas: [
        reserva('s1', 'CONFIRMADA', -5, 5),
        reserva('s-dado-de-baja', 'CONFIRMADA', -5, 5),
      ] as any,
    })
    expect(sitiosOcupadosHoy(s).size).toBe(1)
  })
})

describe('tarifaDeSitio — A-8', () => {
  it('manda la publicada: el caso GUSTAVO BAZ (45 000 heredada vs 85 000 real)', () => {
    expect(tarifaDeSitio({ tarifaPublicada: 85000, tarifaMensual: 45000 })).toBe(85000)
  })

  it('cae a la mensual solo si no hay publicada', () => {
    expect(tarifaDeSitio({ tarifaPublicada: null, tarifaMensual: 45000 })).toBe(45000)
    expect(tarifaDeSitio({ tarifaPublicada: 0, tarifaMensual: 45000 })).toBe(45000)
  })

  it('sin ninguna de las dos devuelve 0, no NaN: un NaN envenena todo el total', () => {
    expect(tarifaDeSitio({})).toBe(0)
    expect(tarifaDeSitio({ tarifaPublicada: null, tarifaMensual: null })).toBe(0)
  })
})
