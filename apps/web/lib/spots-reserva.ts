// ============================================================================
//  lib/spots-reserva.ts — cuántos slots de la pantalla ocupa una reserva.
// ----------------------------------------------------------------------------
//  DATA-02, auditoría del 2026-08-26. Existe porque `reservas.spots_reservados`
//  se estaba llenando de DOS FORMAS DISTINTAS según por dónde entrara la venta,
//  y las dos guardaban magnitudes que no son la misma cosa.
//
//  ─── Qué es esta columna, medido y no supuesto ────────────────────────────
//  Es un contador de SLOTS DEL LOOP de esa pantalla. Se sabe porque al vencer
//  la reserva su valor se SUMA de vuelta a `sitios.spots_disponibles`, acotado
//  con `least(total_spots, …)` (`campanas-repo.ts:254-262`), y `total_spots` es
//  «cuántos slots hay» (`db/schema.sql:157-161`).
//
//  ─── Por qué NO es «spots por día × días» ─────────────────────────────────
//  Porque ese número entra a la misma suma. Una campaña de 4 spots/día durante
//  30 días devolvería 120 a un cubo cuyo techo son, por ejemplo, 12 slots: el
//  `least()` lo recortaría a 12 y **la pantalla quedaría marcada como
//  totalmente libre** aunque otras campañas siguieran ocupándola. Un dato de
//  facturación metido en un contador de capacidad no se nota hasta que alguien
//  vende dos veces el mismo slot.
//
//  La programación —cuántas veces al día se muestra— YA tiene su propia
//  columna, `reservas.spots_por_dia`, y sus propios lectores:
//  `creativos-repo.ts:134-139` (cuántas veces va cada creativo) y
//  `doohmain.ts:294,375` (la cuota pactada). Esos no se tocan: están bien.
//
//  ─── El fallo que esto arregla ────────────────────────────────────────────
//  El camino de propuesta escribía `it.spots_por_dia` en LAS DOS columnas
//  (`campanas-repo.ts:705-706`), y ese campo es opcional: en una propuesta
//  mensual normal viene vacío. Resultado, `spots_reservados = null`, con tres
//  consecuencias que nadie veía:
//
//   1. `lib/reparto-creativos.ts:51-68` lee `null` como «pantalla FIJA, una
//      lona». Una pantalla DIGITAL vendida por propuesta se repartía como una
//      lona: **un creativo se llevaba todo, sin rotación.**
//   2. `campanas-repo.ts:254-262` solo devuelve slots si el valor no es null,
//      así que esas reservas **nunca los devolvían al vencer**.
//   3. `doohmain.ts:375` lo lee como «sin cuota pactada».
// ============================================================================

export interface EntradaSpots {
  /** ¿Es una pantalla digital? Una lona no ocupa slots de ningún loop. */
  digital: boolean
  /** Lo que pidió quien vendió: `spotsPorSitio` en Comercial, `spots_por_dia` en propuesta. */
  pedidos?: number | null
  /** Slots libres de la pantalla ahora mismo. `null` = no se sabe, no se acota. */
  disponibles?: number | null
}

/**
 * Slots que la reserva retiene, o `null` si la pantalla no es digital.
 *
 * Vive aparte de `campanas-repo.ts` por dos motivos, y el segundo es el
 * importante: ese archivo arrastra `cache()` de React y no se puede importar
 * fuera de Next —así que esta regla no se podría probar—, y **los dos caminos
 * de venta llamaban cada uno a su propia versión**. Mientras haya dos
 * expresiones para la misma idea, vuelven a divergir; con una, no pueden.
 */
export function spotsDeLaReserva(e: EntradaSpots): number | null {
  // Una lona no ocupa slots de un loop: no hay loop. `null` aquí es correcto y
  // es lo que `reparto-creativos` espera para no rotar.
  if (!e.digital) return null

  // Digital SIN cantidad pedida ocupa 1, no `null`. Es el corazón del arreglo:
  // «no se dijo cuántos» no significa «es una lona». Una pantalla digital que
  // se vendió está ocupada, y decir lo contrario es lo que hacía que un solo
  // creativo se quedara con toda la pantalla.
  const pedidos = e.pedidos != null ? Math.round(e.pedidos) : 1

  // Acotado a lo que de verdad queda libre. Si no quedan slots, la reserva
  // retiene 0: no se inventa capacidad que la pantalla no tiene.
  const tope = e.disponibles != null ? e.disponibles : Number.POSITIVE_INFINITY
  return Math.max(0, Math.min(pedidos, tope))
}
