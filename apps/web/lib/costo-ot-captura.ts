import { formatMonto } from './data/derive'
import { leerCifra } from './captura-cifra'
// ============================================================================
//  lib/costo-ot-captura.ts — OT-COSTO-01 · qué entiende el campo «Costo real»
//  de una orden de trabajo de lo que se teclea en él.
// ----------------------------------------------------------------------------
//  Vive FUERA del componente a propósito. `vitest.config.ts` no monta jsdom, así
//  que **una decisión escrita dentro de un `.tsx` no la prueba nadie** — este
//  repositorio ya pagó ese defecto con el tono de los avisos del reporte, que
//  vivía dentro del componente hasta el 2026-09-18.
//
//  Y lo que se decide aquí es dinero. Las dos preguntas que contesta tienen una
//  respuesta equivocada que NO da ningún error:
//
//   · ¿El campo vacío es «cero» o «bórralo»? Es **bórralo**. Si fuera cero,
//     dejar el campo en blanco afirmaría que la visita fue gratis, el reporte
//     dejaría de usar la estimación por tipo para esa OT y el costo de operación
//     bajaría sin que nadie lo hubiera pedido.
//   · ¿Se manda lo que no cambió? **No.** Guardar sin cambios escribiría en la
//     bitácora un movimiento de dinero que nadie hizo, y pediría la contraseña
//     del candado por nada.
// ============================================================================

export type LecturaCosto =
  | { ok: true; valor: number | null }
  | { ok: false; error: string }

/**
 * Del texto tecleado al importe. `null` = «borra el costo capturado», que es lo
 * que significa dejar el campo vacío.
 *
 * NO usa `Number()` a secas sobre el texto: `Number('')` es 0 y `Number(' ')`
 * también, así que un campo en blanco entraría como un cero — justo la
 * confusión que este módulo existe para no tener. El vacío se decide ANTES.
 */
export function leerCostoOt(texto: string): LecturaCosto {
  // Desde el 08/10 (fase 2 de la coma de miles) es `leerCifra` con las reglas
  // de cualquier importe: dos decimales y sin negativos. Hasta esa fecha este
  // lector RECHAZABA las comas, y con razón: la pantalla no las producía, así
  // que aceptarlas era aceptar algo que nadie había escrito. Ahora el campo
  // (`CampoCifra`) pinta 12,000 mientras se teclea, y la regla tiene que
  // entender lo que la propia pantalla enseña. Lo que NO cambia es lo que se
  // rechaza por ambiguo: '1,5' sigue fuera (¿1.5 o 15?), igual que '0x10',
  // 'Infinity', '1e999' y los espacios dentro. Y el vacío sigue siendo BORRAR.
  const r = leerCifra(texto, { decimales: 2, minimo: 0 })
  if (!r.ok) {
    return { ok: false, error: /negativ/i.test(r.error) ? 'El costo no puede ser negativo' : r.error }
  }
  return r
}

/**
 * ¿Hay algo que mandar al servidor?
 *
 * La comparación es con `===` sobre `number | null` y NO con un `!nuevo` ni un
 * `||`: `0` es un importe legítimo y `null` es la ausencia, y tratarlos igual
 * haría dos cosas malas a la vez — pasar de 12 000 a 0 se leería como «sin
 * cambios» y no se guardaría, y borrar un costo de cero no haría nada, dejando
 * esa visita afirmando que fue gratis para siempre.
 */
export function hayQueGuardarCosto(original: number | null, nuevo: number | null): boolean {
  return original !== nuevo
}

/**
 * Lo que se precarga en el campo.
 *
 * `null` da cadena VACÍA, nunca '0': un cero precargado convertiría «nadie lo
 * ha capturado» en la afirmación «costó cero» en cuanto el usuario guardara. Y
 * un cero capturado SÍ se enseña, porque es un dato que alguien decidió.
 *
 * Sin separadores de miles: esto es lo que guarda el FORMULARIO, no lo que se
 * ve. Las comas las pone `CampoCifra` al pintarlo (12,000), y lo que devuelve
 * al teclear vuelve a venir sin ellas — el mismo contrato que todos los campos
 * de importe desde el 08/10.
 */
export function textoDeCosto(valor: number | null): string {
  return valor == null ? '' : String(valor)
}

// ─── Una OT CERRADA ya no admite costo (decisión del dueño, 08/10) ──────────
// El servidor lo rechaza (`fijarCostoOT`, 409); estos son los textos de la
// pantalla. El importe va con `formatMonto`: con coma de miles, como toda cifra.

/** Lo que se dice junto al botón «Cerrar OT», ANTES de cerrarla. */
export function avisoAntesDeCerrar(costoReal: number | null): string {
  if (costoReal == null) {
    return 'Esta OT no tiene costo capturado. Si la cierras, ya no podrás registrarlo después: el reporte de rentabilidad usará la estimación por tipo de tarea.'
  }
  return `Al cerrarla, el costo de ${formatMonto(costoReal)} queda fijo: ya no se podrá cambiar.`
}

/** Lo que se dice del costo de una OT que ya está cerrada. */
export function textoCostoDeCerrada(costoReal: number | null): string {
  if (costoReal == null) {
    return 'Se cerró sin costo capturado: el reporte de rentabilidad usa la estimación por tipo de tarea.'
  }
  return `Costo registrado: ${formatMonto(costoReal)}. La OT está cerrada y ya no se puede cambiar.`
}
