import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { validarPublicacion, ValidacionError } from '@/lib/server/campanas-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { notificar } from '@/lib/server/notificaciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/campanas/:id/validar  { aprobar: boolean, motivo?: string }
// Valida (aprueba/rechaza) la publicación de una campaña enviada al dominio.
// Aprobar → la campaña pasa a ACTIVA (al aire). Requiere comercial.crear.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => null)
  if (typeof body?.aprobar !== 'boolean') {
    return NextResponse.json({ error: 'Falta aprobar (boolean)' }, { status: 400 })
  }
  try {
    const c = await validarPublicacion(
      params.id,
      body.aprobar,
      body.motivo ?? null,
      g.usuario?.nombre ?? 'Sistema',
    )
    if (!c) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    await registrarAccion(
      g.usuario,
      body.aprobar ? 'Aprobó publicación de campaña' : 'Rechazó publicación de campaña',
      c.nombre,
    )
    await notificar({
      tipo: 'validacion',
      nivel: body.aprobar ? 'ok' : 'warn',
      titulo: body.aprobar ? 'Publicación aprobada' : 'Publicación rechazada',
      detalle: body.aprobar
        ? `${c.nombre} fue validada y está al aire`
        : `${c.nombre} fue rechazada${c.validacionMotivo ? `: ${c.validacionMotivo}` : ''}`,
      link: `/demo/campanas/${c.id}`,
    })
    return NextResponse.json(c)
  } catch (e) {
    if (e instanceof ValidacionError) {
      return NextResponse.json({ error: e.message }, { status: 409 })
    }
    throw e
  }
}
