import { describe, it, expect } from 'vitest'
import { resumirPropuestas, type PropuestaP } from './propuestas-periodo'

// ============================================================================
//  El tablero de propuestas por periodo (PROP-PER, 06/10).
// ----------------------------------------------------------------------------
//  Pedido del dueño: «en propuestas añadir un dashboard: propuestas aprobadas,
//  ganancia por aprobada, rechazadas, generadas, y todo por lapsos de tiempo».
//  Cada cifra se cuenta por SU fecha: generada por la de creación, aprobada por
//  la de aprobación, rechazada por la de rechazo. Una propuesta creada en agosto
//  y aprobada en octubre es «generada» en agosto y «aprobada» en octubre.
//  La ganancia es venta − renta de las pantallas (decisión del dueño).
// ============================================================================

const oct = { desde: '2026-10-01', hasta: '2026-10-31' }
const sep = { desde: '2026-09-01', hasta: '2026-09-30' }

const p = (o: Partial<PropuestaP> & Pick<PropuestaP, 'id'>): PropuestaP => ({
  folio: o.id.toUpperCase(),
  nombre: `Propuesta ${o.id}`,
  estatus: 'ENVIADA',
  creada: '2026-10-01',
  aprobada: null,
  rechazada: null,
  vendedorId: 'v1',
  vendedor: 'Víctor',
  venta: null,
  costoRenta: null,
  ...o,
})

const props: PropuestaP[] = [
  // Aprobadas en octubre: una con buena ganancia, otra con poca.
  p({ id: 'a1', estatus: 'APROBADA', creada: '2026-09-20', aprobada: '2026-10-02', venta: 100000, costoRenta: 40000 }),
  p({ id: 'a2', estatus: 'APROBADA', creada: '2026-10-03', aprobada: '2026-10-05', venta: 50000, costoRenta: 45000, vendedorId: 'v2', vendedor: 'Gerardo' }),
  // Aprobada en septiembre.
  p({ id: 'a3', estatus: 'APROBADA', creada: '2026-09-01', aprobada: '2026-09-15', venta: 30000, costoRenta: 10000 }),
  // Aprobada en octubre SIN renta capturada: cuenta como aprobada y en la
  // venta, pero no se le puede calcular ganancia.
  p({ id: 'a4', estatus: 'APROBADA', creada: '2026-10-04', aprobada: '2026-10-06', venta: 20000, costoRenta: null }),
  // Rechazadas: una en octubre, otra en septiembre.
  p({ id: 'r1', estatus: 'RECHAZADA', creada: '2026-09-25', rechazada: '2026-10-03', vendedorId: 'v2', vendedor: 'Gerardo' }),
  p({ id: 'r2', estatus: 'RECHAZADA', creada: '2026-09-02', rechazada: '2026-09-10' }),
  // Rechazada ANTES de que se guardara la fecha: no cae en ningún periodo.
  p({ id: 'r3', estatus: 'RECHAZADA', creada: '2026-08-01', rechazada: null }),
  // Abiertas: creadas en octubre, sin decidir.
  p({ id: 'b1', estatus: 'BORRADOR', creada: '2026-10-04' }),
  p({ id: 'e1', estatus: 'ENVIADA', creada: '2026-10-05', vendedorId: 'v2', vendedor: 'Gerardo' }),
]

describe('1 · cada cosa se cuenta por su fecha', () => {
  it('generadas: las CREADAS en el periodo, sin importar cómo acabaron', () => {
    expect(resumirPropuestas(props, oct, true).generadas).toBe(4) // a2, a4, b1, e1
    expect(resumirPropuestas(props, sep, true).generadas).toBe(4) // a1 (20/09), a3, r1, r2
  })

  it('aprobadas: por la fecha de APROBACIÓN', () => {
    expect(resumirPropuestas(props, oct, true).aprobadas.n).toBe(3) // a1, a2, a4
    expect(resumirPropuestas(props, sep, true).aprobadas.n).toBe(1) // a3
  })

  it('rechazadas: por la fecha de RECHAZO; sin fecha no cae en ningún periodo', () => {
    expect(resumirPropuestas(props, oct, true).rechazadas).toBe(1) // r1
    expect(resumirPropuestas(props, sep, true).rechazadas).toBe(1) // r2
    expect(resumirPropuestas(props, { desde: '2026-01-01', hasta: '2026-12-31' }, true).rechazadas).toBe(2)
  })

  it('tasa de cierre: aprobadas entre decididas del periodo', () => {
    expect(resumirPropuestas(props, oct, true).tasaCierre).toBeCloseTo(3 / 4)
    expect(resumirPropuestas(props, { desde: '2026-07-01', hasta: '2026-07-31' }, true).tasaCierre).toBeNull()
  })
})

describe('2 · la ganancia: venta − renta de las pantallas', () => {
  it('venta, costo y ganancia de las aprobadas del periodo', () => {
    const r = resumirPropuestas(props, oct, true).aprobadas
    expect(r.venta).toBe(170000) // a1 + a2 + a4
    // Ganancia solo de las que tienen renta capturada (a1 y a2).
    expect(r.costo).toBe(85000)
    expect(r.ganancia).toBe(65000)
    expect(r.gananciaPromedio).toBe(32500)
    expect(r.margenPct).toBeCloseTo((65000 / 150000) * 100)
    expect(r.sinCosto).toBe(1) // a4
  })

  it('sin permiso de ver costos no viaja ni el costo ni la ganancia', () => {
    const r = resumirPropuestas(props, oct, false).aprobadas
    expect(r.venta).toBe(170000)
    expect(r.costo).toBeNull()
    expect(r.ganancia).toBeNull()
    expect(r.gananciaPromedio).toBeNull()
    expect(r.margenPct).toBeNull()
    const lista = resumirPropuestas(props, oct, false).lista
    expect(lista.every((x) => x.ganancia === null && x.costoRenta === null)).toBe(true)
  })

  it('sin aprobadas con costo, la ganancia promedio es null, no 0 ni NaN', () => {
    const r = resumirPropuestas([props[3]], oct, true).aprobadas
    expect(r.ganancia).toBe(0)
    expect(r.gananciaPromedio).toBeNull()
    expect(r.margenPct).toBeNull()
  })
})

describe('3 · el detalle', () => {
  it('por vendedor: lo de cada quien en el periodo', () => {
    const v = resumirPropuestas(props, oct, true).porVendedor
    expect(v).toEqual([
      { vendedor: 'Víctor', generadas: 2, aprobadas: 2, rechazadas: 0, venta: 120000, ganancia: 60000 },
      { vendedor: 'Gerardo', generadas: 2, aprobadas: 1, rechazadas: 1, venta: 50000, ganancia: 5000 },
    ])
  })

  it('la lista de aprobadas, de mayor a menor ganancia, con las sin costo al final', () => {
    const l = resumirPropuestas(props, oct, true).lista
    expect(l.map((x) => [x.folio, x.ganancia])).toEqual([['A1', 60000], ['A2', 5000], ['A4', null]])
  })
})
