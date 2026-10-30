import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { creativosPublicadosDeCampana } from '@/lib/server/playlogs-repo'
import { consultarCampanasDoohmain, doohmainHabilitado } from '@/lib/server/doohmain'
import { estadoDeCampanaRemota, hoyEnMexico } from '@/lib/doohmain-estado'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/campanas/[id]/doohmain-estado → cada creativo publicado de la
// campaña, en qué pantallas de DOOHmain está y cómo lo ve DOOHmain AHORA
// (`get_campaigns`): al aire, en pausa, finalizado. Solo lectura (29/10).
//
// Si DOOHmain no contesta se devuelven igual los creativos, con `estado: null`
// y el error: lo que se publicó lo sabemos por el registro del SDK aunque el
// proveedor esté caído.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const creativos = await creativosPublicadosDeCampana(params.id)
    if (!doohmainHabilitado() || !creativos.length) {
      return NextResponse.json({
        habilitado: doohmainHabilitado(),
        creativos: creativos.map((c) => ({ ...c, estado: null, inicio: null, fin: null })),
        error: null,
      })
    }
    const r = await consultarCampanasDoohmain(creativos.map((c) => c.auth))
    const hoy = hoyEnMexico()
    return NextResponse.json({
      habilitado: true,
      creativos: creativos.map((c) => ({
        ...c,
        ...(r.ok ? estadoDeCampanaRemota(r.payload, c.auth, hoy) : { estado: null, inicio: null, fin: null }),
      })),
      error: r.ok ? null : (r.error ?? 'DOOHmain no respondió'),
    })
  } catch (e) {
    return respuestaError(e)
  }
}
