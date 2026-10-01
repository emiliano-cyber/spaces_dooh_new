// ============================================================================
//  lib/data/codigos-api.ts — el cliente HTTP de los códigos promocionales.
//  ADR 0039, Fase 3.
// ----------------------------------------------------------------------------
//  EL `r.ok` NO SE BORRA DE NINGUNA DE ESTAS FUNCIONES, por el mismo motivo
//  escrito en `sitios-api.ts`, `rejilla-api.ts` y `volumen-api.ts`: sin él, un
//  403 del candado se resolvería como éxito y la pantalla cantaría «guardado»
//  con el catálogo intacto. El mensaje se devuelve TAL CUAL lo manda el
//  servidor porque `esErrorDeDesbloqueo` lo reconoce por texto.
//
//  ⚠️ Y AQUÍ IMPORTA MÁS QUE EN NINGÚN OTRO SITIO. `aplicarCodigoApi` manda el
//  CÓDIGO TECLEADO y nada más — no hay ningún parámetro de porcentaje que
//  pudiera añadirse «para ahorrar una consulta». Si el 400 de un cupón vencido
//  o agotado se tragara, la pantalla diría que se aplicó y el vendedor se lo
//  prometería al cliente. El texto del error ES el producto aquí: distingue «no
//  existe» de «venció» de «se agotó», y quien vende necesita saber cuál es.
// ============================================================================

export type CodigoPromocionalUI = {
  id: string
  codigo: string
  descuentoPct: number
  vigenteDesde: string
  vigenteHasta: string
  /** `null` = sin tope de usos; el freno es la fecha. */
  usosMaximos: number | null
  /** Cuántas veces se ha canjeado ya. Lo cuenta el servidor. */
  usos: number
}

async function fallar(r: Response, porOmision: string): Promise<never> {
  const d = await r.json().catch(() => ({}))
  throw new Error((d as { error?: string }).error ?? porOmision)
}

/** Los cupones de la organización, con su cuenta de canjes. */
export async function codigosApi(): Promise<CodigoPromocionalUI[]> {
  const r = await fetch('/spaces-dooh/api/codigos-promocionales/')
  if (!r.ok) return fallar(r, 'No se pudieron leer los códigos promocionales')
  const d = (await r.json()) as { codigos: CodigoPromocionalUI[] }
  return d.codigos ?? []
}

export async function guardarCodigoApi(
  c: Partial<CodigoPromocionalUI>,
): Promise<CodigoPromocionalUI> {
  const r = await fetch(
    c.id ? `/spaces-dooh/api/codigos-promocionales/${c.id}/` : '/spaces-dooh/api/codigos-promocionales/',
    {
      method: c.id ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        codigo: c.codigo,
        descuentoPct: c.descuentoPct,
        vigenteDesde: c.vigenteDesde,
        vigenteHasta: c.vigenteHasta,
        usosMaximos: c.usosMaximos ?? null,
      }),
    },
  )
  if (!r.ok) return fallar(r, 'No se pudo guardar el código')
  return r.json()
}

/**
 * Borra un cupón. Borrado REAL, y por eso la pantalla dice «Eliminar».
 *
 * Ninguna venta se mueve: el texto y el porcentaje se copiaron a la propuesta
 * al canjear. Lo que SÍ se va con él son sus canjes, o sea **su cuenta de usos
 * vuelve a cero si se vuelve a crear con el mismo código** — la pantalla lo
 * dice, porque es la única consecuencia que no se ve.
 */
export async function borrarCodigoApi(id: string): Promise<void> {
  const r = await fetch(`/spaces-dooh/api/codigos-promocionales/${id}/`, { method: 'DELETE' })
  if (!r.ok) await fallar(r, 'No se pudo eliminar el código')
}

/**
 * ⚠️ APLICA UN CÓDIGO A UNA PROPUESTA. **Solo viaja el código tecleado.**
 *
 * No hay ningún parámetro de porcentaje, y no es un olvido: es el invariante de
 * la Fase 3. El servidor busca el cupón, comprueba la vigencia contra el reloj
 * de Postgres, cuenta los canjes con la fila bloqueada, y decide él cuánto
 * descuenta. Añadirle aquí un `descuentoPct` convertiría el cupón en una
 * sugerencia del navegador.
 */
export async function aplicarCodigoApi(
  propuestaId: string,
  codigo: string,
): Promise<{ codigo: string; descuentoPct: number }> {
  const r = await fetch(`/spaces-dooh/api/propuestas/${propuestaId}/codigo/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ codigo }),
  })
  // El mensaje del servidor pasa TAL CUAL: es el que dice si el cupón no
  // existe, si venció o si se agotó, y las tres cosas se arreglan distinto.
  if (!r.ok) return fallar(r, 'No se pudo aplicar el código')
  return r.json()
}

/** Quita el código de la propuesta y DEVUELVE EL USO al cupón. */
export async function quitarCodigoApi(propuestaId: string): Promise<void> {
  const r = await fetch(`/spaces-dooh/api/propuestas/${propuestaId}/codigo/`, { method: 'DELETE' })
  if (!r.ok) await fallar(r, 'No se pudo quitar el código')
}
