import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarTenants, puedeCambiarCrm, tenantActual } from '@/lib/server/tenant'
import { crearOrganizacionCtrl } from '@/lib/server/cuentas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/tenants → lista de organizaciones (solo super-admin de plataforma).
export async function GET() {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!(await puedeCambiarCrm())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  return NextResponse.json({ tenants: await listarTenants(), activo: await tenantActual() })
}

// POST /api/tenants → crea una organización (CRM) nueva + su usuario Dueño.
// body: { nombre, slug?, admin: { nombre, email, password } }
export async function POST(req: Request) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!(await puedeCambiarCrm())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  try {
    const res = await crearOrganizacionCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Creó organización (CRM)', res.tenant.nombre)
    return NextResponse.json(res, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
