import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearArrendador } from '@/lib/server/arrendadores-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/arrendadores → alta de propietario/arrendador.
export async function POST(req: Request) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => null)
  if (!body?.nombre?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  const arr = await crearArrendador(body)
  await registrarAccion(g.usuario, 'Creó propietario', arr.nombre)
  return NextResponse.json(arr, { status: 201 })
}
