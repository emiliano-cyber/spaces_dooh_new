import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { extenderCampanaCtrl, extensionesCampanaCtrl } from '@/lib/server/campanas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/campanas/:id/extender → las extensiones de la campaña con su
// contrato, la más reciente primero (comercial.ver). EXT-CONTRATO (29/10): es el
// expediente de las extensiones, y vive en la misma ruta que las crea en vez de
// abrir otra carpeta para un listado.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await extensionesCampanaCtrl(params.id))
  } catch (e) {
    return respuestaError(e)
  }
}

// POST /api/campanas/:id/extender  { fechaFin, contratoUrl } (requiere comercial.crear)
// EXT-CONTRATO (29/10, regla del dueño): sin el contrato firmado de la
// extensión, 422 y no se toca nada.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const c = await extenderCampanaCtrl(params.id, await req.json().catch(() => ({})), g.usuario)
    // FOLIO-VENTA (07/10) · cada extensión deja su tramo: con qué folio quedó
    // y hasta cuándo. Leídas en orden, las entradas dicen qué cubre cada tramo.
    // Y desde EXT-CONTRATO dice que se hizo con contrato: el archivo en sí está
    // en `campana_extensiones`, no en la bitácora (que es texto).
    await registrarAccion(
      g.usuario,
      `Extendió campaña ${c.folio} hasta ${String(c.fechaFin ?? '').slice(0, 10)} con contrato`,
      c.nombre,
    )
    return NextResponse.json(c)
  } catch (e) {
    return respuestaError(e)
  }
}
