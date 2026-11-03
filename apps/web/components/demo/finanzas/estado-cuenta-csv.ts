import type { RespuestaResumen } from '@/lib/data/finanzas-periodo-api'
import { etiquetaPeriodo } from '@/lib/finanzas-periodo'
import { traducir, type ClaveTexto } from '@/lib/i18n/diccionario'
import { formatearFecha, simboloMoneda } from '@/lib/i18n/dinero'
import type { Idioma } from '@/lib/i18n/idiomas'

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
  idioma: Idioma = 'es',
): string {
  // Ola 7 · en el IDIOMA DE LA PANTALLA (decision del dueño, 2026-11-03).
  //  · En espanol, byte a byte el CSV de siempre: cada texto fijo sale de una
  //    clave cuyo espanol es el literal de antes (lo fija
  //    `estado-cuenta-csv-idioma.test.ts`), y fechas e importes van crudos.
  //  · En ingles, los textos fijos en ingles, las fechas «Sep 1, 2026» y la
  //    moneda (`MX$`) en el ENCABEZADO de cada importe. El importe sigue siendo
  //    un numero: con «MX$23,200.00» Excel no sumaria la columna, y un saldo
  //    negativo («-MX$100.00») lo abriria como formula.
  //  · Los datos (titular, folios, nombres) no cambian.
  const t = (k: ClaveTexto, v?: Record<string, string>) => traducir(idioma, k, v)
  const es = idioma === 'es'
  const fecha = (iso: string) =>
    es ? iso : texto(formatearFecha(iso, idioma, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }))
  // En espanol nunca lleva moneda: es el encabezado de siempre.
  const importe = (rotulo: string) => (es ? rotulo : `${rotulo} (${simboloMoneda(idioma)})`)
  const r = d.resumen
  const vencidoAl = t('finanzas.estado-cuenta.vencido-al', {
    fecha: es ? r.corte : formatearFecha(r.corte, idioma, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
  })
  const columnas = [
    t('finanzas.estado-cuenta.col.fecha'),
    t('finanzas.estado-cuenta.col.movimiento'),
    t('finanzas.comun.folio'),
    ...(conCliente ? [t('finanzas.comun.cliente')] : []),
    importe(t('finanzas.estado-cuenta.col.cargo')),
    importe(t('finanzas.estado-cuenta.col.abono')),
    importe(t('finanzas.estado-cuenta.col.saldo')),
  ]
  const lineas: string[] = [
    `${t('finanzas.estado-cuenta.titulo')},${texto(titular)}`,
    `${t('finanzas.csv.periodo')},${texto(etiquetaPeriodo(d.periodo, idioma))},${fecha(d.periodo.desde)},${fecha(d.periodo.hasta)}`,
    '',
    `${importe(t('finanzas.estado-cuenta.saldo-inicio'))},${num(r.saldoInicial)}`,
    `${importe(t('finanzas.periodo.facturado'))},${num(r.facturado.monto)}`,
    `${importe(t('finanzas.periodo.cobrado'))},${num(r.cobrado)}`,
    `${importe(t('finanzas.csv.saldo-cierre'))},${num(r.saldoFinal)}`,
    `${texto(importe(vencidoAl))},${num(r.vencido.monto)}`,
    '',
    columnas.join(','),
    ...d.movimientos.map((m) =>
      [
        fecha(m.fecha),
        m.tipo === 'factura'
          ? t('finanzas.estado-cuenta.factura')
          : m.aproximado
            ? t('finanzas.csv.pago-aproximado')
            : t('finanzas.estado-cuenta.pago'),
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

/** El nombre del archivo que se descarga, en el idioma de la pantalla. */
export function nombreArchivoEstadoCuenta(desde: string, deUnCliente: boolean, idioma: Idioma = 'es'): string {
  const base = traducir(idioma, 'finanzas.csv.archivo')
  const cliente = deUnCliente ? `-${traducir(idioma, 'finanzas.csv.archivo.cliente')}` : ''
  return `${base}-${desde.slice(0, 7)}${cliente}.csv`
}
