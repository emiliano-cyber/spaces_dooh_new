import { NextResponse } from 'next/server'
import { usuarioActual, permisosDeRol } from '@/lib/server/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/auth/me → { usuario, permisos } o 401 si no hay sesión.
export async function GET() {
  const u = await usuarioActual()
  if (!u) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  const permisos = await permisosDeRol(u.rol)
  return NextResponse.json({ usuario: u, permisos })
}
