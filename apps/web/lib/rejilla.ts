// ============================================================================
//  lib/rejilla.ts — La rejilla de precios: franja horaria y temporada.
//  Módulo PURO: sin `fetch`, sin React, sin BD. Hermano de `modalidades.ts`.
// ----------------------------------------------------------------------------
//  QUÉ RESUELVE (ADR 0039, Fase 1). Hasta hoy el precio de venta era UN número
//  por `(pantalla, unidad)` — `sitio_modalidades`, con su `unique (sitio_id,
//  unidad)` (`db/schema.sql:207-211`). A partir de aquí es
//
//      tarifa base = f(pantalla, unidad, FRANJA, FECHA)
//
//  y la fecha entra por la TEMPORADA que la cubre. Las capas de descuento
//  (volumen, código, paquete) son las fases 2–4 y NO viven aquí.
//
//  POR QUÉ ES UN MÓDULO PURO Y NO LÓGICA DENTRO DEL REPOSITORIO. La regla
//  «cuál de estas filas manda» la necesitan CUATRO sitios: la ficha al guardar,
//  el importador al validar, la propuesta al cotizar y el congelado del
//  snapshot al aprobar. Cuatro copias divergen — es exactamente el modo de
//  fallo que este repositorio ya documentó con el orden de las migraciones
//  (`scripts/migrar.mjs:61`) y con la copia de `ordenar()` en `db-e2e.ts`. Aquí
//  divergir significa cobrar un precio que nadie decidió.
// ============================================================================

/** Una franja horaria de la organización. `HH:MM` en 24 h, fin EXCLUSIVO. */
export type FranjaHoraria = {
  id: string
  nombre: string
  horaInicio: string
  horaFin: string
}

/** Una temporada de la organización. `AAAA-MM-DD`, ambos extremos INCLUSIVOS. */
export type Temporada = {
  id: string
  nombre: string
  desde: string
  hasta: string
}

/** Una fila de la rejilla, ya filtrada a una `(pantalla, unidad)`. */
export type FilaRejilla = {
  franjaId: string | null
  temporadaId: string | null
  tarifa: number
}

/**
 * De dónde salió la tarifa, **en orden de especificidad**. Se congela en el
 * snapshot junto con el importe: seis meses después, «1 800» sin decir que era
 * el prime del Buen Fin no se puede auditar.
 */
export const ORIGENES_TARIFA = [
  'franja+temporada',
  'franja',
  'temporada',
  'rejilla',
  'modalidad',
] as const

export type OrigenTarifa = (typeof ORIGENES_TARIFA)[number]

export type TarifaResuelta = {
  tarifa: number
  origen: OrigenTarifa
  /** La franja de la fila GANADORA, no la contratada. Null si ganó una fila sin franja. */
  franjaId: string | null
  /** La temporada de la fila GANADORA. */
  temporadaId: string | null
}

/**
 * EL AVISO, declarado una sola vez (ADR 0039, «el producto tiene que DECIRLO»).
 *
 * El SDK de DOOHmain acepta `--version --anunciante --campana --fecha-inicio
 * --fecha-fin --filepath --screen --list --cant-dia`
 * (`doohmain_sdk/__main__.py:66-75`). **No hay `--hora` ni `--dias`.** La franja
 * se vende y se cobra, pero la programación la mete una persona en el CMS.
 *
 * Enseñar «prime 06:00–10:00» sin decir esto es mentir por omisión: el día que
 * un spot salga a las tres de la mañana nadie sabrá si falló el sistema o el
 * operador. Se declara aquí —y no suelto en cada pantalla— porque un texto
 * copiado en cinco sitios deja cuatro versiones viejas el día que cambie.
 */
export const AVISO_FRANJA_NO_VIAJA_AL_CMS =
  'La franja horaria es un compromiso COMERCIAL: se cotiza y se cobra, pero NO se ' +
  'envía al CMS. Quien opere la pantalla tiene que programarla manualmente.'

const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/
const FECHA_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

const MINUTOS_DEL_DIA = 24 * 60

/**
 * `HH:MM` → minutos desde la medianoche, o **null** si no es una hora.
 *
 * Devuelve null y NO un cero a propósito: un `?? 0` pondría toda hora mal
 * escrita a medianoche sin dar el menor error, que es convertir «no sé» en una
 * afirmación concreta — la familia de defecto que el ADR 0039 nombra.
 */
export function minutosDeHora(hora: string): number | null {
  const m = HORA_RE.exec(String(hora ?? '').trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/**
 * Los tramos `[inicio, fin)` que ocupa una franja dentro de un día.
 *
 * Una franja que cruza la medianoche (22:00–06:00) ocupa DOS tramos. Tratarla
 * como uno solo con `inicio > fin` haría que el solape se calculara al revés y
 * que 23:00 quedara fuera de la madrugada — sin error, solo con el precio
 * equivocado.
 */
function tramos(inicio: number, fin: number): [number, number][] {
  if (inicio < fin) return [[inicio, fin]]
  return [
    [inicio, MINUTOS_DEL_DIA],
    [0, fin],
  ]
}

/** Intersección de dos tramos medio abiertos `[a, b)`. */
function seCruzan(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1]
}

/**
 * Por qué NO se puede guardar esta franja, o `null` si sí se puede.
 *
 * `otras` son las franjas YA guardadas de la misma organización. Una franja no
 * se compara consigo misma: guardar «prime» con las mismas horas es editarle el
 * nombre, no un solape, y si esto no se excluyera ninguna franja se podría
 * volver a guardar jamás.
 *
 * EL SOLAPE SE PROHÍBE, y es la decisión que hace determinista todo lo demás:
 * si dos franjas pudieran cubrir las 09:30, el precio de ese spot dependería de
 * un desempate que nadie decidió — y el invariante de congelar no salva de eso,
 * congelaría un precio inexplicable.
 */
export function motivoFranjaInvalida(
  franja: FranjaHoraria,
  otras: FranjaHoraria[],
): string | null {
  const nombre = String(franja.nombre ?? '').trim()
  if (!nombre) return 'La franja necesita un nombre.'

  const ini = minutosDeHora(franja.horaInicio)
  const fin = minutosDeHora(franja.horaFin)
  if (ini === null || fin === null) {
    return `Hora no válida en "${nombre}": se escribe HH:MM en 24 horas, de 00:00 a 23:59.`
  }
  if (ini === fin) {
    return `La franja "${nombre}" empieza y termina a la misma hora: no cubre nada.`
  }

  const mios = tramos(ini, fin)
  for (const otra of otras) {
    if (otra.id === franja.id) continue
    const oi = minutosDeHora(otra.horaInicio)
    const of = minutosDeHora(otra.horaFin)
    if (oi === null || of === null || oi === of) continue
    const suyos = tramos(oi, of)
    if (mios.some((a) => suyos.some((b) => seCruzan(a, b)))) {
      return `La franja "${nombre}" (${franja.horaInicio}–${franja.horaFin}) se solapa con "${otra.nombre}" (${otra.horaInicio}–${otra.horaFin}).`
    }
  }
  return null
}

/**
 * Por qué NO se puede guardar esta temporada, o `null`.
 *
 * Mismo criterio que las franjas: los extremos son INCLUSIVOS y el solape se
 * prohíbe. Que «Diciembre» y «Buen Fin» no puedan convivir tal cual no es una
 * limitación escondida: obliga al dueño a decir qué precio manda esos cuatro
 * días, que es una decisión de negocio, no de implementación.
 *
 * Las fechas se comparan como CADENAS `AAAA-MM-DD`, que ordenan igual que las
 * fechas y no arrastran zona horaria. Un `new Date('2026-11-13')` aquí sería un
 * instante UTC y en México restaría un día al imprimirlo.
 */
export function motivoTemporadaInvalida(
  temporada: Temporada,
  otras: Temporada[],
): string | null {
  const nombre = String(temporada.nombre ?? '').trim()
  if (!nombre) return 'La temporada necesita un nombre.'

  const desde = String(temporada.desde ?? '').trim()
  const hasta = String(temporada.hasta ?? '').trim()
  if (!FECHA_RE.test(desde) || !FECHA_RE.test(hasta)) {
    return `Fecha no válida en "${nombre}": se escribe AAAA-MM-DD.`
  }
  if (hasta < desde) {
    return `La temporada "${nombre}" termina antes de empezar.`
  }

  for (const otra of otras) {
    if (otra.id === temporada.id) continue
    if (!FECHA_RE.test(otra.desde) || !FECHA_RE.test(otra.hasta)) continue
    if (desde <= otra.hasta && otra.desde <= hasta) {
      return `La temporada "${nombre}" (${desde} a ${hasta}) se solapa con "${otra.nombre}" (${otra.desde} a ${otra.hasta}).`
    }
  }
  return null
}

/**
 * Qué temporada cubre esta fecha, o `null` — que es lo normal: la mayor parte
 * del año no es temporada de nada.
 *
 * Devuelve la PRIMERA que cubre. Como el solape está prohibido
 * (`motivoTemporadaInvalida`), no puede haber una segunda; si la hubiera —datos
 * anteriores a esta validación— gana la primera del orden que llegue, y por eso
 * el repositorio las pide ordenadas por `desde`.
 */
export function temporadaDeFecha(temporadas: Temporada[], fecha: string): string | null {
  const f = String(fecha ?? '').trim()
  if (!FECHA_RE.test(f)) return null
  for (const t of temporadas) {
    if (t.desde <= f && f <= t.hasta) return t.id
  }
  return null
}

/**
 * LA RESOLUCIÓN. De la rejilla dispersa a UN precio, diciendo de dónde salió.
 *
 * ─── La rejilla es DISPERSA, y ése es el invariante 1 ──────────────────────
 * Se puebla donde el dueño quiera. Una pantalla SIN ninguna fila se vende
 * exactamente como hoy, con `tarifaBase` (su `sitio_modalidades`). Y una
 * pantalla con rejilla a la que se le contrata una franja que no tiene fila
 * propia TAMBIÉN se vende: cae al escalón siguiente. **En ningún camino se
 * impide vender por falta de captura.**
 *
 * ─── El orden de especificidad, y por qué la franja gana a la temporada ────
 *   1. (franja, temporada)  — la fila exacta
 *   2. (franja, —)
 *   3. (—, temporada)
 *   4. (—, —)               — la fila de la rejilla sin dimensiones
 *   5. `tarifaBase`         — `sitio_modalidades`, o sea el precio de hoy
 *
 * Entre 2 y 3 hay que elegir, y se elige la FRANJA: la franja la escoge el
 * vendedor y queda CONTRATADA en el ítem; la temporada se DEDUCE de la fecha.
 * Entre dos filas igual de específicas manda la que alguien eligió a propósito.
 *
 * ─── Un CERO de la rejilla es un precio, no un hueco ───────────────────────
 * El desempate se hace por presencia de fila, nunca con `?? tarifaBase` sobre
 * el importe: un `0` capturado a conciencia —madrugada regalada dentro de un
 * paquete— saldría cobrado a tarifa completa, y nadie lo vería.
 */
export function resolverTarifa(entrada: {
  tarifaBase: number
  rejilla: FilaRejilla[]
  franjaId: string | null
  temporadaId: string | null
}): TarifaResuelta {
  const { tarifaBase, rejilla, franjaId, temporadaId } = entrada
  const filas = rejilla ?? []

  const buscar = (fr: string | null, te: string | null) =>
    filas.find((f) => (f.franjaId ?? null) === fr && (f.temporadaId ?? null) === te) ?? null

  if (franjaId && temporadaId) {
    const exacta = buscar(franjaId, temporadaId)
    if (exacta) {
      return {
        tarifa: Number(exacta.tarifa),
        origen: 'franja+temporada',
        franjaId,
        temporadaId,
      }
    }
  }
  if (franjaId) {
    const porFranja = buscar(franjaId, null)
    if (porFranja) {
      return { tarifa: Number(porFranja.tarifa), origen: 'franja', franjaId, temporadaId: null }
    }
  }
  if (temporadaId) {
    const porTemporada = buscar(null, temporadaId)
    if (porTemporada) {
      return {
        tarifa: Number(porTemporada.tarifa),
        origen: 'temporada',
        franjaId: null,
        temporadaId,
      }
    }
  }
  const sinDimensiones = buscar(null, null)
  if (sinDimensiones) {
    return {
      tarifa: Number(sinDimensiones.tarifa),
      origen: 'rejilla',
      franjaId: null,
      temporadaId: null,
    }
  }
  return { tarifa: Number(tarifaBase), origen: 'modalidad', franjaId: null, temporadaId: null }
}
