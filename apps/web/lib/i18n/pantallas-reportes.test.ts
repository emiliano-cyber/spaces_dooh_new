import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'
import { ES_REPORTES, EN_REPORTES } from './textos/reportes'

// ============================================================================
//  I18N · LOTE «REPORTES» (`/reportes`), RENDIDO EN LOS DOS IDIOMAS.
// ----------------------------------------------------------------------------
//  El mismo arnes que `pantallas-catalogos.test.ts`: la pagina REAL dentro del
//  proveedor de idioma, `renderToStaticMarkup`, y
//
//    (a) en ESPANOL sale el texto de siempre, letra por letra;
//    (b) en INGLES no queda NINGUNA frase espanola del lote.
//
//  El reporte llega por un `fetch` dentro de un `useEffect`, que en el
//  servidor no corre, asi que se FUERZA el valor inicial de `useState`: los
//  filtros, la respuesta y el cuerpo del reporte (y, en la tabla, la fila con
//  su desglose abierto). Cada entrada de la cola es un predicado sobre el
//  valor inicial Y sobre la pila (para no confundir el `null` de la respuesta
//  con el de otro componente), y se consume en orden.
//
//  ORDEN, y no es estilo: la pagina se IMPORTA PRIMERO y los `useState` se
//  fuerzan DESPUES, justo antes de rendir. Si se forzaran antes del
//  `await import`, un estado que agota el tiempo dejaria su cola a medias y
//  se comeria los forzados del siguiente: fallos intermitentes.
//
//  Con `I18N_VOLCAR=<carpeta>` vuelca el HTML espanol de cada estado: se corre
//  antes y despues de tocar los componentes y se compara con `diff -rq`.
//
//  Las NOTAS que redacta el motor llegan del servidor en espanol: en espanol
//  se pintan tal cual (aqui van escritas a mano en los datos), y en ingles la
//  pantalla las vuelve a armar desde los numeros que viajan con ellas. Por eso
//  las frases inglesas de las notas SI se comprueban abajo.
// ============================================================================

type Forzado = { si: (inicial: unknown, pila: string) => boolean; valor: unknown }
const forzado = vi.hoisted(() => ({ cola: [] as Forzado[] }))

vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>()
  function useState(inicial?: unknown) {
    const valorInicial = typeof inicial === 'function' ? undefined : inicial
    const cabeza = forzado.cola[0]
    if (cabeza && cabeza.si(valorInicial, new Error().stack ?? '')) {
      forzado.cola.shift()
      return real.useState(cabeza.valor)
    }
    return real.useState(inicial)
  }
  return { ...real, default: { ...real, useState }, useState }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/reportes',
  useSearchParams: () => new URLSearchParams(''),
}))
// La tarjeta plegable lee `localStorage` en un efecto; aqui basta con que
// pinte su titulo, su resumen y su contenido.
vi.mock('@/components/demo/ui/CardColapsable', () => ({
  CardColapsable: (p: { titulo: string; resumen?: unknown; children?: unknown }) =>
    createElement('section', null, createElement('h3', null, p.titulo), p.resumen as never, p.children as never),
}))

beforeEach(() => {
  process.env.IDIOMA_INGLES = '1'
  forzado.cola = []
  vi.useFakeTimers()
  // 15/02/2026: el trimestre en curso es T1 2026 y lleva 46 de sus 90 dias.
  vi.setSystemTime(new Date(2026, 1, 15, 12))
})
afterEach(() => {
  vi.useRealTimers()
})

// ─── Datos ──────────────────────────────────────────────────────────────────
const periodo = (clave: string, etiqueta: string, ingreso: number) => ({
  clave, etiqueta, desde: `${clave}-01`, hasta: `${clave}-28`, ingreso, costoEspacio: 100, costoOperacion: 50,
  costoEnergia: 20, costoTotal: 170, margenBruto: ingreso - 170, visitas: 1,
})
const PERIODOS = [periodo('2026-01', 'ene', 600), periodo('2026-02', 'feb', 400)]
const fila = (clave: string, extra: Record<string, unknown> = {}) => ({
  clave, etiqueta: 'Panel ' + clave, detalle: 'Reforma', ingreso: 1000, costoEspacio: 300, costoOperacion: 100,
  costoEnergia: 50, costoTotal: 450, margenBruto: 550, margenBrutoPct: 55, tieneContrato: true, arrendador: 'Don Pepe',
  periodos: PERIODOS, visitas: 2, ...extra,
})
const TOTALES = { ingreso: 2000, costoEspacio: 600, costoOperacion: 200, costoEnergia: 100, costoTotal: 900, margenBruto: 1100, margenBrutoPct: 55 }
const reporte = (dimension: string, filas: unknown[], extra: Record<string, unknown> = {}) => ({
  dimension, granularidad: 'mes', desde: '2026-01-01', hasta: '2026-03-31', periodos: PERIODOS,
  filas, totales: TOTALES, ...extra,
})
const filtros = (dimension: string, desde = '2026-01-01', hasta = '2026-03-31') => ({ dimension, granularidad: 'mes', desde, hasta })

// ─── El arnes ───────────────────────────────────────────────────────────────
function pintar(idioma: Idioma, el: ReactElement): string {
  return renderToStaticMarkup(createElement(ProveedorIdioma, { idioma, puedeElegir: true }, el))
}
function texto(html: string): string {
  return html
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}
function enesimo(componente: string, pred: (v: unknown) => boolean, n = 1) {
  let vistos = 0
  return (v: unknown, pila: string) => {
    if (!pila.includes(componente) || !pred(v)) return false
    vistos += 1
    return vistos === n
  }
}
const forzar = (si: Forzado['si'], valor: unknown) => forzado.cola.push({ si, valor })
const esNull = (v: unknown) => v === null
const esIndefinido = (v: unknown) => v === undefined

const pagina = async () => (await import('../../app/(app)/(shell)/reportes/page')).default

/** Importa la pagina, fuerza los estados y la rinde. En ESE orden. */
async function rendir(idioma: Idioma, forzados: () => void): Promise<string> {
  const Pagina = await pagina()
  forzados()
  return pintar(idioma, createElement(Pagina))
}
/** El reporte con datos: los filtros, la respuesta y el cuerpo, en ese orden. */
function conReporte(f: unknown, r: { filas: unknown[] }, abrir?: string) {
  return () => {
    forzar(enesimo('ReportesPage', esIndefinido), f)
    forzar(enesimo('ReportesPage', esNull), { status: 200, mensaje: null, filas: r.filas.length })
    forzar(enesimo('ReportesPage', esNull), r)
    if (abrir) forzar(enesimo('TablaRentabilidad', (v) => v instanceof Set), new Set([abrir]))
  }
}
const soloFiltros = (f: unknown, respuesta?: unknown) => () => {
  forzar(enesimo('ReportesPage', esIndefinido), f)
  if (respuesta) forzar(enesimo('ReportesPage', esNull), respuesta)
}

type Estado = { nombre: string; pintar: (idioma: Idioma) => Promise<string>; espanol: string[]; ingles: string[] }

const ESTADOS: Estado[] = [
  {
    nombre: 'por pantalla, trimestre en curso, una fila abierta',
    pintar: (idioma) =>
      rendir(idioma, conReporte(filtros('sitio'), reporte('sitio', [
        fila('s1'),
        fila('s2', { tieneContrato: false, arrendador: null, ingreso: 0, margenBrutoPct: null, margenBruto: -450 }),
        fila('s3', { propia: true }),
      ]), 's1')),
    espanol: [
      'Reportes de rentabilidad', 'Qué ingresa y qué cuesta cada pantalla en el periodo que elijas.', 'Agrupar', 'Desde', 'Hasta',
      'Por pantalla', 'Por trimestre', 'Por operación', 'Por metro cuadrado', 'Por consumo de luz', 'Por razón social',
      'Publicada vs neta', 'Por vendedor', 'Periodos', 'Mensual', 'Trimestral',
      'Ingreso y las tres fuentes de costo de cada pantalla —espacio, operación y luz—. Peor margen primero.',
      'Indicadores del periodo', 'Ingreso del periodo', '3 pantallas con movimiento', 'Costo total',
      'Espacio $ 600.00 · Operación $ 200.00 · Luz $ 100.00', 'Margen sobre ingreso', '55.0 %', 'Margen $ 1,100.00',
      'Del 01/01/2026 al 31/03/2026', 'periodos',
      'El periodo que estás viendo toca T1 2026, que está EN CURSO: llevan 46 de sus 90 días.',
      'Notas sobre estas cifras (', 'El margen de este reporte es BRUTO',
      '1 pantalla no tiene contrato de arrendamiento en el periodo',
      '1 pantalla costó sin vender nada en el periodo, así que no tiene margen porcentual (la columna sale con «—»).',
      'Costo del espacio', 'Costo de operación', 'Costo de la luz', 'Margen bruto %', 'Reforma · sin contrato', 'Reforma · propia',
      'Reforma · Don Pepe', 'Total (', 'title="Sin ingreso en el rango: no hay porcentaje que calcular"',
      'title="Ocultar el desglose por periodo"', 'title="Ver el desglose por periodo"', '>Espacio<', '>Operación<', '>Luz<',
      '>Visitas<', '>Periodo<', '>ene<', 'title="Del 2026-01-01 al 2026-01-28"',
    ],
    ingles: [
      'Profitability reports', 'What each screen brings in and what it costs in the period you choose.', 'Group by', 'From', 'To',
      'By screen', 'By quarter', 'By operations', 'By square meter', 'By electricity consumption', 'By legal entity',
      'Published vs net', 'By sales rep', 'Periods', 'Monthly', 'Quarterly',
      'Revenue and the three cost sources of each screen —space, operations and electricity—. Worst margin first.',
      'Period indicators', 'Period revenue', '3 screens with activity', 'Total cost',
      'Space MX$ 600.00 · Operations MX$ 200.00 · Electricity MX$ 100.00', 'Margin on revenue', '55.0%', 'Margin MX$ 1,100.00',
      'Jan 1, 2026 to Mar 31, 2026', 'periods',
      'The period you are viewing touches Q1 2026, which is IN PROGRESS: 46 of its 90 days have gone by.',
      'Notes on these figures (', 'The margin in this report is GROSS',
      '1 screen has no lease contract in the period',
      '1 screen cost money without selling anything in the period, so it has no percentage margin (the column shows “—”).',
      'Space cost', 'Operations cost', 'Electricity cost', 'Gross margin (%)', 'Reforma · no contract', 'Reforma · owned',
      'Reforma · Don Pepe', 'Total (', 'title="No revenue in the range: there is no percentage to calculate"',
      'title="Hide the breakdown by period"', 'title="Show the breakdown by period"', '>Space<', '>Operations<', '>Electricity<',
      '>Visits<', '>Period<', '>Jan<', 'title="2026-01-01 to 2026-01-28"',
    ],
  },
  {
    nombre: 'por metro cuadrado, todas las caras y exclusiones',
    pintar: (idioma) =>
      rendir(idioma, conReporte(filtros('m2', '2025-01-01', '2025-03-31'), reporte('m2', [fila('s1', { m2: 36, ingresoPorM2: 27.7, margenBrutoPorM2: 15.2 })], {
        desde: '2025-01-01', hasta: '2025-03-31', convencionM2: 'todas-las-caras',
        excluidas: {
          digitales: 1, sinMedidas: 2,
          nota: 'Quedaron fuera del ranking: 1 pantalla digital o rotativa, porque su denominador correcto son spots y no metros · 2 estáticas sin ancho o sin alto capturados.',
        },
      }))),
    espanol: [
      'La superficie suma TODAS las caras de cada pantalla', 'Superficie', 'Ingreso / m²', 'Margen bruto / m²',
      '1 pantalla con movimiento', '36.00 m²', 'Quedaron fuera del ranking: 1 pantalla digital o rotativa',
      'Qué superficie estática rinde.',
    ],
    ingles: [
      'The area adds up ALL the faces of each screen', 'Area', 'Revenue / m²', 'Gross margin / m²', '1 screen with activity',
      '36.00 m²',
      'Left out of the ranking: 1 digital or rotating screen, because its correct denominator is spots, not meters · 2 static screens with no width or height recorded.',
      'Which static area pays off.',
    ],
  },
  {
    nombre: 'por metro cuadrado, una cara y ninguna excluida',
    pintar: (idioma) =>
      rendir(idioma, conReporte(filtros('m2', '2025-01-01', '2025-03-31'), reporte('m2', [fila('s1', { m2: 18 })], {
        desde: '2025-01-01', hasta: '2025-03-31', convencionM2: 'una-cara',
        excluidas: { digitales: 0, sinMedidas: 0, nota: 'No se excluyó ninguna pantalla: todas las que tuvieron movimiento son estáticas y tienen sus medidas capturadas.' },
      }))),
    espanol: ['La superficie es la de UNA cara', 'No se excluyó ninguna pantalla'],
    ingles: ['The area is that of ONE face', 'No screen was excluded: all the ones with activity are static and have their measurements recorded.'],
  },
  {
    nombre: 'por trimestre, uno sin ingreso',
    pintar: (idioma) =>
      rendir(idioma, conReporte(filtros('trimestre', '2025-01-01', '2025-06-30'), reporte('trimestre', [
        fila('2025-T1', { etiqueta: 'T1 2025', detalle: '', ingreso: 0, margenBrutoPct: null, tieneContrato: false }),
        fila('2025-T2', { etiqueta: 'T2 2025', detalle: '' }),
      ], { desde: '2025-01-01', hasta: '2025-06-30' }))),
    espanol: [
      '>Trimestre<', '2 trimestres con movimiento', '1 trimestre sin ingreso en el rango. Aparece en cero a propósito',
      '>T1 2025<', '>T2 2025<',
    ],
    ingles: [
      '>Quarter<', '2 quarters with activity', '1 quarter with no revenue in the range. It shows as zero on purpose',
      '>Q1 2025<', '>Q2 2025<',
    ],
  },
  {
    nombre: 'por operacion, con horas, visitas por tipo y costos estimados',
    pintar: (idioma) =>
      rendir(idioma, conReporte(filtros('operacion', '2025-01-01', '2025-06-30'), reporte('operacion', [
        fila('s1', { costoOperacionPct: 10, horasEnSitio: 3.5, visitasConDuracion: 1, visitasPorTipo: { HERRERIA: 2, INSPECCION: 1 } }),
        fila('s2', { costoOperacionPct: null, horasEnSitio: null, ingreso: 0, margenBrutoPct: null }),
      ], {
        desde: '2025-01-01', hasta: '2025-06-30',
        costosReales: {
          visitasConCostoReal: 3, visitasConEstimacion: 2, costoRealCapturado: 12000, costoEstimado: 3000,
          nota: 'El costo de operación se arma de dos fuentes y NO son lo mismo: lo que de verdad costó cada visita, cuando alguien lo capturó en su orden de trabajo, y una ESTIMACIÓN por tipo de orden —la de Configuración— cuando no. La estimación cobra igual una herrería de $12,000 que una de $800. 2 de las 5 visitas del periodo entran con la estimación por tipo ($3,000) y 3 con su costo real ($12,000). Esa parte del costo —y el margen que sale de ella— es una estimación, no una medición: capturar el costo en la orden de trabajo la sustituye.',
        },
      }))),
    espanol: [
      'Horas en sitio', 'Operación / ingreso', 'Visitas', 'de 1 visita', 'Herrería 2 · Inspección 1', '3.5 h',
      'title="Ninguna visita del rango tiene registradas sus dos marcas de tiempo"',
      'title="Sin ingreso en el rango: no hay proporción que calcular"',
      'Dónde se va el dinero en visitas', '2 de las 5 visitas del periodo entran con la estimación por tipo ($3,000)',
    ],
    ingles: [
      'Hours on site', 'Operations / revenue', 'Visits', 'of 1 visit', '3.5 h',
      'title="No visit in the range has both of its timestamps recorded"',
      'title="No revenue in the range: there is no ratio to calculate"',
      'Where the money goes on visits',
      'The estimate charges a metalwork job of MX$12,000 the same as one of MX$800.',
      '2 of the 5 visits in the period go in at the per-type estimate (MX$3,000) and 3 at their actual cost (MX$12,000).',
    ],
  },
  {
    nombre: 'por razon social, con la fila sin asignar',
    pintar: (idioma) =>
      rendir(idioma, conReporte(filtros('entidad', '2025-01-01', '2025-06-30'), reporte('entidad', [
        fila('e1', { etiqueta: 'Medios del Norte SA', detalle: 'Vende publicidad', saldoAtribuido: 10, pctDelIngreso: 40 }),
        fila('', { etiqueta: 'Sin asignar', detalle: 'Sin razón social en el dato de origen', saldoAtribuido: 0, pctDelIngreso: 60 }),
      ], {
        desde: '2025-01-01', hasta: '2025-06-30',
        atribucion: {
          reservasSinEmisora: 3, contratosSinEntidad: 1, costoOperacionSinRepartir: 200, costoEnergiaSinRepartir: 100,
          nota: 'La operación ($200) y la luz ($100) NO se reparten entre razones sociales: ningún dato dice a nombre de quién se pagan. Por eso esta vista no muestra margen — saldría mejor que el real. 3 reservas del periodo sin comprobante con emisora: su ingreso sale en «Sin asignar». 1 contrato sin razón social asignada: su renta sale en «Sin asignar».',
        },
      }))),
    espanol: [
      'Por razón social', '1 razón social', '>Razón social<', 'Saldo atribuido', '% de la facturación', 'Sin asignar',
      'Sin razón social en el dato de origen', 'La operación ($200) y la luz ($100) NO se reparten entre razones sociales',
    ],
    ingles: [
      'By legal entity', '1 legal entity', '>Legal name<', 'Attributed balance', '% of billing', 'Unassigned',
      'No legal entity in the source data', 'Operations (MX$200) and electricity (MX$100) are NOT split among legal entities',
      '3 bookings in the period have no invoice from an issuing entity: their revenue shows under “Unassigned”.',
      '1 contract has no legal entity assigned: its rent shows under “Unassigned”.',
    ],
  },
  {
    nombre: 'publicada vs neta, con reservas sin tarifa',
    pintar: (idioma) =>
      rendir(idioma, conReporte(filtros('tarifa', '2025-01-01', '2025-06-30'), reporte('tarifa', [
        fila('s1', { ingresoLista: 1500, ingresoComparable: 1000, descuentoYComision: 500, descuentoYComisionPct: 33.3 }),
        fila('s2', { ingresoLista: null, ingresoComparable: null, descuentoYComision: null, descuentoYComisionPct: null }),
      ], {
        desde: '2025-01-01', hasta: '2025-06-30',
        tarifas: {
          reservasConTarifa: 4, reservasSinTarifa: 1, ingresoLista: 1500, ingresoComparable: 1000, ingresoSinTarifa: 700,
          nota: 'La diferencia entre la tarifa publicada y el neto es el descuento comercial MÁS la comisión de agencia: las dos se congelan juntas en la propuesta y el dato no las separa por pantalla. 1 de las 5 reservas del periodo no tienen tarifa publicada con la que comparar ($700 de ingreso): o nacieron en Comercial —donde el precio que se guarda YA ES la tarifa de lista— o su precio no coincide con el neto que congeló su propuesta. Esas filas salen con una raya y no con un cero: un cero diría que se regaló la tarifa entera.',
        },
      }))),
    espanol: ['Tarifa publicada', 'Neto comparable', 'Descuento y comisión', '% sobre publicada', '33.3 %', '1 de las 5 reservas del periodo'],
    ingles: [
      'Published rate', 'Comparable net', 'Discount and commission', '% of published', '33.3%',
      '1 of the 5 bookings in the period has no published rate to compare against (MX$700 of revenue)',
      'The difference between the published rate and the net is the commercial discount PLUS the agency commission',
    ],
  },
  {
    nombre: 'por vendedor, con la fila sin vendedor',
    pintar: (idioma) =>
      rendir(idioma, conReporte(filtros('vendedor', '2025-01-01', '2025-06-30'), reporte('vendedor', [
        fila('u1', { etiqueta: 'Ana Ruiz', detalle: 'Ejecutiva', pctDelIngreso: 40, ingresoLista: 1500, ingresoComparable: 1000, descuentoYComision: 500, descuentoYComisionPct: 33.3 }),
        fila('', { etiqueta: 'Sin vendedor', detalle: 'Campañas de Comercial y propuestas anteriores al 2026-09-28', pctDelIngreso: 60, ingresoLista: null, ingresoComparable: null, descuentoYComision: null, descuentoYComisionPct: null }),
      ], {
        desde: '2025-01-01', hasta: '2025-06-30',
        vendedores: {
          reservasConVendedor: 2, reservasSinVendedor: 3, reservasSinPropuesta: 1, reservasDePropuestaSinVendedor: 2, ingresoSinVendedor: 1200,
          nota: 'La diferencia entre la tarifa publicada y el neto es el descuento comercial MÁS la comisión de agencia: las dos se congelan juntas en la propuesta y el dato no las separa. No es todo rebaja que el vendedor concediera. 3 de las 5 reservas del periodo salen en «Sin vendedor» ($1,200 de ingreso): 1 de campañas creadas directamente en Comercial, que nunca tuvieron propuesta y por tanto no tienen a quién atribuirse; 2 de propuestas anteriores al 2026-09-28, cuando todavía no se guardaba quién las hacía: ese dato NO SE PUEDE RECUPERAR —la bitácora guarda el nombre de la propuesta, no su identificador— así que esas ventas se quedan sin vendedor para siempre. Esas filas salen con una raya y no con un cero: un cero en «Descuento y comisión» afirmaría que no se concedió ninguno.',
        },
      }))),
    espanol: [
      '>Vendedor<', '2 vendedores con movimiento', 'Sin vendedor', 'Campañas de Comercial y propuestas anteriores al 2026-09-28',
      '3 de las 5 reservas del periodo salen en «Sin vendedor»', 'Cuánto vendió cada persona',
    ],
    ingles: [
      '>Sales rep<', '2 sales reps with activity', 'No sales rep', 'Campaigns from Sales and proposals before 2026-09-28',
      '3 of the 5 bookings in the period show under “No sales rep” (MX$1,200 of revenue): 1 from campaigns created directly in Sales',
      '2 from proposals before 2026-09-28', 'Not all of it is a discount the sales rep granted.',
      'Those rows show a dash, not a zero: a zero in “Discount and commission” would claim none was granted.',
      'How much each person sold',
    ],
  },
  {
    nombre: 'por consumo de luz, con recibos que faltan',
    pintar: (idioma) =>
      rendir(idioma, conReporte(filtros('luz', '2025-01-01', '2025-06-30'), reporte('luz', [
        fila('s1', { kwh: 1500, costoPorKwh: 2.4 }),
      ], {
        desde: '2025-01-01', hasta: '2025-06-30',
        cobertura: {
          esperados: 6, faltantes: 2, recibosSinDestino: 1, importeSinDestino: 350,
          nota: 'Faltan 2 de 6 recibos del periodo, así que el costo de la luz que ves está INCOMPLETO y el margen sale mejor de lo que va a quedar. Un mes sin recibo no es un mes sin consumo: es un dato que nadie ha capturado todavía. Además, 1 recibo por 350 no aparece en ninguna fila, porque su predio todavía no tiene pantallas dadas de alta.',
        },
      }))),
    espanol: ['>Consumo<', 'Costo / kWh', '1,500 kWh', 'Faltan 2 de 6 recibos del periodo', 'Además, 1 recibo por 350'],
    ingles: [
      '>Consumption<', 'Cost / kWh', '1,500 kWh', 'Missing: 2 of 6 bills for the period',
      'Also, 1 bill for MX$350 does not appear in any row, because its property has no screens set up yet.',
    ],
  },
  {
    nombre: 'sin movimiento',
    pintar: (idioma) => rendir(idioma, conReporte(filtros('sitio', '2025-01-01', '2025-03-31'), reporte('sitio', []))),
    espanol: [
      'Sin movimiento en este periodo',
      'Entre el 01/01/2025 y el 31/03/2025 ninguna pantalla registró ingreso, renta ni órdenes de trabajo.',
      'Resultado',
    ],
    ingles: [
      'No activity in this period',
      'Between Jan 1, 2025 and Mar 31, 2025 no screen recorded revenue, rent or work orders.',
      'Result',
    ],
  },
  {
    nombre: 'el servidor falla sin mensaje',
    pintar: (idioma) => rendir(idioma, soloFiltros(filtros('sitio', '2025-01-01', '2025-03-31'), { status: 500, mensaje: null, filas: 0 })),
    espanol: ['No se pudo calcular el reporte', 'No se pudo calcular el reporte. La petición no llegó a buen término.'],
    ingles: ['Could not calculate the report', 'Could not calculate the report. The request did not go through.'],
  },
  {
    nombre: 'periodo invertido',
    pintar: (idioma) => rendir(idioma, soloFiltros(filtros('sitio', '2025-05-01', '2025-01-01'))),
    espanol: ['La fecha de fin no puede ser anterior a la de inicio', 'Revisa el periodo'],
    ingles: ['The end date cannot be earlier than the start date', 'Check the period'],
  },
  {
    nombre: 'rango de mas de 24 meses',
    pintar: (idioma) => rendir(idioma, soloFiltros(filtros('sitio', '2020-01-01', '2025-01-01'))),
    espanol: ['El reporte abarca como máximo 24 meses por consulta. Acorta el rango de fechas.'],
    ingles: ['The report covers at most 24 months per query. Shorten the date range.'],
  },
  {
    nombre: 'fecha con formato roto',
    pintar: (idioma) => rendir(idioma, soloFiltros(filtros('sitio', '2025-1-1x', '2025-03-31'))),
    espanol: ['Usa fechas con formato AAAA-MM-DD'],
    ingles: ['Use dates in YYYY-MM-DD format'],
  },
  {
    nombre: 'falta la fecha de inicio',
    pintar: (idioma) => rendir(idioma, soloFiltros(filtros('sitio', '', '2025-03-31'))),
    espanol: ['Falta la fecha de inicio del reporte'],
    ingles: ['The report start date is missing'],
  },
  {
    nombre: 'sin pedir todavia',
    pintar: (idioma) => rendir(idioma, soloFiltros(filtros('vendedor', '2025-01-01', '2025-03-31'))),
    espanol: ['Elige un periodo', 'El reporte se calcula al elegir las fechas.', 'Resultado', 'Cuánto vendió cada persona'],
    ingles: ['Choose a period', 'The report is calculated when you choose the dates.', 'Result', 'How much each person sold'],
  },
]

const htmlIngles: string[] = []

describe('lote REPORTES · en ESPANOL sale el texto de siempre', () => {
  ESTADOS.forEach((e, i) => {
    it(e.nombre, async () => {
      const crudo = await e.pintar('es')
      const dir = process.env.I18N_VOLCAR
      if (dir) {
        mkdirSync(dir, { recursive: true })
        writeFileSync(path.join(dir, `${String(i).padStart(2, '0')}-es.html`), crudo)
      }
      const html = texto(crudo)
      expect(e.espanol.filter((f) => !html.includes(f))).toEqual([])
    })
  })
})

describe('lote REPORTES · en INGLES no queda ninguna frase espanola', () => {
  for (const e of ESTADOS) {
    it(e.nombre, async () => {
      const html = texto(await e.pintar('en'))
      htmlIngles.push(html)
      const soloEspanol = e.espanol.filter((f) => !e.ingles.includes(f))
      expect(soloEspanol.filter((f) => html.includes(f))).toEqual([])
      expect(e.ingles.filter((f) => !html.includes(f))).toEqual([])
    })
  }
})

describe('lote REPORTES · barrido del diccionario contra el HTML ingles', () => {
  it('ningun texto espanol del lote (de 4 letras o mas) aparece en ingles', () => {
    expect(htmlIngles.length).toBe(ESTADOS.length)
    // Sin los `value="…"` de los `<option>`: son el valor de CODIGO de cada
    // opcion (`trimestre`, `vendedor`), no texto que se vea.
    const todo = htmlIngles.join('\n').replace(/ value="[^"]*"/g, '')
    const es = ES_REPORTES as Record<string, string>
    const en = EN_REPORTES as Record<string, string>
    const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const fugas = Object.keys(es).filter((k) => {
      if (es[k] === en[k]) return false
      return es[k].split(/\{\w+\}/).map((t) => t.trim()).filter((t) => t.length >= 4)
        .some((t) => new RegExp(`(^|[^\\p{L}])${escapar(t)}($|[^\\p{L}])`, 'u').test(todo))
    })
    expect(fugas).toEqual([])
  })
})
