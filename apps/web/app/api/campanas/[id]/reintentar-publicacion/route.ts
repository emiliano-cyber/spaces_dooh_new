import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { reintentarPublicacionCtrl } from '@/lib/server/campanas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { doohmainHabilitado, publicarCampanaEnDoohmain } from '@/lib/server/doohmain'
import { textoAccionPublicacion } from '@/lib/doohmain-resultado'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/campanas/:id/reintentar-publicacion → vuelve a mandar a DOOHmain una
// campaña con la publicación YA aprobada (requiere comercial.crear, igual que
// aprobarla). No cambia nada de la campaña: solo publica lo que falte, y lo ya
// publicado no se duplica. Responde la campaña y `doohmain` con el resultado
// por pantalla; sin `doohmain`, la integración está apagada en esta instancia.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const c = await reintentarPublicacionCtrl(params.id)
    let doohmain: Awaited<ReturnType<typeof publicarCampanaEnDoohmain>> | { error: string } | undefined
    if (doohmainHabilitado()) {
      try {
        doohmain = await publicarCampanaEnDoohmain(params.id)
        await registrarAccion(g.usuario, textoAccionPublicacion(doohmain, 'reintento'), c.nombre)
      } catch (e) {
        doohmain = { error: e instanceof Error ? e.message : 'Fallo al publicar en DOOHmain' }
      }
    }
    return NextResponse.json({ ...c, doohmain })
  } catch (e) {
    return respuestaError(e)
  }
}
