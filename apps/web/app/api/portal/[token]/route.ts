import { NextResponse } from 'next/server'
import { obtenerPortalPublico } from '@/lib/server/portal-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/portal/:token → datos públicos del portal de la campaña (sin sesión).
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const data = await obtenerPortalPublico(params.token)
  if (!data) return NextResponse.json({ error: 'Enlace no válido' }, { status: 404 })
  return NextResponse.json(data)
}
