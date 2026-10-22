import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { crearNotaCtrl, listarNotasCtrl } from '@/lib/server/negociacion-controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// NEG-01 · Las notas adicionales de un espacio, con autor y fecha.
// GET → la lista, la más reciente primero. POST → una más; el autor sale de la
// sesión. No hay PATCH ni DELETE: las notas solo se añaden.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('captacion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await listarNotasCtrl(g.usuario, params.id))
  } catch (e) {
    return respuestaError(e)
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('captacion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await crearNotaCtrl(g.usuario, params.id, await req.json().catch(() => ({}))), {
      status: 201,
    })
  } catch (e) {
    return respuestaError(e)
  }
}
