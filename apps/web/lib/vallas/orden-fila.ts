// ============================================================================
//  lib/vallas/orden-fila.ts — ¿se puede guardar este orden de una fila?
// ----------------------------------------------------------------------------
//  Mover desde el plano (dueño, 24/11) guarda la `posicion` de TODA la fila de
//  una vez: es la marca que `armarPlano` usa para saber que la fila se acomodó
//  a mano (`plano.ts`). Por eso solo se acepta la fila entera —todas las
//  vallas activas de un sitio y una cara, una vez cada una— y con cada grupo
//  junto. Puro: lo aplica `guardarOrdenDeFila` (vallas-repo.ts) dentro de su
//  transacción, con las vallas leídas de la base.
// ============================================================================

export type VallaDeFila = { id: string; sitioId: string; cara: number | null; grupoId: string | null; activo: boolean }

export type ProblemaOrden = 'ajena' | 'mezcla' | 'incompleta' | 'grupo-partido'

/** `vallas`: las de la organización (al menos las de esa fila). `ids`: el orden pedido. */
export function problemaDeOrden(vallas: readonly VallaDeFila[], ids: readonly string[]): ProblemaOrden | null {
  if (!ids.length) return 'incompleta'
  const porId = new Map(vallas.map((v) => [v.id, v]))
  const pedidas = ids.map((id) => porId.get(id))
  if (pedidas.some((v) => !v)) return 'ajena'
  const primera = pedidas[0]!
  if (pedidas.some((v) => v!.sitioId !== primera.sitioId || v!.cara !== primera.cara)) return 'mezcla'

  const fila = vallas.filter((v) => v.activo && v.sitioId === primera.sitioId && v.cara === primera.cara)
  if (new Set(ids).size !== ids.length || ids.length !== fila.length || fila.some((v) => !ids.includes(v.id))) {
    return 'incompleta'
  }

  // Cada grupo, junto: una vez que se sale de un grupo no se vuelve a él.
  const cerrados = new Set<string>()
  let actual: string | null = null
  for (const v of pedidas) {
    const g = v!.grupoId
    if (g !== actual) {
      if (actual) cerrados.add(actual)
      if (g && cerrados.has(g)) return 'grupo-partido'
      actual = g
    }
  }
  return null
}
