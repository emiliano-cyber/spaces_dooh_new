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
  const t = texto.trim()
  if (t === '') return { ok: true, valor: null }

  // Se exige la forma completa del número en vez de fiarse de `Number`, que
  // acepta cosas que aquí no son un importe: '0x10', ' 12 ' con separadores, y
  // 'Infinity'. Sin comas de millar: el campo se precarga sin ellas
  // (`textoDeCosto`), así que aceptarlas sería aceptar algo que la propia
  // pantalla nunca produce.
  if (!/^-?\d+(\.\d+)?$/.test(t)) {
    return { ok: false, error: 'Escribe solo el importe, con punto decimal y sin comas. Ejemplo: 12000 o 1250.50' }
  }

  const v = Number(t)
  // `1e999` pasa la expresión regular? No —lleva una 'e'— pero un número con
  // muchísimos dígitos sí, y `Number` lo convierte en Infinity. Se comprueba.
  if (!Number.isFinite(v)) {
    return { ok: false, error: 'Ese importe es demasiado grande' }
  }
  if (v < 0) {
    return { ok: false, error: 'El costo no puede ser negativo' }
  }
  return { ok: true, valor: v }
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
 * Sin separadores de miles a propósito: con ellos el propio campo devolvería
 * '12,000' y `leerCostoOt` lo rechazaría, así que el usuario vería un error por
 * un texto que no escribió.
 */
export function textoDeCosto(valor: number | null): string {
  return valor == null ? '' : String(valor)
}
