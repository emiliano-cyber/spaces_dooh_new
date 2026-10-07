// ============================================================================
//  lib/periodos.ts — Contratación por tiempo: cuántos periodos de una unidad
//  caben en un rango, y el precio resultante. Módulo PURO (sin estado, sin
//  server-only) para que la UI (preview) y el servidor (autoridad) calculen
//  EXACTAMENTE igual.
//
//  Convención de equivalencias (misma que el enum periodicidad_pago del schema:
//  "mensual ≡ 30 días"): mensual/30, catorcenal/14, semanal/7, diaria/1.
//  `spot`, `hora` y `cpm` no se derivan del rango: su cantidad la captura el
//  usuario (nº de salidas, de horas o de millares de impactos contratados).
// ============================================================================

import { formatMonto } from '@/lib/data/derive'

export type Unidad = 'mensual' | 'catorcenal' | 'semanal' | 'diaria' | 'spot' | 'hora' | 'cpm'

// `plural` es explícito y no `corta + 's'`: en español una palabra terminada en
// -s tónica pluraliza en -es, así que la regla automática escribía «2 mess» en
// el selector de duración de propuestas (M10 de la auditoría del 04/08/2026).
// Las demás unidades sí caían bien por accidente, que es justo lo que hacía que
// el error pasara desapercibido.
export const UNIDADES: { unidad: Unidad; label: string; corta: string; plural: string }[] = [
  { unidad: 'mensual', label: 'Mensual', corta: 'mes', plural: 'meses' },
  { unidad: 'catorcenal', label: 'Catorcenal', corta: 'catorcena', plural: 'catorcenas' },
  { unidad: 'semanal', label: 'Semanal', corta: 'semana', plural: 'semanas' },
  { unidad: 'diaria', label: 'Diaria', corta: 'día', plural: 'días' },
  // CPS-CPM (07/10) · «Por spot» se llama como lo dice ventas: CPS, costo por
  // salida. La CLAVE sigue siendo `spot` a propósito: es la que guardan las
  // propuestas, reservas y tarifas de antes, y cambiarla les cambiaría el
  // significado sin migrarlas. Solo cambia lo que se lee.
  { unidad: 'spot', label: 'CPS · costo por salida', corta: 'salida', plural: 'salidas' },
  { unidad: 'hora', label: 'Por hora', corta: 'hora', plural: 'horas' },
  // CPM · costo por millar. La cantidad son MILLARES de impactos, no impactos:
  // así el importe sigue siendo `tarifa × cantidad` en todas partes (volumen,
  // snapshot, PDF, reserva). Con impactos habría que dividir entre 1000 en cada
  // sitio que multiplica, y el que se olvidara cobraría mil veces de más.
  { unidad: 'cpm', label: 'CPM · costo por millar', corta: 'millar', plural: 'millares' },
]

// Las unidades cuya cantidad la teclea quien vende en vez de salir de las
// fechas. Una sola lista: antes eran tres `unidad === 'spot' || unidad ===
// 'hora'` sueltos, y añadir CPM a dos de los tres habría derivado su cantidad
// del rango en el tercero.
const CANTIDAD_MANUAL: readonly string[] = ['spot', 'hora', 'cpm']
export function esCantidadManual(unidad: string): boolean {
  return CANTIDAD_MANUAL.includes(unidad)
}

export const UNIDAD_LABEL: Record<string, string> = Object.fromEntries(
  UNIDADES.map((u) => [u.unidad, u.label]),
)
// Las dos tablas quedan privadas y se llega a ellas por `unidadCorta`: exportar
// la singular es lo que invitaba a escribir `UNIDAD_CORTA[u] + 's'` en cada
// pantalla, que es de donde salió el «mess».
const UNIDAD_CORTA: Record<string, string> = Object.fromEntries(
  UNIDADES.map((u) => [u.unidad, u.corta]),
)
const UNIDAD_PLURAL: Record<string, string> = Object.fromEntries(
  UNIDADES.map((u) => [u.unidad, u.plural]),
)

// Nombre de la unidad concordado con la cantidad ("1 mes", "2 meses"). Cero va
// en plural, como se dice: "0 meses".
export function unidadCorta(unidad: string, cantidad: number): string {
  const tabla = Math.abs(cantidad) === 1 ? UNIDAD_CORTA : UNIDAD_PLURAL
  return tabla[unidad] ?? unidad
}

// ─── Cómo se CUENTA lo que se vendió ────────────────────────────────────────
//
// Se pueden vender 50 spots —«Por spot», cantidad 50, precio = tarifa × 50— y
// hasta hoy el 50 moría en la base: el detalle de la propuesta enseñaba sitio,
// renta y precio, y la reserva ni siquiera exponía los campos. Un importe sin su
// unidad no dice nada: «$60,000» puede ser un mes o cincuenta spots.
//
// ⚠️ LOS DOS NÚMEROS QUE NO SE PUEDEN MEZCLAR, y ya costó un defecto:
//
//   · `cantidad`      → cuántas unidades se contratan. Es lo que multiplica la
//                       tarifa. Es PRECIO.
//   · `spots_por_dia` → cuántas veces al día se muestra la pieza. Es
//                       PROGRAMACIÓN, y no entra en ningún precio.
//
// Confundirlos fue DATA-02 (auditoría del 26/08): se escribía el mismo valor en
// las dos columnas y `reparto-creativos.ts:51-68` acababa repartiendo una
// pantalla digital como si fuera una lona. El arreglo de la escritura vive en
// `campanas-repo.ts:712-718`; lo que hay aquí es el arreglo de la LECTURA.
//
// Por eso son DOS funciones con DOS vocabularios que no se parecen: una dice
// «spots» y la otra «pases al día». «50 spots · 12 pases al día» no se puede
// leer mal; «50 spots · 12 spots» sí.

/** `50 spots` · `1 mes` · `3 meses`. El QUÉ, sin el precio. */
export function etiquetaCantidad(unidad: string, cantidad: number): string {
  const n = Number(cantidad) || 0
  return `${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })} ${unidadCorta(unidad, n)}`
}

/**
 * `50 spots × $ 1,200.00`. La multiplicación que produjo el importe, escrita.
 *
 * Sin `tarifaUnitaria` devuelve SOLO la cantidad, nunca «× $ 0.00»: ese cero
 * afirmaría que la unidad es gratis, y existe en datos reales —el backfill de
 * `20260721_propuesta_unidad_spots.sql` solo rellenó los ítems que ya tenían
 * precio, así que los demás quedaron en 0.
 *
 * NO acepta `spotsPorDia`, y eso es la mitad del guard: la programación no entra
 * en el precio, y un parámetro que no existe no se puede colar por error.
 */
export function resumenContratacion(c: {
  unidad: string
  cantidad: number
  tarifaUnitaria?: number | null
}): string {
  const etiqueta = etiquetaCantidad(c.unidad, c.cantidad)
  const tarifa = Number(c.tarifaUnitaria ?? 0)
  if (!Number.isFinite(tarifa) || tarifa <= 0) return etiqueta
  return `${etiqueta} × ${formatMonto(tarifa)}`
}

/**
 * `50 spots · $ 54,000.00`. Lo mismo que `resumenContratacion` pero SIN la
 * multiplicación, y la diferencia no es de estilo.
 *
 * En `propuesta_items` el precio ES `tarifa_unitaria × cantidad` (`precioItem`),
 * así que escribir la multiplicación cuadra con el importe de al lado. En
 * `reservas` NO: la reserva nacida de una propuesta guarda el **neto** —`lista ×
 * (1−descuento) × (1−comisión)`, ver la inserción desde propuesta en
 * `campanas-repo.ts`— mientras `tarifa_unitaria` se copió tal cual de la
 * propuesta, que es la de **lista**. Un «50 spots × $ 1,200.00» junto a
 * «$ 54,000.00» enseñaría una cuenta que no da, y se leería como un defecto del
 * sistema cuando es el descuento haciendo su trabajo.
 *
 * Sustituye al `{precio}/mes` que la ficha de campaña pintaba para TODA reserva,
 * incluidas las vendidas por spot: un sufijo fijo sobre un campo variable.
 */
export function resumenReserva(r: { unidad: string; cantidad: number; precio: number }): string {
  return `${etiquetaCantidad(r.unidad, r.cantidad)} · ${formatMonto(Number(r.precio) || 0)}`
}

/**
 * `12 pases al día`, o `null` cuando no se capturó.
 *
 * Dice «pases» y no «spots» a propósito: es lo único que impide que «50 spots» y
 * «12 spots» convivan en la misma ficha significando cosas distintas.
 *
 * El cero devuelve `null` igual que el nulo: `spots_por_dia` está en NULL en
 * toda la producción de hoy, y un «0 pases al día» afirmaría que la pieza no
 * sale nunca, que es lo contrario de «no se capturó».
 */
export function etiquetaFrecuencia(spotsPorDia: number | null | undefined): string | null {
  const n = Number(spotsPorDia ?? 0)
  if (!Number.isFinite(n) || n <= 0) return null
  return `${n} ${n === 1 ? 'pase' : 'pases'} al día`
}

// Días inclusivos entre dos fechas 'YYYY-MM-DD' (14→20 son 7 días).
export function diasInclusivos(fechaInicio: string, fechaFin: string): number {
  const a = Date.parse(fechaInicio)
  const b = Date.parse(fechaFin)
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0
  return Math.floor((b - a) / 86_400_000) + 1
}

// ─── Los MESES son meses de CALENDARIO (decisión del dueño, 2026-10-02) ─────
// Hasta ese día un mes valía 30 días, en la fecha «Hasta» y en la cuenta de lo
// que se cobra. El dueño lo vio como «elijo mes 2 y se los resta»: 05/10 + 2
// meses terminaba el 03/12, y el día de fin retrocedía con cada mes. Y la cuenta
// —días ÷ 30 hacia ARRIBA— cobraba 2 meses por 01/10–31/10, que tiene 31 días.
//
// Las dos cosas cambian JUNTAS y por la misma función, `finDeMeses`: si solo
// cambiara la fecha, 05/10–04/12 (61 días) se seguiría cobrando como 3 meses.
// Semanas, catorcenas y días no cambian: 7, 14 y 1 son exactos.
//
// Las fechas se tratan como TEXTO 'AAAA-MM-DD' y en UTC, nunca con la hora local:
// una fecha de calendario no tiene zona, y con `new Date('2026-10-05')` en México
// el día se movería según la hora en que se calcule.

const ISO_FECHA = /^(\d{4})-(\d{2})-(\d{2})/

function partes(fecha: string): [number, number, number] | null {
  const m = ISO_FECHA.exec(String(fecha))
  return m ? [Number(m[1]), Number(m[2]) - 1, Number(m[3])] : null
}

const isoUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/**
 * El último día (inclusivo) de `n` meses de calendario que empiezan en
 * `fechaInicio`: el día anterior al mismo número de día `n` meses después.
 * 05/10 + 1 → 04/11. Si ese día no existe en el mes de llegada (31/01 + 1 mes),
 * el periodo termina el último día de ese mes (28 o 29 de febrero).
 */
function finDeMeses(fechaInicio: string, n: number): string {
  const p = partes(fechaInicio)
  if (!p) return ''
  const [y, m, d] = p
  const ultimoDiaLlegada = new Date(Date.UTC(y, m + n + 1, 0)).getUTCDate()
  if (d > ultimoDiaLlegada) return isoUTC(Date.UTC(y, m + n, ultimoDiaLlegada))
  return isoUTC(Date.UTC(y, m + n, d) - 86_400_000)
}

// Cuántos periodos de `unidad` caben en el rango. Para spot/hora/cpm devuelve null:
// esa cantidad no se deriva del tiempo, la pone el usuario.
export function periodosEnRango(unidad: Unidad, fechaInicio: string, fechaFin: string): number | null {
  if (esCantidadManual(unidad)) return null
  const dias = diasInclusivos(fechaInicio, fechaFin)
  if (dias <= 0) return 0
  if (unidad === 'mensual') {
    // El menor número de meses de calendario que cubre el rango entero. Las
    // fechas en 'AAAA-MM-DD' se comparan como texto, que ordena igual que el
    // calendario. El tope solo protege de un rango absurdo (100 años).
    const fin = String(fechaFin).slice(0, 10)
    let n = 1
    while (n < 1200 && finDeMeses(fechaInicio, n) < fin) n++
    return n
  }
  const divisor = unidad === 'catorcenal' ? 14 : unidad === 'semanal' ? 7 : 1
  return Math.max(1, Math.ceil(dias / divisor))
}

// La cantidad efectiva del ítem: para unidades de tiempo, los periodos del
// rango; para spot/hora/cpm, la cantidad manual (mínimo 1).
export function cantidadEfectiva(
  unidad: Unidad,
  fechaInicio: string,
  fechaFin: string,
  cantidadManual?: number | null,
): number {
  const auto = periodosEnRango(unidad, fechaInicio, fechaFin)
  if (auto !== null) return auto
  return Math.max(1, Math.floor(cantidadManual ?? 1))
}

// Fecha "hasta" a partir de una duración (rango inclusivo). Usa la MISMA cuenta
// que el precio (`periodosEnRango`): los meses son de calendario (`finDeMeses`) y
// catorcena=14, semana=7, día=1, así una duración de "N meses" se cobra
// exactamente como N meses. Devuelve '' si faltan datos. Solo unidades de tiempo.
export function fechaFinDesde(fechaInicio: string, unidad: Unidad, cantidad: number): string {
  const base = Date.parse(fechaInicio)
  if (Number.isNaN(base) || !cantidad || cantidad < 1) return ''
  if (esCantidadManual(unidad)) return ''
  if (unidad === 'mensual') return finDeMeses(fechaInicio, Math.round(cantidad))
  const factor = unidad === 'catorcenal' ? 14 : unidad === 'semanal' ? 7 : 1
  const diasTotal = Math.round(cantidad * factor)
  const fin = base + (diasTotal - 1) * 86_400_000
  return new Date(fin).toISOString().slice(0, 10)
}

// Precio del ítem = tarifa por unidad × cantidad. Redondeado a entero (MXN/PEN
// sin centavos, como el resto de precios de lista del sistema).
export function precioItem(tarifaUnitaria: number, cantidad: number): number {
  return Math.round((Number(tarifaUnitaria) || 0) * (Number(cantidad) || 0))
}
