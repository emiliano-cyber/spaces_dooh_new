import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { eliminarConsumoCtrl } from '@/lib/server/energia-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// DELETE /api/energia/consumos/[id] → borrar un recibo mal capturado.
//
// Existe porque sin él un importe con un cero de más es PERMANENTE: el índice
// único impide volver a capturar ese mismo recibo, así que la fila mala se
// quedaría inflando el costo de la luz de todo un mes para siempre. Un recibo
// mal tecleado no es historia que preservar, es un error — mismo criterio que
// el borrado de licencias.
//
// `aprobar` y no `crear`: borrar es destructivo y pide el nivel más alto del
// módulo, igual que en arrendadores. El vocabulario de permisos del sistema es
// ver/crear/aprobar/facturar, y pedir una acción que no existe en
// `rol_permisos` devuelve 403 SIEMPRE, incluso al Dueño — el endpoint quedaría
// muerto sin que nada lo delatara.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('operaciones', 'aprobar')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    await eliminarConsumoCtrl(params.id)
    await registrarAccion(g.usuario, 'Borró recibo de luz', params.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return respuestaError(e)
  }
}
