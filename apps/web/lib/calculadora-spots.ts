// ============================================================================
//  lib/calculadora-spots.ts — La CALCULADORA DE SPOTS de una pantalla digital.
//  Módulo PURO: sin `fetch`, sin React, sin BD. Lo usan la pantalla de
//  propuestas y el servidor, y ése es todo su motivo de existir.  ADR 0042.
// ----------------------------------------------------------------------------
//  ADR 0043 (2026-10-06), que sustituye las decisiones 1, 2 y 3 del ADR 0042:
//  la calculadora cuenta COMO LA CALCULADORA HTML DEL DUEÑO (`indexcal.html`),
//  la cantidad Y el precio.
//
//      loop      = anunciantes de hoy + espacios de la línea   (Roadblock: todos)
//      cantidad  = floor( 3600 / (loop × duración) × espacios × horasDía × días )
//      precio    = tarifaMensual / (3600 / (loop × duración) × horasOperación × 30)
//      Roadblock = tarifaMensual × loop / (horasOperación × 30) / floor(3600 / duración)
//                  por spot, × (1 + prima)
//
//  El volumen, el cupón y la comisión se siguen componiendo ENCIMA del precio,
//  igual que antes: lo que cambió es el primer escalón, no la cadena.
//
//  Lo que había ANTES (ADR 0042, 2026-10-01): el precio era la tarifa `spot` de
//  la pantalla, el loop eran todos los espacios y se redondeaba por día. Se
//  cambió porque las cifras no cuadraban con la calculadora con la que el
//  dueño cotiza; los porqués de aquel diseño siguen en el ADR 0042.
//
//  ─── POR QUÉ UNA SOLA COPIA PARA LOS DOS LADOS ─────────────────────────────
//  Es la misma razón que `lib/tarifa-calculada.ts` y `lib/rejilla.ts`
//  («cuatro copias divergen»), con un agravante: el SERVIDOR recalcula la
//  cantidad y rechaza la que no cuadre. Si la pantalla contara con otra regla,
//  el vendedor vería 16 200 spots, los mandaría, y recibiría un 400 sin haber
//  tocado nada. Y si el servidor confiara en la cantidad del navegador, se
//  podría mandar «100 spots» con un `curl` para bajar el total — que es el
//  hallazgo B40 otra vez, por la puerta de la cantidad en vez de la tarifa.
//
//  ─── LO QUE NO SE COPIA DE LA CALCULADORA HTML ─────────────────────────────
//  · La coma flotante. Aquélla divide en flotante; aquí se cuenta en enteros
//    (horas en centésimas, pesos en centavos) y se redondea UNA vez, al final
//    del periodo. Las fracciones de spot de cada día SÍ suman —como en el
//    HTML—, pero un 13 885,99999 no puede volverse 13 885 en un lado y 13 886
//    en el otro: el servidor rechazaría la venta.
//  · El precio se guarda al CENTAVO (`tarifa_unitaria` es `numeric(14,2)`):
//    $100,000 ÷ 16 200 = $6.1728 se cobra a $6.17, que es lo que el HTML enseña.
//
//  ─── LA OCUPACIÓN: LA MISMA CUENTA EN LOS DOS LADOS ────────────────────────
//  «Anunciantes de hoy» son las CAMPAÑAS VIGENTES de la pantalla, el mismo
//  conteo que enseña el inventario (`listarSitios`: libres = total − campañas)
//  y que lee el servidor (`datosDelLoop.campanasActivas`). NO es el contador
//  `spots_disponibles` guardado: si la pantalla contara con uno y el servidor
//  con otro, el loop saldría distinto, la cantidad no cuadraría y la venta se
//  bloquearía con un 400 sin que el vendedor hubiera tocado nada.
// ============================================================================

import { minutosDeHora, type Temporada } from './rejilla'
import {
  centavos,
  decidirPrecioItem,
  tarifaCalculada,
  type DecisionPrecio,
  type SitioTarifable,
} from './tarifa-calculada'

export const SEGUNDOS_POR_HORA = 3600

/** Los días del mes de la calculadora HTML («Días activos al mes»). */
export const DIAS_DEL_MES = 30

/**
 * La duración de un spot cuando ni la pantalla ni la organización la dicen.
 * Es el valor con el que `sitios-repo.ts` da de alta TODA pantalla digital
 * (`duracionSpotSeg ?? (digital ? 20 : null)`), así que es el que de verdad
 * tiene el inventario, no uno inventado aquí.
 */
export const DURACION_SPOT_RESPALDO_SEG = 20

/**
 * Las horas de operación cuando el `horario` de la pantalla no se entiende:
 * la jornada DOOH típica 06:00–24:00. Es el mismo 18 que traía la función
 * `horasOperacion` de `sitios-repo.ts`, que nadie llamaba y que esta sustituye.
 */
export const HORAS_OPERACION_RESPALDO = 18

const esPositivo = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

/**
 * Duración de un spot, en segundos: la de la pantalla (`sitios.duracion_spot_seg`),
 * si no la de la organización (`config_negocio.spot_seg`), y si no 20.
 *
 * Un cero o un negativo NO es una duración: dividir entre él daría infinitos
 * spots, que es la manera más cara de equivocarse aquí.
 */
export function duracionSpotSeg(sitioSeg?: number | null, configSeg?: number | null): number {
  if (esPositivo(sitioSeg)) return sitioSeg
  if (esPositivo(configSeg)) return configSeg
  return DURACION_SPOT_RESPALDO_SEG
}

/**
 * Las horas que cubre una franja. Fin EXCLUSIVO, como toda la rejilla
 * (`lib/rejilla.ts`), y la que cruza la medianoche (22:00–06:00) da 8, no -16.
 * `null` si la franja no se puede leer o no cubre nada.
 */
export function horasDeFranja(f: { horaInicio: string; horaFin: string }): number | null {
  const ini = minutosDeHora(f.horaInicio)
  const fin = minutosDeHora(f.horaFin)
  if (ini === null || fin === null || ini === fin) return null
  return ((fin - ini + 24 * 60) % (24 * 60)) / 60
}

// Una hora suelta → horas (0–24). Acepta «06:00», «24:00», «6:00 am», «12 pm»,
// «6». Fuera de rango devuelve null: «25:00» no es una hora, y tratarla como
// tal daría un horario de un día con más de 24.
function parseHora(s: string): number | null {
  const ap = s.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?/i)
  const simple = s.match(/(\d{1,2})(?::(\d{2}))?/)
  const m = ap ?? simple
  if (!m) return null
  let h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null
  const meridiano = ap?.[3]?.toLowerCase()
  if (meridiano === 'p' && h < 12) h += 12
  if (meridiano === 'a' && h === 12) h = 0
  return h + min / 60
}

/**
 * Horas de operación al día a partir de `sitios.horario`, que es TEXTO LIBRE:
 * el alta pone «06:00-24:00», el importador copia lo que traiga el Excel, y
 * hay «6:00 am a 12:00 pm», «6 a 24», «24 horas»…
 *
 * Devuelve `reconocido: false` cuando cae al respaldo de 18 h, para que la
 * pantalla pueda DECIRLO en vez de enseñar 18 como si los hubiera leído. Un
 * respaldo que no se anuncia es un dato inventado.
 */
export function horasDeHorario(horario?: string | null): { horas: number; reconocido: boolean } {
  const texto = String(horario ?? '').trim()
  const respaldo = { horas: HORAS_OPERACION_RESPALDO, reconocido: false }
  if (!texto) return respaldo
  if (/^24\s*(h|hr|hrs|horas?)\b/i.test(texto) || /^24\s*\/\s*7$/.test(texto)) {
    return { horas: 24, reconocido: true }
  }
  const partes = texto.split(/\s+a\s+|\s*[-–—]\s*/i).filter((x) => /\d/.test(x))
  if (partes.length < 2) return respaldo
  const inicio = parseHora(partes[0])
  const fin = parseHora(partes[1])
  if (inicio == null || fin == null) return respaldo
  const h = fin > inicio ? fin - inicio : fin + 24 - inicio // cruza la medianoche
  if (!(h > 0 && h <= 24)) return respaldo
  return { horas: Math.round(h * 100) / 100, reconocido: true }
}

/**
 * Las horas al día que se ofrecen por omisión, y que son también el TECHO de lo
 * que se puede comprar: la duración de la franja elegida y, sin franja, el
 * horario de la pantalla. El vendedor las puede BAJAR, nunca subir — comprar
 * más horas de las que la pantalla transmite sería cobrar spots que no salen.
 */
export function horasPorOmision(e: {
  franja?: { horaInicio: string; horaFin: string } | null
  horario?: string | null
}): number {
  const deFranja = e.franja ? horasDeFranja(e.franja) : null
  if (deFranja != null) return deFranja
  return horasDeHorario(e.horario).horas
}

/** Rotaciones por hora de UN espacio en un loop de `loop` anunciantes. Solo para enseñar. */
export function rotacionesPorHora(loop: number, duracionSeg: number): number {
  if (!esPositivo(loop) || !esPositivo(duracionSeg)) return 0
  return SEGUNDOS_POR_HORA / (loop * duracionSeg)
}

/** Las horas en CENTÉSIMAS enteras: la columna es `numeric(4,2)`. */
const centesimas = (h: number) => Math.round(Number(h) * 100)

/** Las horas redondeadas a lo que la columna puede guardar. */
export const redondearHoras = (h: number) => centesimas(h) / 100

/**
 * El tamaño del loop de una línea: los anunciantes de HOY más los espacios que
 * compra, como el deslizador «Anunciantes en el loop» de la calculadora HTML
 * —que cuenta al propio cliente—. Un Roadblock es el loop entero.
 *
 * `ocupados` son las campañas vigentes (ver la cabecera). Sin el dato, el loop
 * entero: suponer la pantalla vacía regalaría spots que no salen.
 */
export function loopDeLaLinea(e: {
  totalSpots: number
  ocupados: number | null | undefined
  espacios: number
  roadblock: boolean
}): number {
  const total = Math.round(e.totalSpots)
  if (e.roadblock || e.ocupados == null || !Number.isFinite(Number(e.ocupados))) return total
  return Math.min(total, Math.max(0, Math.floor(Number(e.ocupados))) + Math.round(e.espacios))
}

/** Spots de un Roadblock en una hora: la hora no da un spot partido. */
const spotsPorHoraRoadblock = (duracionSeg: number) => Math.floor(SEGUNDOS_POR_HORA / Math.round(duracionSeg))

/**
 * LA FÓRMULA DE LA CANTIDAD, como la calculadora HTML: las fracciones de spot
 * de cada día suman, y se redondea hacia abajo UNA vez, al final del periodo.
 *
 * En ENTEROS —horas en centésimas— y no en coma flotante: `0.1 + 0.2` no es
 * `0.3`, y el servidor y la pantalla tienen que dar el MISMO entero o la venta
 * se bloquea.
 */
export function cantidadDeSpots(e: {
  loop: number
  duracionSeg: number
  espacios: number
  horasDia: number
  dias: number
  roadblock: boolean
}): number {
  if (!esPositivo(e.loop) || !esPositivo(e.duracionSeg) || !esPositivo(e.espacios) || !esPositivo(e.horasDia)) return 0
  if (!esPositivo(e.dias)) return 0
  const dias = Math.floor(e.dias)
  if (e.roadblock) return Math.floor((spotsPorHoraRoadblock(e.duracionSeg) * centesimas(e.horasDia) * dias) / 100)
  const numerador = SEGUNDOS_POR_HORA * Math.round(e.espacios) * centesimas(e.horasDia) * dias
  const denominador = Math.round(e.loop) * Math.round(e.duracionSeg) * 100
  return Math.floor(numerador / denominador)
}

/**
 * EL PRECIO POR SPOT, como la calculadora HTML, al centavo.
 *
 *  · Normal: tarifa mensual ÷ spots que UN anunciante recibe en 30 días con
 *    las horas de operación de la pantalla. Con el loop más lleno, cada spot
 *    vale más y salen menos: lo que se paga por un espacio al mes es la tarifa
 *    mensual, ocupe quien ocupe el resto.
 *  · Roadblock: el ingreso de UNA hora con el loop entero —tarifa × loop ÷
 *    horas al mes— repartido entre los `floor(3600 / duración)` spots de esa
 *    hora. La prima va aparte (`tarifaConPrima`), una sola vez.
 *
 * Las horas de operación son las del HORARIO de la pantalla, no las de la
 * franja: la renta mensual paga el día entero, y una franja corta no puede
 * encarecer el spot por tener menos horas. La franja ya pone su precio en la
 * rejilla de la tarifa mensual.
 */
export function tarifaPorSpot(e: {
  tarifaMensual: number | null | undefined
  loop: number
  duracionSeg: number
  horasOperacion: number
  roadblock: boolean
}): number | null {
  const mensual = centavos(Number(e.tarifaMensual) || 0)
  const horas = centesimas(e.horasOperacion)
  if (mensual <= 0 || !esPositivo(e.loop) || !esPositivo(e.duracionSeg) || !(horas > 0)) return null
  const loop = Math.round(e.loop)
  const cent = e.roadblock
    ? Math.round((mensual * loop * 100) / (horas * DIAS_DEL_MES * spotsPorHoraRoadblock(e.duracionSeg)))
    : Math.round((mensual * loop * Math.round(e.duracionSeg) * 100) / (SEGUNDOS_POR_HORA * horas * DIAS_DEL_MES))
  return cent / 100
}

/**
 * La tarifa BASE de una línea de calculadora —sin prima—, con la forma
 * `{ tarifa, calculable }` que espera `decidirPrecioCalculadora`.
 *
 * La tarifa mensual es la de la modalidad `mensual` de la pantalla resuelta por
 * `tarifaCalculada()` —con su rejilla de franja y temporada, si la tiene—, y si
 * la pantalla no la ofrece, su `tarifaMensual` de ficha. NUNCA la del spot: la
 * tarifa «por spot» capturada como precio de día o de paquete es la que cotizó
 * $32.6 M el 2026-10-01. Sin ninguna, no es calculable y solo un gerente pone
 * el precio, igual que PRECIO-01.
 */
export function tarifaBaseCalculadora(e: {
  sitio: SitioTarifable
  franjaId: string | null
  temporadas: Temporada[]
  fechaInicio: string
  loop: number
  duracionSeg: number
  horasOperacion: number
  roadblock: boolean
}): { tarifa: number; calculable: boolean } {
  const tarifa = tarifaPorSpot({ ...e, tarifaMensual: tarifaMensualDeSitio(e) })
  return tarifa == null ? { tarifa: 0, calculable: false } : { tarifa, calculable: true }
}

/**
 * La tarifa MENSUAL de la que sale el precio de la calculadora (ver
 * `tarifaBaseCalculadora`). Aparte para que la pantalla enseñe en el desglose
 * exactamente el número con el que contó el servidor. 0 = no hay.
 */
export function tarifaMensualDeSitio(e: {
  sitio: SitioTarifable
  franjaId: string | null
  temporadas: Temporada[]
  fechaInicio: string
}): number {
  const mensual = tarifaCalculada({
    sitio: e.sitio,
    unidad: 'mensual',
    franjaId: e.franjaId,
    temporadas: e.temporadas,
    fechaInicio: e.fechaInicio,
  })
  return mensual.calculable ? mensual.tarifa : Number(e.sitio.tarifaMensual) || 0
}

/**
 * El precio por spot de un Roadblock: tarifa calculada × (1 + prima/100), al
 * centavo. Se cuenta en centavos por el mismo motivo que `centavos()`: la
 * comparación «¿es el precio esperado?» no puede fallar por un redondeo.
 */
export function tarifaConPrima(tarifa: number, primaPct: number): number {
  const p = Number(primaPct) || 0
  return Math.round((centavos(tarifa) * (100 + p)) / 100) / 100
}

/** Los cuatro parámetros de la calculadora tal como llegan en una línea. */
export type ParametrosLinea = {
  espaciosComprados?: number | null
  horasDia?: number | null
  roadblock?: boolean | null
  primaRoadblockPct?: number | null
}

/**
 * ¿Esta línea entra por la calculadora? Basta CUALQUIERA de los cuatro. Si no
 * trae ninguno, la línea sigue exactamente como hoy —cantidad a mano para
 * spot/hora, del rango para el tiempo—: es el invariante de no romper a las
 * pantallas fijas ni a las demás unidades.
 */
export function usaCalculadora(p: ParametrosLinea): boolean {
  return p.espaciosComprados != null || p.horasDia != null || p.roadblock === true || p.primaRoadblockPct != null
}

export type EntradaCalculadora = ParametrosLinea & {
  /** ¿Es una pantalla digital? Una lona no tiene loop. */
  digital: boolean
  unidad: string
  /** `sitios.total_spots`: TODOS los espacios del loop, no la ocupación de hoy. */
  totalSpots: number | null
  duracionSeg: number
  /** El techo de horas: `horasPorOmision()`. */
  horasMaximas: number
  /** Espacios libres ahora. `null` = no se sabe, no se acota (igual que `spotsDeLaReserva`). */
  libres: number | null
  /**
   * ADR 0043 · los anunciantes de HOY: las campañas vigentes de la pantalla.
   * `null` = no se sabe, y el loop es la pantalla entera (`loopDeLaLinea`).
   */
  ocupados?: number | null
  /** Días de la línea, inclusivos (`diasInclusivos`). */
  dias: number
  /** La cantidad que mandó la pantalla, para compararla. */
  cantidadEnviada?: number | null
}

export type ResultadoCalculadora =
  | {
      ok: true
      espaciosComprados: number
      horasDia: number
      roadblock: boolean
      /** `null` sin Roadblock; 0 o más con él. */
      primaRoadblockPct: number | null
      /** ADR 0043 · los anunciantes del loop con los que se contó. */
      loop: number
      rotacionesHora: number
      /** Spots al día, redondeados hacia abajo: es la PROGRAMACIÓN del CMS (`spots_por_dia`, entero). */
      spotsDia: number
      /** Spots al día con sus fracciones, a dos decimales: lo que enseña la pantalla. */
      spotsDiaExactos: number
      /** Lo que se cobra: el periodo entero, redondeado UNA vez. */
      cantidad: number
    }
  /** 400 = la petición está mal; 409 = la pantalla no tiene los espacios libres. */
  | { ok: false; status: 400 | 409; motivo: string }

const mal = (motivo: string) => ({ ok: false as const, status: 400 as const, motivo })

const fmtH = (h: number) => Number(h).toLocaleString('es-MX', { maximumFractionDigits: 2 })

/**
 * LA LÍNEA COMPLETA: valida los parámetros, calcula la cantidad y la compara
 * con la que mandó la pantalla. El servidor la llama con los datos de ESTA
 * organización; la pantalla, con los mismos, para enseñar el número antes.
 *
 * El 409 va DESPUÉS de todos los 400 a propósito: a quien mandó una línea mal
 * formada no le sirve saber que además la pantalla está llena.
 *
 * ─── POR QUÉ SE RECHAZA, Y NO SE AVISA, CUANDO NO HAY ESPACIOS LIBRES ──────
 * Al generar la campaña, `spotsDeLaReserva` ACOTA los espacios retenidos a los
 * libres (`campanas-repo.ts`). Si aquí se dejara cotizar 6 espacios con 5
 * libres, la cantidad —que es dinero— se cobraría por 6 y la reserva retendría
 * 5: se cobrarían reproducciones que no ocurren, justo lo que el redondeo hacia
 * abajo evita. Rechazar aquí garantiza que, el día de la cotización, ese acote
 * no muerda.
 */
export function resolverCalculadora(e: EntradaCalculadora): ResultadoCalculadora {
  return evaluar(e, true)
}

/**
 * Lo mismo que `resolverCalculadora` SIN comparar la cantidad: es lo que la
 * pantalla enseña antes de mandar, y la cantidad que luego manda. Una sola
 * función por dentro (`evaluar`) para que el aviso de la pantalla y el rechazo
 * del servidor no puedan decir cosas distintas.
 */
export function previsualizarCalculadora(e: Omit<EntradaCalculadora, 'cantidadEnviada'>): ResultadoCalculadora {
  return evaluar(e, false)
}

function evaluar(e: EntradaCalculadora, comparar: boolean): ResultadoCalculadora {
  if (!e.digital || e.unidad !== 'spot') {
    return mal('La calculadora de spots solo aplica a pantallas digitales vendidas por spot.')
  }
  const total = Number(e.totalSpots)
  if (!Number.isInteger(total) || total <= 0) {
    return mal('La pantalla no tiene capturado cuántos espacios tiene su loop; captúralo en su ficha antes de usar la calculadora.')
  }
  const roadblock = e.roadblock === true

  let espacios: number
  if (roadblock) {
    espacios = e.espaciosComprados ?? total
    if (espacios !== total) {
      return mal(`Un Roadblock compra los ${total} espacios del loop, no ${espacios}.`)
    }
  } else {
    const pedidos = e.espaciosComprados
    if (pedidos == null || !Number.isInteger(pedidos) || pedidos < 1 || pedidos > total) {
      return mal(`Los espacios del loop van de 1 a ${total}.`)
    }
    espacios = pedidos
  }

  const prima = e.primaRoadblockPct
  if (prima != null && (!Number.isFinite(prima) || prima < 0 || prima > 100)) {
    return mal('La prima de Roadblock va de 0 a 100 %.')
  }
  if (!roadblock && prima != null && prima !== 0) {
    return mal('La prima de Roadblock solo aplica a una línea marcada como Roadblock.')
  }

  const horasMax = redondearHoras(e.horasMaximas)
  const horas = redondearHoras(e.horasDia ?? horasMax)
  if (!(horas > 0) || horas > horasMax) {
    return mal(`Las horas al día van de más de 0 a ${fmtH(horasMax)}: más horas de las que transmite la pantalla serían spots que no salen.`)
  }

  const loop = loopDeLaLinea({ totalSpots: total, ocupados: e.ocupados, espacios, roadblock })
  const cuenta = { loop, duracionSeg: e.duracionSeg, espacios, horasDia: horas, roadblock }
  const dias = Math.floor(Number(e.dias) || 0)
  if (dias <= 0) return mal('La línea no tiene días: revisa las fechas.')
  // ADR 0043 · las fracciones de cada día suman: un día de 0,72 spots no se
  // vende, treinta sí (21). Lo que se rechaza es un PERIODO sin un solo spot.
  const cantidad = cantidadDeSpots({ ...cuenta, dias })
  if (cantidad <= 0) {
    return mal('Con esos espacios y esas horas no sale ni un spot al día.')
  }
  const spotsDia = cantidadDeSpots({ ...cuenta, dias: 1 })
  const spotsDiaExactos = roadblock
    ? (spotsPorHoraRoadblock(e.duracionSeg) * centesimas(horas)) / 100
    : Math.round((SEGUNDOS_POR_HORA * espacios * centesimas(horas)) / (loop * Math.round(e.duracionSeg))) / 100

  if (comparar && (e.cantidadEnviada == null || Number(e.cantidadEnviada) !== cantidad)) {
    return mal(
      `La cantidad de spots no cuadra con la calculadora: con ${espacios} espacios, ${fmtH(horas)} h al día y ${dias} días son ${cantidad} spots, no ${e.cantidadEnviada ?? 'ninguna'}.`,
    )
  }

  if (e.libres != null) {
    const libres = Math.max(0, Math.floor(Number(e.libres)))
    if (roadblock && libres < total) {
      return {
        ok: false,
        status: 409,
        motivo: `Un Roadblock necesita los ${total} espacios del loop libres, y la pantalla tiene ${libres}.`,
      }
    }
    if (espacios > libres) {
      return {
        ok: false,
        status: 409,
        motivo: `Pides ${espacios} espacios del loop y la pantalla solo tiene ${libres} libres.`,
      }
    }
  }

  return {
    ok: true,
    espaciosComprados: espacios,
    horasDia: horas,
    roadblock,
    primaRoadblockPct: roadblock ? (prima ?? 0) : null,
    loop,
    rotacionesHora: rotacionesPorHora(loop, e.duracionSeg),
    spotsDia,
    spotsDiaExactos,
    cantidad,
  }
}

/**
 * La línea del detalle INTERNO de la propuesta: «2 espacios del loop · 18 h al
 * día», o «Roadblock · 12 espacios del loop · 18 h al día · prima 25 %».
 * `null` si la línea no usó la calculadora. Vive aquí y no en la página porque
 * así se prueba sin navegador.
 */
export function etiquetaCalculadora(p: ParametrosLinea): string | null {
  if (p.espaciosComprados == null) return null
  const e = Number(p.espaciosComprados)
  const partes = [`${e} ${e === 1 ? 'espacio' : 'espacios'} del loop`]
  if (p.horasDia != null) partes.push(`${Number(p.horasDia)} h al día`)
  if (p.roadblock) {
    partes.unshift('Roadblock')
    const prima = Number(p.primaRoadblockPct ?? 0) || 0
    if (prima > 0) partes.push(`prima ${prima} %`)
  }
  return partes.join(' · ')
}

/**
 * LA PRIMA DEL ROADBLOCK DENTRO DE LA REGLA DE PRECIO-01.
 *
 * Decisión del dueño, 2026-10-01: la prima solo la pone `comercial.aprobar`.
 * Un vendedor sí puede marcar un Roadblock, con prima 0.
 *
 *  · prima > 0 sin permiso → NO, `'prima-sin-permiso'`, aunque el precio que
 *    mande sea exactamente tarifa × (1+prima).
 *  · la tarifa ESPERADA es la calculada × (1+prima): la prima se aplica UNA
 *    vez, aquí. La pantalla manda ya ese número; si el servidor volviera a
 *    multiplicar, cobraría la prima dos veces.
 *  · con prima > 0 la línea queda como AJUSTE (`ajustado: true`) aunque el
 *    precio cuadre: apartarse de la tarifa de la pantalla es justo lo que
 *    la regla del dueño reserva al gerente, y por eso lleva
 *    `precio_ajustado_por` y su línea de Actividad.
 *  · lo que se guarda como `tarifa_calculada` es la de la PANTALLA, sin la
 *    prima: así «de $1,200 a $1,500» dice cuánto movió el gerente.
 */
export function decidirPrecioCalculadora(e: {
  enviada: number
  calculada: { tarifa: number; calculable: boolean }
  primaPct: number | null
  puedeAjustar: boolean
}): DecisionPrecio | { ok: false; motivo: 'prima-sin-permiso' } {
  const prima = Number(e.primaPct ?? 0) || 0
  if (prima > 0 && !e.puedeAjustar) return { ok: false, motivo: 'prima-sin-permiso' }
  const esperada = e.calculada.calculable ? tarifaConPrima(e.calculada.tarifa, prima) : e.calculada.tarifa
  const dec = decidirPrecioItem({
    enviada: e.enviada,
    calculada: { tarifa: esperada, calculable: e.calculada.calculable },
    puedeAjustar: e.puedeAjustar,
  })
  if (!dec.ok) return dec
  return {
    ok: true,
    tarifaCalculada: e.calculada.calculable ? e.calculada.tarifa : null,
    ajustado: dec.ajustado || prima > 0,
  }
}

/**
 * Los espacios LIBRES de una pantalla, para el servidor.
 *
 * Hoy hay DOS números de «libres» y no dicen lo mismo, así que se toma el
 * MENOR de los dos:
 *
 *  · `total − campañas vigentes` — el que enseña el inventario (`listarSitios`,
 *    «1 slot = 1 campaña», contando `fecha_fin >= current_date`). Es el que ve
 *    el vendedor en la pantalla de propuestas.
 *  · `sitios.spots_disponibles` guardado — el contador con el que la campaña
 *    ACOTA los slots que retiene (`spotsDeLaReserva` en `campanas-repo.ts`).
 *
 * Con el menor, ninguno de los dos puede morder después: lo cotizado cabe en
 * lo que el inventario dice Y en lo que la campaña va a retener. `null` cuando
 * no se sabe ninguno — y entonces no se acota, igual que `spotsDeLaReserva`.
 */
export function espaciosLibres(e: {
  totalSpots: number | null | undefined
  guardados: number | null | undefined
  campanasActivas: number
}): number | null {
  const candidatos: number[] = []
  if (e.totalSpots != null && Number.isFinite(Number(e.totalSpots))) {
    candidatos.push(Number(e.totalSpots) - (Number(e.campanasActivas) || 0))
  }
  if (e.guardados != null && Number.isFinite(Number(e.guardados))) candidatos.push(Number(e.guardados))
  if (!candidatos.length) return null
  return Math.max(0, Math.min(...candidatos))
}

/**
 * Con qué arranca la calculadora en una línea nueva de propuesta.
 *
 * **APAGADA** (`manual: true`), por decisión del dueño del 2026-10-01. Encendida
 * por omisión —como nació en ADR 0042— una pantalla con tarifa «por spot»
 * capturada como precio de día o de paquete pasaba de cotizar $3,200 a $32.6 M:
 * la calculadora llenaba 10,200 spots y los multiplicaba por esa tarifa. Medido
 * en el navegador con «Insurgentes Sur LED» de la base local; su propia línea de
 * referencia decía «equivale a $0.31 por spot frente a la tarifa mensual».
 *
 * Así la línea cotiza como antes (cantidad manual) hasta que se revisen las
 * tarifas por spot, y la calculadora se enciende a mano en cada línea. Cuando
 * las tarifas sean de UNA reproducción, encenderla por omisión es cambiar este
 * `true` por `false`.
 */
export const CALCULADORA_POR_OMISION = {
  manual: true,
  espacios: '1',
  horasDia: '',
  roadblock: false,
  prima: '',
} as const
