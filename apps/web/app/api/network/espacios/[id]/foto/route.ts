import { NextResponse } from 'next/server'
import { esLaAppNetwork } from '@/lib/server/network-token'
import { fotoDeEspacioNetwork } from '@/lib/server/network-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  GET /api/network/espacios/:id/foto — la foto principal, en bytes.  (11/11)
// ----------------------------------------------------------------------------
//  Va aparte de la lista porque las fotos se guardan como data URL base64 y
//  pesan: meterlas en `/api/network/espacios` repetiría el error que
//  `/api/sitios/:id/media` corrigió en `/api/estado` (1 MB en doce pantallas).
//  La app pide la foto solo de las pantallas con `tieneFoto: true`.
//
//  Mismo token que la lista. Pantalla inexistente, con el switch apagado o sin
//  foto: las tres dan 404, para no confirmar qué ids existen.
// ============================================================================

const DATA_URL = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!esLaAppNetwork(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: { 'cache-control': 'no-store' } })
  }

  let foto: string | null = null
  try {
    foto = await fotoDeEspacioNetwork(params.id)
  } catch {
    return NextResponse.json({ error: 'No se pudo leer la foto' }, { status: 503 })
  }
  const m = foto ? DATA_URL.exec(foto) : null
  if (!m) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  return new NextResponse(Buffer.from(m[2], 'base64'), {
    headers: {
      'content-type': m[1],
      // Privada: la pide un servidor con token, no un navegador público.
      'cache-control': 'private, max-age=300',
    },
  })
}
