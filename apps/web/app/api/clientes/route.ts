import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearCliente } from '@/lib/server/clientes-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/clientes → alta de cliente con datos fiscales.
export async function POST(req: Request) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => null)
  if (!body?.nombre?.trim()) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  }
  const cliente = await crearCliente(body)
  await registrarAccion(g.usuario, 'Creó cliente', cliente.nombre)
  return NextResponse.json(cliente, { status: 201 })
}
