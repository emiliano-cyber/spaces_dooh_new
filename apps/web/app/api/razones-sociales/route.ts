import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearRazonSocialCtrl } from '@/lib/server/arrendadores-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/razones-sociales → alta de razón social de un arrendador.
export async function POST(req: Request) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const rs = await crearRazonSocialCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Creó razón social', rs.razonSocial)
    return NextResponse.json(rs, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
