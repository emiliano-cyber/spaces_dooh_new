import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { puedeCambiarCrm, TENANT_COOKIE, listarTenants } from '@/lib/server/tenant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/tenant-activo  { tenantId } → cambia el CRM activo (solo super-admin).
// tenantId vacío/null → vuelve al CRM propio (borra el override).
export async function POST(req: Request) {
  const g = await exigir()
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!(await puedeCambiarCrm())) return NextResponse.json({ error: 'No autorizado para cambiar de CRM' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const tenantId = (body?.tenantId ?? '').trim()
  const res = NextResponse.json({ ok: true, tenantId: tenantId || null })
  if (!tenantId) {
    res.cookies.set({ name: TENANT_COOKIE, value: '', maxAge: 0, path: '/' })
    return res
  }
  const existe = (await listarTenants()).some((t) => t.id === tenantId)
  if (!existe) return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
  res.cookies.set({ name: TENANT_COOKIE, value: tenantId, httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === '1', path: '/', maxAge: 30 * 86_400 })
  return res
}
