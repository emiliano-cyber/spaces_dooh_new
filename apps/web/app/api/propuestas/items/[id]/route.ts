import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { aprobarItem, PropuestaError } from '@/lib/server/propuestas-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/propuestas/items/[id] → aprueba/desaprueba un sitio de la propuesta.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => ({}))
  try {
    const prop = await aprobarItem(params.id, !!body.aprobado)
    if (!prop) return NextResponse.json({ error: 'Ítem no encontrado' }, { status: 404 })
    await registrarAccion(g.usuario, body.aprobado ? 'Aprobó sitio de propuesta' : 'Quitó sitio de propuesta', prop.nombre)
    return NextResponse.json(prop)
  } catch (e) {
    // Propuesta aprobada inmutable → 409.
    if (e instanceof PropuestaError) return NextResponse.json({ error: e.message }, { status: 409 })
    throw e
  }
}
