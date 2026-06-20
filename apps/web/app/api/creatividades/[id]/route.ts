import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { validarCreatividad } from '@/lib/server/creativos-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/creatividades/:id  { aprobar: boolean, motivo?: string }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => null)
  if (typeof body?.aprobar !== 'boolean') {
    return NextResponse.json({ error: 'Falta aprobar (boolean)' }, { status: 400 })
  }
  const crea = await validarCreatividad(params.id, body.aprobar, body.motivo)
  if (!crea) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  await registrarAccion(g.usuario, body.aprobar ? 'Aprobó creativo' : 'Rechazó creativo', crea.nombre)
  return NextResponse.json(crea)
}
