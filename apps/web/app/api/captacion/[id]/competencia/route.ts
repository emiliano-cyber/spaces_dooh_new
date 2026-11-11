import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { crearCompetidorCtrl } from '@/lib/server/negociacion-controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// NEG-01 · POST → quién más ofrece por el espacio.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('captacion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await crearCompetidorCtrl(g.usuario, params.id, await req.json().catch(() => ({}))), {
      status: 201,
    })
  } catch (e) {
    return respuestaError(e)
  }
}
