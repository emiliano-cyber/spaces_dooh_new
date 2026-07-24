import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { reubicarSitio } from '@/lib/server/arrendadores-repo'
import { otReubicacion } from '@/lib/server/operaciones-eventos'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/sitios/[id]/reubicar { predioId } → mueve la pantalla a otro predio y
// dispara una OT de reubicación (integración Arrendadores → Operaciones).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const body = (await req.json().catch(() => ({}))) as { predioId?: unknown }
    const predioId = typeof body.predioId === 'string' ? body.predioId : ''
    if (!predioId) return NextResponse.json({ error: 'Indica el predio destino.' }, { status: 400 })
    const r = await reubicarSitio(params.id, predioId)
    if (!r) return NextResponse.json({ error: 'Pantalla o predio destino no encontrados.' }, { status: 404 })
    const ot = await otReubicacion(params.id, r.predioNombre)
    await registrarAccion(g.usuario, `Reubicó pantalla al predio ${r.predioNombre}`, r.sitioNombre)
    return NextResponse.json({ ok: true, otFolio: ot?.folio ?? null })
  } catch (e) {
    return respuestaError(e)
  }
}
