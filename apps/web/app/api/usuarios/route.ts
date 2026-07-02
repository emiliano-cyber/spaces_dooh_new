import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarUsuarios, crearUsuario, emailExiste } from '@/lib/server/usuarios-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/usuarios → lista (requiere administracion.ver)
export async function GET() {
  const g = await exigir('administracion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json(await listarUsuarios())
}

// POST /api/usuarios → invitar usuario (requiere administracion.crear)
export async function POST(req: Request) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => null)
  if (!body?.nombre || !body?.email) {
    return NextResponse.json({ error: 'Nombre y correo requeridos' }, { status: 400 })
  }
  if (!body?.password || String(body.password).length < 6) {
    return NextResponse.json({ error: 'La contraseña es requerida (mínimo 6 caracteres)' }, { status: 400 })
  }
  if (await emailExiste(body.email)) {
    return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 409 })
  }
  const u = await crearUsuario(body)
  await registrarAccion(g.usuario, 'Invitó usuario', u.nombre)
  return NextResponse.json(u, { status: 201 })
}
