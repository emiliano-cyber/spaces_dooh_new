// ============================================================================
//  lib/descuento.ts — el descuento de una propuesta, validado y acotado.
// ----------------------------------------------------------------------------
//  Vive APARTE del repositorio a propósito: `propuestas-repo.ts` arrastra
//  `cache()` de React, así que importarlo fuera de Next revienta antes de
//  ejecutar nada y su lógica pura no se podría probar. Mismo motivo por el que
//  existe `lib/perfil-acceso.ts`.
// ============================================================================

export class DescuentoInvalido extends Error {
  constructor(recibido: unknown) {
    super(`El descuento debe ser un número entre 0 y 100; llegó ${JSON.stringify(recibido)}`)
  }
}

/**
 * Devuelve el descuento acotado a [0, 100], o revienta si no es un número.
 *
 * ─── El fallo que motiva esta función ──────────────────────────────────────
 * El recorte era `Math.max(0, Math.min(100, Number(input.descuentoPct)))`, y
 * **no recortaba nada** cuando el valor no era un número: `Number('abc')` es
 * `NaN`, `Math.min(100, NaN)` es `NaN` y `Math.max(0, NaN)` también. Parecía
 * una guarda y no lo era.
 *
 * Y la base no lo frenaba: `numeric` de Postgres **admite NaN** y lo propaga
 * —`'NaN'::numeric * 5` vuelve a ser `NaN`—, así que el descuento contaminaba
 * el bruto, el neto y el aprobado de esa propuesta, y la petición contestaba
 * 200 OK. `PATCH /api/propuestas/[id]` pasa el cuerpo crudo: ese camino no
 * tiene esquema, y esta es su única defensa.
 *
 * `Infinity` se rechaza aunque el recorte lo dejara «bien» en 100: quien manda
 * `Infinity` no está pidiendo el 100 %, está mandando basura, y aceptarla
 * esconde el error de quien llama.
 */
export function descuentoValido(valor: unknown): number {
  // `Number([])` es 0 y `Number(true)` es 1: sin este filtro, un arreglo vacío
  // se guardaría como «sin descuento» y un booleano como «1 %».
  if (typeof valor !== 'number' && typeof valor !== 'string') throw new DescuentoInvalido(valor)
  if (typeof valor === 'string' && valor.trim() === '') throw new DescuentoInvalido(valor)
  const n = Number(valor)
  if (!Number.isFinite(n)) throw new DescuentoInvalido(valor)
  return Math.max(0, Math.min(100, n))
}
