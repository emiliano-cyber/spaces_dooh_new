import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearCreatividadCtrl } from '@/lib/server/creativos-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/creatividades  { campanaId, nombre, archivoUrl|codigo, formato?, resolucion? }
export async function POST(req: Request) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const crea = await crearCreatividadCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Subió creativo', crea.nombre)
    return NextResponse.json(crea, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
