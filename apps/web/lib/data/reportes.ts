import type { TipoOT } from './types'
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
//  las caras de sus pantallas: `rentaAtribuidaPorSitio()` (derive.ts:1252), con
//  su distinción entre contrato de predio y contrato de pantalla suelta. Eso
//  está pensado y probado (`derive.anclaje-contrato.test.ts`) y rehacerlo aquí
//  habría creado dos verdades sobre el mismo dinero.
//
//  ES NUEVO el eje de tiempo. `margenPorSitio()` (derive.ts:1278) es una FOTO
//  DE HOY: filtra `ini <= hoy && fin >= hoy` (derive.ts:1285) y no sabe de
//  periodos. Un reporte que verá historia de años necesita repartir.
//
//  ─── Por qué vive en `lib/data/` y no en `lib/server/` ───────────────────
//  Porque es puro y se prueba sin Postgres (`reportes.test.ts`), igual que
//  `derive.ts`. El SQL —y solo el SQL— vive en `lib/server/reportes-repo.ts`,
//  que es quien lee la base y llama aquí.
//
//  ─── Lo que esta primera versión NO hace, dicho aquí para que no sorprenda ─
//  El COSTO usa el contrato VIGENTE HOY de cada pantalla, porque la atribución
//  que se reusa lo resuelve con `contratoActivo()` (derive.ts:1207), que solo
//  acepta VIGENTE / POR_VENCER / RENOVADO. Consecuencia: un reporte de un
//  trimestre pasado NO ve un contrato que ya venció en ese trimestre, y un
//  cambio de renta a mitad de año se aplica hacia atrás. Lo que sí respeta es
//  la VIGENCIA del contrato que encuentra: no cobra renta antes de su
//  `fechaInicio` ni después de su `fechaFin`.
//
//  Se deja así a propósito: arreglarlo pide una atribución consciente del
//  periodo, y esa es la pieza que el porte a agregación SQL tiene que traer.
//  Lo importante es que el LÍMITE ya existe, así que ese porte no tocará
//  ninguna pantalla.
// ============================================================================

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
}

export interface FilaRentabilidad {
  /** Id del sitio (o de lo que agrupe la dimensión). */
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
}

export interface ReporteRentabilidad {
  dimension: 'sitio'
  granularidad: GranularidadReporte
  desde: string
  hasta: string
  periodos: Bucket[]
  filas: FilaRentabilidad[]
  totales: {
    ingreso: number
    costoEspacio: number
    costoOperacion: number
    costoTotal: number
    margen: number
    margenPct: number | null
  }
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
 * rango— y por eso el desglose por periodo cuadra siempre con la fila.
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

// ─── El reporte ─────────────────────────────────────────────────────────────

// Fecha con la que una OT entra en un periodo: la de completada si ya se hizo;
// si no, la programada; si no, la de creación. Se elige así porque el costo se
// devenga cuando el trabajo ocurre, y una OT pendiente ya tiene fecha prevista
// —contarla por su creación la metería en el mes en que se capturó, no en el que
// se va a trabajar.
function fechaDeOt(o: OtReporte): string | null {
  const f = o.fechaCompletada ?? o.fechaProgramada ?? o.creadoEn ?? null
  return f ? f.slice(0, 10) : null
}

export function rentabilidadPorSitio(
  datos: DatosRentabilidad,
  opts: RangoReporte & { granularidad: GranularidadReporte },
): ReporteRentabilidad {
  const buckets = bucketsDelRango(opts, opts.granularidad)

  // La atribución de la renta NO se recalcula aquí: sale de derive.ts.
  const rentaAtribuida = rentaAtribuidaPorSitio(datos)
  const contratoDe = contratoVigentePorSitio(datos)
  const nombreArrendador = new Map(datos.arrendadores.map((a) => [a.id, a.nombre]))

  // Las reservas que NO cuentan se descartan una sola vez, antes de los bucles:
  // CANCELADA no suma (una TENTATIVA sí, el lugar ya está apartado — misma regla
  // que `clientesEnPantalla` en derive.ts).
  const reservas = datos.reservas.filter((r) => r.estatus !== 'CANCELADA')
  const ots = datos.ordenesTrabajo.filter((o) => o.estatus !== 'CANCELADA')

  const filas: FilaRentabilidad[] = []

  for (const s of datos.sitios) {
    const contrato = contratoDe.get(s.id) ?? null
    const rentaMensual = rentaAtribuida.get(s.id) ?? 0
    const reservasDelSitio = reservas.filter((r) => r.sitioId === s.id)
    const otsDelSitio = ots.filter((o) => o.sitioId === s.id)

    const periodos: PeriodoFila[] = buckets.map((b) => {
      // ─── INGRESO: prorrateo por días ─────────────────────────────────────
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
      let ingreso = 0
      for (const r of reservasDelSitio) {
        const diasTotales = diasInclusive(r.fechaInicio, r.fechaFin)
        if (diasTotales <= 0) continue
        const dentroDelBucket = diasSolapados(r.fechaInicio, r.fechaFin, b.desde, b.hasta)
        if (dentroDelBucket === 0) continue
        ingreso += r.precio * (dentroDelBucket / diasTotales)
      }

      // ─── COSTO DEL ESPACIO: renta mensual atribuida × meses del bucket ────
      // Recortado a la VIGENCIA del contrato. Sin ese recorte, el reporte de un
      // trimestre de 2025 cobraría un contrato firmado en 2026 y una pantalla
      // sin actividad aparecería con costo en cualquier rango que se pidiera.
      //
      // `fechaFin` nula solo ocurre en un contrato INCOMPLETO, que
      // `contratoActivo()` ya excluye; se contempla como fin abierto por si
      // alguna vez deja de excluirlo.
      let costoEspacio = 0
      if (contrato && rentaMensual > 0) {
        const vigDesde = contrato.fechaInicio.slice(0, 10)
        const vigHasta = (contrato.fechaFin ?? b.hasta).slice(0, 10)
        const desde = nDia(vigDesde) > nDia(b.desde) ? vigDesde : b.desde
        const hasta = nDia(vigHasta) < nDia(b.hasta) ? vigHasta : b.hasta
        costoEspacio = rentaMensual * mesesEquivalentes(desde, hasta)
      }

      // ─── COSTO DE OPERACIÓN: las OT que caen en el bucket ─────────────────
      // NO se prorratea: una orden de trabajo es un evento, no un periodo. Su
      // costo entra completo en el mes en que se trabaja.
      let costoOperacion = 0
      for (const o of otsDelSitio) {
        const f = fechaDeOt(o)
        if (!f || !dentro(f, b.desde, b.hasta)) continue
        costoOperacion += costoDeOt(o.tipo, datos.costosOt ?? null)
      }

      const iRed = centavos(ingreso)
      const ceRed = centavos(costoEspacio)
      const coRed = centavos(costoOperacion)
      return {
        ...b,
        ingreso: iRed,
        costoEspacio: ceRed,
        costoOperacion: coRed,
        costoTotal: centavos(ceRed + coRed),
        margen: centavos(iRed - ceRed - coRed),
      }
    })

    // El total de la fila es la SUMA DE LOS PERIODOS YA REDONDEADOS, no el
    // redondeo de la suma. Un desglose que no cuadra con su propio total es peor
    // que no tener desglose: obliga a desconfiar de los dos.
    const ingreso = centavos(periodos.reduce((a, p) => a + p.ingreso, 0))
    const costoEspacio = centavos(periodos.reduce((a, p) => a + p.costoEspacio, 0))
    const costoOperacion = centavos(periodos.reduce((a, p) => a + p.costoOperacion, 0))
    const costoTotal = centavos(costoEspacio + costoOperacion)
    const margen = centavos(ingreso - costoTotal)

    // Una pantalla sin ingreso, sin renta y sin OT en el rango no aparece. Un
    // reporte con quinientas filas a cero no se lee, y las que importan —las que
    // cuestan sin vender— sí tienen costo, así que salen igual.
    if (ingreso === 0 && costoEspacio === 0 && costoOperacion === 0) continue

    filas.push({
      clave: s.id,
      etiqueta: s.nombre,
      detalle: s.claveInterna || s.codigoProveedor || '',
      ingreso,
      costoEspacio,
      costoOperacion,
      costoTotal,
      margen,
      margenPct: ingreso > 0 ? centavos((margen / ingreso) * 100) : null,
      tieneContrato: !!contrato,
      arrendador: contrato?.arrendadorId ? (nombreArrendador.get(contrato.arrendadorId) ?? null) : null,
      periodos,
    })
  }

  // Peor margen primero: la pregunta que contesta este reporte es «¿qué
  // pantallas están perdiendo dinero?», no «¿cómo se llaman?».
  filas.sort((a, b) => a.margen - b.margen)

  const ingreso = centavos(filas.reduce((a, f) => a + f.ingreso, 0))
  const costoEspacio = centavos(filas.reduce((a, f) => a + f.costoEspacio, 0))
  const costoOperacion = centavos(filas.reduce((a, f) => a + f.costoOperacion, 0))
  const costoTotal = centavos(costoEspacio + costoOperacion)
  const margen = centavos(ingreso - costoTotal)

  return {
    dimension: 'sitio',
    granularidad: opts.granularidad,
    desde: opts.desde,
    hasta: opts.hasta,
    periodos: buckets,
    filas,
    totales: {
      ingreso,
      costoEspacio,
      costoOperacion,
      costoTotal,
      margen,
      margenPct: ingreso > 0 ? centavos((margen / ingreso) * 100) : null,
    },
  }
}
