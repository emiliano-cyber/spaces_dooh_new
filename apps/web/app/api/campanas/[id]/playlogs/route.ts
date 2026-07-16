import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError, AppError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { consultarYGuardarPlay, listarConsultasDeCampana, authsDeCampana } from '@/lib/server/playlogs-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/campanas/[id]/playlogs → últimas consultas guardadas (payload crudo).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const [consultas, auths] = await Promise.all([
      listarConsultasDeCampana(params.id),
      authsDeCampana(params.id),
    ])
    return NextResponse.json({ consultas, publicadaEnDoohmain: auths.length > 0 })
  } catch (e) {
    return respuestaError(e)
  }
}

// POST /api/campanas/[id]/playlogs → pregunta a DOOHmain por las reproducciones
// de la campaña en un rango y guarda la respuesta TAL CUAL.
// Body: { desde: 'YYYY-MM-DD', hasta: 'YYYY-MM-DD' }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const body = (await req.json().catch(() => ({}))) as { desde?: unknown; hasta?: unknown }
    const fecha = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
    const desde = fecha(body.desde)
    const hasta = fecha(body.hasta)
    if (!desde || !hasta) throw new AppError('Fechas inválidas (se espera YYYY-MM-DD)', 400)
    if (hasta < desde) throw new AppError('La fecha final no puede ser anterior a la inicial', 400)

    const auths = await authsDeCampana(params.id)
    if (!auths.length) {
      throw new AppError('Esta campaña no está publicada en DOOHmain: no hay reproducciones que consultar.', 409)
    }
    const c = await consultarYGuardarPlay({
      campanaId: params.id, auths, desde, hasta, usuarioId: g.usuario.id,
    })
    await registrarAccion(g.usuario, 'Consultó reproducciones en DOOHmain', `${desde} a ${hasta}`)
    return NextResponse.json(c, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
