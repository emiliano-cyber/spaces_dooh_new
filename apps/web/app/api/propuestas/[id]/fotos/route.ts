import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { siNoEsSuya } from '@/lib/server/propuestas-visibilidad'
import { respuestaError } from '@/lib/server/errores'
import { fotosDePropuestaCtrl } from '@/lib/server/propuestas-fotos-controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  GET /api/propuestas/:id/fotos → { sitios: [{ sitioId, nombre, fotos }] }
//  El cuadro «Fotos de las pantallas» de la ficha (dueño, 20/11).
// ----------------------------------------------------------------------------
//  Permiso `comercial.ver`, el MISMO con el que se ve la propuesta, y no
//  `network.ver` como `/api/sitios/:id/media`. A propósito: estas fotos ya las
//  ve el CLIENTE en la liga pública (`/p/<token>`), que cualquiera con
//  `comercial.ver` puede abrir desde esta misma ficha. Pedir `network.ver` aquí
//  no protegería nada y dejaría un cuadro que responde 403 a quien sí ve la
//  propuesta (los permisos son editables por rol desde el 11/11).
//
//  Solo sitios que son renglón de ESA propuesta: conocer el id de otra pantalla
//  no sirve. Y el vendedor solo ve las de SUS propuestas (ADR 0051): una ajena
//  es 404, como en el resto de rutas por id.
// ============================================================================
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const ajena = await siNoEsSuya(g.usuario, params.id)
  if (ajena) return ajena
  try {
    return NextResponse.json(await fotosDePropuestaCtrl(params.id), {
      // `no-store` y no el minuto de `/api/sitios/:id/media`: el cuadro se
      // vuelve a pedir al agregar o quitar un sitio, a la MISMA dirección, y
      // con caché enseñaría la lista de antes durante ese minuto.
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (e) {
    return respuestaError(e)
  }
}
