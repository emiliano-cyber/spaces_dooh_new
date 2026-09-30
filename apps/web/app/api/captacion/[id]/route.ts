import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { obtenerProspectoCtrl, editarProspectoCtrl } from '@/lib/server/captacion-controller'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET → el prospecto con su bitácora. 404 si no es de quien pregunta.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('captacion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await obtenerProspectoCtrl(g.usuario, params.id))
  } catch (e) {
    return respuestaError(e)
  }
}

// PATCH → corrige los datos. No cambia la etapa (eso es un avance) ni el tipo.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('captacion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(
      await editarProspectoCtrl(g.usuario, params.id, await req.json().catch(() => ({}))),
    )
  } catch (e) {
    return respuestaError(e)
  }
}
