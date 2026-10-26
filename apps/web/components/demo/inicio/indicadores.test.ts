import { describe, it, expect } from 'vitest'
import {
  antiguedadCobranza,
  pipelineComercial,
  huecosProximos,
  ordenarAlertas,
  tonoPinHoy,
  precioDesdeRespuesta,
} from './indicadores'

// ============================================================================
//  DASH-REF (26/10) · Lo que los referentes del sector ponen en el inicio y el
//  Dashboard no tenía: cobranza por antigüedad, pipeline comercial, huecos por
//  renovar, alertas por gravedad, cuánto de la tarifa se cobra y el pin del
//  mapa por lo que pasa HOY. Ver `vault/03-Frontend/dashboard-inicio.md`.
// ============================================================================

const HOY = new Date(2026, 9, 26, 10, 0) // 26 oct 2026, hora local

// ─── 3 · Por cobrar por antigüedad ─────────────────────────────────────────
describe('antiguedadCobranza', () => {
  const fac = { id: 'F1', monto: 1000 }
  const cob = (id: string, venc: string, over: Record<string, unknown> = {}) => ({
    id, facturaId: 'F1', fechaVencimiento: venc, estatus: 'AL_CORRIENTE', montoPagado: 0, ...over,
  })

  it('reparte el saldo por días de atraso, y lo que no ha vencido va aparte', () => {
    const r = antiguedadCobranza(
      [
        cob('a', '2026-11-10'), // no vence aún
        cob('b', '2026-10-26'), // vence HOY: todavía no está vencida
        cob('c', '2026-10-25'), // 1 día
        cob('d', '2026-09-26'), // 30 días
        cob('e', '2026-09-25'), // 31 días
        cob('f', '2026-07-28'), // 90 días
        cob('g', '2026-07-27'), // 91 días
      ] as any,
      [fac] as any,
      HOY,
    )
    const m = Object.fromEntries(r.tramos.map((t) => [t.clave, t.monto]))
    expect(m).toEqual({ corriente: 2000, d1_30: 2000, d31_60: 1000, d61_90: 1000, d90: 1000 })
    expect(r.total).toBe(7000)
    expect(r.vencido).toBe(5000)
  })

  it('usa el SALDO (lo abonado se descuenta) y la cuota de una parcialidad', () => {
    const r = antiguedadCobranza(
      [cob('a', '2026-10-01', { montoPagado: 400 }), cob('b', '2026-10-01', { monto: 250 })] as any,
      [fac] as any,
      HOY,
    )
    expect(r.total).toBe(600 + 250)
  })

  it('NEGATIVO · lo PAGADO y los saldos en cero no entran', () => {
    const r = antiguedadCobranza(
      [cob('a', '2026-01-01', { estatus: 'PAGADA' }), cob('b', '2026-01-01', { montoPagado: 1000 })] as any,
      [fac] as any,
      HOY,
    )
    expect(r.total).toBe(0)
    expect(r.vencido).toBe(0)
  })
})

// ─── 4 · Pipeline comercial ────────────────────────────────────────────────
describe('pipelineComercial', () => {
  const p = (id: string, estatus: string, over: Record<string, unknown> = {}) => ({
    id, estatus, neto: 1000, netoAprobado: 0, vendedorId: null, aprobadaEn: null, rechazadaEn: null, ...over,
  })
  const usuarios = [
    { id: 'U1', nombre: 'Ana' },
    { id: 'U2', nombre: 'Beto' },
  ]

  it('abierto = borradores y enviadas, por su neto', () => {
    const r = pipelineComercial([p('1', 'BORRADOR'), p('2', 'ENVIADA', { neto: 500 }), p('3', 'APROBADA')] as any, usuarios, HOY)
    expect(r.abierto).toEqual({ n: 2, valor: 1500, enviadas: 1 })
  })

  it('ganado del MES por la fecha de aprobación, con lo APROBADO; y por vendedor', () => {
    const r = pipelineComercial(
      [
        p('1', 'APROBADA', { aprobadaEn: '2026-10-03T18:00:00Z', netoAprobado: 800, vendedorId: 'U1' }),
        p('2', 'APROBADA', { aprobadaEn: '2026-10-20T18:00:00Z', netoAprobado: 300, vendedorId: 'U2' }),
        p('3', 'APROBADA', { aprobadaEn: '2026-10-21T18:00:00Z', netoAprobado: 900, vendedorId: 'U2' }),
        // De septiembre: no es de este mes.
        p('4', 'APROBADA', { aprobadaEn: '2026-09-30T18:00:00Z', netoAprobado: 5000, vendedorId: 'U1' }),
        p('5', 'APROBADA', { aprobadaEn: '2026-10-05T18:00:00Z', netoAprobado: 100, vendedorId: null }),
      ] as any,
      usuarios,
      HOY,
    )
    expect(r.ganadoMes).toEqual({ n: 4, valor: 2100 })
    expect(r.porVendedor).toEqual([
      { nombre: 'Beto', n: 2, valor: 1200 },
      { nombre: 'Ana', n: 1, valor: 800 },
      { nombre: 'Sin vendedor', n: 1, valor: 100 },
    ])
  })

  it('NEGATIVO · un vendedor cuyo nombre no llega NO es «Sin vendedor»; quien está en sesión se reconoce', () => {
    // Visto en el navegador el 26/10: la lista de usuarios solo viaja a quien ve
    // `operaciones` (`app/api/estado/route.ts`), así que a un VENDEDOR le llega
    // vacía y las tres propuestas, todas con vendedor, salían como «Sin
    // vendedor». Afirmaba un dato falso.
    const r = pipelineComercial(
      [
        p('1', 'APROBADA', { aprobadaEn: '2026-10-03T18:00:00Z', netoAprobado: 800, vendedorId: 'U1' }),
        p('2', 'APROBADA', { aprobadaEn: '2026-10-04T18:00:00Z', netoAprobado: 300, vendedorId: 'U2' }),
        p('3', 'APROBADA', { aprobadaEn: '2026-10-05T18:00:00Z', netoAprobado: 100, vendedorId: null }),
      ] as any,
      [],
      HOY,
      { id: 'U1', nombre: 'Ana' },
    )
    expect(r.porVendedor).toEqual([
      { nombre: 'Ana', n: 1, valor: 800 },
      { nombre: 'Otros vendedores', n: 1, valor: 300 },
      { nombre: 'Sin vendedor', n: 1, valor: 100 },
    ])
  })

  it('NEGATIVO · una aprobada SIN fecha (anterior al 09/10) no cuenta como ganada este mes', () => {
    const r = pipelineComercial([p('1', 'APROBADA', { netoAprobado: 900 })] as any, usuarios, HOY)
    expect(r.ganadoMes).toEqual({ n: 0, valor: 0 })
  })

  it('tasa de cierre de los últimos 90 días; sin decisiones es null, no 0 %', () => {
    const r = pipelineComercial(
      [
        p('1', 'APROBADA', { aprobadaEn: '2026-10-01T12:00:00Z' }),
        p('2', 'RECHAZADA', { rechazadaEn: '2026-09-01T12:00:00Z' }),
        p('3', 'RECHAZADA', { rechazadaEn: '2026-08-15T12:00:00Z' }),
        // Hace más de 90 días: fuera.
        p('4', 'RECHAZADA', { rechazadaEn: '2026-06-01T12:00:00Z' }),
      ] as any,
      usuarios,
      HOY,
    )
    expect(r.tasaCierre).toBeCloseTo(1 / 3, 6)
    expect(pipelineComercial([] as any, usuarios, HOY).tasaCierre).toBeNull()
  })
})

// ─── 5 · Huecos y renovaciones ─────────────────────────────────────────────
describe('huecosProximos', () => {
  const sitios = [
    { id: 'FIJA', nombre: 'Espectacular Reforma', tipoMedio: 'ESPECTACULAR' },
    { id: 'DIG', nombre: 'Pantalla Insurgentes', tipoMedio: 'PANTALLA_DIGITAL' },
  ]
  const campanas = [
    { id: 'C1', nombre: 'Verano', clienteId: 'K1' },
    { id: 'C2', nombre: 'Otoño', clienteId: 'K2' },
    { id: 'C3', nombre: 'Verano II', clienteId: 'K1' },
  ]
  const clientes = [
    { id: 'K1', nombre: 'Refrescos SA' },
    { id: 'K2', nombre: 'Banco SA' },
  ]
  const r = (id: string, sitioId: string, campanaId: string, ini: string, fin: string, over: Record<string, unknown> = {}) => ({
    id, sitioId, campanaId, fechaInicio: ini, fechaFin: fin, estatus: 'CONFIRMADA', spotsReservados: null, ...over,
  })
  const datos = (reservas: unknown[]) => ({ sitios, campanas, clientes, reservas }) as any

  it('una cara fija que se queda sin campaña en la ventana es un hueco, con el cliente que sale', () => {
    const h = huecosProximos(datos([r('R1', 'FIJA', 'C1', '2026-09-01', '2026-11-05')]), HOY)
    expect(h).toEqual([
      {
        sitioId: 'FIJA', sitioNombre: 'Espectacular Reforma', campanaId: 'C1', campanaNombre: 'Verano',
        clienteNombre: 'Refrescos SA', fechaFin: '2026-11-05', dias: 10, digital: false, slots: null,
      },
    ])
  })

  it('NEGATIVO · si otra campaña toma la cara al día siguiente, no hay hueco', () => {
    const h = huecosProximos(
      datos([r('R1', 'FIJA', 'C1', '2026-09-01', '2026-11-05'), r('R2', 'FIJA', 'C2', '2026-11-06', '2026-12-31')]),
      HOY,
    )
    expect(h).toEqual([])
  })

  it('NEGATIVO · una reserva TENTATIVA que ya apartó el relevo también cuenta', () => {
    const h = huecosProximos(
      datos([
        r('R1', 'FIJA', 'C1', '2026-09-01', '2026-11-05'),
        r('R2', 'FIJA', 'C2', '2026-11-06', '2026-12-31', { estatus: 'TENTATIVA' }),
      ]),
      HOY,
    )
    expect(h).toEqual([])
  })

  it('en una digital los slots que libera una campaña son un hueco aunque haya otras al aire', () => {
    const h = huecosProximos(
      datos([
        r('R1', 'DIG', 'C1', '2026-09-01', '2026-11-01', { spotsReservados: 2 }),
        r('R2', 'DIG', 'C2', '2026-09-01', '2026-12-31', { spotsReservados: 3 }),
      ]),
      HOY,
    )
    expect(h.map((x) => [x.campanaId, x.digital, x.slots, x.dias])).toEqual([['C1', true, 2, 6]])
  })

  it('NEGATIVO · en una digital, si el MISMO cliente renueva, no es hueco', () => {
    const h = huecosProximos(
      datos([
        r('R1', 'DIG', 'C1', '2026-09-01', '2026-11-01', { spotsReservados: 2 }),
        r('R2', 'DIG', 'C3', '2026-11-02', '2026-12-31', { spotsReservados: 2 }),
      ]),
      HOY,
    )
    expect(h).toEqual([])
  })

  it('NEGATIVO · lo que ya terminó, lo que termina después de la ventana y lo cancelado no entran', () => {
    const h = huecosProximos(
      datos([
        r('R1', 'FIJA', 'C1', '2026-09-01', '2026-10-25'),
        r('R2', 'FIJA', 'C1', '2026-09-01', '2026-12-31'),
        r('R3', 'DIG', 'C2', '2026-09-01', '2026-11-01', { estatus: 'CANCELADA' }),
      ]),
      HOY,
    )
    expect(h).toEqual([])
  })

  it('ordena por lo más próximo', () => {
    const h = huecosProximos(
      datos([r('R1', 'FIJA', 'C1', '2026-09-01', '2026-11-20'), r('R2', 'DIG', 'C2', '2026-09-01', '2026-10-28')]),
      HOY,
    )
    expect(h.map((x) => x.dias)).toEqual([2, 25])
  })
})

// ─── 6 · Alertas por gravedad ──────────────────────────────────────────────
describe('ordenarAlertas', () => {
  it('rojas primero, y dentro de cada nivel se respeta el orden en que se generaron', () => {
    const a = (id: string, nivel: string, tipo = 'pago') => ({ id, nivel, tipo, titulo: id, detalle: '' })
    const r = ordenarAlertas([a('1', 'ambar'), a('2', 'rojo', 'ot'), a('3', 'ambar', 'cobranza'), a('4', 'rojo', 'cobranza')] as any[])
    expect(r.map((x) => x.id)).toEqual(['2', '4', '1', '3'])
  })
})

// ─── 8 · El pin del mapa, por lo que pasa HOY ──────────────────────────────
describe('tonoPinHoy', () => {
  const fija = { id: 'S', tipoMedio: 'ESPECTACULAR', esRotativo: false, exhibicion: 'fijo' }
  const res = (estatus: string, ini = '2026-10-01', fin = '2026-10-31') => ({ sitioId: 'S', estatus, fechaInicio: ini, fechaFin: fin })

  it('fija con reserva confirmada que cubre hoy → ocupada (rojo)', () => {
    expect(tonoPinHoy(fija, [res('CONFIRMADA')] as any, HOY)).toBe('rojo')
  })
  it('fija solo apartada hoy → ámbar', () => {
    expect(tonoPinHoy(fija, [res('TENTATIVA')] as any, HOY)).toBe('ambar')
  })
  it('NEGATIVO · una confirmada que ya terminó, o cancelada, no la ocupa', () => {
    expect(tonoPinHoy(fija, [res('CONFIRMADA', '2026-09-01', '2026-10-25'), res('CANCELADA')] as any, HOY)).toBe('verde')
  })
  it('una digital sigue en azul', () => {
    expect(tonoPinHoy({ ...fija, tipoMedio: 'PANTALLA_DIGITAL' }, [res('CONFIRMADA')] as any, HOY)).toBe('azul')
  })
})

// ─── 7 · Cuánto de la tarifa publicada se cobra ────────────────────────────
describe('precioDesdeRespuesta', () => {
  const tarifas = { reservasConTarifa: 4, reservasSinTarifa: 1, ingresoLista: 100000, ingresoComparable: 82000, ingresoSinTarifa: 5000, nota: 'x' }

  it('200 → el porcentaje cobrado de la tarifa de lista, y cuántas reservas lo respaldan', () => {
    expect(precioDesdeRespuesta(200, { tarifas })).toEqual({ fase: 'datos', pct: 82, conTarifa: 4, sinTarifa: 1 })
  })
  it('NEGATIVO · sin tarifa de lista con la que comparar es «sin datos», no 0 %', () => {
    expect(precioDesdeRespuesta(200, { tarifas: { ...tarifas, ingresoLista: 0, reservasConTarifa: 0 } })).toEqual({ fase: 'sin-datos' })
  })
  it('403 es sin acceso y un cuerpo roto es error', () => {
    expect(precioDesdeRespuesta(403, null)).toEqual({ fase: 'sin-acceso' })
    expect(precioDesdeRespuesta(200, {})).toEqual({ fase: 'error' })
  })
})
