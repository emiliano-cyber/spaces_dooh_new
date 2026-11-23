import { NextResponse } from 'next/server'
import { fotosSitioPublicoCtrl } from '@/lib/server/fotos-sitio-publico-controller'
import { respuestaError } from '@/lib/server/errores'
import { limitar, ipDe } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/propuestas/publica/:token/sitios/:sitioId → fotos y ubicación de UNA
// pantalla de la propuesta, para el cuadro «Ver fotos y ubicación» de la liga
// del cliente (18/11). SIN auth a propósito, como la liga misma: el token es la
// autorización, y el sitio tiene que ser renglón de ESA propuesta.
//
// Por qué una ruta aparte y no las fotos dentro de `/publica/:token`: son data
// URLs de cientos de kB cada una (ver `app/api/sitios/[id]/media`), y la liga
// se pide en cada apertura. Aquí se piden solo al abrir el cuadro de un sitio.
// Y por qué no `/api/sitios/:id/media`: exige sesión, y abrirla sin sesión
// enseñaría cualquier pantalla a quien adivinara un id.
export async function GET(req: Request, { params }: { params: { id: string; sitioId: string } }) {
  // Mismo tope que el seguimiento: sobra para un humano que abre fotos, y corta
  // a quien quiera recorrer tokens o ids a ráfagas.
  const lim = limitar(`fotos-sitio:${ipDe(req)}`, 60, 60_000)
  if (!lim.ok) {
    return NextResponse.json(
      { error: `Demasiados intentos. Espera ${lim.retrySeg}s.` },
      { status: 429, headers: { 'Retry-After': String(lim.retrySeg) } },
    )
  }
  try {
    return NextResponse.json(await fotosSitioPublicoCtrl(params.id, params.sitioId), {
      // Privada y corta, como la galería interna: abrir y cerrar el cuadro no
      // vuelve a bajar las fotos, y una galería editada se ve al minuto.
      headers: { 'Cache-Control': 'private, max-age=60' },
    })
  } catch (e) {
    return respuestaError(e)
  }
}
