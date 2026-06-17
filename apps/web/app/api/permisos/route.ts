import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { matrizPermisos } from '@/lib/server/usuarios-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/permisos → matriz rol×módulo×acción (para la pestaña de roles)
export async function GET() {
  const g = await exigir('administracion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json(await matrizPermisos())
}
