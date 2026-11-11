import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { crearContactoCtrl } from '@/lib/server/negociacion-controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// NEG-01 · POST → un contacto más del espacio (el dueño, la apoderada, la
// vecina…). `esLegal` marca a quien firma.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('captacion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await crearContactoCtrl(g.usuario, params.id, await req.json().catch(() => ({}))), {
      status: 201,
    })
  } catch (e) {
    return respuestaError(e)
  }
}
