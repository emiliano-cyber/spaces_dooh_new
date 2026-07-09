import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { validarPublicacionCtrl } from '@/lib/server/campanas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { notificar } from '@/lib/server/notificaciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/campanas/:id/validar  { aprobar: boolean, motivo?: string }
// Valida (aprueba/rechaza) la publicación de una campaña enviada al dominio.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const body = await req.json().catch(() => ({}))
    const c = await validarPublicacionCtrl(params.id, g.usuario?.nombre ?? 'Sistema', body)
    await registrarAccion(
      g.usuario,
      body?.aprobar ? 'Aprobó publicación de campaña' : 'Rechazó publicación de campaña',
      c.nombre,
    )
    await notificar({
      tipo: 'validacion',
      nivel: body?.aprobar ? 'ok' : 'warn',
      titulo: body?.aprobar ? 'Publicación aprobada' : 'Publicación rechazada',
      detalle: body?.aprobar
        ? `${c.nombre} fue validada y está al aire`
        : `${c.nombre} fue rechazada${c.validacionMotivo ? `: ${c.validacionMotivo}` : ''}`,
      link: `/demo/campanas/${c.id}`,
    })
    return NextResponse.json(c)
  } catch (e) {
    return respuestaError(e)
  }
}
