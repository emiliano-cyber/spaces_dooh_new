// ============================================================================
//  lib/folio-venta.ts — el folio de una campaña es el de su VENTA, y cada
//  extensión le suma un tramo: PR-2026-0042 → PR-2026-0042.1 → .2 …
// ----------------------------------------------------------------------------
//  Pedido de ventas del 06/10: «asociar el id con el no. de venta, y si se
//  alarga la campaña añadir un .1». El tramo lo pone la base, en el mismo
//  `update` que alarga la fecha (`campanas-repo.ts`, `extenderCampana`), para
//  que dos extensiones a la vez no puedan escribir el mismo `.1`.
//
//  Aquí vive solo lo contrario: recuperar el folio SIN tramo, para lo que tiene
//  que seguir reconociendo la misma campaña después de extenderla.
// ============================================================================

/** `PR-2026-0042.3` → `PR-2026-0042`. Un folio sin tramo se devuelve igual. */
export function folioBase(folio: string): string {
  return String(folio ?? '').replace(/\.\d+$/, '')
}
