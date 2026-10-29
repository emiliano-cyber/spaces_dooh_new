import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { nombreDeCreativoPropio } from '@/lib/server/creativos-repo'
import { cambiarEstadoEnDoohmain, doohmainHabilitado, estaPublicadoEnDoohmain } from '@/lib/server/doohmain'
import { accionDoohmain } from '@/lib/doohmain-estado'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/creatividades/:id/doohmain  { accion: 'pausar' | 'reanudar' }
// Baja del aire un creativo publicado o lo vuelve a subir, sin perderlo (29/10).
// La API de DOOHmain no deja quitar un arte de la lista: pausar su campaña es
// la única forma reversible. Retirarlo para siempre sigue siendo el DELETE.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const status = accionDoohmain(await req.json().catch(() => null))
    if (!status) return NextResponse.json({ error: 'accion debe ser pausar o reanudar' }, { status: 400 })
    // Mismo orden que el DELETE (v0.12.3): que el creativo sea de esta
    // organización ANTES de tocar DOOHmain. Las tablas del SDK no tienen RLS.
    const nombre = await nombreDeCreativoPropio(params.id)
    if (nombre === null) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    if (!doohmainHabilitado()) {
      return NextResponse.json({ error: 'La integración con DOOHmain está apagada en esta instancia' }, { status: 409 })
    }
    if (!(await estaPublicadoEnDoohmain(params.id))) {
      return NextResponse.json({ error: 'Este creativo no está publicado en DOOHmain' }, { status: 409 })
    }
    const r = await cambiarEstadoEnDoohmain(params.id, status)
    if (r.ok !== true) {
      return NextResponse.json(
        // No «no se cambió nada»: si el subproceso se cortó por tiempo, DOOHmain
        // pudo haberlo aplicado igual. Lo honesto es mandar a mirar el estado.
        { error: 'DOOHmain no confirmó el cambio' + (r.error ? ` (${r.error})` : '') + '. Revisa su estado antes de repetirlo.' },
        { status: 502 },
      )
    }
    await registrarAccion(
      g.usuario,
      status === 'pause' ? 'Pausó creativo en DOOHmain' : 'Reanudó creativo en DOOHmain',
      nombre,
    )
    return NextResponse.json({ ok: true, estado: status })
  } catch (e) {
    return respuestaError(e)
  }
}
