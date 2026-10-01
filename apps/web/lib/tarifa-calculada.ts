// ============================================================================
//  lib/tarifa-calculada.ts — La TARIFA CALCULADA de una línea de propuesta.
//  Módulo PURO: sin `fetch`, sin React, sin BD. Lo usan la pantalla y el
//  servidor, y ése es todo su motivo de existir.
// ----------------------------------------------------------------------------
//  Decisión del dueño, 2026-10-01, textual: «en propuestas aparte de ser
//  calculado el gerente será el único que podrá poner otro precio diferente al
//  de la tarifa e igual usuarios superiores».
//
//  Cierra el hallazgo B40 PARA LA TARIFA BASE. Hasta hoy la cuenta vivía dentro
//  de `propuestas/page.tsx` (`tarifaDe`), un componente `'use client'`, y
//  `propuestas-controller.ts` copiaba la `tarifaUnitaria` que mandara el
//  navegador: se podía cerrar una venta de prime a 1 peso con un `curl`, y el
//  snapshot la congelaba con toda la apariencia de ser auditable.
//
//  ─── POR QUÉ UNA SOLA FUNCIÓN PARA LOS DOS LADOS ───────────────────────────
//  Si la pantalla calculara con una regla y el servidor con otra, el vendedor
//  vería un precio, lo mandaría, y el servidor le contestaría «solo un gerente
//  puede cambiar la tarifa» sin que nadie hubiera cambiado nada. Es el modo de
//  fallo que `lib/rejilla.ts` ya documenta («cuatro copias divergen»), con un
//  agravante: aquí divergir no cobra mal, BLOQUEA LA VENTA. Por eso
//  `tarifa-calculada.test.ts` compara esta función contra una copia literal de
//  la regla vieja de la pantalla en una matriz de casos.
//
//  ─── LO QUE NO VIVE AQUÍ ───────────────────────────────────────────────────
//  El volumen, el descuento comercial, el cupón y el paquete. Todos se componen
//  ENCIMA de la tarifa base, y ninguno cambia con este módulo: la tarifa es el
//  primer escalón de la cadena del ADR 0039, y es el único que esto vigila.
// ============================================================================

import { resolverTarifa, temporadaDeFecha, type OrigenTarifa, type Temporada } from './rejilla'
import { UNIDADES, type Unidad } from './periodos'

/**
 * Lo que hace falta saber de una pantalla para tarifarla. Es la forma que ya
 * trae `rowToSitio` (`lib/server/sitios-repo.ts`) para la pantalla, así que la
 * página la pasa tal cual; el servidor la arma con la MISMA forma desde
 * `tarifas-repo.ts`.
 */
export type SitioTarifable = {
  tarifaPublicada?: number | null
  tarifaMensual?: number | null
  modalidadesDetalle?: { unidad: string; tarifaPublicada: number | null }[] | null
  rejilla?: { unidad: string; franjaId: string | null; temporadaId: string | null; tarifa: number }[] | null
}

/**
 * Las modalidades publicadas de una pantalla, `[{unidad, tarifa}]`.
 *
 * Sin ninguna, una mensual SINTÉTICA con su tarifa publicada: así se vendía y
 * así se sigue vendiendo una pantalla dada de alta antes de que existieran las
 * modalidades. Es la regla que tenía `modalidadesDe` en la pantalla, movida aquí
 * sin tocar una coma.
 */
export function modalidadesDeSitio(s: SitioTarifable): { unidad: Unidad; tarifa: number }[] {
  const det = (s.modalidadesDetalle ?? []) as { unidad: string; tarifaPublicada: number | null }[]
  const validas = det
    .filter((m) => UNIDADES.some((u) => u.unidad === m.unidad))
    .map((m) => ({ unidad: m.unidad as Unidad, tarifa: Number(m.tarifaPublicada) || 0 }))
  if (validas.length) return validas
  return [{ unidad: 'mensual', tarifa: Number(s.tarifaPublicada || s.tarifaMensual || 0) }]
}

export type TarifaCalculada = {
  /** La tarifa por UNA unidad. Es el número que la pantalla enseña y manda. */
  tarifa: number
  origen: OrigenTarifa
  /** La temporada que cubría la fecha de inicio, o null. */
  temporadaId: string | null
  /**
   * ¿Hay de verdad una tarifa de la que salga este número?
   *
   * `false` cuando la pantalla no tiene ninguna tarifa capturada (0), o cuando
   * se pide una unidad que la pantalla no ofrece y la cuenta cayó a la primera
   * modalidad por no tener otra cosa. En los dos casos el número existe —la
   * pantalla lo pinta igual que antes— pero no es «la tarifa»: es un respaldo.
   * Y sobre un respaldo no se puede decir que un precio «es el de la tarifa».
   *
   * Un CERO capturado en la REJILLA sí es calculable: `lib/rejilla.ts` dice
   * «un cero de la rejilla es un precio, no un hueco» —la madrugada regalada
   * dentro de un paquete—, y lo decidió el dueño a conciencia.
   */
  calculable: boolean
}

/**
 * LA CUENTA. De la pantalla, la unidad, la franja contratada y la fecha de
 * inicio, a la tarifa por unidad.
 *
 * La temporada se DEDUCE de la fecha de inicio (`temporadaDeFecha`), igual que
 * hacía la pantalla y igual que hace el congelado del snapshot: no se elige.
 * `temporadas` tienen que ser las ACTIVAS de la organización, ordenadas por
 * `desde` — las mismas que sirve `listarTemporadas()`.
 */
export function tarifaCalculada(e: {
  sitio: SitioTarifable
  unidad: string
  franjaId?: string | null
  temporadas: Temporada[]
  fechaInicio: string
}): TarifaCalculada {
  const mods = modalidadesDeSitio(e.sitio)
  const propia = mods.find((m) => m.unidad === e.unidad)
  // El respaldo a la primera modalidad es el de la pantalla de siempre. Se
  // conserva para que el número no cambie; `calculable` dice si es de fiar.
  const base = propia?.tarifa ?? mods[0].tarifa
  const temporadaId = temporadaDeFecha(e.temporadas, e.fechaInicio)
  const filas = (e.sitio.rejilla ?? []).filter((f) => f.unidad === e.unidad)
  const r = filas.length
    ? resolverTarifa({ tarifaBase: base, rejilla: filas, franjaId: e.franjaId || null, temporadaId })
    : { tarifa: Number(base), origen: 'modalidad' as const }
  const calculable = r.origen !== 'modalidad' ? true : !!propia && r.tarifa > 0
  return { tarifa: r.tarifa, origen: r.origen, temporadaId, calculable }
}

/**
 * Pesos → centavos enteros. La comparación «¿es la tarifa?» se hace AQUÍ y no
 * con `===` sobre flotantes: `0.1 + 0.2 !== 0.3`, y un vendedor que manda la
 * tarifa exacta no puede recibir un «solo un gerente puede cambiarla» por un
 * error de redondeo que nadie ve.
 */
export function centavos(pesos: number): number {
  return Math.round(Number(pesos) * 100)
}

export type DecisionPrecio =
  | {
      ok: true
      /** Lo que se guarda en `propuesta_items.tarifa_calculada`. */
      tarifaCalculada: number | null
      /** Si el precio se apartó de la tarifa (o no había tarifa) y lo puso alguien con permiso. */
      ajustado: boolean
    }
  | { ok: false; motivo: 'distinta' | 'sin-tarifa' }

/**
 * LA REGLA DEL DUEÑO, en una función que se puede probar sin servidor.
 *
 *  · Precio = tarifa (al centavo)     → vale para cualquiera, NO es un ajuste.
 *  · Precio ≠ tarifa, sin permiso     → NO. `motivo: 'distinta'`.
 *  · Precio ≠ tarifa, con permiso     → sí, y queda como ajuste.
 *  · Sin tarifa calculable, sin permiso → NO, aunque mande 0. `'sin-tarifa'`:
 *    con una pantalla sin tarifa, lo que el vendedor mande ES poner el precio,
 *    y poner el precio es justamente lo que solo puede el gerente.
 *  · Sin tarifa calculable, con permiso → sí, ajuste sin tarifa que guardar.
 *
 * `puedeAjustar` es `comercial.aprobar` (GERENTE_VENTAS, DIRECTOR_COMERCIAL,
 * ADMINISTRADOR, DUENO); lo resuelve el controller contra `rol_permisos`.
 */
export function decidirPrecioItem(e: {
  enviada: number
  calculada: { tarifa: number; calculable: boolean }
  puedeAjustar: boolean
}): DecisionPrecio {
  if (!e.calculada.calculable) {
    return e.puedeAjustar ? { ok: true, tarifaCalculada: null, ajustado: true } : { ok: false, motivo: 'sin-tarifa' }
  }
  const tarifa = e.calculada.tarifa
  if (centavos(e.enviada) === centavos(tarifa)) return { ok: true, tarifaCalculada: tarifa, ajustado: false }
  return e.puedeAjustar ? { ok: true, tarifaCalculada: tarifa, ajustado: true } : { ok: false, motivo: 'distinta' }
}

const pesos = (n: number) =>
  `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

/**
 * La línea de Actividad de un ajuste de tarifa. Se pinta como
 * «<persona> · <esto> <nombre de la propuesta>», igual que
 * `textoBitacoraPropuesta` (`lib/descuento.ts`): se escribe para quien no
 * programa, y dice las DOS cifras —la que calculó el sistema y la que quedó—,
 * que es lo único que permite saber después cuánto se movió y quién lo movió.
 *
 * Sin tarifa calculada NO dice «de $0»: un cero inventado se leería como que la
 * pantalla se regalaba, y lo cierto es que no tenía tarifa.
 */
export function textoBitacoraAjusteTarifa(a: {
  sitioNombre: string
  unidad: string
  tarifaCalculada: number | null
  tarifa: number
}): string {
  if (a.tarifaCalculada == null) {
    return `Puso la tarifa de «${a.sitioNombre}» (${a.unidad}) en ${pesos(a.tarifa)}, sin tarifa calculada, en la propuesta`
  }
  return `Cambió la tarifa de «${a.sitioNombre}» (${a.unidad}) de ${pesos(a.tarifaCalculada)} a ${pesos(a.tarifa)} en la propuesta`
}
