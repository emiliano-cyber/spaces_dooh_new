import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { confirmarReserva } from '@/lib/server/campanas-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/campanas/:id/confirmar (requiere comercial.crear)
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const c = await confirmarReserva(params.id)
  if (!c) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json(c)
}
