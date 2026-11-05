import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { csvEstadoCuenta, nombreArchivoEstadoCuenta } from './estado-cuenta-csv'
import { fijarMonedaInstancia } from '@/lib/i18n/dinero'
import type { RespuestaResumen } from '@/lib/data/finanzas-periodo-api'

// ============================================================================
//  Ola 7 · el CSV del estado de cuenta, en el IDIOMA DE LA PANTALLA
//  (decision del dueño, 2026-11-03).
// ----------------------------------------------------------------------------
//  · En espanol, BYTE A BYTE el CSV de antes: los dos textos de abajo se
//    sacaron del codigo de `d4fe7883`, antes de tocarlo.
//  · En ingles: encabezados, tipos de movimiento y textos fijos en ingles; las
//    fechas como «Sep 1, 2026»; el periodo en ingles; la moneda (`MX$`) en el
//    encabezado de cada importe. Los importes siguen siendo NUMEROS (punto
//    decimal, sin miles), para que Excel los sume y para que un saldo negativo
//    no llegue como «-MX$…», que Excel lee como formula.
//  · Los datos (titular, folios, nombres) no cambian.
// ============================================================================

const datos = {
  periodo: { desde: '2026-09-01', hasta: '2026-09-30', etiqueta: 'Septiembre 2026' },
  hoy: '2026-10-06',
  resumen: {
    facturado: { monto: 23200, facturas: 1 }, cobrado: 5000.5, saldoInicial: 11600, saldoFinal: 29800,
    vencido: { monto: 6600, facturas: 1 }, corte: '2026-09-30', renta: null, abonosSinFecha: 0,
  },
  movimientos: [
    { fecha: '2026-09-10', tipo: 'factura', folio: 'F2', clienteId: 'c1', cargo: 23200, abono: 0, saldo: 34800 },
    { fecha: '2026-09-20', tipo: 'abono', folio: 'F1', clienteId: 'c1', cargo: 0, abono: 5000.5, saldo: 29799.5 },
    { fecha: '2026-09-30', tipo: 'abono', aproximado: true, folio: 'F3, "x"', clienteId: 'c2', cargo: 0, abono: 100, saldo: -100 },
  ],
} as unknown as RespuestaResumen
const nombre = (id: string) => (id === 'c1' ? 'Acme' : '=Beta')

const ES_CON_CLIENTE =
  'Estado de cuenta,"Acme, S.A."\nPeriodo,Septiembre 2026,2026-09-01,2026-09-30\n\nSaldo al inicio,11600\nFacturado,23200\nCobrado,5000.5\nSaldo al cierre,29800\nVencido al 2026-09-30,6600\n\nFecha,Movimiento,Folio,Cliente,Cargo,Abono,Saldo\n2026-09-10,Factura,F2,Acme,23200,,34800\n2026-09-20,Pago recibido,F1,Acme,,5000.5,29799.5\n2026-09-30,Pago recibido (fecha aproximada),"F3, ""x""",\'=Beta,,100,-100'
const ES_SIN_CLIENTE =
  'Estado de cuenta,Acme\nPeriodo,Septiembre 2026,2026-09-01,2026-09-30\n\nSaldo al inicio,11600\nFacturado,23200\nCobrado,5000.5\nSaldo al cierre,29800\nVencido al 2026-09-30,6600\n\nFecha,Movimiento,Folio,Cargo,Abono,Saldo\n2026-09-10,Factura,F2,23200,,34800\n2026-09-20,Pago recibido,F1,,5000.5,29799.5\n2026-09-30,Pago recibido (fecha aproximada),"F3, ""x""",,100,-100'

afterEach(() => fijarMonedaInstancia('MXN'))

describe('estado de cuenta en CSV · en espanol, byte a byte el de antes', () => {
  it('con la columna del cliente (todos los clientes)', () => {
    expect(csvEstadoCuenta(datos, 'Acme, S.A.', nombre, true)).toBe(ES_CON_CLIENTE)
    expect(csvEstadoCuenta(datos, 'Acme, S.A.', nombre, true, 'es')).toBe(ES_CON_CLIENTE)
  })
  it('de un cliente', () => {
    expect(csvEstadoCuenta(datos, 'Acme', () => 'Acme', false, 'es')).toBe(ES_SIN_CLIENTE)
  })
  it('el nombre del archivo', () => {
    expect(nombreArchivoEstadoCuenta('2026-09-01', false)).toBe('estado-de-cuenta-2026-09.csv')
    expect(nombreArchivoEstadoCuenta('2026-09-01', true, 'es')).toBe('estado-de-cuenta-2026-09-cliente.csv')
  })
})

describe('estado de cuenta en CSV · en ingles, en el idioma de la pantalla', () => {
  it('con la columna del cliente', () => {
    expect(csvEstadoCuenta(datos, 'Acme, S.A.', nombre, true, 'en')).toBe(
      [
        'Account statement,"Acme, S.A."',
        'Period,September 2026,"Sep 1, 2026","Sep 30, 2026"',
        '',
        'Opening balance (MX$),11600',
        'Invoiced (MX$),23200',
        'Collected (MX$),5000.5',
        'Closing balance (MX$),29800',
        '"Overdue as of Sep 30, 2026 (MX$)",6600',
        '',
        'Date,Transaction,Invoice no.,Client,Charge (MX$),Payment (MX$),Balance (MX$)',
        '"Sep 10, 2026",Invoice,F2,Acme,23200,,34800',
        '"Sep 20, 2026",Payment received,F1,Acme,,5000.5,29799.5',
        '"Sep 30, 2026",Payment received (approximate date),"F3, ""x""",\'=Beta,,100,-100',
      ].join('\n'),
    )
  })
  it('de un cliente: sin la columna', () => {
    const csv = csvEstadoCuenta(datos, 'Acme', () => 'Acme', false, 'en')
    expect(csv).toContain('\nDate,Transaction,Invoice no.,Charge (MX$),Payment (MX$),Balance (MX$)\n')
    expect(csv).toContain('\n"Sep 10, 2026",Invoice,F2,23200,,34800\n')
  })
  it('una instancia en dolares: «$» en ingles', () => {
    fijarMonedaInstancia('USD')
    expect(csvEstadoCuenta(datos, 'Acme', () => 'Acme', false, 'en')).toContain('Opening balance ($),11600')
  })
  it('sin una palabra de espanol fuera de los datos', () => {
    const csv = csvEstadoCuenta(datos, 'Acme', () => 'Acme', false, 'en')
    expect(csv).not.toMatch(/Estado|Periodo|Saldo|Facturado|Cobrado|Vencido|Fecha|Movimiento|Folio|Cargo|Abono|Pago|Factura|Septiembre|\d{4}-\d{2}-\d{2}/)
  })
  it('el nombre del archivo', () => {
    expect(nombreArchivoEstadoCuenta('2026-09-01', false, 'en')).toBe('account-statement-2026-09.csv')
    expect(nombreArchivoEstadoCuenta('2026-09-01', true, 'en')).toBe('account-statement-2026-09-client.csv')
  })
  it('la pantalla pasa su idioma al CSV y al nombre del archivo', () => {
    const fuente = readFileSync(join(process.cwd(), 'components/demo/finanzas/EstadoCuenta.tsx'), 'utf8')
    expect(fuente).toContain('csvEstadoCuenta(datos, titular, nombreCliente, !cliente, idioma)')
    expect(fuente).toContain('nombreArchivoEstadoCuenta(datos.periodo.desde, !!cliente, idioma)')
  })
})

// Lote L4 del italiano (2026-11-03): la misma decision que en ingles —el CSV
// en el idioma de la pantalla—, con fechas y periodo italianos («10 set 2026»,
// «settembre 2026») y la moneda en el ENCABEZADO. Validacion del L4: SOLO en
// italiano, separador «;» e importes con coma decimal, que es lo que una Excel
// con configuracion italiana abre con doble clic (con «,» lo metia todo en una
// columna y leia «5000.5» como texto). El importe sigue siendo un NUMERO, y un
// texto que empieza por = + - @ sigue neutralizado. Espanol e ingles, byte a
// byte los de arriba.
describe('estado de cuenta en CSV · en italiano, para una Excel italiana', () => {
  it('con la columna del cliente', () => {
    expect(csvEstadoCuenta(datos, 'Acme, S.A.', nombre, true, 'it')).toBe(
      [
        'Estratto conto;Acme, S.A.',
        'Periodo;settembre 2026;1 set 2026;30 set 2026',
        '',
        'Saldo iniziale (MX$);11600',
        'Fatturato (MX$);23200',
        'Incassato (MX$);5000,5',
        'Saldo finale (MX$);29800',
        'Scaduto al giorno 30 set 2026 (MX$);6600',
        '',
        'Data;Movimento;N. fattura;Cliente;Addebito (MX$);Accredito (MX$);Saldo (MX$)',
        '10 set 2026;Fattura;F2;Acme;23200;;34800',
        '20 set 2026;Pagamento ricevuto;F1;Acme;;5000,5;29799,5',
        '30 set 2026;Pagamento ricevuto (data approssimativa);"F3, ""x""";\'=Beta;;100;-100',
      ].join('\n'),
    )
  })
  it('un texto con «;» va entre comillas, y uno que empieza por = sigue neutralizado', () => {
    const csv = csvEstadoCuenta(datos, '=Acme; S.A.', () => 'Acme', false, 'it')
    expect(csv.split('\n')[0]).toBe('Estratto conto;"\'=Acme; S.A."')
  })
  it('de un cliente: sin la columna', () => {
    const csv = csvEstadoCuenta(datos, 'Acme', () => 'Acme', false, 'it')
    expect(csv).toContain('\nData;Movimento;N. fattura;Addebito (MX$);Accredito (MX$);Saldo (MX$)\n')
    expect(csv).toContain('\n10 set 2026;Fattura;F2;23200;;34800\n')
  })
  it('una instancia en dolares: «US$» en italiano', () => {
    fijarMonedaInstancia('USD')
    expect(csvEstadoCuenta(datos, 'Acme', () => 'Acme', false, 'it')).toContain('Saldo iniziale (US$);11600')
  })
  it('sin una palabra de espanol ni de ingles fuera de los datos', () => {
    const csv = csvEstadoCuenta(datos, 'Acme', () => 'Acme', false, 'it')
    expect(csv).not.toMatch(/Estado|Facturado|Cobrado|Vencido|Fecha|Movimiento,Folio|Cargo|Abono|Pago |Factura,|Septiembre|\d{4}-\d{2}-\d{2}/)
    expect(csv).not.toMatch(/Account|Period,|Opening|Invoiced|Collected|Closing|Overdue|Date|Transaction|Invoice|Charge|Payment|Balance|September|Sep \d/)
  })
  it('el nombre del archivo', () => {
    expect(nombreArchivoEstadoCuenta('2026-09-01', false, 'it')).toBe('estratto-conto-2026-09.csv')
    expect(nombreArchivoEstadoCuenta('2026-09-01', true, 'it')).toBe('estratto-conto-2026-09-cliente.csv')
  })
})

// Lote L4 del portugues (2026-11-05), H4 de la validacion de la ola 0: una
// Excel con configuracion brasilena, como la italiana, espera «;» y coma
// decimal; con la coma de siempre lo mete todo en una columna y lee «5000.5»
// como texto. Lo mismo que el italiano: el importe sigue siendo un NUMERO (sin
// miles ni simbolo), la moneda va en el ENCABEZADO («MX$», «US$» en pt-BR) y
// un texto que empieza por = + - @ sigue neutralizado. Fechas y periodo en
// pt-BR. Espanol, ingles e italiano, byte a byte los de arriba.
describe('estado de cuenta en CSV · en portugues, para una Excel brasilena', () => {
  it('con la columna del cliente', () => {
    expect(csvEstadoCuenta(datos, 'Acme, S.A.', nombre, true, 'pt')).toBe(
      [
        'Extrato;Acme, S.A.',
        'Período;setembro de 2026;1 de set. de 2026;30 de set. de 2026',
        '',
        'Saldo inicial (MX$);11600',
        'Faturado (MX$);23200',
        'Recebido (MX$);5000,5',
        'Saldo final (MX$);29800',
        'Vencido até 30 de set. de 2026 (MX$);6600',
        '',
        'Data;Movimento;Nº da fatura;Cliente;Débito (MX$);Crédito (MX$);Saldo (MX$)',
        '10 de set. de 2026;Fatura;F2;Acme;23200;;34800',
        '20 de set. de 2026;Pagamento recebido;F1;Acme;;5000,5;29799,5',
        '30 de set. de 2026;Pagamento recebido (data aproximada);"F3, ""x""";\'=Beta;;100;-100',
      ].join('\n'),
    )
  })
  it('un texto con «;» va entre comillas, y uno que empieza por = sigue neutralizado', () => {
    const csv = csvEstadoCuenta(datos, '=Acme; S.A.', () => 'Acme', false, 'pt')
    expect(csv.split('\n')[0]).toBe('Extrato;"\'=Acme; S.A."')
  })
  it('de un cliente: sin la columna', () => {
    const csv = csvEstadoCuenta(datos, 'Acme', () => 'Acme', false, 'pt')
    expect(csv).toContain('\nData;Movimento;Nº da fatura;Débito (MX$);Crédito (MX$);Saldo (MX$)\n')
    expect(csv).toContain('\n10 de set. de 2026;Fatura;F2;23200;;34800\n')
  })
  it('una instancia en dolares: «US$» en portugues', () => {
    fijarMonedaInstancia('USD')
    expect(csvEstadoCuenta(datos, 'Acme', () => 'Acme', false, 'pt')).toContain('Saldo inicial (US$);11600')
  })
  it('sin una palabra de espanol ni de ingles fuera de los datos', () => {
    const csv = csvEstadoCuenta(datos, 'Acme', () => 'Acme', false, 'pt')
    // «Vencido» tambien es portugues («Vencido até …», validacion del L4, H1): no se busca.
    expect(csv).not.toMatch(/Estado|Facturado|Cobrado|Vencido al|Fecha|Folio|Cargo|Abono|Pago |Factura|Septiembre|\d{4}-\d{2}-\d{2}/)
    expect(csv).not.toMatch(/Account|Period,|Opening|Invoiced|Collected|Closing|Overdue|Date|Transaction|Invoice|Charge|Payment|Balance|September|Sep \d/)
  })
  it('ningun importe con punto decimal ni separador «,» de campos', () => {
    const csv = csvEstadoCuenta(datos, 'Acme', () => 'Acme', false, 'pt')
    expect(csv).not.toMatch(/\d\.\d/)
    expect(csv.split('\n').filter((l) => l && !l.includes(';'))).toEqual([])
  })
  it('el nombre del archivo', () => {
    expect(nombreArchivoEstadoCuenta('2026-09-01', false, 'pt')).toBe('extrato-2026-09.csv')
    expect(nombreArchivoEstadoCuenta('2026-09-01', true, 'pt')).toBe('extrato-2026-09-cliente.csv')
  })
})
