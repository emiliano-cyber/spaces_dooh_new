import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarOportunidadesCtrl, crearOportunidadCtrl } from '@/lib/server/oportunidades-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/oportunidades — lo que cada cliente quiere comprar.  ADR 0051.
// ----------------------------------------------------------------------------
//  Quien no tiene `comercial.aprobar` solo ve y toca lo SUYO: el filtro lo pone
//  el controller por permiso, y una oportunidad ajena contesta 404.
// ============================================================================

// GET → página de oportunidades (?etapas=&clienteId=&pagina=&porPagina=).
export async function GET(req: Request) {
  const g = await exigir('comercial', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await listarOportunidadesCtrl(g.usuario, new URL(req.url).searchParams))
  } catch (e) {
    return respuestaError(e)
  }
}

// POST → alta. El vendedor sale de la sesión, nunca del cuerpo.
export async function POST(req: Request) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const o = await crearOportunidadCtrl(g.usuario, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Abrió una oportunidad', o.nombre)
    return NextResponse.json(o, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
