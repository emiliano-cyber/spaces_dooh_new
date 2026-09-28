// ============================================================================
//  lib/data/volumen-api.ts — el cliente HTTP de la escala de descuento por
//  volumen.  ADR 0039, Fase 2.
// ----------------------------------------------------------------------------
//  EL `r.ok` NO SE BORRA DE NINGUNA DE ESTAS FUNCIONES, por el mismo motivo
//  escrito en `sitios-api.ts` y en `rejilla-api.ts`: sin él, un 403 del candado
//  se resolvería como éxito y la pantalla cantaría «guardado» con la escala
//  intacta. El mensaje se devuelve TAL CUAL lo manda el servidor porque
//  `esErrorDeDesbloqueo` lo reconoce por texto; sustituirlo por uno propio
//  dejaría el 403 como error rojo, sin cuadro donde teclear la contraseña.
//
//  ⚠️ AQUÍ NO SE CALCULA NINGÚN DESCUENTO. Este archivo lee y escribe la
//  ESCALA; el porcentaje que se aplica a una venta lo decide el servidor al
//  crear la propuesta (`propuestas-controller.ts`). Lo que la pantalla de
//  cotización pinta con estos datos es una PREVISTA — si algún día divergiera,
//  manda lo que se guardó.
// ============================================================================

export type TramoVolumenUI = {
  id: string
  unidad: string
  desdeCantidad: number
  descuentoPct: number
}

async function fallar(r: Response, porOmision: string): Promise<never> {
  const d = await r.json().catch(() => ({}))
  throw new Error((d as { error?: string }).error ?? porOmision)
}

/** Los tramos de la organización, ordenados por unidad y umbral. */
export async function escalasVolumenApi(): Promise<TramoVolumenUI[]> {
  const r = await fetch('/api/volumen/escalas/')
  if (!r.ok) return fallar(r, 'No se pudo leer la escala de volumen')
  const d = (await r.json()) as { tramos: TramoVolumenUI[] }
  return d.tramos ?? []
}

export async function guardarTramoVolumenApi(
  t: Partial<TramoVolumenUI>,
): Promise<TramoVolumenUI> {
  const r = await fetch(t.id ? `/api/volumen/escalas/${t.id}/` : '/api/volumen/escalas/', {
    method: t.id ? 'PATCH' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      unidad: t.unidad,
      desdeCantidad: t.desdeCantidad,
      descuentoPct: t.descuentoPct,
    }),
  })
  if (!r.ok) return fallar(r, 'No se pudo guardar el tramo')
  return r.json()
}

/**
 * Borra un tramo. Borrado REAL, y por eso la pantalla dice «Eliminar» y no «Dar
 * de baja»: nada lo referencia —cada línea de propuesta copió su porcentaje y
 * su umbral al capturarla—, así que ninguna venta ya hecha se mueve. Es lo
 * contrario de las franjas, donde la baja es lógica porque lo contratado sí
 * apunta a la fila.
 */
export async function borrarTramoVolumenApi(id: string): Promise<void> {
  const r = await fetch(`/api/volumen/escalas/${id}/`, { method: 'DELETE' })
  if (!r.ok) await fallar(r, 'No se pudo eliminar el tramo')
}
