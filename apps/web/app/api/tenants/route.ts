import { NextResponse } from 'next/server'
import { exigir, validarPassword } from '@/lib/server/auth'
import { listarTenants, crearTenant, puedeCambiarCrm, tenantActual } from '@/lib/server/tenant'
import { crearUsuario, emailExiste } from '@/lib/server/usuarios-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { esEmailValido, EMAIL_INVALIDO } from '@/lib/validacion'

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
// body: { nombre, slug?, admin: { nombre, email, password? } }
export async function POST(req: Request) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!(await puedeCambiarCrm())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const body = await req.json().catch(() => null)
  if (!body?.nombre?.trim()) return NextResponse.json({ error: 'Falta el nombre de la organización' }, { status: 400 })
  const admin = body.admin ?? {}
  if (!admin.nombre?.trim() || !admin.email?.trim()) {
    return NextResponse.json({ error: 'Falta el usuario administrador (nombre y correo)' }, { status: 400 })
  }
  if (!esEmailValido(admin.email)) {
    return NextResponse.json({ error: EMAIL_INVALIDO }, { status: 400 })
  }
  const errPass = validarPassword(admin.password)
  if (errPass) return NextResponse.json({ error: errPass }, { status: 400 })
  if (await emailExiste(admin.email)) {
    return NextResponse.json({ error: 'Ese correo ya está registrado' }, { status: 409 })
  }
  const tenant = await crearTenant(body.nombre, body.slug ?? body.nombre)
  const usuario = await crearUsuario({
    nombre: admin.nombre,
    email: admin.email,
    cargo: admin.cargo ?? 'Dueño',
    rol: 'DUENO',
    password: admin.password,
    tenantId: tenant.id,
  })
  await registrarAccion(g.usuario, 'Creó organización (CRM)', tenant.nombre)
  return NextResponse.json({ tenant, usuario }, { status: 201 })
}
