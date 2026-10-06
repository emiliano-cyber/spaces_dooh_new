import { describe, it, expect } from 'vitest'
import { csvEstadoCuenta } from './estado-cuenta-csv'
import type { RespuestaResumen } from '@/lib/data/finanzas-periodo-api'

const datos: RespuestaResumen = {
  periodo: { desde: '2026-09-01', hasta: '2026-09-30', etiqueta: 'Septiembre 2026' },
  hoy: '2026-10-06',
  resumen: {
    facturado: { monto: 23200, facturas: 1 },
    cobrado: 5000,
    saldoInicial: 11600,
    saldoFinal: 29800,
    vencido: { monto: 6600, facturas: 1 },
    corte: '2026-09-30',
    renta: null,
    abonosSinFecha: 0,
  },
  movimientos: [
    { fecha: '2026-09-10', tipo: 'factura', folio: 'F2', clienteId: 'c1', cargo: 23200, abono: 0, saldo: 34800 },
    { fecha: '2026-09-20', tipo: 'abono', folio: 'F1', clienteId: 'c1', cargo: 0, abono: 5000, saldo: 29800 },
  ],
}

describe('el estado de cuenta en CSV', () => {
  it('trae el encabezado con el titular y el periodo, el resumen y los movimientos', () => {
    const csv = csvEstadoCuenta(datos, 'Acme', () => 'Acme', false)
    const lineas = csv.split('\n')
    expect(lineas[0]).toContain('Estado de cuenta')
    expect(csv).toContain('Acme')
    expect(csv).toContain('Septiembre 2026')
    expect(csv).toContain('Saldo al inicio,11600')
    expect(csv).toContain('Saldo al cierre,29800')
    expect(csv).toContain('2026-09-10,Factura,F2,23200,,34800')
    expect(csv).toContain('2026-09-20,Pago recibido,F1,,5000,29800')
  })

  it('con todos los clientes, añade la columna del cliente', () => {
    const csv = csvEstadoCuenta(datos, 'Todos los clientes', () => 'Acme', true)
    expect(csv).toContain('Fecha,Movimiento,Folio,Cliente,Cargo,Abono,Saldo')
    expect(csv).toContain('2026-09-10,Factura,F2,Acme,23200,,34800')
  })

  it('un nombre que empieza por = no llega a Excel como fórmula', () => {
    const csv = csvEstadoCuenta(datos, '=HYPERLINK("http://x")', () => '=1+1', true)
    expect(csv).not.toMatch(/(^|,)=/m)
    expect(csv).toContain("'=1+1")
  })

  it('un nombre con coma no rompe las columnas', () => {
    const csv = csvEstadoCuenta(datos, 'Acme, S.A.', () => 'Acme, S.A.', true)
    expect(csv).toContain('"Acme, S.A."')
  })
})
