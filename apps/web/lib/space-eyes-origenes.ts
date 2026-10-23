// ============================================================================
//  lib/space-eyes-origenes.ts — De dónde salió una foto, en palabras.
// ----------------------------------------------------------------------------
//  `photos.source` de Space Eye tiene SIETE valores (migración 024):
//  manual, scheduled, on_demand, boot, creative_change, falla y campana. La
//  pantalla nombraba menos, y de dos maneras distintas:
//
//    · la Galería conocía seis y pintaba la etiqueta solo si el origen estaba
//      en su lista, así que una prueba de campaña salía SIN NINGUNA etiqueta y
//      tampoco se podía filtrar;
//    · la ficha del equipo conocía uno —«a demanda»— y a todo lo demás lo
//      llamaba «programada». Ahí una prueba de campaña no es que no se nombre:
//      se presenta como otra cosa, que es peor.
//
//  Lo encontró el dueño el 22-oct-2026, el día que las dos campañas de Dessea
//  dieron su primera prueba en MAGNOCENTRO: «se tomaron 2 fotos, ¿son esos?
//  solo que en la leyenda no dice algo de campaña». El dato estaba bien
//  guardado —el contador de la campaña subió—; lo que faltaba era decirlo.
//
//  Dos listas que nombran lo mismo acaban divergiendo; por eso solo existe
//  ESTA. Es un dato puro, sin dependencias: lo importan la Galería y la ficha.
// ============================================================================

/** Los siete orígenes del ENUM, en el orden en que se ofrecen para filtrar. */
export const ORIGENES_FOTO: { valor: string; texto: string }[] = [
  { valor: 'manual', texto: 'Manual' },
  { valor: 'scheduled', texto: 'Programada' },
  { valor: 'on_demand', texto: 'A petición' },
  { valor: 'creative_change', texto: 'Creativo nuevo' },
  { valor: 'campana', texto: 'Campaña' },
  { valor: 'falla', texto: 'Falla de pantalla' },
  { valor: 'boot', texto: 'Al encender' },
]

const TEXTO = new Map(ORIGENES_FOTO.map((o) => [o.valor, o.texto]))

/**
 * El nombre del origen, o `null` si no lo conocemos.
 *
 * Devuelve `null` —y no el valor crudo— a propósito: un origen que esta versión
 * no conoce es un valor nuevo de Space Eye, y enseñar `creative_change` en la
 * pantalla es peor que no enseñar nada. Que falte la etiqueta se nota y se
 * arregla; un tecnicismo en inglés se queda ahí años.
 */
export function textoOrigen(origen: string | null | undefined): string | null {
  if (!origen) return null
  return TEXTO.get(origen) ?? null
}

/**
 * El sello que se pinta sobre la foto: el origen y, si es prueba de campaña, de
 * CUÁL.
 *
 * El nombre importa porque una misma pantalla puede tener vendidos dos
 * creativos de la misma campaña —es lo que pasó con Dessea— y cada uno manda su
 * propia prueba: sin el nombre, dos fotos distintas dirían exactamente lo mismo.
 */
export function selloDeFoto(
  origen: string | null | undefined,
  campana?: string | null,
): string | null {
  const base = textoOrigen(origen)
  if (!base) return null
  if (origen === 'campana' && campana) return `${base} · ${campana}`
  return base
}
