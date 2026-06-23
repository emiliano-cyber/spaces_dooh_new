import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearPropuesta } from '@/lib/server/propuestas-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/propuestas → crea una propuesta (borrador) con sus sitios.
export async function POST(req: Request) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => null)
  if (!body?.nombre?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  if (!body?.items?.length) return NextResponse.json({ error: 'Agrega al menos un sitio' }, { status: 400 })
  try {
    const prop = await crearPropuesta(body)
    await registrarAccion(g.usuario, 'Creó propuesta', prop.nombre)
    return NextResponse.json(prop, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo crear la propuesta' },
      { status: 400 },
    )
  }
}
