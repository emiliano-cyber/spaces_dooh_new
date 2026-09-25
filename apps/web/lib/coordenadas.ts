// ============================================================================
//  lib/coordenadas.ts — ¿esta ubicación sirve para pintarse en un mapa?
// ----------------------------------------------------------------------------
//  UNA sola definición de "coordenada utilizable", compartida por el mapa y por
//  la validación de cercanía al predio. Antes había media: `predio-cercania.ts`
//  descartaba el (0,0) y el mapa no, así que el mismo dato era un hueco para
//  una comprobación y un lugar real para la otra.
// ============================================================================

// Convierte a número lo que pueda serlo. Acepta cadenas porque `pg` devuelve
// las columnas `numeric` como TEXTO, no como número.
export function coordenada(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

// Un par de coordenadas, o null si no se puede saber dónde está.
//
// > [!danger] El (0,0) es un hueco, NO un lugar
// > Una pantalla sin capturar sale de la base como NULL y `rowToSitio` la
// > entrega como 0 (`lib/server/sitios-repo.ts:44-45`). Cero es finito, así que
// > pasaba cualquier comprobación de `Number.isFinite` y se dibujaba en el
// > golfo de Guinea. Y como el auto-enfoque del mapa va al cúmulo más denso, un
// > inventario sin coordenadas se llevaba el encuadre al Atlántico: el mapa no
// > parecía vacío, parecía roto.
// >
// > Descartar el par completo en cero es seguro —ahí no hay inventario, hay
// > océano— pero un cero SOLO no se toca: el ecuador y Greenwich existen.
export function puntoUtil(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined,
): { lat: number; lng: number } | null {
  const la = coordenada(lat)
  const ln = coordenada(lng)
  if (la == null || ln == null) return null
  if (la === 0 && ln === 0) return null
  // Fuera del rango terrestre no es un lugar: es un dato corrupto. MapLibre lo
  // acepta sin quejarse y deja el pin en un sitio imposible.
  if (la < -90 || la > 90) return null
  if (ln < -180 || ln > 180) return null
  return { lat: la, lng: ln }
}
