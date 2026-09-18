import { formatMonto } from '@/lib/data/derive'
import { TIPO_OT_LABEL } from '@/lib/tipos-ot'
import type { ConvencionM2, ExclusionesM2, FilaRentabilidad, PeriodoFila } from '@/lib/data/reportes'
import {
  avanceDelTrimestreEnCurso,
  cuenta,
  solapaTrimestreEnCurso,
  type DimensionUI,
} from './consulta'

// ============================================================================
//  components/demo/reportes/tabla.ts — Qué columnas trae cada dimensión.
// ----------------------------------------------------------------------------
//  LA REGLA: las columnas, el encabezado de la primera y el orden inicial SALEN
//  DE LA DIMENSIÓN. No hay un juego fijo de columnas.
//
//  Estaba al revés, y así se descubrió —el 2026-09-18, con el build fusionado y
//  un navegador delante—: la tabla pintaba SIEMPRE las siete columnas de
//  `sitio`. «Por operación» calculaba bien —Tlalpan 21.6 % contra Santa Mónica
//  34.2 %, el guion del dueño— y NO enseñaba ni visitas ni horas, que es justo
//  lo que la hace «por operación». Y en trimestral el encabezado de la primera
//  columna decía «PANTALLA» mientras las filas eran trimestres.
//
//  POR QUÉ NO LO VIO NADA AUTOMÁTICO, que es lo que lo hace interesante: las
//  columnas propias de `operacion` y de `m2` son campos OPCIONALES de
//  `FilaRentabilidad` (`lib/data/reportes.ts:118-134`). Un campo opcional que
//  nadie lee no da error de tipos ni de ejecución: da una tabla que calcula
//  perfectamente y no contesta su propia pregunta. Ni el typecheck, ni las
//  unitarias, ni las e2e pueden ver eso.
//
//  Y por qué está aquí y no en el `.tsx`: `vitest.config.ts` no monta jsdom a
//  propósito, así que una decisión escrita dentro de un componente no la prueba
//  nadie. Es el mismo motivo por el que la compuerta del shell salió a
//  `compuerta.ts` y aparecieron nueve casos en rojo.
// ============================================================================

/** Todo lo que la tabla puede pintar de una fila. Lo opcional llega según la dimensión. */
export type FilaOrdenable = Pick<
  FilaRentabilidad,
  | 'clave'
  | 'etiqueta'
  | 'ingreso'
  | 'costoEspacio'
  | 'costoOperacion'
  | 'costoTotal'
  | 'margen'
  | 'margenPct'
  | 'tieneContrato'
  | 'visitas'
> &
  Partial<
    Pick<
      FilaRentabilidad,
      | 'visitasPorTipo'
      | 'costoOperacionPct'
      | 'horasEnSitio'
      | 'visitasConDuracion'
      | 'm2'
      | 'ingresoPorM2'
      | 'margenPorM2'
    >
  >

export type ColumnaReporte =
  | 'etiqueta'
  | 'ingreso'
  | 'costoEspacio'
  | 'costoOperacion'
  | 'costoTotal'
  | 'margen'
  | 'margenPct'
  | 'visitas'
  | 'costoOperacionPct'
  | 'horasEnSitio'
  | 'm2'
  | 'ingresoPorM2'
  | 'margenPorM2'

export type Direccion = 'asc' | 'desc'

export interface Orden {
  columna: ColumnaReporte
  direccion: Direccion
}

// Cómo se pinta el valor, y sobre todo qué significa su ausencia. No es estilo:
// `horasEnSitio` en `null` significa «ninguna visita tiene las dos marcas de
// tiempo» y pintado como «0.0 h» afirma que la cuadrilla entró y salió en el
// mismo instante — una medición, no una ausencia. `visitas` en cero es lo
// contrario: un hecho medido, y ahí el cero es la verdad.
export type FormatoColumna = 'texto' | 'dinero' | 'porcentaje' | 'entero' | 'superficie' | 'horas'

export interface DefinicionColumna {
  clave: ColumnaReporte
  label: string
  numerica: boolean
  formato: FormatoColumna
  /** La dirección ÚTIL de la columna, no la que quedara puesta. */
  direccionInicial: Direccion
  /** El campo por el que se ORDENA, cuando no es el que se pinta. */
  campoOrden?: keyof FilaOrdenable
  /** `reporte.totales` trae esta columna, así que el pie la puede pintar. */
  totalizable: boolean
}

// Las SEIS columnas que `Totales` (`lib/data/reportes.ts:137-144`) trae, y
// ninguna más. Lo que no está aquí no lleva total en el pie, y eso es una
// decisión, no un olvido: los totales vienen del SERVIDOR porque dos sumas de
// lo mismo divergen. Y con las columnas por dimensión hay un caso peor que
// divergir: `margenPorM2` es un COCIENTE, y el promedio de los cocientes de las
// filas NO es el cociente del total —cada pantalla tiene otra superficie—, así
// que un pie «calculado» ahí daría una cifra que no es de nadie.
const TOTALIZABLES: ReadonlySet<ColumnaReporte> = new Set<ColumnaReporte>([
  'ingreso',
  'costoEspacio',
  'costoOperacion',
  'costoTotal',
  'margen',
  'margenPct',
])

const def = (
  clave: ColumnaReporte,
  label: string,
  formato: FormatoColumna,
  direccionInicial: Direccion,
  campoOrden?: keyof FilaOrdenable,
): DefinicionColumna => ({
  clave,
  label,
  numerica: formato !== 'texto',
  formato,
  direccionInicial,
  campoOrden,
  totalizable: TOTALIZABLES.has(clave),
})

// El catálogo COMPLETO: toda columna que existe, con una sola definición. El
// juego de cada dimensión se arma eligiendo de aquí, para que la misma columna
// no se llame ni se formatee de dos formas según dónde salga.
export const COLUMNAS: DefinicionColumna[] = [
  def('etiqueta', 'Pantalla', 'texto', 'asc'),
  def('ingreso', 'Ingreso', 'dinero', 'desc'),
  def('costoEspacio', 'Costo del espacio', 'dinero', 'desc'),
  def('costoOperacion', 'Costo de operación', 'dinero', 'desc'),
  def('costoTotal', 'Costo total', 'dinero', 'desc'),
  // Margen y margen % arrancan por el PEOR, igual que el reporte: la pregunta
  // que contesta es «¿qué pantallas están perdiendo dinero?».
  def('margen', 'Margen', 'dinero', 'asc'),
  def('margenPct', 'Margen %', 'porcentaje', 'asc'),
  // ─── Solo en `operacion` ────────────────────────────────────────────────
  def('visitas', 'Visitas', 'entero', 'desc'),
  def('costoOperacionPct', 'Operación / ingreso', 'porcentaje', 'desc'),
  def('horasEnSitio', 'Horas en sitio', 'horas', 'desc'),
  // ─── Solo en `m2` ───────────────────────────────────────────────────────
  def('m2', 'Superficie', 'superficie', 'desc'),
  def('ingresoPorM2', 'Ingreso / m²', 'dinero', 'desc'),
  def('margenPorM2', 'Margen / m²', 'dinero', 'asc'),
]

const CATALOGO = new Map(COLUMNAS.map((c) => [c.clave, c]))

// Las siete de dinero, que toda dimensión comparte porque toda dimensión pivota
// LA MISMA rejilla sitio × periodo (`matriz()`): si cada una sumara por su
// cuenta, cuatro dimensiones darían cuatro cifras distintas del mismo mes.
const COMUNES: ColumnaReporte[] = [
  'etiqueta',
  'ingreso',
  'costoEspacio',
  'costoOperacion',
  'costoTotal',
  'margen',
  'margenPct',
]

// Cuando una dimensión trae columnas propias, la que cede el sitio es
// `costoTotal`: es la suma EXACTA de las dos columnas que tiene al lado, que
// siguen en pantalla, así que no se pierde ninguna información. Sacar cualquier
// otra sí sería información perdida — y once columnas de cifras a 13 px no se
// leen «a tres metros (proyector)», que es donde esto se presenta.
const COMUNES_SIN_TOTAL = COMUNES.filter((c) => c !== 'costoTotal')

const inserta = (base: ColumnaReporte[], antes: ColumnaReporte, propias: ColumnaReporte[]) => {
  const i = base.indexOf(antes)
  return [...base.slice(0, i), ...propias, ...base.slice(i)]
}

const COLUMNAS_POR_DIMENSION: Record<DimensionUI, ColumnaReporte[]> = {
  sitio: COMUNES,
  trimestre: COMUNES,
  // Las tres que la hacen «por operación», pegadas al costo de operación que
  // explican: cuántas veces se fue, qué proporción del ingreso se comió y
  // cuántas horas se estuvo. Sin ellas el reporte calcula y no contesta.
  operacion: inserta(COMUNES_SIN_TOTAL, 'margen', ['visitas', 'costoOperacionPct', 'horasEnSitio']),
  // La superficie va junto a la etiqueta —es lo que define la fila— y los dos
  // cocientes junto al margen, que es con lo que se comparan.
  m2: inserta(
    inserta(COMUNES_SIN_TOTAL, 'ingreso', ['m2']),
    'margenPct',
    ['ingresoPorM2', 'margenPorM2'],
  ),
}

// El encabezado de la primera columna dice QUÉ son las filas. Decía «PANTALLA»
// en trimestral, sobre filas que eran trimestres: la clase de mentira que no da
// ningún error y que hace leer la tabla entera al revés.
//
// En `trimestre` además se ORDENA por `clave` (`2026-T1`) y no por la etiqueta
// que se pinta (`T1 2026`): como texto, «T4 2025» va DESPUÉS de «T1 2026» —la
// T4 pesa más que la T1— y en el calendario va antes. Es la misma trampa de
// comparar fechas como cadenas que este repo ya pagó dos veces.
const PRIMERA_COLUMNA: Record<DimensionUI, { label: string; campoOrden?: keyof FilaOrdenable }> = {
  sitio: { label: 'Pantalla' },
  trimestre: { label: 'Trimestre', campoOrden: 'clave' },
  operacion: { label: 'Pantalla' },
  m2: { label: 'Pantalla' },
}

export function columnasDeDimension(d: DimensionUI): DefinicionColumna[] {
  const primera = PRIMERA_COLUMNA[d]
  return COLUMNAS_POR_DIMENSION[d].map((clave) => {
    const base = CATALOGO.get(clave)!
    return clave === 'etiqueta' ? { ...base, ...primera } : base
  })
}

// El orden de apertura de cada dimensión es EL MISMO que el de su motor
// (`lib/data/reportes.ts`). Si la tabla reordenara al recibir, discutiría con
// el servidor sobre la misma pregunta.
//
// `trimestre` es la única que no va «peor primero», y es deliberado: sus filas
// son una SERIE DE TIEMPO, no un ranking. Ordenada por margen descendente, el
// trimestre más reciente sale arriba unas veces y abajo otras según cómo fuera
// el negocio, y una serie así no se puede leer. El motor ya los devuelve en
// orden cronológico.
const ORDEN_POR_DIMENSION: Record<DimensionUI, Orden> = {
  sitio: { columna: 'margen', direccion: 'asc' },
  trimestre: { columna: 'etiqueta', direccion: 'asc' },
  // Por MÁS COSTO DE OPERACIÓN, no por peor margen. El caso que lo demuestra
  // está en el motor: una pantalla con −120 000 de margen por una renta
  // carísima y CERO visitas saldría primera por margen y taparía justo a las
  // que sí son un problema de operación. Un margen horrible por renta cara no
  // se arregla yendo menos veces.
  operacion: { columna: 'costoOperacion', direccion: 'desc' },
  // Peor margen POR METRO, que no es el mismo orden que por margen absoluto:
  // una valla pequeña que rinde poco por metro es peor negocio que un
  // espectacular grande con el mismo margen total.
  m2: { columna: 'margenPorM2', direccion: 'asc' },
}

export function ordenInicialDe(d: DimensionUI): Orden {
  return ORDEN_POR_DIMENSION[d]
}

// `es-MX` explícito y no el locale del navegador: 'Á' vale 193 y 'B' 66, así
// que por código de carácter «Ángeles» iría DESPUÉS de «Bosques». Y dejarlo al
// locale del visitante haría que la misma tabla saliera en distinto orden en la
// máquina de quien la presenta y en la del cliente.
const comparadorTexto = new Intl.Collator('es-MX', { sensitivity: 'base', numeric: true })

function definicionPara(orden: Orden, dimension: DimensionUI): DefinicionColumna {
  return (
    columnasDeDimension(dimension).find((c) => c.clave === orden.columna) ??
    CATALOGO.get(orden.columna) ??
    CATALOGO.get('margen')!
  )
}

export function ordenarFilas<T extends FilaOrdenable>(
  filas: readonly T[],
  orden: Orden,
  dimension: DimensionUI,
): T[] {
  const col = definicionPara(orden, dimension)
  const campo = (col.campoOrden ?? col.clave) as keyof FilaOrdenable
  const signo = orden.direccion === 'asc' ? 1 : -1
  // Copia antes de ordenar: `Array.prototype.sort` ordena EN SITIO, y sobre el
  // arreglo que guarda un `useState` eso es una mutación que React no ve, así
  // que la tabla no se vuelve a pintar.
  return [...filas].sort((a, b) => {
    if (!col.numerica) {
      return signo * comparadorTexto.compare(String(a[campo] ?? ''), String(b[campo] ?? ''))
    }
    const va = a[campo] as number | null | undefined
    const vb = b[campo] as number | null | undefined
    // El `null` va al final en las DOS direcciones, y aquí hay dos columnas que
    // lo usan con el mismo significado: `margenPct` («no hubo ingreso, no hay
    // porcentaje que calcular») y `horasEnSitio` («ninguna visita las tiene
    // medidas»). No es un empate ni un cero, así que no entra en la escala: si
    // se invirtiera con la dirección, esa fila saltaría del final al principio
    // solo por cambiar el sentido.
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    return signo * (va - vb)
  })
}

export function siguienteOrden(actual: Orden, clic: ColumnaReporte): Orden {
  if (actual.columna === clic) {
    return { columna: clic, direccion: actual.direccion === 'asc' ? 'desc' : 'asc' }
  }
  return { columna: clic, direccion: CATALOGO.get(clic)?.direccionInicial ?? 'desc' }
}

/** El valor que la columna PINTA. `null` si la fila no lo trae. */
export function valorDeColumna(f: FilaOrdenable, col: DefinicionColumna): string | number | null {
  const v = f[col.clave as keyof FilaOrdenable]
  if (v == null) return null
  return typeof v === 'number' || typeof v === 'string' ? v : null
}

/** El valor de esa columna en los totales del SERVIDOR, o `null` si no lo trae. */
export function totalDeColumna(
  totales: Record<string, number | null>,
  col: DefinicionColumna,
): number | null {
  if (!col.totalizable) return null
  const v = totales[col.clave]
  return typeof v === 'number' ? v : null
}

// Un decimal, con signo, y una RAYA cuando no hay porcentaje. Nunca «0 %»: ese
// cero afirmaría que la pantalla quedó a la par.
export function formatoPorcentaje(v: number | null): string {
  if (v == null) return '—'
  return `${v.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}

export function formatoCelda(v: string | number | null, formato: FormatoColumna): string {
  if (formato === 'texto') return v == null ? '' : String(v)
  if (formato === 'porcentaje') return formatoPorcentaje(v as number | null)
  // Solo aquí el `null` se pinta como raya en las tres restantes. En `entero` el
  // cero SÍ se pinta: cero visitas es un hecho medido, no un dato que falta.
  if (v == null) return '—'
  const n = Number(v)
  if (formato === 'dinero') return formatMonto(n)
  if (formato === 'entero') return n.toLocaleString('es-MX', { maximumFractionDigits: 0 })
  if (formato === 'horas') {
    return `${n.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`
  }
  // La superficie lleva su unidad: «18» a secas no dice metros, y esta columna
  // convive con cinco de pesos.
  return `${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`
}

// «Van a arreglarla» no es lo mismo que «van a inspeccionarla», y esa
// distinción ES el guion del dueño (Tlalpan contra Santa Mónica): el total de
// visitas no la ve. De más a menos, porque lo que se busca es qué tipo de
// trabajo se está comiendo el sitio.
//
// Un tipo que no está en `TIPO_OT_LABEL` se pinta con su clave y NO se omite:
// una OT histórica con un tipo retirado del catálogo sigue contando en
// `visitas`, así que omitirla dejaría dos cifras que no cuadran sin decir por
// qué. `MONTAJE_DIGITAL` ya es uno de esos (`lib/tipos-ot.ts`).
export function resumenVisitasPorTipo(porTipo: Record<string, number> | undefined): string {
  if (!porTipo) return ''
  return Object.entries(porTipo)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tipo, n]) => `${TIPO_OT_LABEL[tipo as keyof typeof TIPO_OT_LABEL] ?? tipo} ${n}`)
    .join(' · ')
}

// El desglose por bucket que TODA dimensión trae en `periodos[]`, y que hasta
// hoy no llegaba a la pantalla. Se pinta en el orden del SERVIDOR: los buckets
// son una serie de tiempo y ordenarlos por importe los hace ilegibles.
export const COLUMNAS_DESGLOSE: { clave: keyof PeriodoFila; label: string; formato: FormatoColumna }[] = [
  { clave: 'etiqueta', label: 'Periodo', formato: 'texto' },
  { clave: 'ingreso', label: 'Ingreso', formato: 'dinero' },
  { clave: 'costoEspacio', label: 'Espacio', formato: 'dinero' },
  { clave: 'costoOperacion', label: 'Operación', formato: 'dinero' },
  { clave: 'margen', label: 'Margen', formato: 'dinero' },
  { clave: 'visitas', label: 'Visitas', formato: 'entero' },
]

export function desgloseDeFila(f: { periodos?: readonly PeriodoFila[] }): PeriodoFila[] {
  // Copia, y sin ordenar: el orden es el del servidor. La copia es por lo mismo
  // que en `ordenarFilas` — nada de lo que sale de aquí debe poder mutar la
  // respuesta que guarda el `useState`.
  return [...(f.periodos ?? [])]
}

export interface AvisoReporte {
  clave: 'periodo-en-curso' | 'm2-convencion' | 'm2-excluidas' | 'sin-contrato' | 'sin-ingreso'
  texto: string
}

export interface ReporteParaAvisos {
  dimension: DimensionUI
  /** El rango que se pidió. `AAAA-MM-DD`, inclusive. */
  desde: string
  hasta: string
  /**
   * El día de hoy, INYECTADO y no leído de `new Date()` aquí dentro: es lo que
   * permite probar el aviso del periodo en curso sin falsear el reloj.
   *
   * Los tres son obligatorios a propósito, aunque solo los use un aviso. Con
   * ellos opcionales, la pantalla podía olvidarse de pasarlos y el aviso
   * **dejaría de salir sin que nada se quejara** — que es EXACTAMENTE el defecto
   * que esta pantalla ya tuvo con las columnas de `operacion` y `m2`, campos
   * opcionales que nadie leía. Obligatorios, el typecheck lo impide.
   */
  hoy: Date
  filas: readonly FilaOrdenable[]
  excluidas?: ExclusionesM2 | null
  convencionM2?: ConvencionM2 | null
}

// La frase que dice QUÉ cuenta como metro cuadrado en las cifras de la tabla.
// Va siempre, porque un número por metro cuadrado sin esto no se puede
// conciliar con nada.
//
// La convención vigente desde el 2026-09-18 es `todas-las-caras`, por decisión
// del dueño («los m2 los define cada pantalla igual que cada cara»), y su texto
// está redactado como lo que es: una afirmación. **No dice que haya nada
// pendiente**, porque ya no lo hay — hasta esa fecha sí lo decía, y dejarlo
// habría hecho que la pantalla siguiera preguntando algo ya contestado.
//
// El texto de `una-cara` se conserva entero porque la bandera del motor
// (`MULTIPLICAR_M2_POR_CARAS`) se conserva: si el dueño cambia de opinión, el
// aviso vuelve a ser cierto sin escribir una línea. Y nombra la convención
// vigente como la alternativa, para que quien lo lea sepa que la otra existe.
const TEXTO_CONVENCION: Record<ConvencionM2, string> = {
  'todas-las-caras':
    'La superficie suma TODAS las caras de cada pantalla: una de dos caras de 3 × 6 cuenta 36 m², no 18. Es la superficie que se vende, y cada pantalla aporta la de sus propias caras.',
  'una-cara':
    'La superficie es la de UNA cara: una pantalla de dos caras de 3 × 6 cuenta 18 m², no 36. Mide la superficie del soporte y no la que se vende, así que las pantallas de varias caras salen mejor situadas que si se contaran todas.',
}

// Lo que el reporte NO mide, o deja fuera, dicho ENCIMA de la tabla en vez de
// escondido detrás de cifras que parecen completas.
//
// Los textos se arman aquí y no en el `.tsx` por el motivo de siempre —sin jsdom
// no se prueba lo que vive en un componente— y porque uno de ellos era FALSO en
// una dimensión sin que nada se quejara: en `trimestre`, `tieneContrato`
// significa «hubo renta en el trimestre» y la fila no es una pantalla
// (`vault/02-Backend/reportes-dimensiones.md` §3), así que «2 pantallas no
// tienen contrato» sobre dos trimestres sin renta afirma algo que no existe.
export function avisosDelReporte(r: ReporteParaAvisos): AvisoReporte[] {
  const avisos: AvisoReporte[] = []

  // ─── EL PERIODO QUE NO HA CERRADO ─────────────────────────────────────────
  // Va PRIMERO porque cambia cómo se lee todo lo demás que hay en pantalla. Un
  // aviso sobre la validez de las cifras puesto debajo de las cifras llega
  // tarde.
  //
  // La pantalla abre en el trimestre EN CURSO por decisión del dueño
  // (`RANGO_DE_APERTURA`, 2026-09-18), y el precio de esa decisión es este
  // aviso. Sin él, lo primero que se ve es `Ingreso $0.00 · Costo $184,500.00 ·
  // Margen ($184,500.00)` —medido en la base sembrada— y **eso se lee como una
  // pérdida real cuando no lo es**: es un periodo a medias.
  //
  // El texto dice las tres cosas que hacen falta para no leerlo mal, y ninguna
  // es opcional:
  //  1. que el periodo sigue abierto, con cuánto lleva corrido;
  //  2. EL MECANISMO — la renta ya corrió completa y lo vendido todavía no está
  //     dentro. Sin esto, «el periodo está incompleto» no explica por qué la
  //     cifra sale negativa ni hacia dónde va a moverse;
  //  3. que no se compara con un trimestre terminado.
  //
  // Y está escrito en lenguaje de negocio. Quien lo lee vende publicidad: no
  // hay un solo nombre de campo ni una palabra de código, y hay una prueba que
  // lo vigila.
  if (solapaTrimestreEnCurso({ desde: r.desde, hasta: r.hasta }, r.hoy)) {
    const { corridos, totales, etiqueta } = avanceDelTrimestreEnCurso(r.hoy)
    avisos.push({
      clave: 'periodo-en-curso',
      texto: `El periodo que estás viendo toca ${etiqueta}, que está EN CURSO: llevan ${corridos} de sus ${totales} días. La renta de los espacios ya corrió esos ${corridos} días completos, pero lo que se vendió se cobra al cerrar, así que el ingreso todavía no está dentro y el margen sale peor de lo que va a quedar. No lo compares con un trimestre terminado.`,
    })
  }

  // Primero la convención, porque sin ella las cifras por metro de la tabla no
  // se pueden conciliar con nada: una cifra por metro cuadrado sin decir qué
  // cuenta como metro cuadrado no significa nada.
  if (r.convencionM2) {
    avisos.push({ clave: 'm2-convencion', texto: TEXTO_CONVENCION[r.convencionM2] })
  }

  // La nota viene REDACTADA del servidor (`notaDeExclusiones`) y se pinta tal
  // cual. Volver a escribirla aquí sería la segunda implementación de la misma
  // frase, que es el error de raíz que este repo documenta
  // (`lib/server/tenant.ts:87-89`): divergirían, y divergir aquí significa
  // decirle al usuario que se excluyó otra cosa de la que se excluyó.
  //
  // Y se pinta TAMBIÉN cuando no se excluyó nada, porque «no excluí ninguna» y
  // «no te lo digo» se ven igual si no hay texto — el hallazgo C1 de la
  // auditoría QA otra vez, el silencio indistinguible de la ausencia.
  if (r.excluidas) {
    avisos.push({ clave: 'm2-excluidas', texto: r.excluidas.nota })
  }

  // Solo donde la fila ES una pantalla. El sustantivo se declara una vez, en
  // `consulta.ts`, porque lo leen también la cabecera y la tabla.
  if (r.dimension !== 'trimestre') {
    const n = r.filas.filter((f) => !f.tieneContrato).length
    if (n > 0) {
      avisos.push({
        clave: 'sin-contrato',
        texto: `${cuenta(n, r.dimension)} ${n === 1 ? 'no tiene' : 'no tienen'} contrato de arrendamiento en el periodo: su costo del espacio sale en cero porque falta el dato, no porque sea gratis, y su margen se lee mejor de lo que es.`,
      })
    }
  }

  const n = r.filas.filter((f) => f.ingreso === 0).length
  if (n > 0) {
    avisos.push({
      clave: 'sin-ingreso',
      texto:
        r.dimension === 'trimestre'
          ? // Un trimestre sin movimiento SÍ aparece, en cero y a propósito: un
            // hueco en una serie se lee como «faltan datos» y un cero se lee
            // como «no pasó nada», que es la verdad.
            `${cuenta(n, r.dimension)} sin ingreso en el rango. ${n === 1 ? 'Aparece' : 'Aparecen'} en cero a propósito: en una serie de tiempo un hueco se lee como «faltan datos» y un cero se lee como «no pasó nada».`
          : // Son justo las que este reporte existe para encontrar, y su
            // `margenPct` es `null`, así que en la columna del porcentaje no se
            // ven.
            `${cuenta(n, r.dimension)} ${n === 1 ? 'costó' : 'costaron'} sin vender nada en el periodo, así que no ${n === 1 ? 'tiene' : 'tienen'} margen porcentual (la columna sale con «—»).`,
    })
  }

  return avisos
}
