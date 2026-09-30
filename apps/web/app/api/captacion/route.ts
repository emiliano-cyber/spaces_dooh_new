import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarProspectosCtrl, crearProspectoCtrl } from '@/lib/server/captacion-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/captacion — la bitácora de captación.  CAP-01.
// ----------------------------------------------------------------------------
//  Quien no tiene `captacion.aprobar` solo ve y toca lo SUYO: el filtro lo pone
//  el controller por permiso, y un prospecto ajeno contesta 404.
// ============================================================================

// GET → página de prospectos (?etapa=&tipo=&pagina=&porPagina=).
export async function GET(req: Request) {
  const g = await exigir('captacion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await listarProspectosCtrl(g.usuario, new URL(req.url).searchParams))
  } catch (e) {
    return respuestaError(e)
  }
}

// POST → alta. El vendedor sale de la sesión, nunca del cuerpo.
export async function POST(req: Request) {
  const g = await exigir('captacion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const p = await crearProspectoCtrl(g.usuario, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Registró un prospecto', `${p.tipo.toLowerCase()} · ${p.nombre}`)
    return NextResponse.json(p, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
