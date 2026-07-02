import { NextResponse } from 'next/server'
import { q1 } from '@/lib/server/db'
import { verifyPassword, crearSesion, cookieSesion, permisosDeRol } from '@/lib/server/auth'
import { limitar, ipDe } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/auth/login  { email, password } → set cookie + { usuario, permisos }
export async function POST(req: Request) {
  // Anti fuerza bruta: máx. 10 intentos por IP cada 5 minutos.
  const lim = limitar(`login:${ipDe(req)}`, 10, 5 * 60_000)
  if (!lim.ok) {
    return NextResponse.json(
      { error: `Demasiados intentos. Espera ${lim.retrySeg}s e intenta de nuevo.` },
      { status: 429, headers: { 'Retry-After': String(lim.retrySeg) } },
    )
  }
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
