import { describe, it, expect } from 'vitest'
import {
  sitiosOcupadosHoy,
  tarifaDeSitio,
  ocupacionRed,
  ocupacionSerie,
  clientesEnPantalla,
  cupoDePantalla,
} from './derive'
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

// ============================================================================
//  Ocupación de la red ponderada por capacidad.
//  Un espectacular es una cara (se vende entero); una digital son N slots. El
//  conteo por pantalla daba 100% a una digital con 1 de 12 slots vendidos.
// ============================================================================
const digital = (id: string, totalSpots: number | null) => ({
  id, tipoMedio: 'PANTALLA_DIGITAL', totalSpots, estatusComercial: 'DISPONIBLE',
})
const fija = (id: string) => ({ id, tipoMedio: 'ESPECTACULAR', totalSpots: null, estatusComercial: 'DISPONIBLE' })
const reservaDe = (sitioId: string, campanaId: string, desde: number, hasta: number, estatus = 'CONFIRMADA') => ({
  id: `r-${sitioId}-${campanaId}-${desde}`, sitioId, campanaId, estatus,
  fechaInicio: dia(desde), fechaFin: dia(hasta),
})

describe('ocupacionRed — ponderada por slots y por caras fijas', () => {
  it('una digital de 12 slots con 3 campañas ocupa 3, no la pantalla entera', () => {
    const s = estado({
      sitios: [digital('d1', 12)] as any,
      reservas: [
        reservaDe('d1', 'c1', -5, 5),
        reservaDe('d1', 'c2', -3, 10),
        reservaDe('d1', 'c3', 0, 20),
      ] as any,
    })
    const r = ocupacionRed(s)
    expect(r.capacidad).toBe(12)
    expect(r.ocupados).toBe(3)
    expect(r.pct).toBeCloseTo(25)
    expect(r.sitiosOcupados).toBe(1) // la pantalla sí tiene algo vendido
  })

  it('una fija vale 1: ocupada o libre, sin medias tintas', () => {
    const s = estado({
      sitios: [fija('f1'), fija('f2')] as any,
      reservas: [reservaDe('f1', 'c1', -5, 5)] as any,
    })
    const r = ocupacionRed(s)
    expect(r.capacidad).toBe(2)
    expect(r.ocupados).toBe(1)
    expect(r.pct).toBeCloseTo(50)
  })

  it('mezcla digital + fijas: el % sale de los espacios, no de las pantallas', () => {
    // 1 digital de 12 con 3 campañas + 2 fijas, una ocupada.
    // Por pantalla serían 2 de 3 = 67%. Por capacidad son 4 de 14 = 28.6%.
    const s = estado({
      sitios: [digital('d1', 12), fija('f1'), fija('f2')] as any,
      reservas: [
        reservaDe('d1', 'c1', -5, 5),
        reservaDe('d1', 'c2', -3, 10),
        reservaDe('d1', 'c3', 0, 20),
        reservaDe('f1', 'c4', -1, 30),
      ] as any,
    })
    const r = ocupacionRed(s)
    expect(r.capacidad).toBe(14)
    expect(r.ocupados).toBe(4)
    expect(r.pct).toBeCloseTo((4 / 14) * 100)
    expect(r.digitales).toEqual({ sitios: 1, ocupados: 3, capacidad: 12 })
    expect(r.fijas).toEqual({ sitios: 2, ocupados: 1, capacidad: 2 })
  })

  it('dos reservas de la MISMA campaña en la misma pantalla ocupan un slot', () => {
    const s = estado({
      sitios: [digital('d1', 12)] as any,
      reservas: [
        reservaDe('d1', 'c1', -5, 5),
        reservaDe('d1', 'c1', 6, 20),
      ] as any,
    })
    expect(ocupacionRed(s).ocupados).toBe(1)
  })

  it('las TENTATIVAS no cuentan: reservar no es vender (misma regla A-2)', () => {
    const s = estado({
      sitios: [digital('d1', 12)] as any,
      reservas: [reservaDe('d1', 'c1', -5, 5, 'TENTATIVA')] as any,
    })
    expect(ocupacionRed(s).ocupados).toBe(0)
  })

  it('solo cuenta lo vigente en la ventana', () => {
    const s = estado({
      sitios: [digital('d1', 12)] as any,
      reservas: [
        reservaDe('d1', 'c1', -30, -10), // terminada
        reservaDe('d1', 'c2', 10, 30),   // futura
      ] as any,
    })
    expect(ocupacionRed(s).ocupados).toBe(0)
  })

  it('una digital sin slots capturados entra valiendo 1 y se reporta aparte', () => {
    const s = estado({
      sitios: [digital('d1', null)] as any,
      reservas: [reservaDe('d1', 'c1', -5, 5)] as any,
    })
    const r = ocupacionRed(s)
    expect(r.capacidad).toBe(1)
    expect(r.ocupados).toBe(1)
    expect(r.sinSlots).toBe(1)
  })

  it('nunca pasa del 100% aunque haya más campañas que slots', () => {
    const s = estado({
      sitios: [digital('d1', 2)] as any,
      reservas: [
        reservaDe('d1', 'c1', -5, 5),
        reservaDe('d1', 'c2', -5, 5),
        reservaDe('d1', 'c3', -5, 5),
      ] as any,
    })
    const r = ocupacionRed(s)
    expect(r.ocupados).toBe(2)
    expect(r.pct).toBe(100)
  })

  it('red vacía: 0%, no NaN', () => {
    const r = ocupacionRed(estado({ sitios: [], reservas: [] }))
    expect(r.pct).toBe(0)
    expect(r.capacidad).toBe(0)
  })

  it('la gráfica usa la misma definición que el KPI', () => {
    const s = estado({
      sitios: [digital('d1', 12), fija('f1')] as any,
      reservas: [reservaDe('d1', 'c1', -1, 30), reservaDe('f1', 'c2', -1, 30)] as any,
    })
    const kpi = ocupacionRed(s)
    const serie = ocupacionSerie(s, 'dia')
    // El primer bucket de la serie es HOY: mismo número que el KPI.
    expect(serie.puntos[0].pct).toBeCloseTo(kpi.pct)
    expect(serie.puntos[0].ocupados).toBe(kpi.ocupados)
  })
})

// ============================================================================
//  ADR 0008 · espejo en cliente del cupo de clientes. Lo que se prueba aquí es
//  que la UI mide lo MISMO que el servidor: si divergen, el comercial ve "hay
//  lugar" y la reserva se cae al mandarla (o al revés, que es peor: ve el aviso
//  y deja de vender una pantalla que sí admitía al cliente).
// ============================================================================
describe('clientesEnPantalla / cupoDePantalla — ADR 0008', () => {
  const camp = (id: string, clienteId: string) => ({ id, clienteId })
  const res = (sitioId: string, campanaId: string, desde: number, hasta: number, estatus = 'CONFIRMADA') => ({
    id: `r-${campanaId}-${desde}`, sitioId, campanaId, estatus,
    fechaInicio: dia(desde), fechaFin: dia(hasta),
  })
  const datos = {
    campanas: [camp('c1', 'cli-a'), camp('c2', 'cli-b'), camp('c3', 'cli-a'), camp('c4', 'cli-c')] as any,
    reservas: [
      res('s1', 'c1', -5, 5),
      res('s1', 'c2', -3, 10),
      res('s1', 'c3', 0, 20),   // mismo cliente que c1
      res('s1', 'c4', 40, 60),  // fuera de ventana
    ] as any,
  }
  const ventana = () => ({
    desde: new Date(dia(-1)).getTime(),
    hasta: new Date(dia(1)).getTime(),
  })

  it('cuenta CLIENTES distintos, no campañas: dos campañas de uno son un lugar', () => {
    const { desde, hasta } = ventana()
    const ids = clientesEnPantalla(datos, 's1', desde, hasta)
    expect(ids.sort()).toEqual(['cli-a', 'cli-b'])
  })

  it('ignora lo que no solapa la ventana', () => {
    const { desde, hasta } = ventana()
    expect(clientesEnPantalla(datos, 's1', desde, hasta)).not.toContain('cli-c')
  })

  it('las TENTATIVAS sí ocupan cupo: el lugar ya está apartado', () => {
    const { desde, hasta } = ventana()
    const conTentativa = {
      campanas: [camp('c9', 'cli-z')] as any,
      reservas: [res('s1', 'c9', -1, 1, 'TENTATIVA')] as any,
    }
    expect(clientesEnPantalla(conTentativa, 's1', desde, hasta)).toEqual(['cli-z'])
  })

  it('las CANCELADAS no ocupan nada', () => {
    const { desde, hasta } = ventana()
    const cancelada = {
      campanas: [camp('c9', 'cli-z')] as any,
      reservas: [res('s1', 'c9', -1, 1, 'CANCELADA')] as any,
    }
    expect(clientesEnPantalla(cancelada, 's1', desde, hasta)).toEqual([])
  })

  it('el cupo de la pantalla manda sobre el global', () => {
    expect(cupoDePantalla({ maxClientes: 6 }, { maxClientesPantalla: 4 })).toBe(6)
    expect(cupoDePantalla({ maxClientes: null }, { maxClientesPantalla: 4 })).toBe(4)
    expect(cupoDePantalla({}, { maxClientesPantalla: 4 })).toBe(4)
    expect(cupoDePantalla({ maxClientes: null }, { maxClientesPantalla: null })).toBeNull()
    expect(cupoDePantalla({}, null)).toBeNull()
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
