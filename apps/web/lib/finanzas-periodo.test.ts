import { describe, it, expect } from 'vitest'
import {
  periodoDe,
  resumirPeriodo,
  movimientosDelPeriodo,
  type FacturaP,
  type CuotaP,
  type AbonoP,
  type RentaP,
} from './finanzas-periodo'

// ============================================================================
//  Finanzas por periodo (FIN-PER, ADR 0046).
// ----------------------------------------------------------------------------
//  El dueño pidió el 06/10 un tablero con temporalidad (mes, mes pasado,
//  trimestre, año, rango libre) y un estado de cuenta de este mes y del
//  pasado. Todo sale de aquí, que es puro, para que la pantalla, la ruta y las
//  pruebas digan lo mismo.
// ============================================================================

describe('1 · los periodos', () => {
  const HOY = '2026-10-06'

  it('mes actual: del 1 al último día del mes', () => {
    expect(periodoDe('mes', HOY)).toMatchObject({ desde: '2026-10-01', hasta: '2026-10-31' })
  })

  it('mes pasado, también cruzando de año', () => {
    expect(periodoDe('mes-anterior', HOY)).toMatchObject({ desde: '2026-09-01', hasta: '2026-09-30' })
    expect(periodoDe('mes-anterior', '2026-01-15')).toMatchObject({ desde: '2025-12-01', hasta: '2025-12-31' })
  })

  it('febrero bisiesto y no bisiesto', () => {
    expect(periodoDe('mes', '2028-02-10').hasta).toBe('2028-02-29')
    expect(periodoDe('mes', '2026-02-10').hasta).toBe('2026-02-28')
  })

  it('trimestre actual y anterior (oct-dic, jul-sep), y el anterior al primero', () => {
    expect(periodoDe('trimestre', HOY)).toMatchObject({ desde: '2026-10-01', hasta: '2026-12-31' })
    expect(periodoDe('trimestre-anterior', HOY)).toMatchObject({ desde: '2026-07-01', hasta: '2026-09-30' })
    expect(periodoDe('trimestre-anterior', '2026-02-01')).toMatchObject({ desde: '2025-10-01', hasta: '2025-12-31' })
  })

  it('año: del 1 de enero al 31 de diciembre', () => {
    expect(periodoDe('anio', HOY)).toMatchObject({ desde: '2026-01-01', hasta: '2026-12-31' })
  })

  it('rango libre: el que se da, y al revés se ordena', () => {
    expect(periodoDe('rango', HOY, { desde: '2026-03-05', hasta: '2026-04-20' })).toMatchObject({
      desde: '2026-03-05', hasta: '2026-04-20',
    })
    expect(periodoDe('rango', HOY, { desde: '2026-04-20', hasta: '2026-03-05' })).toMatchObject({
      desde: '2026-03-05', hasta: '2026-04-20',
    })
  })

  it('rango sin fechas válidas es un error, no un periodo inventado', () => {
    expect(() => periodoDe('rango', HOY, { desde: 'ayer', hasta: '2026-04-20' })).toThrow()
    expect(() => periodoDe('rango', HOY)).toThrow()
  })

  it('cada periodo trae una etiqueta legible', () => {
    expect(periodoDe('mes', HOY).etiqueta).toBe('Octubre 2026')
    expect(periodoDe('trimestre', HOY).etiqueta).toBe('4.º trimestre 2026')
    expect(periodoDe('anio', HOY).etiqueta).toBe('2026')
  })
})

// Un cliente con dos facturas:
//   F1 · 11 600 emitida el 15/08, una sola cuota que vence el 14/09.
//        Pagó 5 000 el 20/09 y 6 600 el 05/10 → liquidada en octubre.
//   F2 · 23 200 emitida el 10/09, dos cuotas de 11 600 (vencen 10/10 y 10/11).
//        Nada pagado.
//   F3 · ANULADA, emitida el 12/09 por 50 000: no cuenta para nada.
// Y otro cliente con F4 · 1 000 emitida el 02/10, sin pagar, vence el 01/11.
const facturas: FacturaP[] = [
  { id: 'f1', folio: 'F1', clienteId: 'c1', fecha: '2026-08-15', monto: 11600, anulada: false },
  { id: 'f2', folio: 'F2', clienteId: 'c1', fecha: '2026-09-10', monto: 23200, anulada: false },
  { id: 'f3', folio: 'F3', clienteId: 'c1', fecha: '2026-09-12', monto: 50000, anulada: true },
  { id: 'f4', folio: 'F4', clienteId: 'c2', fecha: '2026-10-02', monto: 1000, anulada: false },
]
const cuotas: CuotaP[] = [
  { id: 'q1', facturaId: 'f1', vence: '2026-09-14', monto: 11600 },
  { id: 'q2a', facturaId: 'f2', vence: '2026-10-10', monto: 11600 },
  { id: 'q2b', facturaId: 'f2', vence: '2026-11-10', monto: 11600 },
  { id: 'q3', facturaId: 'f3', vence: '2026-10-12', monto: 50000 },
  { id: 'q4', facturaId: 'f4', vence: '2026-11-01', monto: 1000 },
]
const abonos: AbonoP[] = [
  { cobranzaId: 'q1', monto: 5000, fecha: '2026-09-20' },
  { cobranzaId: 'q1', monto: 6600, fecha: '2026-10-05' },
]
const rentas: RentaP[] = [
  { monto: 8000, periodo: '2026-09-01', pagada: true, fechaPago: '2026-09-03' },
  { monto: 8000, periodo: '2026-10-01', pagada: true, fechaPago: '2026-10-02' },
  { monto: 8000, periodo: '2026-10-15', pagada: false, fechaPago: null },
]
const datos = { facturas, cuotas, abonos, rentas }

describe('2 · el resumen de un periodo', () => {
  const sep = { desde: '2026-09-01', hasta: '2026-09-30' }
  const oct = { desde: '2026-10-01', hasta: '2026-10-31' }

  it('facturado: lo emitido EN el periodo, sin anuladas', () => {
    expect(resumirPeriodo(datos, sep, '2026-10-06').facturado).toEqual({ monto: 23200, facturas: 1 })
    expect(resumirPeriodo(datos, oct, '2026-10-06').facturado).toEqual({ monto: 1000, facturas: 1 })
  })

  it('cobrado: lo que ENTRÓ en el periodo, por la fecha del abono', () => {
    expect(resumirPeriodo(datos, sep, '2026-10-06').cobrado).toBe(5000)
    expect(resumirPeriodo(datos, oct, '2026-10-06').cobrado).toBe(6600)
  })

  it('saldo inicial + facturado − cobrado = saldo final', () => {
    const r = resumirPeriodo(datos, sep, '2026-10-06')
    expect(r.saldoInicial).toBe(11600) // F1 entera, emitida en agosto
    expect(r.saldoFinal).toBe(11600 + 23200 - 5000)
    const o = resumirPeriodo(datos, oct, '2026-10-06')
    expect(o.saldoInicial).toBe(r.saldoFinal) // el final de un mes es el inicio del siguiente
    expect(o.saldoFinal).toBe(r.saldoFinal + 1000 - 6600)
  })

  it('vencido al cierre de un periodo pasado: lo que se debía y ya había vencido ese día', () => {
    // 30/09: F1 venció el 14/09 y solo tenía pagados 5 000 → 6 600 vencidos.
    expect(resumirPeriodo(datos, sep, '2026-10-06').vencido).toEqual({ monto: 6600, facturas: 1 })
  })

  it('vencido de un periodo en curso se mide a HOY, no a fin de mes', () => {
    // A hoy (06/10) F1 ya está pagada y la primera cuota de F2 vence el 10/10:
    // no hay nada vencido. Medir al 31/10 contaría como vencido lo que no lo está.
    expect(resumirPeriodo(datos, oct, '2026-10-06').vencido).toEqual({ monto: 0, facturas: 0 })
    expect(resumirPeriodo(datos, oct, '2026-10-15').vencido).toEqual({ monto: 11600, facturas: 1 })
  })

  it('una factura pagada NO cuenta como vencida aunque su fecha haya pasado', () => {
    // Es el mismo pedido del 06/10 que la etiqueta de la cuota.
    expect(resumirPeriodo(datos, oct, '2026-10-08').vencido.facturas).toBe(0)
  })

  it('renta: pagada por fecha de pago, por pagar por periodo', () => {
    expect(resumirPeriodo(datos, oct, '2026-10-06').renta).toEqual({ pagada: 8000, porPagar: 8000 })
    expect(resumirPeriodo(datos, sep, '2026-10-06').renta).toEqual({ pagada: 8000, porPagar: 0 })
  })

  it('la renta de septiembre pagada en octubre sale como pagada EN OCTUBRE', () => {
    // Lo encontró un mutante que sobrevivía: con periodo y fecha de pago en el
    // mismo mes, contar por uno o por otro daba igual y nadie lo veía.
    const tarde = { ...datos, rentas: [{ monto: 5000, periodo: '2026-09-15', pagada: true, fechaPago: '2026-10-03' }] }
    expect(resumirPeriodo(tarde, sep, '2026-10-06').renta).toEqual({ pagada: 0, porPagar: 0 })
    expect(resumirPeriodo(tarde, oct, '2026-10-06').renta).toEqual({ pagada: 5000, porPagar: 0 })
  })

  it('por cliente: solo sus facturas y sus cobros, y sin renta', () => {
    const r = resumirPeriodo(datos, oct, '2026-10-06', 'c2')
    expect(r.facturado).toEqual({ monto: 1000, facturas: 1 })
    expect(r.cobrado).toBe(0)
    expect(r.saldoInicial).toBe(0)
    expect(r.renta).toBeNull()
  })

  it('un abono histórico sin fecha se fecha con su FACTURA, y se avisa', () => {
    // F2 se emitió el 10/09: el abono sin fecha cae en septiembre, no en
    // octubre, y queda marcado como aproximado.
    const conHistorico = { ...datos, abonos: [...abonos, { cobranzaId: 'q2a', monto: 1000, fecha: null }] }
    const s = resumirPeriodo(conHistorico, sep, '2026-10-06')
    expect(s.cobrado).toBe(5000 + 1000)
    expect(s.abonosSinFecha).toBe(1000)
    const o = resumirPeriodo(conHistorico, oct, '2026-10-06')
    expect(o.cobrado).toBe(6600)
    expect(o.abonosSinFecha).toBe(0)
    expect(o.saldoInicial).toBe(s.saldoFinal)
  })

  it('un periodo que contiene la factura con abono histórico NO arranca en negativo', () => {
    // Lo encontró sembrar ejemplos el 06/10: tratando el abono sin fecha como
    // «anterior a todo», el año salía con saldo inicial de −4 640.
    const d = {
      facturas: [{ id: 'h', folio: 'H', clienteId: 'c', fecha: '2026-06-20', monto: 4640, anulada: false }],
      cuotas: [{ id: 'qh', facturaId: 'h', vence: '2026-07-20', monto: 4640 }],
      abonos: [{ cobranzaId: 'qh', monto: 4640, fecha: null }],
      rentas: [],
    }
    const anio = resumirPeriodo(d, { desde: '2026-01-01', hasta: '2026-12-31' }, '2026-10-06')
    expect(anio.saldoInicial).toBe(0)
    expect(anio.saldoFinal).toBe(0)
    expect(anio.cobrado).toBe(4640)
  })

  it('en los movimientos, el abono histórico sale en la fecha de su factura y marcado', () => {
    const conHistorico = { ...datos, abonos: [...abonos, { cobranzaId: 'q2a', monto: 1000, fecha: null }] }
    const m = movimientosDelPeriodo(conHistorico, sep, 'c1')
    const h = m.find((x) => x.tipo === 'abono' && x.aproximado)
    expect(h).toMatchObject({ fecha: '2026-09-10', folio: 'F2', abono: 1000 })
  })

  it('los importes no arrastran centavos de coma flotante', () => {
    const d = {
      facturas: [{ id: 'x', folio: 'X', clienteId: 'c', fecha: '2026-10-01', monto: 0.1, anulada: false },
        { id: 'y', folio: 'Y', clienteId: 'c', fecha: '2026-10-01', monto: 0.2, anulada: false }],
      cuotas: [], abonos: [], rentas: [],
    }
    expect(resumirPeriodo(d, oct, '2026-10-06').facturado.monto).toBe(0.3)
  })
})

describe('3 · los movimientos del estado de cuenta', () => {
  it('cargos y abonos del periodo, en orden, con el saldo corrido', () => {
    const m = movimientosDelPeriodo(datos, { desde: '2026-09-01', hasta: '2026-09-30' }, 'c1')
    expect(m.map((x) => [x.fecha, x.tipo, x.folio, x.cargo, x.abono, x.saldo])).toEqual([
      ['2026-09-10', 'factura', 'F2', 23200, 0, 11600 + 23200],
      ['2026-09-20', 'abono', 'F1', 0, 5000, 11600 + 23200 - 5000],
    ])
  })

  it('la factura anulada no aparece', () => {
    const m = movimientosDelPeriodo(datos, { desde: '2026-09-01', hasta: '2026-09-30' })
    expect(m.some((x) => x.folio === 'F3')).toBe(false)
  })
})
