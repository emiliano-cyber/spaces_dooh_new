// ============================================================================
//  lib/ubicacion.ts — Armado de la línea de ubicación de un sitio.
// ----------------------------------------------------------------------------
//  Dos cosas que parecen detalle y no lo son, porque las dos salieron a
//  pantalla en la auditoría del 04/08/2026 (hallazgo A4):
//
//  1) Interpolar un campo nulo en una plantilla imprime la palabra "null".
//     `alcaldia` es `string | null` en el tipo, y `claveInterna` está tipado
//     como `string` pero llega nulo desde la base en sitios viejos. El
//     encabezado de la ficha mostraba literalmente «null · EDOMEX, EDOMEX».
//
//  2) `ciudad` a veces REPITE la alcaldía (viene de plaza_ciudad, que se
//     captura a mano). Unir sin deduplicar da «EDOMEX, EDOMEX».
//
//  La comparación es sin distinguir mayúsculas para que «Edomex» y «EDOMEX»
//  cuenten como el mismo lugar: quien captura no usa un criterio único.
// ============================================================================

// Une las partes no vacías, sin repetidas. Devuelve '' si no queda ninguna:
// los componentes que la reciben (Sheet, InlinePanel) ya omiten el subtítulo
// vacío, así que un sitio sin datos de ubicación no deja un separador huérfano.
export function ubicacion(partes: (string | null | undefined)[], sep = ', '): string {
  const limpias = partes.map((p) => (p ?? '').trim()).filter(Boolean)
  const unicas = limpias.filter(
    (v, i) => limpias.findIndex((o) => o.toLowerCase() === v.toLowerCase()) === i,
  )
  return unicas.join(sep)
}
