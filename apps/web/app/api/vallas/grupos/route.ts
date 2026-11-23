import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearGrupoCtrl } from '@/lib/server/vallas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/vallas/grupos { numero, modo, ancho?, alto?, vallaIds? } → alta.
// La lista de grupos viaja en GET /api/vallas, junto con las vallas.
export async function POST(req: Request) {
  const g = await exigir('inventario', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const gr = await crearGrupoCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Dio de alta un grupo de vallas', gr.numero)
    return NextResponse.json(gr, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
