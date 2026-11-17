import { describe, it, expect } from 'vitest'
import { cotejoPorCliente, type PropuestaCotejo } from './crm-cotejo'

// ============================================================================
//  El cotejo por cliente (CRM, Fase 1 del ADR 0051, 17/11).
// ----------------------------------------------------------------------------
//  Pedido del dueño: por cliente, «cuántas cotizaciones lleva, qué tiempo de
//  negociación llevamos, cuánto quiere y los cambios que hacen el vendedor y
//  los otros». La Fase 1 responde con lo que YA existe —sin migración—: las
//  cotizaciones, sus versiones (renegociaciones), los días y el dinero.
//  El presupuesto y el detalle de los cambios llegan con las Fases 2 y 3.
// ============================================================================

const AHORA = new Date('2026-11-17T18:00:00.000Z')

const p = (o: Partial<PropuestaCotejo> & Pick<PropuestaCotejo, 'id'>): PropuestaCotejo => ({
  folio: o.id.toUpperCase(),
  nombre: `Propuesta ${o.id}`,
  clienteId: 'c1',
  estatus: 'ENVIADA',
  version: 1,
  creadoEn: '2026-11-01T18:00:00.000Z',
  aprobadaEn: null,
  rechazadaEn: null,
  vendedorId: 'v1',
  vendedorNombre: 'Ana',
  total: 1000,
  totalAprobado: 0,
  vencida: false,
  ...o,
})

describe('cotejoPorCliente', () => {
  it('agrupa las cotizaciones por cliente y cuenta cada estatus', () => {
    const r = cotejoPorCliente(
      [
        p({ id: 'a' }),
        p({ id: 'b', estatus: 'BORRADOR' }),
        p({ id: 'c', estatus: 'RECHAZADA', rechazadaEn: '2026-11-05T18:00:00.000Z' }),
        p({ id: 'd', clienteId: 'c2' }),
      ],
      AHORA,
    )
    const c1 = r.find((x) => x.clienteId === 'c1')!
    expect(c1.cotizaciones).toBe(3)
    expect(c1.porEstatus).toEqual({ BORRADOR: 1, ENVIADA: 1, APROBADA: 0, RECHAZADA: 1 })
    expect(r.find((x) => x.clienteId === 'c2')!.cotizaciones).toBe(1)
  })

  it('las propuestas sin cliente van juntas, en un grupo con clienteId null', () => {
    const r = cotejoPorCliente([p({ id: 'a', clienteId: null }), p({ id: 'b', clienteId: null })], AHORA)
    expect(r).toHaveLength(1)
    expect(r[0].clienteId).toBeNull()
    expect(r[0].cotizaciones).toBe(2)
  })

  it('las renegociaciones son las versiones de más: version 3 = dos cambios', () => {
    const r = cotejoPorCliente([p({ id: 'a', version: 3 }), p({ id: 'b', version: 1 })], AHORA)
    expect(r[0].renegociaciones).toBe(2)
  })

  it('con alguna abierta, los días corren desde la primera cotización hasta hoy', () => {
    const r = cotejoPorCliente(
      [p({ id: 'a', creadoEn: '2026-11-07T18:00:00.000Z' }), p({ id: 'b', creadoEn: '2026-10-28T18:00:00.000Z' })],
      AHORA,
    )
    expect(r[0].abierta).toBe(true)
    expect(r[0].diasNegociando).toBe(20)
    expect(r[0].primeraEn).toBe('2026-10-28T18:00:00.000Z')
  })

  it('todo cerrado: los días se detienen en la última decisión, no en hoy', () => {
    const r = cotejoPorCliente(
      [
        p({ id: 'a', estatus: 'APROBADA', creadoEn: '2026-10-01T18:00:00.000Z', aprobadaEn: '2026-10-11T18:00:00.000Z' }),
        p({ id: 'b', estatus: 'RECHAZADA', creadoEn: '2026-10-02T18:00:00.000Z', rechazadaEn: '2026-10-06T18:00:00.000Z' }),
      ],
      AHORA,
    )
    expect(r[0].abierta).toBe(false)
    expect(r[0].diasNegociando).toBe(10)
  })

  it('cerrada sin fecha de decisión (antes del 09/10): no inventa días, da null', () => {
    const r = cotejoPorCliente([p({ id: 'a', estatus: 'APROBADA', aprobadaEn: null })], AHORA)
    expect(r[0].diasNegociando).toBeNull()
  })

  it('el dinero: en juego = borrador + enviada; ganado = lo aprobado de las aprobadas', () => {
    const r = cotejoPorCliente(
      [
        p({ id: 'a', estatus: 'BORRADOR', total: 100 }),
        p({ id: 'b', estatus: 'ENVIADA', total: 250 }),
        p({ id: 'c', estatus: 'APROBADA', total: 900, totalAprobado: 700, aprobadaEn: '2026-11-10T18:00:00.000Z' }),
        p({ id: 'd', estatus: 'RECHAZADA', total: 5000, rechazadaEn: '2026-11-10T18:00:00.000Z' }),
      ],
      AHORA,
    )
    expect(r[0].enJuego).toBe(350)
    expect(r[0].ganado).toBe(700)
  })

  it('una enviada vencida sigue abierta, pero se cuenta aparte', () => {
    const r = cotejoPorCliente([p({ id: 'a', vencida: true }), p({ id: 'b' })], AHORA)
    expect(r[0].vencidas).toBe(1)
    expect(r[0].abierta).toBe(true)
  })

  it('tasa de cierre: aprobadas / (aprobadas + rechazadas); sin cierres, null', () => {
    const r = cotejoPorCliente(
      [
        p({ id: 'a', clienteId: 'c1', estatus: 'APROBADA', aprobadaEn: '2026-11-10T18:00:00.000Z' }),
        p({ id: 'b', clienteId: 'c1', estatus: 'RECHAZADA', rechazadaEn: '2026-11-10T18:00:00.000Z' }),
        p({ id: 'c', clienteId: 'c1', estatus: 'RECHAZADA', rechazadaEn: '2026-11-10T18:00:00.000Z' }),
        p({ id: 'd', clienteId: 'c2' }),
      ],
      AHORA,
    )
    expect(r.find((x) => x.clienteId === 'c1')!.tasaCierre).toBeCloseTo(1 / 3)
    expect(r.find((x) => x.clienteId === 'c2')!.tasaCierre).toBeNull()
  })

  it('los vendedores que han cotizado al cliente, sin repetir; el de baja por su nombre congelado', () => {
    const r = cotejoPorCliente(
      [
        p({ id: 'a', vendedorId: 'v1', vendedorNombre: 'Ana' }),
        p({ id: 'b', vendedorId: 'v1', vendedorNombre: 'Ana' }),
        p({ id: 'c', vendedorId: null, vendedorNombre: 'Beto' }),
        p({ id: 'd', vendedorId: null, vendedorNombre: null }),
      ],
      AHORA,
    )
    expect(r[0].vendedores).toEqual(['Ana', 'Beto'])
  })

  it('orden: primero los que tienen algo abierto; dentro, la actividad más reciente arriba', () => {
    const r = cotejoPorCliente(
      [
        p({ id: 'a', clienteId: 'cerrado', estatus: 'APROBADA', creadoEn: '2026-11-16T18:00:00.000Z', aprobadaEn: '2026-11-16T18:00:00.000Z' }),
        p({ id: 'b', clienteId: 'viejo', creadoEn: '2026-10-01T18:00:00.000Z' }),
        p({ id: 'c', clienteId: 'reciente', creadoEn: '2026-11-15T18:00:00.000Z' }),
      ],
      AHORA,
    )
    expect(r.map((x) => x.clienteId)).toEqual(['reciente', 'viejo', 'cerrado'])
  })

  it('dentro de cada cliente, sus cotizaciones de la más nueva a la más vieja', () => {
    const r = cotejoPorCliente(
      [p({ id: 'vieja', creadoEn: '2026-10-01T18:00:00.000Z' }), p({ id: 'nueva', creadoEn: '2026-11-10T18:00:00.000Z' })],
      AHORA,
    )
    expect(r[0].propuestas.map((x) => x.id)).toEqual(['nueva', 'vieja'])
  })

  it('sin propuestas, sin grupos', () => {
    expect(cotejoPorCliente([], AHORA)).toEqual([])
  })
})
