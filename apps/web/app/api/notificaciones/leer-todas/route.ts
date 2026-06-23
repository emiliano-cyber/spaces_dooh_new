import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { marcarTodasLeidas } from '@/lib/server/notificaciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/notificaciones/leer-todas → marca todas como leídas.
export async function POST() {
  const g = await exigir()
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  await marcarTodasLeidas()
  return NextResponse.json({ ok: true })
}
