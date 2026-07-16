import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { editarArrendadorCtrl, borrarArrendadorCtrl } from '@/lib/server/arrendadores-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/arrendadores/[id] → editar propietario/arrendador.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const arr = await editarArrendadorCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Editó propietario', arr.nombre)
    return NextResponse.json(arr)
  } catch (e) {
    return respuestaError(e)
  }
}

// DELETE /api/arrendadores/[id] → soft-delete (bloquea si tiene predios/contratos activos).
// Catálogo: dar de baja a un propietario es sensible.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const gc = await exigirCambioSensible('arrendadores', 'aprobar')
  if (!gc.ok) return gc.res
  const g = { usuario: gc.usuario }
  try {
    const arr = await borrarArrendadorCtrl(params.id)
    await registrarAccion(g.usuario, 'Borró propietario (soft-delete)', arr.nombre)
    return NextResponse.json({ ok: true, arrendador: arr })
  } catch (e) {
    return respuestaError(e)
  }
}
