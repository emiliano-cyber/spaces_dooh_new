import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { crearOfertaCtrl } from '@/lib/server/negociacion-controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// NEG-01 · POST → una oferta de renta al DUEÑO del espacio (no es una propuesta
// a un cliente). La versión la pone el servidor.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('captacion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await crearOfertaCtrl(g.usuario, params.id, await req.json().catch(() => ({}))), {
      status: 201,
    })
  } catch (e) {
    return respuestaError(e)
  }
}
