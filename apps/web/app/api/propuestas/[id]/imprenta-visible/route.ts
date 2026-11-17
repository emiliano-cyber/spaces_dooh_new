import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { imprentaVisibleCtrl, cambiarImprentaVisibleCtrl } from '@/lib/server/imprenta-visible-controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/propuestas/[id]/imprenta-visible → { imprentaVisible, puedeCambiar }
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await imprentaVisibleCtrl(params.id, g.usuario))
  } catch (e) {
    return respuestaError(e)
  }
}

// PATCH /api/propuestas/[id]/imprenta-visible { visible } → muestra u oculta al
// cliente el nombre de la imprenta en el seguimiento de su liga (SEG-CLIENTE).
// Oculto por omisión; solo el vendedor que creó la propuesta o un superior.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const body = await req.json().catch(() => ({}))
    const r = await cambiarImprentaVisibleCtrl(params.id, g.usuario, body)
    await registrarAccion(
      g.usuario,
      r.imprentaVisible ? 'Mostró la imprenta al cliente en la liga' : 'Ocultó la imprenta al cliente en la liga',
      params.id,
    )
    return NextResponse.json(r)
  } catch (e) {
    return respuestaError(e)
  }
}
