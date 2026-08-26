import { z } from 'zod'

// ============================================================================
//  lib/server/fechas.ts — «esto tiene que ser una fecha», una sola vez.
// ----------------------------------------------------------------------------
//  La auditoría del 2026-08-26 (UX-01) encontró que el alta de contrato aceptaba
//  «mañana» como fecha de fin: el valor llegaba crudo a un `$1::date` y salía
//  como error del driver, es decir un 500 que no le dice al usuario qué
//  escribió mal. Se corrigió en `arrendadores-controller` y solo ahí.
//
//  El barrido del mismo día encontró el idéntico `z.string().min(1)` en otras
//  tres rutas —extender una campaña, el primer vencimiento del plan de
//  parcialidades y la fecha de la orden de compra—, todas escribiendo también a
//  columnas `date`. Repetir la regla es exactamente lo que le pasó al RFC: se
//  arregla una copia y las otras se quedan atrás sin que nada avise. Por eso
//  vive aquí y se prueba en `fechas.test.ts`.
//
//  Sin `server-only` a propósito: no toca base ni sesión, así que un formulario
//  puede avisar con la MISMA regla antes de enviar, igual que hace `lib/rfc.ts`.
// ============================================================================

// Fecha que Postgres pueda castear de verdad. `Date.parse` es deliberadamente
// permisivo (acepta ISO con y sin hora, y las formas largas del inglés): lo que
// se busca aquí es atrapar el texto libre, no imponer un formato.
export function esFechaValida(v: unknown): boolean {
  if (typeof v !== 'string') return false
  const s = v.trim()
  return s !== '' && !Number.isNaN(Date.parse(s))
}

// Campo obligatorio de fecha. El mensaje del vacío se pasa porque cada
// formulario nombra su campo («Falta la fecha de inicio», «Falta la fecha fin»);
// el de forma es siempre el mismo.
export function fechaZod(mensajeFalta: string) {
  return z
    .string()
    .trim()
    .min(1, mensajeFalta)
    .refine(esFechaValida, 'Fecha inválida')
}

// Día comparable (AAAAMMDD como número) a partir de una fecha ISO, con o sin
// hora. Comparar fechas COMO TEXTO solo funciona si las dos llevan ceros a la
// izquierda: '2026-9-1' y '2026-10-01' están en ese orden en el calendario y en
// el contrario en un `<` de cadenas. Ese defecto ya se pagó dos veces —lo
// destapó un control positivo en rojo durante UX-01—, y rechazaba periodos
// correctos además de dejar pasar los invertidos.
export function diaComparable(v: string): number | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v.trim())
  // Una fecha con otra forma («March 3, 2026») pasa `esFechaValida` pero no se
  // puede reducir a un día sin arrastrar la zona horaria. Devolver null la deja
  // FUERA de la comparación en vez de compararla mal: los CHECK de la base
  // siguen detrás.
  return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : null
}

// `true` solo cuando se puede AFIRMAR que el fin va antes del inicio.
export function ordenInvertido(inicio: string, fin: string): boolean {
  const a = diaComparable(inicio)
  const b = diaComparable(fin)
  return a != null && b != null && b < a
}
