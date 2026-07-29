import { describe, it, expect } from 'vitest'
import { conciliacionRenta } from './derive'

// ============================================================================
//  Conciliación de renta por emplazamiento y arrendador (R3.7).
//
//  Lo que un cuadre tiene que garantizar por encima de todo: que NADA se pierda
//  ni se cuente dos veces. Si el total del cuadre no coincide con la suma de los
//  pagos, el número es peor que no tenerlo, porque se usa para pagarle a un
//  propietario real.
// ============================================================================

const BASE: any = {
  arrendadores: [
    { id: 'A1', nombre: 'Inmuebles Uno' },
    { id: 'A2', nombre: 'Doña Dos' },
  ],
  predios: [
    { id: 'P1', nombre: 'Predio Centro', arrendadorId: 'A1' },
    { id: 'P2', nombre: 'Predio Norte', arrendadorId: 'A2' },
  ],
  sitios: [
    { id: 'S1', nombre: 'Cara A', predioId: 'P1', caras: 1 },
    { id: 'S2', nombre: 'Cara B', predioId: 'P1', caras: 1 },
    { id: 'S3', nombre: 'Suelta', predioId: null, caras: 1 },
    { id: 'S4', nombre: 'Norte 1', predioId: 'P2', caras: 1 },
  ],
  contratos: [],
  pagosRenta: [],
  reservas: [], campanas: [], facturas: [], cobranzas: [], ordenesTrabajo: [],
  creatividades: [], ordenesImpresion: [], evidencias: [], incidencias: [],
  clientes: [], propuestas: [], ordenesCompra: [], notificaciones: [],
  acciones: [], sitiosRed: [], razonesSociales: [], licencias: [],
}

const con = (id: string, over: any = {}) => ({
  id, sitioId: 'S1', predioId: 'P1', arrendadorId: 'A1', estatus: 'VIGENTE',
  fechaInicio: '2026-01-01', fechaFin: '2026-12-31', montoRenta: 10000,
  periodicidad: 'MENSUAL', moneda: 'MXN', ...over,
})

const pago = (id: string, contratoId: string, periodo: string, monto: number, estatus: string) => ({
  id, contratoId, periodo, monto, estatus, fechaPago: null,
  tieneFactura: false, tieneComprobante: false,
})

describe('agrupación por arrendador', () => {
  const estado = {
    ...BASE,
    contratos: [con('C1'), con('C2', { id: 'C2', sitioId: 'S4', predioId: 'P2', arrendadorId: 'A2' })],
    pagosRenta: [
      pago('p1', 'C1', '2026-01', 10000, 'PAGADO'),
      pago('p2', 'C1', '2026-02', 10000, 'VENCIDO'),
      pago('p3', 'C1', '2026-03', 10000, 'PENDIENTE'),
      pago('p4', 'C2', '2026-01', 5000, 'PAGADO'),
    ],
  }

  it('separa a los dos propietarios', () => {
    const r = conciliacionRenta(estado)
    expect(r).toHaveLength(2)
    expect(r.map((x) => x.arrendador).sort()).toEqual(['Doña Dos', 'Inmuebles Uno'])
  })

  it('suma bien lo pagado, lo pendiente y lo vencido', () => {
    const a1 = conciliacionRenta(estado).find((x) => x.arrendadorId === 'A1')!
    expect(a1.pagado).toEqual({ n: 1, monto: 10000 })
    expect(a1.vencido).toEqual({ n: 1, monto: 10000 })
    expect(a1.pendiente).toEqual({ n: 1, monto: 10000 })
  })

  it('NADA se pierde: el total del cuadre es la suma de todos los pagos', () => {
    const r = conciliacionRenta(estado)
    const total = r.reduce((s, a) => s + a.pagado.monto + a.pendiente.monto + a.vencido.monto, 0)
    const esperado = estado.pagosRenta.reduce((s: number, p: any) => s + p.monto, 0)
    expect(total).toBe(esperado)
  })

  it('NADA se cuenta dos veces: los pagos contados son exactamente los que hay', () => {
    const r = conciliacionRenta(estado)
    const n = r.reduce((s, a) => s + a.pagado.n + a.pendiente.n + a.vencido.n, 0)
    expect(n).toBe(estado.pagosRenta.length)
  })

  it('pone primero a quien tiene deuda vencida', () => {
    expect(conciliacionRenta(estado)[0].arrendadorId).toBe('A1')
  })
})

describe('agrupación por emplazamiento', () => {
  it('un predio con dos caras es UN emplazamiento, no dos', () => {
    // Es la razón de ser del agrupador: un predio con seis caras es una
    // negociación con un propietario, no seis.
    const estado = {
      ...BASE,
      contratos: [con('C1')],
      pagosRenta: [
        pago('p1', 'C1', '2026-01', 10000, 'PAGADO'),
        pago('p2', 'C1', '2026-02', 10000, 'PENDIENTE'),
      ],
    }
    const a1 = conciliacionRenta(estado)[0]
    expect(a1.emplazamientos).toHaveLength(1)
    expect(a1.emplazamientos[0].nombre).toBe('Predio Centro')
    expect(a1.emplazamientos[0].tipo).toBe('PREDIO')
  })

  it('una pantalla suelta aparece por su propio nombre', () => {
    const estado = {
      ...BASE,
      contratos: [con('C1', { sitioId: 'S3', predioId: null })],
      pagosRenta: [pago('p1', 'C1', '2026-01', 8000, 'VENCIDO')],
    }
    const e = conciliacionRenta(estado)[0].emplazamientos[0]
    expect(e.tipo).toBe('PANTALLA')
    expect(e.nombre).toBe('Suelta')
  })

  it('dos predios del mismo propietario no se mezclan', () => {
    const estado = {
      ...BASE,
      contratos: [
        con('C1'),
        con('C2', { id: 'C2', sitioId: 'S4', predioId: 'P2', arrendadorId: 'A1' }),
      ],
      pagosRenta: [
        pago('p1', 'C1', '2026-01', 10000, 'PENDIENTE'),
        pago('p2', 'C2', '2026-01', 4000, 'PENDIENTE'),
      ],
    }
    const a1 = conciliacionRenta(estado)[0]
    expect(a1.emplazamientos).toHaveLength(2)
    expect(a1.pendiente.monto).toBe(14000)
  })

  it('cuenta los contratos del emplazamiento sin duplicar por pago', () => {
    const estado = {
      ...BASE,
      contratos: [con('C1'), con('C2', { id: 'C2' })],
      pagosRenta: [
        pago('p1', 'C1', '2026-01', 10000, 'PAGADO'),
        pago('p2', 'C1', '2026-02', 10000, 'PAGADO'),
        pago('p3', 'C2', '2026-01', 10000, 'PAGADO'),
      ],
    }
    expect(conciliacionRenta(estado)[0].emplazamientos[0].contratos).toBe(2)
  })
})

describe('el próximo periodo a pagar', () => {
  it('es el impago más ANTIGUO, que es el que urge', () => {
    const estado = {
      ...BASE,
      contratos: [con('C1')],
      pagosRenta: [
        pago('p1', 'C1', '2026-01', 10000, 'PAGADO'),
        pago('p2', 'C1', '2026-05', 10000, 'PENDIENTE'),
        pago('p3', 'C1', '2026-02', 10000, 'VENCIDO'),
      ],
    }
    expect(conciliacionRenta(estado)[0].proximoPeriodo).toBe('2026-02')
  })

  it('si todo está pagado, no hay próximo', () => {
    const estado = {
      ...BASE,
      contratos: [con('C1')],
      pagosRenta: [pago('p1', 'C1', '2026-01', 10000, 'PAGADO')],
    }
    expect(conciliacionRenta(estado)[0].proximoPeriodo).toBeNull()
  })
})

describe('casos que suelen romper un cuadre', () => {
  it('un contrato INCOMPLETO hereda el arrendador de su predio', () => {
    // Nace sin arrendador (ADR 0001). Sin la herencia, sus pagos caerían en
    // «sin asignar» aunque el predio sí tenga dueño conocido.
    const estado = {
      ...BASE,
      contratos: [con('C1', { arrendadorId: null, estatus: 'INCOMPLETO' })],
      pagosRenta: [pago('p1', 'C1', '2026-01', 10000, 'PENDIENTE')],
    }
    const r = conciliacionRenta(estado)
    expect(r).toHaveLength(1)
    expect(r[0].arrendador).toBe('Inmuebles Uno')
  })

  it('un pago huérfano se muestra aparte, no se descarta en silencio', () => {
    // Descartarlo dejaría un cuadre que parece completo y no lo está.
    const estado = {
      ...BASE,
      contratos: [],
      pagosRenta: [pago('p1', 'FANTASMA', '2026-01', 7000, 'VENCIDO')],
    }
    const r = conciliacionRenta(estado)
    expect(r).toHaveLength(1)
    expect(r[0].arrendador).toBe('Sin arrendador asignado')
    expect(r[0].vencido.monto).toBe(7000)
    expect(r[0].emplazamientos[0].nombre).toBe('Sin contrato')
  })

  it('sin pagos, no inventa filas', () => {
    expect(conciliacionRenta({ ...BASE, contratos: [con('C1')] })).toEqual([])
  })

  it('un importe nulo no rompe la suma', () => {
    const estado = {
      ...BASE,
      contratos: [con('C1')],
      pagosRenta: [pago('p1', 'C1', '2026-01', null as any, 'PENDIENTE')],
    }
    expect(conciliacionRenta(estado)[0].pendiente.monto).toBe(0)
  })
})
