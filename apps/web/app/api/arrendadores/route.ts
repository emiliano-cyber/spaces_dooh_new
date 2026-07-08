import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearArrendadorCtrl } from '@/lib/server/arrendadores-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/arrendadores → alta de propietario/arrendador.
export async function POST(req: Request) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const arr = await crearArrendadorCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Creó propietario', arr.nombre)
    return NextResponse.json(arr, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
