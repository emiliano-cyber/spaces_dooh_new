import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { registrarAvanceCtrl } from '@/lib/server/captacion-controller'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST → una línea más en la bitácora, y quizá un cambio de etapa. Aprobar o
// rechazar NO pasa por aquí: lo niega `lib/captacion.ts` y lo decide otra ruta
// con otro permiso.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('captacion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(
      await registrarAvanceCtrl(g.usuario, params.id, await req.json().catch(() => ({}))),
      { status: 201 },
    )
  } catch (e) {
    return respuestaError(e)
  }
}
