import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearPredioCtrl } from '@/lib/server/arrendadores-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/predios → alta de predio (entidad central del módulo Arrendadores).
export async function POST(req: Request) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const p = await crearPredioCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Creó predio', p.nombre)
    return NextResponse.json(p, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
