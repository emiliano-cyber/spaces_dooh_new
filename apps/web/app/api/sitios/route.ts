import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarSitios, crearSitio, SitioError } from '@/lib/server/sitios-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/sitios → lista de sitios (con modalidades). Requiere network.ver:
// el inventario es dato de negocio, no algo que cualquier sesión pueda listar.
export async function GET() {
  const g = await exigir('network', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json(await listarSitios())
}

// POST /api/sitios → alta de un sitio (requiere comercial.crear)
export async function POST(req: Request) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => null)
  if (!body?.nombre) return NextResponse.json({ error: 'Falta nombre' }, { status: 400 })
  try {
    const sitio = await crearSitio(body)
    await registrarAccion(g.usuario, 'Dio de alta pantalla', sitio.nombre)
    return NextResponse.json(sitio, { status: 201 })
  } catch (e) {
    if (e instanceof SitioError) return NextResponse.json({ error: e.message }, { status: 409 })
    return NextResponse.json({ error: 'No se pudo dar de alta la pantalla' }, { status: 500 })
  }
}
