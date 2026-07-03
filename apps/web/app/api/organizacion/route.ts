import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { tenantActual } from '@/lib/server/tenant'
import { q } from '@/lib/server/db'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/organizacion → renombra la organización (empresa) del CRM actual.
// Se refleja en el sidebar (el nombre que se muestra a la izquierda).
export async function PATCH(req: Request) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => ({}))
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : ''
  if (!nombre) return NextResponse.json({ error: 'El nombre de la empresa es requerido' }, { status: 400 })

  await q('update tenants set nombre = $1 where id = $2', [nombre, await tenantActual()])
  await registrarAccion(g.usuario, 'Renombró la empresa', nombre)
  return NextResponse.json({ ok: true, nombre })
}
