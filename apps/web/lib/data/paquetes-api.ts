// ============================================================================
//  lib/data/paquetes-api.ts — el cliente HTTP de los PAQUETES CERRADOS.
//  ADR 0039, Fase 4.
// ----------------------------------------------------------------------------
//  EL `r.ok` NO SE BORRA DE NINGUNA DE ESTAS FUNCIONES, por el mismo motivo
//  escrito en `sitios-api.ts`, `rejilla-api.ts` y `volumen-api.ts`: sin él, un
//  403 del candado se resolvería como éxito y la pantalla cantaría «guardado»
//  con el catálogo intacto. El mensaje se devuelve TAL CUAL lo manda el
//  servidor porque `esErrorDeDesbloqueo` lo reconoce por texto; sustituirlo por
//  uno propio dejaría el 403 como error rojo, sin cuadro donde teclear la
//  contraseña.
//
//  ⚠️ AQUÍ NO SE MANDA NINGÚN PRECIO AL APLICAR. `aplicarPaqueteApi` manda el
//  `paqueteId` y nada más; el precio lo saca el servidor del catálogo bajo RLS.
//  Si el precio viajara desde aquí, cerrar cinco pantallas en un peso sería
//  editar un JSON en las herramientas del navegador.
// ============================================================================

export type PaqueteUI = {
  id: string
  nombre: string
  precioCerrado: number
  admiteCodigo: boolean
  activo: boolean
  notas: string | null
  sitios: string[]
  /** En cuántas propuestas está aplicado AHORA. No incluye las ya aprobadas
   *  cuyo paquete se borró: ésas conservan el precio y pierden el enlace. */
  aplicadoEn: number
}

async function fallar(r: Response, porOmision: string): Promise<never> {
  const d = await r.json().catch(() => ({}))
  throw new Error((d as { error?: string }).error ?? porOmision)
}

export async function paquetesApi(): Promise<PaqueteUI[]> {
  const r = await fetch('/api/paquetes/')
  if (!r.ok) return fallar(r, 'No se pudieron leer los paquetes')
  const d = (await r.json()) as { paquetes: PaqueteUI[] }
  return d.paquetes ?? []
}

export async function guardarPaqueteApi(p: Partial<PaqueteUI>): Promise<PaqueteUI> {
  const r = await fetch(p.id ? `/api/paquetes/${p.id}/` : '/api/paquetes/', {
    method: p.id ? 'PATCH' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      nombre: p.nombre,
      precioCerrado: p.precioCerrado,
      // Se mandan SIEMPRE, y no con un `?? true` que los omitiría: el esquema
      // del servidor los da por apagado/encendido cuando faltan, así que
      // omitirlos al EDITAR apagaría la bandera sin que nadie lo pidiera.
      admiteCodigo: p.admiteCodigo === true,
      activo: p.activo !== false,
      notas: p.notas ?? null,
      sitios: p.sitios ?? [],
    }),
  })
  if (!r.ok) return fallar(r, 'No se pudo guardar el paquete')
  return r.json()
}

/**
 * Borra un paquete. Borrado REAL, y por eso la pantalla dice «Eliminar»: nada
 * del precio de una venta depende de esta fila —al aplicarlo, el nombre, el
 * precio, la bandera y la composición se copiaron a la propuesta—, así que
 * ninguna venta ya hecha se mueve.
 *
 * Lo que SÍ se pierde es el enlace: una propuesta que lo tenía conserva su
 * precio y deja de saber de qué fila del catálogo salió. Para dejar de venderlo
 * sin perder nada, se le quita `activo`.
 */
export async function borrarPaqueteApi(id: string): Promise<void> {
  const r = await fetch(`/api/paquetes/${id}/`, { method: 'DELETE' })
  if (!r.ok) await fallar(r, 'No se pudo eliminar el paquete')
}

/** Aplica un paquete a una propuesta. SOLO viaja el id. */
export async function aplicarPaqueteApi(
  propuestaId: string,
  paqueteId: string,
): Promise<{ nombre: string; precio: number; admiteCodigo: boolean; composicion: string[] }> {
  const r = await fetch(`/api/propuestas/${propuestaId}/paquete/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ paqueteId }),
  })
  if (!r.ok) return fallar(r, 'No se pudo aplicar el paquete')
  return r.json()
}

/** Quita el paquete y devuelve la propuesta a los precios de línea. */
export async function quitarPaqueteApi(propuestaId: string): Promise<void> {
  const r = await fetch(`/api/propuestas/${propuestaId}/paquete/`, { method: 'DELETE' })
  if (!r.ok) await fallar(r, 'No se pudo quitar el paquete')
}
