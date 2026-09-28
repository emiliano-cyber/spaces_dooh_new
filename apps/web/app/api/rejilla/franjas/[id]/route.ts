import { NextResponse } from 'next/server'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { guardarFranjaCtrl, desactivarFranjaCtrl } from '@/lib/server/rejilla-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/rejilla/franjas/:id — editar o DAR DE BAJA una franja.
// ----------------------------------------------------------------------------
//  DELETE DA DE BAJA, NO BORRA, y la diferencia importa: una franja contratada
//  es un hecho, y `propuesta_items_franja_fkey` es `on delete restrict`. Un
//  borrado real haría que la primera franja vendida devolviera un 500 sin
//  explicar por qué — el mismo razonamiento que llevó `propuestas.usuario_id` a
//  `set null` el mismo día, resuelto aquí por el otro lado porque aquí SÍ hay
//  baja lógica. Lo vendido sigue en pie y deja de ofrecerse en el selector.
//
//  El `id` de la ruta MANDA sobre el del cuerpo. Si se tomara del cuerpo, un
//  PATCH a `/franjas/A` con `{"id":"B"}` editaría B — y ningún candado lo vería,
//  porque el candado protege la ruta, no el JSON.
// ============================================================================
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigirCambioSensible('inventario', 'crear')
  if (!g.ok) return g.res
  try {
    const body = await req.json().catch(() => ({}))
    const franja = await guardarFranjaCtrl({ ...body, id: params.id })
    await registrarAccion(g.usuario, 'Editó una franja horaria', franja.nombre)
    return NextResponse.json(franja)
  } catch (e) {
    return respuestaError(e)
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigirCambioSensible('inventario', 'crear')
  if (!g.ok) return g.res
  try {
    const r = await desactivarFranjaCtrl(params.id)
    await registrarAccion(g.usuario, 'Dio de baja una franja horaria', params.id)
    return NextResponse.json(r)
  } catch (e) {
    return respuestaError(e)
  }
}
