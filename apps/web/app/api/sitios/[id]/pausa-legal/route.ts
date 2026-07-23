import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { pausarSitioLegal, reanudarSitioLegal } from '@/lib/server/arrendadores-repo'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/sitios/[id]/pausa-legal { motivo } → pausa la pantalla por una
// situación legal: la saca de la disponibilidad comercial (BLOQUEADO) con motivo.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const body = (await req.json().catch(() => ({}))) as { motivo?: unknown }
    const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : ''
    if (!motivo) return NextResponse.json({ error: 'Indica el motivo de la pausa legal.' }, { status: 400 })
    const s = await pausarSitioLegal(params.id, motivo)
    if (!s) return NextResponse.json({ error: 'Pantalla no encontrada' }, { status: 404 })
    await registrarAccion(g.usuario, 'Pausó por situación legal', s.nombre)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return respuestaError(e)
  }
}

// DELETE /api/sitios/[id]/pausa-legal → reanuda (levanta la pausa legal).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const s = await reanudarSitioLegal(params.id)
    if (!s) return NextResponse.json({ error: 'La pantalla no estaba en pausa legal' }, { status: 404 })
    await registrarAccion(g.usuario, 'Reanudó (fin de pausa legal)', s.nombre)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return respuestaError(e)
  }
}
