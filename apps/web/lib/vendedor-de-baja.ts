// ============================================================================
//  lib/vendedor-de-baja.ts — El vendedor que ya no existe sigue vendiendo en
//  el reporte (P19, decisión del dueño del 29/10).
//
//  `propuestas.usuario_id` es `on delete set null`: al borrar a un usuario, sus
//  propuestas se quedaban sin vendedor y su dinero caía en «Sin vendedor»,
//  revuelto con las propuestas históricas. Desde el 29/10 la propuesta guarda
//  también el NOMBRE (`propuestas.vendedor_nombre`), y aquí se convierte en una
//  fila más del reporte.
//
//  Se hace en los DATOS del reporte y no en `lib/data/reportes.ts` a propósito:
//  la atribución de allí sigue trabajando por identificador, y un vendedor de
//  baja es un identificador sintético (`baja:<nombre>`) que no puede chocar con
//  un uuid. Dos vendedores borrados con el mismo nombre se suman en una fila:
//  es lo único que se sabe de ellos, y separarlos sería inventar.
// ============================================================================

export const PREFIJO_BAJA = 'baja:'
export const CARGO_DE_BAJA = 'Ya no está en la organización'

export interface FilaVendedorDeCampana {
  campana_id: string
  usuario_id: string | null
  vendedor_nombre?: string | null
}

/**
 * El vendedor de cada campaña: el usuario si sigue existiendo, el nombre
 * congelado si se borró, o `null` si la propuesta es histórica (no se sabe).
 *
 * `idsVigentes` son los usuarios de la organización: un `usuario_id` que no
 * esté ahí —otro tenant, o un dato roto— NO se rescata por el nombre, porque
 * el nombre lo habría escrito esa misma fila.
 */
export function vendedoresConBajas(
  usuarios: { id: string; nombre: string; cargo: string | null }[],
  filas: FilaVendedorDeCampana[],
): {
  vendedores: { id: string; nombre: string; cargo: string | null }[]
  vendedorDeCampana: { campanaId: string; usuarioId: string | null }[]
} {
  const bajas = new Map<string, { id: string; nombre: string; cargo: string | null }>()
  const vendedorDeCampana = filas.map((r) => {
    if (r.usuario_id) return { campanaId: r.campana_id, usuarioId: r.usuario_id }
    const nombre = (r.vendedor_nombre ?? '').trim()
    if (!nombre) return { campanaId: r.campana_id, usuarioId: null }
    const id = PREFIJO_BAJA + nombre
    if (!bajas.has(id)) bajas.set(id, { id, nombre, cargo: CARGO_DE_BAJA })
    return { campanaId: r.campana_id, usuarioId: id }
  })
  return { vendedores: [...usuarios, ...bajas.values()], vendedorDeCampana }
}
