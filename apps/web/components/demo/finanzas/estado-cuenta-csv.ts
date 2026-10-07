import type { RespuestaResumen } from '@/lib/data/finanzas-periodo-api'

// ============================================================================
//  El estado de cuenta en CSV (abre en Excel). Aparte del componente para
//  probarlo sin DOM.
//
//  Dos defensas, las mismas que los demás exportes del repo:
//    · un valor que empieza por = + - @ lo abre Excel como FÓRMULA. El titular
//      y los nombres de cliente los escribe una persona, así que se les antepone
//      un apóstrofo (como `lib/contratos-export.ts` y `lib/inventario-export.ts`).
//      Los importes son números y no pasan por aquí: un saldo negativo tiene que
//      llegar como número negativo, no como texto.
//    · comas, comillas y saltos de línea van entre comillas dobles.
// ============================================================================

const PELIGROSO = /^[=+\-@\t\r]/

function texto(v: string): string {
  const seguro = PELIGROSO.test(v) ? `'${v}` : v
  return /[",\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro
}
const num = (v: number) => String(v)

export function csvEstadoCuenta(
  d: RespuestaResumen,
  titular: string,
  nombreCliente: (id: string) => string,
  conCliente: boolean,
): string {
  const r = d.resumen
  const lineas: string[] = [
    `Estado de cuenta,${texto(titular)}`,
    `Periodo,${texto(d.periodo.etiqueta)},${d.periodo.desde},${d.periodo.hasta}`,
    '',
    `Saldo al inicio,${num(r.saldoInicial)}`,
    `Facturado,${num(r.facturado.monto)}`,
    `Cobrado,${num(r.cobrado)}`,
    `Saldo al cierre,${num(r.saldoFinal)}`,
    `Vencido al ${r.corte},${num(r.vencido.monto)}`,
    '',
    conCliente ? 'Fecha,Movimiento,Folio,Cliente,Cargo,Abono,Saldo' : 'Fecha,Movimiento,Folio,Cargo,Abono,Saldo',
    ...d.movimientos.map((m) =>
      [
        m.fecha,
        m.tipo === 'factura' ? 'Factura' : m.aproximado ? 'Pago recibido (fecha aproximada)' : 'Pago recibido',
        texto(m.folio),
        ...(conCliente ? [texto(nombreCliente(m.clienteId))] : []),
        m.cargo ? num(m.cargo) : '',
        m.abono ? num(m.abono) : '',
        num(m.saldo),
      ].join(','),
    ),
  ]
  return lineas.join('\n')
}
