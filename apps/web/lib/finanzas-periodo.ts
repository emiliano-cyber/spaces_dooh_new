// ============================================================================
//  lib/finanzas-periodo.ts — Finanzas por periodo (FIN-PER, ADR 0046).
// ----------------------------------------------------------------------------
//  El tablero de Finanzas con temporalidad y el estado de cuenta (de la empresa
//  o de un cliente) salen de aquí. Es PURO —recibe filas, devuelve cifras—
//  para que la ruta del servidor, la pantalla y las pruebas cuenten igual.
//
//  Las definiciones, una vez y con su porqué:
//
//  · FACTURADO: facturas no anuladas EMITIDAS en el periodo, con IVA.
//  · COBRADO: abonos cuya FECHA cae en el periodo (`cobranza_abonos`). Antes del
//    06/10 el sistema no guardaba esa fecha; lo rescatado sin rastro en la
//    bitácora queda sin fecha y no se atribuye a ningún periodo (cuenta en el
//    saldo, como algo pagado antes de cualquier periodo).
//  · SALDO INICIAL: lo facturado antes del periodo menos lo cobrado antes.
//    SALDO FINAL = inicial + facturado − cobrado. El final de un mes es, por
//    construcción, el inicial del siguiente.
//  · VENCIDO: lo que a la fecha de CORTE se debía de cuotas cuyo vencimiento ya
//    había pasado. El corte es el fin del periodo, o HOY si el periodo no ha
//    terminado: medir octubre al 31 contaría como vencido lo que hoy no lo está.
//    Una cuota pagada al corte no está vencida aunque su fecha haya pasado.
//  · RENTA: pagada = pagos con FECHA DE PAGO en el periodo; por pagar = pagos
//    sin pagar cuyo periodo cae en él. Solo en la vista de la empresa.
//
//  Las fechas son de calendario 'AAAA-MM-DD' y se comparan como texto, que en
//  ese formato ordena igual que las fechas. Ningún `new Date()` aquí dentro:
//  «hoy» entra como parámetro (lo pone el servidor, en la zona de la base).
// ============================================================================

export type TipoPeriodo = 'mes' | 'mes-anterior' | 'trimestre' | 'trimestre-anterior' | 'anio' | 'rango'

export interface Periodo {
  desde: string
  hasta: string
}

export interface FacturaP {
  id: string
  folio: string
  clienteId: string
  fecha: string
  monto: number
  anulada: boolean
}
export interface CuotaP {
  id: string
  facturaId: string
  vence: string
  /** El importe de ESTA cuota (o el de la factura si es cobro único). */
  monto: number
}
export interface AbonoP {
  cobranzaId: string
  monto: number
  /** NULL = rescate histórico sin fecha (ADR 0046). */
  fecha: string | null
}
export interface RentaP {
  monto: number
  periodo: string
  pagada: boolean
  fechaPago: string | null
}
export interface DatosFinanzas {
  facturas: FacturaP[]
  cuotas: CuotaP[]
  abonos: AbonoP[]
  rentas: RentaP[]
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
  'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const dos = (n: number) => String(n).padStart(2, '0')
const fecha = (a: number, m: number, d: number) => `${a}-${dos(m)}-${dos(d)}`
// Día 0 del mes siguiente = último día de este. Date.UTC para que la zona de
// quien lo ejecute no lo mueva.
const ultimoDia = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate()
const redondear = (v: number) => Math.round(v * 100) / 100

export function periodoDe(
  tipo: TipoPeriodo,
  hoy: string,
  rango?: { desde?: string; hasta?: string },
): Periodo & { etiqueta: string } {
  if (!FECHA.test(hoy)) throw new Error(`Fecha de hoy inválida: ${hoy}`)
  const a = Number(hoy.slice(0, 4))
  const m = Number(hoy.slice(5, 7))
  const mes = (aa: number, mm: number) => ({
    desde: fecha(aa, mm, 1),
    hasta: fecha(aa, mm, ultimoDia(aa, mm)),
    etiqueta: `${MESES[mm - 1]} ${aa}`,
  })
  const trimestre = (aa: number, t: number) => ({
    desde: fecha(aa, t * 3 + 1, 1),
    hasta: fecha(aa, t * 3 + 3, ultimoDia(aa, t * 3 + 3)),
    etiqueta: `${t + 1}.º trimestre ${aa}`,
  })
  const t = Math.floor((m - 1) / 3)
  switch (tipo) {
    case 'mes':
      return mes(a, m)
    case 'mes-anterior':
      return m === 1 ? mes(a - 1, 12) : mes(a, m - 1)
    case 'trimestre':
      return trimestre(a, t)
    case 'trimestre-anterior':
      return t === 0 ? trimestre(a - 1, 3) : trimestre(a, t - 1)
    case 'anio':
      return { desde: fecha(a, 1, 1), hasta: fecha(a, 12, 31), etiqueta: String(a) }
    case 'rango': {
      const d = rango?.desde ?? ''
      const h = rango?.hasta ?? ''
      if (!FECHA.test(d) || !FECHA.test(h)) throw new Error('El rango necesita fecha de inicio y de fin (AAAA-MM-DD)')
      const [desde, hasta] = d <= h ? [d, h] : [h, d]
      return { desde, hasta, etiqueta: `${desde} a ${hasta}` }
    }
  }
}

// Las cuotas y abonos de facturas ANULADAS no cuentan para nada: una factura
// anulada no se debió nunca. Y con filtro de cliente, solo lo suyo.
function vigentes(d: DatosFinanzas, clienteId?: string | null) {
  const facturas = d.facturas.filter((f) => !f.anulada && (!clienteId || f.clienteId === clienteId))
  const ids = new Set(facturas.map((f) => f.id))
  const cuotas = d.cuotas.filter((c) => ids.has(c.facturaId))
  const idsCuota = new Set(cuotas.map((c) => c.id))
  const abonos = d.abonos.filter((x) => idsCuota.has(x.cobranzaId))
  return { facturas, cuotas, abonos }
}

// Sin fecha = rescate histórico: se trata como pagado ANTES de cualquier periodo.
const antesDe = (x: AbonoP, dia: string) => x.fecha === null || x.fecha < dia
const enPeriodo = (dia: string | null, p: Periodo) => dia !== null && dia >= p.desde && dia <= p.hasta

export interface ResumenPeriodo {
  facturado: { monto: number; facturas: number }
  cobrado: number
  saldoInicial: number
  saldoFinal: number
  vencido: { monto: number; facturas: number }
  /** Fecha a la que se midió lo vencido: fin del periodo, o hoy si no ha terminado. */
  corte: string
  /** null en la vista de un cliente: la renta es de la empresa. */
  renta: { pagada: number; porPagar: number } | null
  /** Lo rescatado sin fecha (ADR 0046): está en el saldo, no en ningún periodo. */
  abonosSinFecha: number
}

export function resumirPeriodo(
  d: DatosFinanzas,
  p: Periodo,
  hoy: string,
  clienteId?: string | null,
): ResumenPeriodo {
  const { facturas, cuotas, abonos } = vigentes(d, clienteId)

  const emitidas = facturas.filter((f) => enPeriodo(f.fecha, p))
  const facturado = redondear(emitidas.reduce((s, f) => s + f.monto, 0))
  const cobrado = redondear(abonos.filter((x) => enPeriodo(x.fecha, p)).reduce((s, x) => s + x.monto, 0))

  const facturadoAntes = facturas.filter((f) => f.fecha < p.desde).reduce((s, f) => s + f.monto, 0)
  const cobradoAntes = abonos.filter((x) => antesDe(x, p.desde)).reduce((s, x) => s + x.monto, 0)
  const saldoInicial = redondear(facturadoAntes - cobradoAntes)

  // Vencido al corte: por cuota, lo que faltaba pagar ese día si ya había vencido.
  const corte = p.hasta < hoy ? p.hasta : hoy
  const pagadoAlCorte = new Map<string, number>()
  for (const x of abonos) {
    if (x.fecha === null || x.fecha <= corte) {
      pagadoAlCorte.set(x.cobranzaId, (pagadoAlCorte.get(x.cobranzaId) ?? 0) + x.monto)
    }
  }
  // Una factura emitida después del corte todavía no existía ese día.
  const existiaAlCorte = new Set(facturas.filter((f) => f.fecha <= corte).map((f) => f.id))
  let vencidoMonto = 0
  const facturasVencidas = new Set<string>()
  for (const c of cuotas) {
    if (!existiaAlCorte.has(c.facturaId) || !(c.vence < corte)) continue
    const debe = redondear(c.monto - (pagadoAlCorte.get(c.id) ?? 0))
    if (debe > 0) {
      vencidoMonto += debe
      facturasVencidas.add(c.facturaId)
    }
  }

  const renta = clienteId
    ? null
    : {
        pagada: redondear(d.rentas.filter((r) => r.pagada && enPeriodo(r.fechaPago, p)).reduce((s, r) => s + r.monto, 0)),
        porPagar: redondear(d.rentas.filter((r) => !r.pagada && enPeriodo(r.periodo, p)).reduce((s, r) => s + r.monto, 0)),
      }

  return {
    facturado: { monto: facturado, facturas: emitidas.length },
    cobrado,
    saldoInicial,
    saldoFinal: redondear(saldoInicial + facturado - cobrado),
    vencido: { monto: redondear(vencidoMonto), facturas: facturasVencidas.size },
    corte,
    renta,
    abonosSinFecha: redondear(abonos.filter((x) => x.fecha === null).reduce((s, x) => s + x.monto, 0)),
  }
}

export interface Movimiento {
  fecha: string
  tipo: 'factura' | 'abono'
  folio: string
  clienteId: string
  cargo: number
  abono: number
  /** Saldo después de este movimiento, partiendo del saldo inicial del periodo. */
  saldo: number
}

// Los renglones del estado de cuenta: cada factura emitida (cargo) y cada pago
// recibido (abono) del periodo, por fecha, con el saldo corrido. En el mismo
// día va primero la factura: es el orden en que ocurre el dinero.
export function movimientosDelPeriodo(d: DatosFinanzas, p: Periodo, clienteId?: string | null): Movimiento[] {
  const { facturas, cuotas, abonos } = vigentes(d, clienteId)
  const facturaDe = new Map(facturas.map((f) => [f.id, f]))
  const facturaDeCuota = new Map(cuotas.map((c) => [c.id, facturaDe.get(c.facturaId)!]))

  const filas: Omit<Movimiento, 'saldo'>[] = [
    ...facturas
      .filter((f) => enPeriodo(f.fecha, p))
      .map((f) => ({ fecha: f.fecha, tipo: 'factura' as const, folio: f.folio, clienteId: f.clienteId, cargo: f.monto, abono: 0 })),
    ...abonos
      .filter((x) => enPeriodo(x.fecha, p))
      .map((x) => {
        const f = facturaDeCuota.get(x.cobranzaId)!
        return { fecha: x.fecha as string, tipo: 'abono' as const, folio: f.folio, clienteId: f.clienteId, cargo: 0, abono: x.monto }
      }),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.tipo === b.tipo ? 0 : a.tipo === 'factura' ? -1 : 1))

  let saldo = resumirPeriodo(d, p, p.hasta, clienteId).saldoInicial
  return filas.map((f) => {
    saldo = redondear(saldo + f.cargo - f.abono)
    return { ...f, saldo }
  })
}
