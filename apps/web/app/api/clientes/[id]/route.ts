import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { actualizarClienteCtrl } from '@/lib/server/clientes-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/clientes/[id] → edición de cliente / datos fiscales.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const body = await req.json().catch(() => ({}))
    const cliente = await actualizarClienteCtrl(params.id, body)
    await registrarAccion(g.usuario, 'Editó cliente', cliente.nombre)
    return NextResponse.json(cliente)
  } catch (e) {
    return respuestaError(e)
  }
}
