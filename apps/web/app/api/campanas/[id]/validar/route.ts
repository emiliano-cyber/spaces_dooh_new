import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { validarPublicacionCtrl } from '@/lib/server/campanas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { notificar } from '@/lib/server/notificaciones-repo'
import { doohmainHabilitado, publicarCampanaEnDoohmain } from '@/lib/server/doohmain'

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
      link: `/campanas/${c.id}`,
    })

    // Al aprobar: publicar en DOOHmain vía el SDK (si está habilitado). Un fallo
    // aquí NO revierte la aprobación; se reporta al usuario en la respuesta.
    let doohmain: Awaited<ReturnType<typeof publicarCampanaEnDoohmain>> | { error: string } | undefined
    if (body?.aprobar && doohmainHabilitado()) {
      try {
        doohmain = await publicarCampanaEnDoohmain(params.id)
        const fallos = doohmain.filter((r) => !r.ok)
        await registrarAccion(
          g.usuario,
          fallos.length ? `Publicación en DOOHmain con ${fallos.length} error(es)` : 'Publicó campaña en DOOHmain',
          c.nombre,
        )
      } catch (e) {
        doohmain = { error: e instanceof Error ? e.message : 'Fallo al publicar en DOOHmain' }
      }
    }

    return NextResponse.json({ ...c, doohmain })
  } catch (e) {
    return respuestaError(e)
  }
}
