import { esFechaValida, ordenInvertido } from '@/lib/server/fechas'
import type { CeldaCaptura, TableroConsumos } from '@/lib/server/energia-controller'
import type { ConsumoEnergia, PuntoDeMedicion } from '@/lib/server/energia-repo'

// ============================================================================
//  components/demo/energia/captura.ts — Lo que decide la pantalla de captura.
// ----------------------------------------------------------------------------
//  LO QUE HACE ESTA PANTALLA Y NO HACE NINGUNA OTRA: enseñar LO QUE FALTA.
//
//  Una lista de recibos capturados deja invisible el mes que nadie tecleó, y ese
//  mes no aparece como un error en ninguna parte: sale como un costo de luz de
//  CERO en el reporte de rentabilidad, indistinguible de una pantalla que de
//  verdad no gasta luz. Por eso la unidad de esta pantalla es la REJILLA de
//  punto de medición × mes, con sus huecos marcados, y no la lista de filas que
//  existen.
//
//  Y por qué vive aquí y no en el `.tsx`: `vitest.config.ts` NO monta jsdom, a
//  propósito (lo dice en su propia cabecera). Consecuencia exacta: una decisión
//  escrita dentro de un componente no la prueba nadie. Ya pasó con la compuerta
//  del shell —se sacó a `compuerta.ts` y aparecieron nueve casos en rojo— y con
//  las columnas por dimensión de la tabla de reportes.
// ============================================================================

export type TableroUI = TableroConsumos

// CON el basePath y CON la barra final. `next.config.mjs` declara
// `basePath: '/spaces-dooh'` y `trailingSlash: true`: una ruta escrita
// `/api/energia/consumos` sale del navegador hacia el ORIGEN, no hacia la app, y
// el síntoma no es un error de red — es el 404 de Next con cuerpo HTML, que esta
// pantalla pintaría como «no se pudo cargar» sin decir nada de la causa. Le pasó
// a la pantalla de reportes el 2026-09-18.
export const RUTA_CONSUMOS = '/spaces-dooh/api/energia/consumos/'

export function rutaDeBorrado(id: string): string {
  return `${RUTA_CONSUMOS}${encodeURIComponent(id)}/`
}

export interface RangoCaptura {
  /** `AAAA-MM-DD`, inclusive. */
  desde: string
  /** `AAAA-MM-DD`, inclusive. */
  hasta: string
}

export function construirConsulta(r: RangoCaptura): string {
  // `URLSearchParams` y no concatenación: escapa por su cuenta. El schema del
  // controller es `.strict()`, así que un `&` sin escapar que cuele un
  // parámetro de más da 400 y tumba la pantalla entera.
  const p = new URLSearchParams({ desde: r.desde, hasta: r.hasta })
  return `${RUTA_CONSUMOS}?${p.toString()}`
}

const dosCifras = (n: number) => String(n).padStart(2, '0')

/** Cuántos meses se ven de un vistazo al abrir. Ver `RANGO_DE_APERTURA`. */
const MESES_A_LA_VISTA = 6

/**
 * Con qué rango abre la pantalla: los SEIS últimos meses, terminando en el mes
 * EN CURSO.
 *
 * Quien usa esto tiene un recibo en la mano, casi siempre del mes pasado. Seis
 * meses es lo que cabe de columnas sin encoger la tabla, y alcanza para ver de
 * un vistazo si quedó un hueco viejo sin rellenar.
 *
 * El mes en curso entra aunque casi nunca tenga recibo todavía: si no estuviera,
 * el recibo que llega el día 3 no tendría dónde capturarse y habría que mover el
 * rango a mano para teclear justo lo más reciente.
 *
 * Se construye desde las PARTES LOCALES de la fecha (`getMonth`, no
 * `toISOString`): en México (UTC−6) el día 1 a medianoche local sale como el
 * último día del mes anterior en UTC, y el rango entero se correría un mes. Es
 * la misma trampa que ya se pagó en `diasHasta` (`derive.ts`).
 */
export function RANGO_DE_APERTURA(hoy: Date): RangoCaptura {
  const anio = hoy.getFullYear()
  const mes = hoy.getMonth()
  // `new Date(anio, mes - 5, 1)` cruza el año él solo; escrito como `mes - 5`
  // sobre el número de mes daría negativos en los primeros meses del año.
  const inicio = new Date(anio, mes - (MESES_A_LA_VISTA - 1), 1)
  // Día 0 del mes siguiente = último día del mes, sin tabla de 28/30/31.
  const ultimoDia = new Date(anio, mes + 1, 0).getDate()
  return {
    desde: `${inicio.getFullYear()}-${dosCifras(inicio.getMonth() + 1)}-01`,
    hasta: `${anio}-${dosCifras(mes + 1)}-${dosCifras(ultimoDia)}`,
  }
}

/**
 * Por qué NO se puede pedir este rango. `null` = se puede.
 *
 * Se valida aquí además del servidor porque pedir un rango que se sabe malo
 * cuesta una consulta y devuelve un 400 que la pantalla tiene que traducir. Se
 * usa la MISMA regla —`ordenInvertido` de `lib/server/fechas.ts`, la que usa el
 * controller— y no una copia: dos reglas divergen, y aquí divergir significa
 * rechazar periodos correctos.
 */
export function motivoInvalido(r: RangoCaptura): string | null {
  const desde = r.desde.trim()
  const hasta = r.hasta.trim()
  if (!desde) return 'Falta el mes de inicio'
  if (!hasta) return 'Falta el mes de fin'
  if (!esFechaValida(desde) || !esFechaValida(hasta)) return 'Usa fechas con formato AAAA-MM-DD'
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(desde) || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(hasta)) {
    return 'Usa fechas con formato AAAA-MM-DD'
  }
  // Por CALENDARIO y no comparando texto: '2026-9-1' va DESPUÉS de '2026-10-01'
  // como cadena y antes en el calendario. Ese defecto ya se pagó dos veces.
  if (ordenInvertido(desde, hasta)) return 'El mes de fin no puede ser anterior al de inicio'
  return null
}

// ─── La rejilla ─────────────────────────────────────────────────────────────

export interface CeldaUI {
  /** `AAAA-MM`. */
  mes: string
  recibos: ConsumoEnergia[]
  /**
   * No hay recibo capturado para ese punto y ese mes.
   *
   * `hueco` y no «importe 0» es la distinción que justifica esta pantalla
   * entera: un hueco pintado como «$0.00» AFIRMA que ese mes no se gastó luz, y
   * la verdad es que no se sabe. Es el hallazgo C1 de la auditoría QA —el vacío
   * indistinguible del no cargado— aplicado al dato que más caro sale tenerlo
   * mal, porque el reporte lo suma como cero sin avisar.
   */
  hueco: boolean
  /** Suma de los recibos de la celda, o `null` si es un hueco. NUNCA 0. */
  importe: number | null
  kwh: number | null
}

export interface FilaUI {
  punto: PuntoDeMedicion
  celdas: CeldaUI[]
  /** Cuántos meses le faltan a ESTE punto. Es a quién hay que perseguir. */
  huecos: number
}

/**
 * De la rejilla del servidor a las filas que se pintan.
 *
 * Los meses salen del tablero y en SU orden, no de las celdas: una celda que
 * faltara en la respuesta dejaría una columna corrida y la tabla enseñaría el
 * importe de febrero bajo el encabezado de marzo. Por eso cada fila se
 * construye recorriendo `meses` y buscando su celda, y no al revés.
 */
export function filasDelTablero(t: TableroUI): FilaUI[] {
  const porClave = new Map<string, CeldaCaptura>()
  for (const c of t.celdas) porClave.set(`${c.punto}|${c.mes}`, c)

  return t.puntos.map((punto) => {
    let huecos = 0
    const celdas = t.meses.map((mes) => {
      const clave = mes.slice(0, 7)
      const celda = porClave.get(`${punto.clave}|${clave}`)
      const recibos = celda?.recibos ?? []
      const hueco = recibos.length === 0
      if (hueco) huecos += 1
      return {
        mes: clave,
        recibos,
        hueco,
        // `null` y no 0 cuando no hay recibo. Ver `CeldaUI.hueco`.
        importe: hueco ? null : recibos.reduce((a, r) => a + r.importe, 0),
        kwh: hueco ? null : recibos.reduce((a, r) => a + r.kwh, 0),
      }
    })
    return { punto, celdas, huecos }
  })
}

export interface ResumenCobertura {
  tono: 'alerta' | 'ok' | 'info'
  texto: string
  /** Frase aparte para los recibos que no llegan a ninguna pantalla. `''` si no hay. */
  huerfanos: string
}

const pesos = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 })

/**
 * Lo que hay que decir encima de la rejilla, y en qué tono.
 *
 * Se dice TAMBIÉN cuando no falta nada, y en eso no hay ambigüedad: «no falta
 * ninguno» y «no te lo digo» se ven idénticos si no se pinta nada. Pero entonces
 * va en verde y no en ámbar — un aviso que saliera siempre en alerta no lo
 * leería nadie, que es la lección del ámbar que dejó de avisar por salir en
 * todo.
 */
export function resumenDeCobertura(t: TableroUI): ResumenCobertura {
  const huerfanos =
    t.huerfanos.length > 0
      ? `${t.huerfanos.length} ${t.huerfanos.length === 1 ? 'recibo capturado' : 'recibos capturados'} por ${pesos(t.huerfanos.reduce((a, r) => a + r.importe, 0))} no ${t.huerfanos.length === 1 ? 'llega' : 'llegan'} a ninguna pantalla, porque su predio no tiene ninguna dada de alta. Ese dinero no aparece en el reporte de rentabilidad.`
      : ''

  // Sin puntos de medición no se puede afirmar que la captura está al día: un
  // «está completo» sobre un inventario vacío felicita por no tener nada.
  if (t.esperados === 0) {
    return {
      tono: 'info',
      texto:
        'Todavía no hay dónde capturar recibos: hace falta al menos un predio con pantallas, o una pantalla sin predio.',
      huerfanos,
    }
  }

  if (t.faltantes === 0) {
    return {
      tono: 'ok',
      texto: `Captura completa: están los ${t.esperados} recibos del periodo. El costo de la luz del reporte de rentabilidad es el total de verdad.`,
      huerfanos,
    }
  }

  return {
    tono: 'alerta',
    texto: `Faltan ${t.faltantes} de ${t.esperados} recibos del periodo. Mientras falten, el reporte de rentabilidad suma solo lo capturado y enseña un costo de luz MENOR del real, sin avisar de nada: un mes sin recibo no es un mes sin consumo.`,
    huerfanos,
  }
}

/**
 * `2026-02` → `feb 2026`.
 *
 * La fecha se construye con `new Date(anio, mes, 1)` en hora LOCAL y no desde la
 * cadena: `new Date('2026-01')` se interpreta como UTC, y al oeste de Greenwich
 * eso cae en diciembre del año anterior. Es el mismo error de zona que este repo
 * ya pagó dos veces.
 */
export function etiquetaDeMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return new Date(a, m - 1, 1).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })
}

// ─── El formulario de alta ──────────────────────────────────────────────────

export interface ReciboEnFormulario {
  /** La clave del punto: `P:<id>` o `S:<id>`. */
  punto: string
  /** `AAAA-MM`, tal como lo da un `<input type="month">`. */
  periodo: string
  medidor?: string
  kwh: string
  importe: string
  notas?: string
}

const numeroInvalido = (v: string, etiqueta: string): string | null => {
  const t = v.trim()
  // Obligatorio: la base los tiene NOT NULL porque un recibo trae siempre las
  // dos cifras impresas.
  if (!t) return `Captura ${etiqueta} del recibo`
  const n = Number(t)
  if (!Number.isFinite(n)) return `${etiqueta} tiene que ser un número`
  // El CERO vale: un medidor que no giró es un hecho, y rechazarlo obligaría a
  // inventar un número. Lo que no vale es negativo — eso es una nota de crédito,
  // no un consumo, y RESTARÍA costo mejorando el margen sin que nada lo dijera.
  if (n < 0) return `${etiqueta} no puede ser negativo`
  return null
}

/** Por qué NO se puede guardar este recibo. `null` = se puede. */
export function motivoInvalidoDelRecibo(r: ReciboEnFormulario, hoy: Date): string | null {
  if (!r.punto.trim()) return 'Elige a qué predio o pantalla corresponde el recibo'
  const periodo = r.periodo.trim()
  if (!/^\d{4}-\d{1,2}$/.test(periodo)) return 'Elige el mes del recibo'

  const kwh = numeroInvalido(r.kwh, 'los kWh')
  if (kwh) return kwh
  const importe = numeroInvalido(r.importe, 'el importe')
  if (importe) return importe

  // Un recibo de un mes que no ha empezado es casi siempre un año mal tecleado,
  // y su efecto NO SE VE: entra en un periodo que nadie mira todavía y aparece
  // meses después inflando el costo de un mes que ya se daba por cerrado. El mes
  // EN CURSO sí vale — un recibo puede llegar a mitad de mes.
  const [a, m] = periodo.split('-').map(Number)
  const mesDelRecibo = a * 100 + m
  const mesDeHoy = hoy.getFullYear() * 100 + (hoy.getMonth() + 1)
  // La comparación se hace con enteros AAAAMM y no comparando las cadenas: el
  // `<input type="month">` da ceros a la izquierda, pero `motivoInvalido` acepta
  // formas sin ellos y un `>` de cadenas diría que '2026-9' va después de
  // '2026-10'. Es el mismo defecto que este repo ya pagó dos veces con fechas.
  if (mesDelRecibo > mesDeHoy) return 'Ese mes todavía no ha terminado: no puede haber recibo'

  return null
}

// ─── Qué se pinta en el cuerpo de la tarjeta, y qué NO puede taparlo ────────

export type VistaCaptura =
  | 'cargando'
  | 'error-carga'
  | 'periodo-invalido'
  | 'sin-puntos'
  | 'rejilla'
  | 'nada'

export interface EstadoCaptura {
  cargando: boolean
  /** Falló traer el tablero: no hay nada fiable que enseñar. */
  errorCarga: string | null
  /**
   * Falló BORRAR un recibo. Va aparte a propósito y esta función NO lo mira:
   * ver `vistaDeCaptura`.
   */
  errorBorrado: string | null
  motivo: string | null
  tablero: TableroUI | null
}

/**
 * Qué se pinta en el cuerpo de la tarjeta de la rejilla.
 *
 * LO QUE ESTA FUNCIÓN EXISTE PARA IMPEDIR: que un fallo al BORRAR se lleve la
 * rejilla por delante. `errorBorrado` está en `EstadoCaptura` y aquí NO se mira
 * ni una vez, y eso es la corrección, no un descuido.
 *
 * Antes había un solo estado `error` para las dos cosas. Un DELETE con 403
 * —Operaciones puede `ver` y `crear` consumos, pero borrar exige `aprobar`—
 * entraba en el mismo sitio que el fallo de carga, y el render lo prioriza
 * sobre todo lo demás: la tabla completa, intacta en memoria, dejaba de
 * pintarse y salía «No se pudo cargar la captura». Falso: sí cargó. Es la
 * familia de errores que este repositorio ya conoce —los que mienten sin dar
 * error— y el aviso del borrado va junto al botón, sin tocar lo que se enseña.
 */
export function vistaDeCaptura(e: EstadoCaptura): VistaCaptura {
  // El orden ES la decisión. `cargando` va primero porque enseñar la rejilla
  // vieja mientras llega la nueva afirma un dato que ya no se sostiene.
  if (e.cargando) return 'cargando'
  if (e.errorCarga) return 'error-carga'
  if (e.motivo) return 'periodo-invalido'
  if (!e.tablero) return 'nada'
  if (e.tablero.puntos.length === 0) return 'sin-puntos'
  return 'rejilla'
}

/**
 * Lo que se lee antes de borrar un recibo.
 *
 * No dice «¿seguro?»: nombra el recibo —medidor, mes e importe— y dice la
 * consecuencia REAL, que no es «se pierde un dato». Es que ese mes vuelve a ser
 * un HUECO, y mientras lo sea el reporte de rentabilidad suma solo lo capturado
 * y enseña un costo de luz menor del real sin avisar de nada. Un «¿seguro?» no
 * deja decidir; esto sí.
 */
export function textoDeConfirmacionDeBorrado(r: ConsumoEnergia): string {
  // `sin número` y no «null»: un recibo sin medidor es normal —no todos los
  // predios lo traen— y en la rejilla ya se nombra así.
  const medidor = r.medidor?.trim() || 'sin número'
  return `Se borra el recibo del medidor ${medidor}, de ${etiquetaDeMes(r.periodo.slice(0, 7))}, por ${pesos(r.importe)}. No se puede deshacer: ese mes vuelve a contar como un hueco, y hasta que lo captures otra vez el reporte de rentabilidad enseñará un costo de luz menor del real.`
}
