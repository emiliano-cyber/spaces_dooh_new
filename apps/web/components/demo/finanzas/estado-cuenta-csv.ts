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
//    · el separador (la coma, o el «;» del italiano y el portugues), las comillas y los saltos
//      de línea van entre comillas dobles.
// ============================================================================

const PELIGROSO = /^[=+\-@\t\r]/

// `sep` es el separador de campos: la coma de siempre o el punto y coma del
// italiano y del portugues (abajo). Un texto que lo contenga va entre comillas.
function texto(v: string, sep: ',' | ';' = ','): string {
  const seguro = PELIGROSO.test(v) ? `'${v}` : v
  const especial = sep === ',' ? /[",\n\r]/ : /[";\n\r]/
  return especial.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro
}

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
  //  · En ITALIANO (validacion del lote L4, 2026-11-03), ademas, el formato de
  //    una Excel con configuracion italiana: separador «;» y coma decimal
  //    («5000,5»). Con la coma de siempre, el doble clic lo mete todo en una
  //    columna y lee «5000.5» como texto. El importe sigue siendo un NUMERO
  //    (sin miles ni simbolo) y la defensa contra formulas no cambia. Espanol
  //    e ingles, byte a byte los de antes.
  //  · En PORTUGUES (lote L4, 2026-11-05; H4 de la validacion de la ola 0),
  //    lo mismo que en italiano: una Excel brasilena tambien espera «;» y coma
  //    decimal. No se lee de `comaDecimal()` (`lib/captura-cifra.ts`): esa es
  //    la CAPTURA de cifras, que en portugues sigue a la mexicana hasta la
  //    tarea roja P2; esto es el archivo que abre la Excel de quien lo baja.
  const t = (k: ClaveTexto, v?: Record<string, string>) => traducir(idioma, k, v)
  const es = idioma === 'es'
  const excelConComa = idioma === 'it' || idioma === 'pt'
  const sep = excelConComa ? ';' : ','
  const tx = (v: string) => texto(v, sep)
  const num = (v: number) => (excelConComa ? String(v).replace('.', ',') : String(v))
  const fecha = (iso: string) =>
    es ? iso : tx(formatearFecha(iso, idioma, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }))
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
    `${t('finanzas.estado-cuenta.titulo')}${sep}${tx(titular)}`,
    `${t('finanzas.csv.periodo')}${sep}${tx(etiquetaPeriodo(d.periodo, idioma))}${sep}${fecha(d.periodo.desde)}${sep}${fecha(d.periodo.hasta)}`,
    '',
    `${importe(t('finanzas.estado-cuenta.saldo-inicio'))}${sep}${num(r.saldoInicial)}`,
    `${importe(t('finanzas.periodo.facturado'))}${sep}${num(r.facturado.monto)}`,
    `${importe(t('finanzas.periodo.cobrado'))}${sep}${num(r.cobrado)}`,
    `${importe(t('finanzas.csv.saldo-cierre'))}${sep}${num(r.saldoFinal)}`,
    `${tx(importe(vencidoAl))}${sep}${num(r.vencido.monto)}`,
    '',
    columnas.join(sep),
    ...d.movimientos.map((m) =>
      [
        fecha(m.fecha),
        m.tipo === 'factura'
          ? t('finanzas.estado-cuenta.factura')
          : m.aproximado
            ? t('finanzas.csv.pago-aproximado')
            : t('finanzas.estado-cuenta.pago'),
        tx(m.folio),
        ...(conCliente ? [tx(nombreCliente(m.clienteId))] : []),
        m.cargo ? num(m.cargo) : '',
        m.abono ? num(m.abono) : '',
        num(m.saldo),
      ].join(sep),
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
