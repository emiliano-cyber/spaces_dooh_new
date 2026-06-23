import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { marcarNotificacionLeida } from '@/lib/server/notificaciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/notificaciones/[id]/leer → marca una notificación como leída.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir()
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const n = await marcarNotificacionLeida(params.id)
  if (!n) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json(n)
}
