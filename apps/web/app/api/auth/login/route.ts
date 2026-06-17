import { NextResponse } from 'next/server'
import { q1 } from '@/lib/server/db'
import { verifyPassword, crearSesion, cookieSesion, permisosDeRol } from '@/lib/server/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/auth/login  { email, password } → set cookie + { usuario, permisos }
export async function POST(req: Request) {
  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  const { email, password } = body
  if (!email || !password) {
    return NextResponse.json({ error: 'Correo y contraseña requeridos' }, { status: 400 })
  }

  const u = await q1<{
    id: string; nombre: string; email: string; cargo: string | null
    rol: string; activo: boolean; password_hash: string | null
  }>(
    `select id, nombre, email, cargo, rol::text as rol, activo, password_hash
       from usuarios where lower(email) = lower($1)`,
    [email],
  )

  const ok = u && u.activo && (await verifyPassword(password, u.password_hash))
  if (!u || !ok) {
    return NextResponse.json({ error: 'Correo o contraseña inválidos' }, { status: 401 })
  }

  const token = await crearSesion(u.id)
  const permisos = await permisosDeRol(u.rol)
  const res = NextResponse.json({
    usuario: { id: u.id, nombre: u.nombre, email: u.email, cargo: u.cargo, rol: u.rol, activo: u.activo },
    permisos,
  })
  res.cookies.set(cookieSesion(token))
  return res
}
