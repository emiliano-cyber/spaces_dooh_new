import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { editarOfertaCtrl } from '@/lib/server/negociacion-controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// NEG-01 · PATCH → cambia el estado o las notas de una oferta. NO hay DELETE a
// propósito (Next contesta 405): la historia de lo que se le ofreció al dueño
// es la negociación, y el rol de la base tampoco puede borrarla.
export async function PATCH(req: Request, { params }: { params: { id: string; ofertaId: string } }) {
  const g = await exigir('captacion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(
      await editarOfertaCtrl(g.usuario, params.id, params.ofertaId, await req.json().catch(() => ({}))),
    )
  } catch (e) {
    return respuestaError(e)
  }
}
