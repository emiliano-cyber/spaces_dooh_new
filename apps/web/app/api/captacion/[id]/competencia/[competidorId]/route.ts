import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { borrarCompetidorCtrl, editarCompetidorCtrl } from '@/lib/server/negociacion-controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: { id: string; competidorId: string } }

// NEG-01 · PATCH → corrige lo que se sabe de un competidor. DELETE → lo quita.
export async function PATCH(req: Request, { params }: Ctx) {
  const g = await exigir('captacion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(
      await editarCompetidorCtrl(g.usuario, params.id, params.competidorId, await req.json().catch(() => ({}))),
    )
  } catch (e) {
    return respuestaError(e)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const g = await exigir('captacion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await borrarCompetidorCtrl(g.usuario, params.id, params.competidorId))
  } catch (e) {
    return respuestaError(e)
  }
}
