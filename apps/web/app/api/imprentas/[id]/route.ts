import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { actualizarImprentaCtrl } from '@/lib/server/imprentas-controller'
import { IMPRENTA_NO_ENCONTRADA } from '@/lib/server/imprentas-repo'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/imprentas/:id { nombre?, requisitos?, activo? } → edita o da de
// baja (activo: false). No hay DELETE: la baja es lógica (IMP-REQ, 18/11).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('imprenta', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  // Un id que no es uuid haría fallar el cast de Postgres con un 500.
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NextResponse.json({ error: IMPRENTA_NO_ENCONTRADA }, { status: 404 })
  try {
    const im = await actualizarImprentaCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Actualizó una imprenta', im.nombre)
    return NextResponse.json(im)
  } catch (e) {
    return respuestaError(e)
  }
}
