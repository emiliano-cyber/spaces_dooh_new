// ============================================================================
//  lib/secciones-plegadas.ts — qué secciones dejó plegadas cada persona (PLEG-01).
//
//  Preferencia de pantalla y de cada navegador: vive en localStorage, como la
//  vista compacta de Campañas (`lib/campanas-vista.ts`), y no toca el servidor.
//  Lo usa `CardColapsable` cuando recibe un `id`. Puro y probado aquí; el
//  acceso a localStorage va en el componente, envuelto en try/catch.
// ============================================================================

export const CLAVE_PLEGADAS = 'spaces:secciones-plegadas'

/** Lo guardado, validado: cualquier cosa rara vuelve a «ninguna plegada». */
export function leerPlegadas(raw: string | null): string[] {
  if (!raw) return []
  let d: unknown
  try {
    d = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(d)) return []
  return [...new Set(d.filter((x): x is string => typeof x === 'string' && x !== ''))]
}

/** La lista con `id` plegada (`true`) o desplegada (`false`). No muta la de entrada. */
export function conPlegada(lista: string[], id: string, plegada: boolean): string[] {
  const sin = lista.filter((x) => x !== id)
  return plegada ? [...sin, id] : sin
}
