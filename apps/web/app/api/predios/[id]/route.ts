import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { editarPredioCtrl } from '@/lib/server/arrendadores-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/predios/[id] → editar predio (datos y estado del inmueble).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const p = await editarPredioCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Editó predio', p.nombre)
    return NextResponse.json(p)
  } catch (e) {
    return respuestaError(e)
  }
}
