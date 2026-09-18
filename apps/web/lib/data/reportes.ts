import type { ContratoArrendamiento, Sitio, TipoOT } from './types'
import {
  rentaAtribuidaPorSitio,
  contratoVigentePorSitio,
  etiquetaBucket,
  type DatosAtribucion,
} from './derive'
import { costoDeOt } from '../costos-ot'

// ============================================================================
//  lib/data/reportes.ts — Rentabilidad por periodo. LÓGICA PURA.
// ----------------------------------------------------------------------------
//  Es el motor que corre DETRÁS de `GET /api/reportes/rentabilidad`, en el
//  servidor. No lo importa ninguna pantalla y no debe hacerlo: el reporte no
//  pasa por el store.
//
//  ─── Qué reusa y qué es nuevo ────────────────────────────────────────────
//  REUSA, sin tocarla, la atribución de la renta de un contrato de predio entre
//  las caras de sus pantallas: `rentaAtribuidaPorSitio()` (derive.ts:1282), con
//  su distinción entre contrato de predio y contrato de pantalla suelta. Eso
//  está pensado y probado (`derive.anclaje-contrato.test.ts`) y rehacerlo aquí
//  habría creado dos verdades sobre el mismo dinero.
//
//  ES NUEVO el eje de tiempo. `margenPorSitio()` (derive.ts:1308) es una FOTO
//  DE HOY: filtra `ini <= hoy && fin >= hoy` y no sabe de periodos. Un reporte
//  que verá historia de años necesita repartir.
//
//  ES NUEVA, desde el 2026-09-18, LA SELECCIÓN DEL CONTRATO POR PERIODO. Ver
//  el bloque «El contrato que gobierna un PERIODO» más abajo: es el defecto que
//  hacía deshonesto cualquier reporte de un trimestre pasado.
//
//  ─── Por qué vive en `lib/data/` y no en `lib/server/` ───────────────────
//  Porque es puro y se prueba sin Postgres (`reportes.test.ts`), igual que
//  `derive.ts`. El SQL —y solo el SQL— vive en `lib/server/reportes-repo.ts`,
//  que es quien lee la base y llama aquí.
//
//  ─── Las cuatro dimensiones, y por qué no son un `group by` ──────────────
//  Cada una contesta una PREGUNTA distinta, con su propio orden y sus propias
//  columnas:
//
//   · `sitio`     → ¿qué pantallas pierden dinero?        (peor margen primero)
//   · `trimestre` → ¿cómo evoluciona el negocio?          (orden CRONOLÓGICO)
//   · `operacion` → ¿dónde se nos va el dinero en visitas? (más operación primero)
//   · `m2`        → ¿qué superficie estática rinde?        (peor margen/m² primero)
//
//  Las cuatro comparten la MATRIZ sitio × periodo (`matriz()`), que es donde
//  vive el prorrateo, y se diferencian solo en cómo la pivotan. Si cada una
//  recalculara el dinero, cuatro dimensiones darían cuatro cifras distintas del
//  mismo mes.
//
//  ─── Lo que esta versión sigue sin hacer ─────────────────────────────────
//  NO HAY AGREGACIÓN EN SQL: el motor lee y suma en Node. El límite del
//  endpoint existe justamente para que ese porte no toque ninguna pantalla.
// ============================================================================

// Las cuatro dimensiones DECLARADAS del contrato del endpoint. Se declaran AQUÍ
// y el controller valida con zod contra esta misma lista: dos declaraciones
// —una en el motor y otra en el validador— dejarían un enum que acepta una
// dimensión sin motor, o un motor que nadie puede pedir.
export const DIMENSIONES_REPORTE = ['sitio', 'trimestre', 'operacion', 'm2'] as const
export type DimensionReporte = (typeof DIMENSIONES_REPORTE)[number]

// Las dos granularidades que admite un reporte de dinero. Son un subconjunto de
// `Granularidad` (derive.ts): `dia` y `semana` existen para la gráfica de
// ocupación y NO valen aquí — una rentabilidad por día sobre historia de años es
// la consulta sin límite que este endpoint viene a evitar.
export type GranularidadReporte = 'mes' | 'trimestre'

export interface RangoReporte {
  /** `YYYY-MM-DD`, inclusive. */
  desde: string
  /** `YYYY-MM-DD`, inclusive. */
  hasta: string
}

type OpcionesReporte = RangoReporte & { granularidad: GranularidadReporte }

export interface Bucket {
  /** `2026-03` o `2026-T1`. Estable, para casar filas entre peticiones. */
  clave: string
  /** `mar` o `T1 2026`. Para pintar. */
  etiqueta: string
  desde: string
  hasta: string
}

export interface PeriodoFila extends Bucket {
  ingreso: number
  costoEspacio: number
  costoOperacion: number
  costoTotal: number
  margen: number
  /** Órdenes de trabajo que cayeron en este periodo. */
  visitas: number
}

export interface FilaRentabilidad {
  /** Id del sitio, o clave del trimestre (`2026-T1`), según la dimensión. */
  clave: string
  etiqueta: string
  /** Clave interna o código de proveedor, para desambiguar nombres repetidos. */
  detalle: string
  ingreso: number
  costoEspacio: number
  costoOperacion: number
  costoTotal: number
  margen: number
  /**
   * Porcentaje sobre el ingreso, o `null` cuando no hubo ingreso. NO es 0:
   * un «0 %» sobre una pantalla con 15 000 de renta y cero ventas se lee como
   * «no gana ni pierde», que es exactamente lo contrario de lo que pasó.
   */
  margenPct: number | null
  tieneContrato: boolean
  arrendador: string | null
  periodos: PeriodoFila[]
  /** Órdenes de trabajo del rango. Es un hecho del periodo en toda dimensión. */
  visitas: number

  // ─── Solo en `operacion` ────────────────────────────────────────────────
  /** Cuántas visitas de cada tipo de OT. `{ HERRERIA: 2, INSPECCION: 1 }`. */
  visitasPorTipo?: Record<string, number>
  /** Qué proporción del ingreso se comió la operación. `null` sin ingreso. */
  costoOperacionPct?: number | null
  /** Horas REALES en sitio, de las OT que tienen las dos marcas de tiempo. */
  horasEnSitio?: number | null
  /** Sobre cuántas visitas se midieron esas horas. */
  visitasConDuracion?: number

  // ─── Solo en `m2` ───────────────────────────────────────────────────────
  /** Superficie considerada, en metros cuadrados. Ver `CONVENCION_M2`. */
  m2?: number
  ingresoPorM2?: number
  margenPorM2?: number
}

export interface Totales {
  ingreso: number
  costoEspacio: number
  costoOperacion: number
  costoTotal: number
  margen: number
  margenPct: number | null
}

/** Qué se dejó fuera del reporte por m² y por qué. Ver `rentabilidadPorM2`. */
export interface ExclusionesM2 {
  /** Pantallas que venden spots, no metros. */
  digitales: number
  /** Estáticas sin `ancho` o sin `alto` capturados. */
  sinMedidas: number
  /** Frase lista para pintar: el número no debe aparecer sin su porqué. */
  nota: string
}

export type ConvencionM2 = 'una-cara' | 'todas-las-caras'

export interface ReporteRentabilidad {
  dimension: DimensionReporte
  granularidad: GranularidadReporte
  desde: string
  hasta: string
  periodos: Bucket[]
  filas: FilaRentabilidad[]
  totales: Totales
  /** Solo en `m2`: cuántas pantallas quedaron fuera del ranking y por qué. */
  excluidas?: ExclusionesM2
  /** Solo en `m2`: qué cuenta como metro cuadrado en estas cifras. */
  convencionM2?: ConvencionM2
}

interface ReservaReporte {
  sitioId: string
  precio: number
  estatus: string
  fechaInicio: string
  fechaFin: string
}

interface OtReporte {
  sitioId: string | null
  tipo: string
  estatus: string
  fechaCompletada?: string | null
  fechaProgramada?: string | null
  creadoEn?: string | null
  /**
   * Duración real en segundos, cuando la OT tiene `fecha_inicio` y
   * `fecha_completada`. Se calcula EN SQL como un intervalo para que la zona
   * horaria no entre en la cuenta. `null` = no se sabe, que no es lo mismo que
   * cero.
   */
  duracionSeg?: number | null
}

export interface DatosRentabilidad extends DatosAtribucion {
  arrendadores: { id: string; nombre: string }[]
  reservas: ReservaReporte[]
  ordenesTrabajo: OtReporte[]
  /** Costo por tipo de OT de ESTE tenant. Vacío = manda `COSTOS_OT_RESPALDO`. */
  costosOt?: Partial<Record<TipoOT, number>> | null
}

// ─── Fechas de CALENDARIO, sin zona horaria ─────────────────────────────────
//
// Todo lo que entra aquí es una fecha de calendario —`date` en Postgres—, nunca
// un instante. `new Date('2026-07-17')` la interpreta como medianoche UTC, que
// en México (UTC−6) cae a las 18:00 del día ANTERIOR en hora local; este repo ya
// pagó ese error y lo documenta en `derive.ts` → `diasHasta`.
//
// La aritmética se hace sobre un número de día entero construido con `Date.UTC`
// desde las partes del texto. Los dos extremos se construyen igual, así que la
// zona no entra en la cuenta en ningún momento.
function partes(iso: string): [number, number, number] {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return [a, m, d]
}

/** Día absoluto (entero) de una fecha de calendario. */
function nDia(iso: string): number {
  const [a, m, d] = partes(iso)
  return Date.UTC(a, m - 1, d) / 86_400_000
}

/** `YYYY-MM-DD` con ceros a la izquierda, desde un día absoluto. */
function isoDe(n: number): string {
  const d = new Date(n * 86_400_000)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}-${mm}-${dd}`
}

/** Días naturales del mes (1–12). */
function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate()
}

/** Días INCLUSIVE entre dos fechas. 0 si están invertidas. */
function diasInclusive(desde: string, hasta: string): number {
  return Math.max(0, nDia(hasta) - nDia(desde) + 1)
}

/** Días INCLUSIVE en los que dos rangos se solapan. 0 si no se tocan. */
function diasSolapados(aDesde: string, aHasta: string, bDesde: string, bHasta: string): number {
  const ini = Math.max(nDia(aDesde), nDia(bDesde))
  const fin = Math.min(nDia(aHasta), nDia(bHasta))
  return Math.max(0, fin - ini + 1)
}

/** ¿Esta fecha cae dentro del rango, extremos incluidos? */
function dentro(fecha: string, desde: string, hasta: string): boolean {
  const n = nDia(fecha)
  return n >= nDia(desde) && n <= nDia(hasta)
}

// Dinero: dos decimales. Se redondea AL SALIR, nunca en medio de la cuenta.
function centavos(v: number): number {
  return Math.round(v * 100) / 100
}

// ─── El eje de tiempo ───────────────────────────────────────────────────────

/**
 * De un rango de fechas a los buckets de calendario que lo cubren, RECORTADOS
 * al rango. Los buckets son meses o trimestres naturales, no ventanas móviles
 * de 30 días: la renta de un contrato se paga por mes de calendario, y un
 * reporte cuyos periodos no casan con los del recibo no se puede conciliar.
 */
export function bucketsDelRango(rango: RangoReporte, gran: GranularidadReporte): Bucket[] {
  const [aDesde, mDesde] = partes(rango.desde)
  const [aHasta, mHasta] = partes(rango.hasta)
  if (nDia(rango.hasta) < nDia(rango.desde)) return []

  const paso = gran === 'trimestre' ? 3 : 1
  // El primer bucket empieza en el arranque de SU mes o trimestre natural, no
  // en la fecha pedida: si no, un rango que empieza el 10 de febrero daría un
  // «trimestre» del 10/02 al 09/05 y dejaría de ser comparable con el siguiente.
  const mesInicial = gran === 'trimestre' ? Math.floor((mDesde - 1) / 3) * 3 : mDesde - 1

  const out: Bucket[] = []
  let anio = aDesde
  let mes = mesInicial // 0–11
  for (let guardia = 0; guardia < 4000; guardia++) {
    if (anio > aHasta || (anio === aHasta && mes > mHasta - 1)) break

    const bDesde = isoDe(Date.UTC(anio, mes, 1) / 86_400_000)
    const bHasta = isoDe(Date.UTC(anio, mes + paso, 0) / 86_400_000)

    const desde = nDia(bDesde) > nDia(rango.desde) ? bDesde : rango.desde
    const hasta = nDia(bHasta) < nDia(rango.hasta) ? bHasta : rango.hasta

    const clave =
      gran === 'trimestre'
        ? `${anio}-T${Math.floor(mes / 3) + 1}`
        : `${anio}-${String(mes + 1).padStart(2, '0')}`

    out.push({
      clave,
      // `new Date(anio, mes, 1)` en hora LOCAL a propósito: `etiquetaBucket`
      // usa `toLocaleDateString`, y una fecha construida en UTC saldría con el
      // mes anterior al oeste de Greenwich.
      etiqueta: etiquetaBucket(new Date(anio, mes, 1), gran),
      desde: isoDe(nDia(desde)),
      hasta: isoDe(nDia(hasta)),
    })

    mes += paso
    while (mes > 11) {
      mes -= 12
      anio += 1
    }
  }
  return out
}

/**
 * Cuántos MESES de renta cubre un rango de fechas.
 *
 * Un mes natural completo vale 1, tenga 28, 30 o 31 días, y un trimestre
 * completo vale 3. Dividir los días por un 30 fijo haría que febrero costara
 * 28/30 de mes y julio 31/30: la renta mensual de un contrato se paga una vez
 * por mes, no por día, así que la unidad tiene que ser el mes de calendario.
 *
 * Un mes a medias vale la fracción de SUS días naturales. Eso hace que la
 * función sea aditiva —la suma de los meses de los buckets es el total del
 * rango— y por eso el desglose por periodo cuadra siempre con la fila. Y es lo
 * que permite partir un bucket en segmentos de vigencia sin descuadrarlo.
 */
export function mesesEquivalentes(desde: string, hasta: string): number {
  if (nDia(hasta) < nDia(desde)) return 0
  const [aD, mD] = partes(desde)
  const [aH, mH] = partes(hasta)

  let total = 0
  let anio = aD
  let mes = mD - 1
  for (let guardia = 0; guardia < 4000; guardia++) {
    if (anio > aH || (anio === aH && mes > mH - 1)) break
    const mDesde = isoDe(Date.UTC(anio, mes, 1) / 86_400_000)
    const mHasta = isoDe(Date.UTC(anio, mes + 1, 0) / 86_400_000)
    total += diasSolapados(desde, hasta, mDesde, mHasta) / diasDelMes(anio, mes + 1)
    mes += 1
    if (mes > 11) {
      mes = 0
      anio += 1
    }
  }
  return total
}

// ════════════════════════════════════════════════════════════════════════════
//  El contrato que gobierna un PERIODO, no el de hoy
// ----------------------------------------------------------------------------
//  Corregido el 2026-09-18. Hasta entonces el costo del espacio se resolvía con
//  `contratoVigentePorSitio()` (derive.ts:1239), que filtra por
//  `contratoActivo()` (derive.ts:1133) — VIGENTE, POR_VENCER o RENOVADO: EL
//  ESTATUS DE HOY. Con eso, un reporte de un periodo pasado mentía de dos
//  maneras a la vez y ninguna daba error:
//
//   1. NO VEÍA el contrato que gobernaba ese periodo y ya venció. La pantalla
//      salía a costo cero, o no salía en absoluto porque «no tuvo movimiento».
//      Un margen calculado sin su renta no es optimista: es falso.
//   2. Aplicaba el cambio de renta HACIA ATRÁS. El contrato de hoy, con su
//      importe de hoy, se cobraba en todo periodo anterior que su vigencia
//      tocara.
//
//  La regla nueva: EL CONTRATO QUE CUENTA ES EL QUE SOLAPA EL RANGO PEDIDO, con
//  independencia de su estatus de hoy.
// ════════════════════════════════════════════════════════════════════════════

// Los dos estatus que NO acreditan un acuerdo real en NINGÚN periodo:
//
//   · INCOMPLETO es un pendiente de CAPTURA (ADR 0001): sus cuatro datos pueden
//     estar en NULL. Se excluye aunque traiga importe, porque el acuerdo todavía
//     no está afirmado.
//   · CANCELADO es un pendiente DESCARTADO: nunca se pagó. Cobrarlo sería
//     inventar un costo, que es peor que esconderlo.
//
// Es la misma pareja que `sitiosSinContratoCompleto()` (derive.ts) usa en su
// `NO_ACREDITAN`, y por el mismo motivo. Y es la razón por la que aquí NO sirve
// `contratoActivo()`: esa función además excluye VENCIDO, que es precisamente el
// estatus del contrato que gobernó un trimestre pasado. Un VENCIDO está
// caducado, no es falso.
const NO_ACREDITAN_EN_SU_PERIODO = new Set(['INCOMPLETO', 'CANCELADO'])

/** Vigencia del contrato en días absolutos. `fechaFin` nula = fin abierto. */
function vigencia(c: ContratoArrendamiento): [number, number] {
  return [
    nDia(c.fechaInicio.slice(0, 10)),
    c.fechaFin ? nDia(c.fechaFin.slice(0, 10)) : Number.MAX_SAFE_INTEGER,
  ]
}

/** Los contratos que pudieron representar un costo dentro del rango pedido. */
function contratosDelPeriodo(
  contratos: ContratoArrendamiento[],
  rango: RangoReporte,
): ContratoArrendamiento[] {
  const desde = nDia(rango.desde)
  const hasta = nDia(rango.hasta)
  return contratos.filter((c) => {
    if (NO_ACREDITAN_EN_SU_PERIODO.has(c.estatus)) return false
    const [ini, fin] = vigencia(c)
    return ini <= hasta && fin >= desde
  })
}

// El ADAPTADOR, y conviene entender por qué es un adaptador y no una trampa.
//
// `rentaAtribuidaPorSitio()` y `contratoVigentePorSitio()` deciden con el
// estatus porque su pregunta es «¿qué se paga HOY?». Aquí la pregunta ya se
// contestó antes —`contratosDelPeriodo()` seleccionó los que gobiernan el
// periodo— y lo único que se les pide es la ATRIBUCIÓN: el reparto de la renta
// de un contrato de predio entre las caras de sus pantallas, y la precedencia
// del contrato del predio sobre el propio de la pantalla.
//
// Se les pasa una copia con el estatus normalizado para que su filtro no vuelva
// a decidir lo que ya está decidido. NO se cambia nada en la base ni en la
// respuesta: es el argumento de una llamada.
//
// La alternativa era copiar la atribución aquí, y este repo documenta esa clase
// de error como su error de raíz (`lib/server/tenant.ts:87-89`): dos
// implementaciones divergen, y aquí divergir significa que el reporte y el
// dashboard darían dos costos distintos para la misma pantalla.
function comoVigente(c: ContratoArrendamiento): ContratoArrendamiento {
  return { ...c, estatus: 'VIGENTE' as ContratoArrendamiento['estatus'] }
}

/**
 * Parte un rango en los TROZOS donde el conjunto de contratos en vigor no
 * cambia, cortando por cada `fechaInicio` y cada `fechaFin` que caiga dentro.
 *
 * Hace falta porque un relevo de contrato no espera al final del mes. Si el
 * bucket no se partiera, dos contratos del mismo predio solaparían el mismo
 * periodo y el desempate de `contratoVigentePorSitio()` —la renta mayor, que es
 * lo conservador para una foto de hoy— se quedaría con el bucket entero y
 * perdería los días del otro.
 *
 * `mesesEquivalentes` es aditiva, así que la suma de los trozos es exactamente
 * el bucket: partirlo no descuadra el desglose.
 */
function segmentosDeVigencia(
  desde: string,
  hasta: string,
  contratos: ContratoArrendamiento[],
): RangoReporte[] {
  const ini = nDia(desde)
  const fin = nDia(hasta)
  if (fin < ini) return []

  // Los cortes son los ARRANQUES de cada trozo, más el día siguiente al final.
  const cortes = new Set<number>([ini, fin + 1])
  for (const c of contratos) {
    const [cIni, cFin] = vigencia(c)
    if (cIni > ini && cIni <= fin) cortes.add(cIni)
    if (cFin + 1 > ini && cFin + 1 <= fin) cortes.add(cFin + 1)
  }
  const ordenados = [...cortes].sort((a, b) => a - b)

  const out: RangoReporte[] = []
  for (let i = 0; i < ordenados.length - 1; i++) {
    out.push({ desde: isoDe(ordenados[i]), hasta: isoDe(ordenados[i + 1] - 1) })
  }
  return out
}

interface Atribucion {
  /** Renta mensual atribuida a cada pantalla en este segmento. */
  renta: Map<string, number>
  /** Qué contrato gobierna cada pantalla, por id. */
  gobierna: Map<string, string>
}

// La atribución de un segmento se memoiza por el conjunto de contratos que lo
// cubren: lo normal es que sea el MISMO conjunto en los doce meses del año, y
// recalcularlo por bucket sería recorrer todas las pantallas otras doce veces.
function atribucionDeSegmento(
  sitios: Sitio[],
  cubren: ContratoArrendamiento[],
  memo: Map<string, Atribucion>,
): Atribucion {
  const clave = cubren
    .map((c) => c.id)
    .sort()
    .join('|')
  const previa = memo.get(clave)
  if (previa) return previa

  const contexto: DatosAtribucion = { sitios, contratos: cubren.map(comoVigente) }
  const a: Atribucion = {
    renta: rentaAtribuidaPorSitio(contexto),
    gobierna: new Map(
      [...contratoVigentePorSitio(contexto)].map(([sitioId, c]) => [sitioId, c.id]),
    ),
  }
  memo.set(clave, a)
  return a
}

// ─── La matriz sitio × periodo ──────────────────────────────────────────────

interface Celda {
  ingreso: number
  costoEspacio: number
  costoOperacion: number
  visitas: number
  visitasConDuracion: number
  segundos: number
  /**
   * Visitas por tipo de OT. Es `null` —y no un `Map` vacío— mientras no haya
   * ninguna, y eso NO es cosmético: la matriz tiene una celda por pantalla y por
   * periodo, así que un reporte de cinco años por mes sobre quinientas pantallas
   * son 30 000 celdas, y la abrumadora mayoría no tiene ni una orden de trabajo.
   * Un `Map` vacío por celda es el campo más caro de los siete y el que menos
   * se usa.
   */
  porTipo: Map<string, number> | null
}

function celdaVacia(): Celda {
  return {
    ingreso: 0,
    costoEspacio: 0,
    costoOperacion: 0,
    visitas: 0,
    visitasConDuracion: 0,
    segundos: 0,
    porTipo: null,
  }
}

// Fecha con la que una OT entra en un periodo: la de completada si ya se hizo;
// si no, la programada; si no, la de creación. Se elige así porque el costo se
// devenga cuando el trabajo ocurre, y una OT pendiente ya tiene fecha prevista
// —contarla por su creación la metería en el mes en que se capturó, no en el que
// se va a trabajar.
//
// ⚠️ Esta prelación está escrita DOS veces: aquí y en el `where` de
// `reportes-repo.ts`, que decide qué OT LLEGAN mientras esto decide en qué
// periodo CAEN. Si difirieran, una OT quedaría fuera del reporte sin aparecer en
// ningún periodo y sin dar error. `reportes-repo.aislamiento.test.ts` compara
// las dos y se pone rojo si alguien cambia una sola.
function fechaDeOt(o: OtReporte): string | null {
  const f = o.fechaCompletada ?? o.fechaProgramada ?? o.creadoEn ?? null
  return f ? f.slice(0, 10) : null
}

function agrupar<T>(items: T[], clave: (t: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const it of items) {
    const k = clave(it)
    if (k == null) continue
    const lista = out.get(k)
    if (lista) lista.push(it)
    else out.set(k, [it])
  }
  return out
}

interface Matriz {
  buckets: Bucket[]
  /** Una fila por pantalla, alineada con `buckets`. */
  porSitio: Map<string, Celda[]>
  /** El contrato que gobernó cada pantalla en el rango (el más reciente). */
  contratoDelPeriodo: Map<string, ContratoArrendamiento>
}

/**
 * El cálculo del dinero, UNA sola vez. Las cuatro dimensiones pivotan esto y
 * ninguna vuelve a sumar: si cada una recalculara, cuatro dimensiones darían
 * cuatro cifras distintas del mismo mes.
 */
function matriz(datos: DatosRentabilidad, opts: OpcionesReporte): Matriz {
  const buckets = bucketsDelRango(opts, opts.granularidad)

  // Las que NO cuentan se descartan una sola vez, antes de los bucles:
  // CANCELADA no suma (una reserva TENTATIVA sí, el lugar ya está apartado —
  // misma regla que `clientesEnPantalla` en derive.ts).
  const reservasDe = agrupar(
    datos.reservas.filter((r) => r.estatus !== 'CANCELADA'),
    (r) => r.sitioId,
  )
  // Una OT sin `sitio_id` (la columna es nullable, `on delete set null`) no se
  // le carga a ninguna pantalla: `agrupar` la descarta.
  const otsDe = agrupar(
    datos.ordenesTrabajo.filter((o) => o.estatus !== 'CANCELADA'),
    (o) => o.sitioId,
  )

  const contratos = contratosDelPeriodo(datos.contratos, opts)
  const porId = new Map(contratos.map((c) => [c.id, c]))
  const memo = new Map<string, Atribucion>()

  const porSitio = new Map<string, Celda[]>()
  for (const s of datos.sitios) porSitio.set(s.id, buckets.map(celdaVacia))
  const contratoDelPeriodo = new Map<string, ContratoArrendamiento>()

  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i]

    for (const s of datos.sitios) {
      const celda = porSitio.get(s.id)![i]

      // ─── INGRESO: prorrateo por DÍAS ───────────────────────────────────
      // `precio × (días de la reserva dentro del bucket / días totales de la
      // reserva)`. El precio de una reserva es el de TODO su periodo —así se
      // captura y así se factura—, así que meterlo entero en el bucket donde
      // empieza haría que una campaña de marzo a abril pareciera ingreso de
      // marzo. Repartir por días es lo único que hace que el reporte de dos
      // trimestres consecutivos sume exactamente el precio, sin perder ni
      // inventar dinero.
      //
      // Se reparte por DÍAS y no por meses porque el ingreso se devenga cada
      // día que la pantalla exhibe, al contrario que la renta —que se paga por
      // mes de calendario, ver `mesesEquivalentes`.
      for (const r of reservasDe.get(s.id) ?? []) {
        const diasTotales = diasInclusive(r.fechaInicio, r.fechaFin)
        if (diasTotales <= 0) continue
        const dentroDelBucket = diasSolapados(r.fechaInicio, r.fechaFin, b.desde, b.hasta)
        if (dentroDelBucket === 0) continue
        celda.ingreso += r.precio * (dentroDelBucket / diasTotales)
      }

      // ─── COSTO DE OPERACIÓN: las OT que caen en el bucket ──────────────
      // NO se prorratea: una orden de trabajo es un evento, no un periodo. Su
      // costo entra completo en el mes en que se trabaja, y el importe sale por
      // TIPO desde `config_negocio.costos_ot` (ADR 0011), con respaldo.
      for (const o of otsDe.get(s.id) ?? []) {
        const f = fechaDeOt(o)
        if (!f || !dentro(f, b.desde, b.hasta)) continue
        celda.costoOperacion += costoDeOt(o.tipo, datos.costosOt ?? null)
        celda.visitas += 1
        const porTipo = (celda.porTipo ??= new Map())
        porTipo.set(o.tipo, (porTipo.get(o.tipo) ?? 0) + 1)
        // La duración solo cuenta si se midió. `null` es «no se sabe», que no es
        // lo mismo que «fueron y no tardaron nada».
        if (o.duracionSeg != null && o.duracionSeg > 0) {
          celda.segundos += o.duracionSeg
          celda.visitasConDuracion += 1
        }
      }
    }

    // ─── COSTO DEL ESPACIO: por SEGMENTOS de vigencia dentro del bucket ───
    // El bucket se parte por las fronteras de vigencia de los contratos que lo
    // tocan, y cada trozo se cobra con la atribución de LOS SUYOS. Así un relevo
    // de contrato a mitad de mes cobra cada mitad a su precio, en vez de que uno
    // de los dos se pierda entero.
    for (const seg of segmentosDeVigencia(b.desde, b.hasta, contratos)) {
      const segIni = nDia(seg.desde)
      const segFin = nDia(seg.hasta)
      // Los cortes están puestos en las fronteras, así que un contrato que toca
      // el segmento lo cubre COMPLETO: no hay que recortar nada más.
      const cubren = contratos.filter((c) => {
        const [ini, fin] = vigencia(c)
        return ini <= segIni && fin >= segFin
      })
      if (!cubren.length) continue

      const meses = mesesEquivalentes(seg.desde, seg.hasta)
      if (meses <= 0) continue
      const { renta, gobierna } = atribucionDeSegmento(datos.sitios, cubren, memo)

      for (const s of datos.sitios) {
        const mensual = renta.get(s.id) ?? 0
        if (mensual > 0) porSitio.get(s.id)![i].costoEspacio += mensual * meses
        // El último que gana es el más reciente del rango: los buckets y los
        // segmentos se recorren en orden cronológico. Es el que se enseña en la
        // columna del arrendador, que es la pregunta «¿a quién se le paga esto?».
        const idGobierna = gobierna.get(s.id)
        const original = idGobierna ? porId.get(idGobierna) : undefined
        if (original) contratoDelPeriodo.set(s.id, original)
      }
    }
  }

  // Se redondea AL SALIR de la celda, no en medio de la cuenta: los segmentos de
  // un bucket se suman en crudo y el bucket se redondea una sola vez.
  for (const celdas of porSitio.values()) {
    for (const c of celdas) {
      c.ingreso = centavos(c.ingreso)
      c.costoEspacio = centavos(c.costoEspacio)
      c.costoOperacion = centavos(c.costoOperacion)
    }
  }

  return { buckets, porSitio, contratoDelPeriodo }
}

// ─── De celdas a filas ──────────────────────────────────────────────────────

function periodosDe(buckets: Bucket[], celdas: Celda[]): PeriodoFila[] {
  return buckets.map((b, i) => {
    const c = celdas[i]
    return {
      ...b,
      ingreso: c.ingreso,
      costoEspacio: c.costoEspacio,
      costoOperacion: c.costoOperacion,
      costoTotal: centavos(c.costoEspacio + c.costoOperacion),
      margen: centavos(c.ingreso - c.costoEspacio - c.costoOperacion),
      visitas: c.visitas,
    }
  })
}

// El total de una fila es la SUMA DE LOS PERIODOS YA REDONDEADOS, no el redondeo
// de la suma. Un desglose que no cuadra con su propio total es peor que no tener
// desglose: obliga a desconfiar de los dos.
function sumar(periodos: PeriodoFila[]): Totales {
  const ingreso = centavos(periodos.reduce((a, p) => a + p.ingreso, 0))
  const costoEspacio = centavos(periodos.reduce((a, p) => a + p.costoEspacio, 0))
  const costoOperacion = centavos(periodos.reduce((a, p) => a + p.costoOperacion, 0))
  const costoTotal = centavos(costoEspacio + costoOperacion)
  const margen = centavos(ingreso - costoTotal)
  return {
    ingreso,
    costoEspacio,
    costoOperacion,
    costoTotal,
    margen,
    margenPct: ingreso > 0 ? centavos((margen / ingreso) * 100) : null,
  }
}

function totalesDeFilas(filas: FilaRentabilidad[]): Totales {
  const ingreso = centavos(filas.reduce((a, f) => a + f.ingreso, 0))
  const costoEspacio = centavos(filas.reduce((a, f) => a + f.costoEspacio, 0))
  const costoOperacion = centavos(filas.reduce((a, f) => a + f.costoOperacion, 0))
  const costoTotal = centavos(costoEspacio + costoOperacion)
  const margen = centavos(ingreso - costoTotal)
  return {
    ingreso,
    costoEspacio,
    costoOperacion,
    costoTotal,
    margen,
    margenPct: ingreso > 0 ? centavos((margen / ingreso) * 100) : null,
  }
}

// ¿Pasó algo con esta pantalla en el rango? Una pantalla sin ingreso, sin renta,
// sin OT y sin visitas no aparece: un reporte con quinientas filas a cero no se
// lee, y las que importan —las que cuestan sin vender— sí tienen costo.
//
// Las VISITAS cuentan como movimiento aunque su costo configurado sea 0: una
// inspección que hace el propio dueño no paga cuadrilla (`costos-ot.ts`), y aun
// así es un hecho del periodo que el reporte de operación tiene que enseñar.
function hayMovimiento(t: Totales, visitas: number): boolean {
  return t.ingreso !== 0 || t.costoEspacio !== 0 || t.costoOperacion !== 0 || visitas !== 0
}

// Suma las celdas de VARIAS pantallas bucket a bucket. El número de buckets se
// pasa aparte y no se deduce de la primera fila: un tenant sin ninguna pantalla
// —o un rango donde no sobrevive ninguna— dejaría el arreglo vacío y la serie
// de tiempo se quedaría sin eje, que es un `undefined` tres funciones más allá.
function acumularCeldas(celdas: Celda[][], buckets: number): Celda[] {
  const out = Array.from({ length: buckets }, celdaVacia)
  for (const fila of celdas) {
    for (let i = 0; i < fila.length; i++) {
      out[i].ingreso += fila[i].ingreso
      out[i].costoEspacio += fila[i].costoEspacio
      out[i].costoOperacion += fila[i].costoOperacion
      out[i].visitas += fila[i].visitas
      out[i].visitasConDuracion += fila[i].visitasConDuracion
      out[i].segundos += fila[i].segundos
      if (fila[i].porTipo) {
        const acum = (out[i].porTipo ??= new Map())
        for (const [t, n] of fila[i].porTipo!) acum.set(t, (acum.get(t) ?? 0) + n)
      }
    }
  }
  for (const c of out) {
    c.ingreso = centavos(c.ingreso)
    c.costoEspacio = centavos(c.costoEspacio)
    c.costoOperacion = centavos(c.costoOperacion)
  }
  return out
}

function nombreArrendadorDe(datos: DatosRentabilidad) {
  const mapa = new Map(datos.arrendadores.map((a) => [a.id, a.nombre]))
  return (c: ContratoArrendamiento | undefined): string | null =>
    c?.arrendadorId ? (mapa.get(c.arrendadorId) ?? null) : null
}

// ════════════════════════════════════════════════════════════════════════════
//  1 · `sitio` — ¿qué pantallas pierden dinero?
// ════════════════════════════════════════════════════════════════════════════

export function rentabilidadPorSitio(
  datos: DatosRentabilidad,
  opts: OpcionesReporte,
): ReporteRentabilidad {
  const m = matriz(datos, opts)
  const arrendadorDe = nombreArrendadorDe(datos)
  const filas: FilaRentabilidad[] = []

  for (const s of datos.sitios) {
    const periodos = periodosDe(m.buckets, m.porSitio.get(s.id)!)
    const t = sumar(periodos)
    const visitas = periodos.reduce((a, p) => a + p.visitas, 0)
    if (!hayMovimiento(t, visitas)) continue
    const contrato = m.contratoDelPeriodo.get(s.id)
    filas.push({
      clave: s.id,
      etiqueta: s.nombre,
      detalle: s.claveInterna || s.codigoProveedor || '',
      ...t,
      tieneContrato: !!contrato,
      arrendador: arrendadorDe(contrato),
      periodos,
      visitas,
    })
  }

  // Peor margen primero: la pregunta que contesta este reporte es «¿qué
  // pantallas están perdiendo dinero?», no «¿cómo se llaman?».
  filas.sort((a, b) => a.margen - b.margen)

  return {
    dimension: 'sitio',
    granularidad: opts.granularidad,
    desde: opts.desde,
    hasta: opts.hasta,
    periodos: m.buckets,
    filas,
    totales: totalesDeFilas(filas),
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  2 · `trimestre` — ¿cómo evoluciona el negocio?
// ════════════════════════════════════════════════════════════════════════════

/**
 * Una fila por trimestre natural, sumando TODAS las pantallas. La granularidad
 * sigue mandando en el desglose: con `mes`, cada trimestre trae sus tres meses.
 *
 * Es la única dimensión que NO ordena por peor margen: una serie de tiempo
 * ordenada por importe es ilegible, y la pregunta aquí es «¿cómo va el año?».
 * Por el mismo motivo un trimestre sin movimiento SÍ aparece, en cero: un hueco
 * en una serie se lee como «faltan datos» y un cero como «no pasó nada», que es
 * la verdad.
 */
export function rentabilidadPorTrimestre(
  datos: DatosRentabilidad,
  opts: OpcionesReporte,
): ReporteRentabilidad {
  const m = matriz(datos, opts)
  const totalPorBucket = acumularCeldas([...m.porSitio.values()], m.buckets.length)
  const periodosTodos = periodosDe(m.buckets, totalPorBucket)

  // Los buckets, agrupados por el trimestre natural al que pertenecen. La clave
  // y la etiqueta salen de las mismas funciones que la gráfica de ocupación
  // (`etiquetaBucket`), para que el mismo trimestre no se llame «T1» en una
  // pantalla y «1er trimestre» en otra.
  const orden: string[] = []
  const grupos = new Map<string, { etiqueta: string; indices: number[] }>()
  m.buckets.forEach((b, i) => {
    const [anio, mes] = partes(b.desde)
    const t = Math.floor((mes - 1) / 3)
    const clave = `${anio}-T${t + 1}`
    let g = grupos.get(clave)
    if (!g) {
      // Hora LOCAL a propósito: `etiquetaBucket` usa `toLocaleDateString`, y una
      // fecha construida en UTC saldría con el mes anterior al oeste de
      // Greenwich.
      g = { etiqueta: etiquetaBucket(new Date(anio, t * 3, 1), 'trimestre'), indices: [] }
      grupos.set(clave, g)
      orden.push(clave)
    }
    g.indices.push(i)
  })

  const filas: FilaRentabilidad[] = orden.map((clave) => {
    const g = grupos.get(clave)!
    const periodos = g.indices.map((i) => periodosTodos[i])
    const t = sumar(periodos)
    return {
      clave,
      etiqueta: g.etiqueta,
      // El rango REAL que cubre el trimestre dentro de lo pedido: un reporte que
      // arranca el 10 de febrero no cubre el T1 completo, y la fila lo dice.
      detalle: `${periodos[0].desde} a ${periodos[periodos.length - 1].hasta}`,
      ...t,
      // En una serie de tiempo esto significa «hubo renta en el trimestre», no
      // «hay un contrato»: la fila no es una pantalla.
      tieneContrato: t.costoEspacio !== 0,
      // No hay un arrendador por trimestre: son todos los del periodo.
      arrendador: null,
      periodos,
      visitas: periodos.reduce((a, p) => a + p.visitas, 0),
    }
  })

  return {
    dimension: 'trimestre',
    granularidad: opts.granularidad,
    desde: opts.desde,
    hasta: opts.hasta,
    periodos: m.buckets,
    filas,
    totales: totalesDeFilas(filas),
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  3 · `operacion` — ¿dónde se nos va el dinero en visitas?
// ════════════════════════════════════════════════════════════════════════════

/**
 * Visitas a sitio contra el dinero que ese sitio produce. El reporte nace de un
 * ejemplo textual del dueño, y tiene que poder enseñarlo:
 *
 *   «Tlalpan G500 es menos rentable que G500 Santa Mónica. Han tenido las
 *    mismas campañas, pero a una van a cada rato a arreglarla.»
 *
 * Las visitas son `ordenes_trabajo.sitio_id`, y el costo de cada una sale por
 * TIPO de `config_negocio.costos_ot` (ADR 0011) con respaldo, no de una
 * constante: montar una lona y hacer una inspección no cuestan lo mismo.
 *
 * Ordena por COSTO DE OPERACIÓN descendente y no por peor margen, porque la
 * pregunta no es «¿qué pantalla gana menos?». Una pantalla con margen horrible
 * por una renta cara no es un problema de operación, y saldría arriba tapando
 * las que sí lo son.
 */
export function rentabilidadPorOperacion(
  datos: DatosRentabilidad,
  opts: OpcionesReporte,
): ReporteRentabilidad {
  const m = matriz(datos, opts)
  const arrendadorDe = nombreArrendadorDe(datos)
  const filas: FilaRentabilidad[] = []

  for (const s of datos.sitios) {
    const celdas = m.porSitio.get(s.id)!
    const periodos = periodosDe(m.buckets, celdas)
    const t = sumar(periodos)
    const visitas = periodos.reduce((a, p) => a + p.visitas, 0)
    if (!hayMovimiento(t, visitas)) continue

    const porTipo: Record<string, number> = {}
    let segundos = 0
    let visitasConDuracion = 0
    for (const c of celdas) {
      if (c.porTipo) for (const [tipo, n] of c.porTipo) porTipo[tipo] = (porTipo[tipo] ?? 0) + n
      segundos += c.segundos
      visitasConDuracion += c.visitasConDuracion
    }

    const contrato = m.contratoDelPeriodo.get(s.id)
    filas.push({
      clave: s.id,
      etiqueta: s.nombre,
      detalle: s.claveInterna || s.codigoProveedor || '',
      ...t,
      tieneContrato: !!contrato,
      arrendador: arrendadorDe(contrato),
      periodos,
      visitas,
      visitasPorTipo: porTipo,
      // Qué proporción del ingreso se comió la operación. `null` sin ingreso, no
      // 0: sin nada vendido, «0 %» diría que la operación no pesa.
      costoOperacionPct: t.ingreso > 0 ? centavos((t.costoOperacion / t.ingreso) * 100) : null,
      // Horas REALES en sitio (`fecha_inicio` → `fecha_completada`). `null`
      // cuando ninguna visita las tiene medidas: no se promedia sobre nada.
      horasEnSitio: visitasConDuracion > 0 ? centavos(segundos / 3600) : null,
      visitasConDuracion,
    })
  }

  filas.sort(
    (a, b) =>
      b.costoOperacion - a.costoOperacion ||
      b.visitas - a.visitas ||
      a.etiqueta.localeCompare(b.etiqueta),
  )

  return {
    dimension: 'operacion',
    granularidad: opts.granularidad,
    desde: opts.desde,
    hasta: opts.hasta,
    periodos: m.buckets,
    filas,
    totales: totalesDeFilas(filas),
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  4 · `m2` — ¿qué superficie estática rinde?
// ════════════════════════════════════════════════════════════════════════════

// ─── DECISIÓN DEL DUEÑO, 2026-09-18. NO ES UN VALOR POR OMISIÓN ─────────────
//
//  ¿El metro cuadrado de una pantalla de DOS CARAS de 3 × 6 son 18 m² o 36 m²?
//
//  **Lo decidió Jochelo el 2026-09-18, y quedó CERRADA**: son 36. Sus palabras,
//  literales — «los m2 los define cada pantalla igual que cada cara». O sea que
//  cada pantalla aporta la superficie de TODAS sus caras, y el número de caras
//  sale de la propia pantalla (`sitios.caras`), no de una regla global. El
//  razonamiento de negocio: si se venden las dos caras, las dos son superficie
//  que se monetiza, así que el m² mide la superficie que se VENDE y no la del
//  soporte.
//
//  Estuvo abierta desde el 18/09 por la mañana, cuando la dimensión nació: la
//  alternativa era contar UNA CARA —el m² como superficie del soporte—, que es
//  lo que se implementó mientras no había respuesta, precisamente porque no
//  inventa superficie. **Las dos respuestas cambian el ranking entero**, y por
//  eso no la tomó el código.
//
//  **La bandera SE QUEDA, y eso es deliberado.** Sin ella el siguiente lector
//  encontraría un `× caras` suelto dentro de `superficieM2()` y lo tomaría por
//  un descuido —o por un valor por omisión que nadie eligió— y lo invertiría.
//  Es el mismo criterio que `RANGO_DE_APERTURA` en `components/demo/reportes/
//  consulta.ts`: lo que una persona decidió se deja escrito, con su fecha y con
//  la alternativa nombrada, para que se pueda volver atrás sin rehacer nada.
//  Si el dueño cambia de opinión, esto vuelve a `false` y no se toca nada más.
//
//  Y el reporte DECLARA la convención que usó en `convencionM2`: una cifra por
//  metro cuadrado sin decir qué cuenta como metro cuadrado no se puede
//  conciliar con nada.
//
//  MEDIDO al invertirla, porque era el riesgo de verdad: al multiplicar por
//  caras el m² sube y los cocientes bajan, pero **el ingreso y el costo no se
//  mueven**. Dos corridas del mismo rango, una con cada valor, dan cifras
//  idénticas en `ingreso`, `costoEspacio`, `costoOperacion`, `costoTotal`,
//  `margen`, `margenPct` y `visitas` —y en los dos totales del reporte—, y solo
//  cambian `m2`, `ingresoPorM2` y `margenPorM2`. Si alguna cifra de dinero se
//  moviera habría un acoplamiento que no debe existir.
const MULTIPLICAR_M2_POR_CARAS: boolean = true

const CONVENCION_M2: ConvencionM2 = MULTIPLICAR_M2_POR_CARAS ? 'todas-las-caras' : 'una-cara'

/** Superficie en m², o `null` si no se puede saber. */
function superficieM2(s: Sitio): number | null {
  if (s.ancho == null || s.alto == null) return null
  const unaCara = Number(s.ancho) * Number(s.alto)
  if (!Number.isFinite(unaCara) || unaCara <= 0) return null
  return MULTIPLICAR_M2_POR_CARAS ? unaCara * (s.caras || 1) : unaCara
}

// ¿Esta pantalla se vende por SPOTS en vez de por metros?
//
// Hay DOS reglas de «digital» en este repo y difieren A PROPÓSITO
// (`derive.ts:1373`): la de BOOKING (`esDigital`, que por S0-3 solo considera
// digital a `PANTALLA_DIGITAL`) y la de PRESENTACIÓN (`medioLabel`, que además
// cuenta los rotativos y la exhibición digital).
//
// Para el m² manda la de PRESENTACIÓN, porque la pregunta es QUÉ VENDE la
// pantalla: un rotativo sobre estructura estática vende rotación, y su
// denominador tampoco son metros. `reportes.dimensiones.test.ts` compara esta
// función con `medioLabel` en las 24 combinaciones posibles, para que las dos no
// se separen en silencio — si divergieran, una digital entraría al ranking por
// m² sin dar ningún error.
function vendePorSpots(s: Sitio): boolean {
  return (
    s.tipoMedio === 'PANTALLA_DIGITAL' ||
    !!s.esRotativo ||
    s.exhibicion === 'digital' ||
    s.exhibicion === 'rotativo'
  )
}

function notaDeExclusiones(digitales: number, sinMedidas: number): string {
  if (digitales === 0 && sinMedidas === 0) {
    return 'No se excluyó ninguna pantalla: todas las que tuvieron movimiento son estáticas y tienen sus medidas capturadas.'
  }
  const partes: string[] = []
  if (digitales > 0) {
    partes.push(
      `${digitales} ${digitales === 1 ? 'pantalla digital o rotativa' : 'pantallas digitales o rotativas'}, porque su denominador correcto son spots y no metros`,
    )
  }
  if (sinMedidas > 0) {
    partes.push(
      `${sinMedidas} ${sinMedidas === 1 ? 'estática' : 'estáticas'} sin ancho o sin alto capturados`,
    )
  }
  return `Quedaron fuera del ranking: ${partes.join(' · ')}.`
}

/**
 * Rendimiento por metro cuadrado, SOLO de las estáticas.
 *
 * Dos exclusiones que son la mitad del reporte, y van CONTADAS en la respuesta:
 *
 *  1. LAS DIGITALES NO ENTRAN. Para una pantalla digital el denominador correcto
 *     son los spots, no los metros: mezclarlas produce un ranking sin sentido y
 *     sin error. Una LED de 9.6 × 5.4 que vende doce spots al día no se compara
 *     con una valla de la misma superficie.
 *  2. LAS ESTÁTICAS SIN MEDIDAS TAMPOCO. `sitios.ancho` y `sitios.alto` son
 *     nullable, y dividir por un ancho que no está capturado no da un error: da
 *     una cifra.
 *
 * Un reporte que esconde filas sin decirlo se lee como el inventario completo,
 * así que el recuento va en `excluidas`. Solo se cuenta como excluida la que
 * TENDRÍA fila —la que tuvo movimiento en el rango—: si no, un catálogo con
 * trescientas digitales dormidas diría «excluí 300» en un reporte donde eso no
 * significa nada.
 *
 * ⚠️ `sitios.precio_m2` YA EXISTE y significa OTRA COSA: es el costo de
 * IMPRESIÓN por m² (`lib/server/sitios-repo.ts`, de donde sale
 * `tarifa_impresion = ancho × alto × precio_m2`). NO se usa aquí ni se le pone
 * un nombre parecido, y hay un guard que lo comprueba leyendo este archivo: un
 * reporte de rentabilidad que hablara del proveedor de lonas se leería como si
 * dijera algo del negocio.
 */
export function rentabilidadPorM2(
  datos: DatosRentabilidad,
  opts: OpcionesReporte,
): ReporteRentabilidad {
  const m = matriz(datos, opts)
  const arrendadorDe = nombreArrendadorDe(datos)
  const filas: FilaRentabilidad[] = []
  let digitales = 0
  let sinMedidas = 0

  for (const s of datos.sitios) {
    const periodos = periodosDe(m.buckets, m.porSitio.get(s.id)!)
    const t = sumar(periodos)
    const visitas = periodos.reduce((a, p) => a + p.visitas, 0)
    // Primero el filtro de movimiento: una pantalla que no habría salido en
    // ningún caso no es una exclusión de este reporte.
    if (!hayMovimiento(t, visitas)) continue

    if (vendePorSpots(s)) {
      digitales += 1
      continue
    }
    const m2 = superficieM2(s)
    if (m2 == null) {
      sinMedidas += 1
      continue
    }

    const contrato = m.contratoDelPeriodo.get(s.id)
    filas.push({
      clave: s.id,
      etiqueta: s.nombre,
      detalle: s.claveInterna || s.codigoProveedor || '',
      ...t,
      tieneContrato: !!contrato,
      arrendador: arrendadorDe(contrato),
      periodos,
      visitas,
      m2: centavos(m2),
      ingresoPorM2: centavos(t.ingreso / m2),
      margenPorM2: centavos(t.margen / m2),
    })
  }

  // Peor margen POR METRO primero. Ojo: no es el mismo orden que por margen
  // absoluto, y esa es justamente la pregunta de esta dimensión — una valla
  // pequeña que rinde poco por metro es peor negocio que un espectacular grande
  // con el mismo margen total.
  filas.sort((a, b) => a.margenPorM2! - b.margenPorM2! || a.etiqueta.localeCompare(b.etiqueta))

  return {
    dimension: 'm2',
    granularidad: opts.granularidad,
    desde: opts.desde,
    hasta: opts.hasta,
    periodos: m.buckets,
    filas,
    // Los totales son los de las filas QUE SE VEN. Sumar también las excluidas
    // daría un total que no cuadra con ninguna columna de la tabla; por eso el
    // recuento de exclusiones va al lado.
    totales: totalesDeFilas(filas),
    excluidas: { digitales, sinMedidas, nota: notaDeExclusiones(digitales, sinMedidas) },
    convencionM2: CONVENCION_M2,
  }
}
