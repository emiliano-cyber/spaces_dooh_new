import { NextResponse } from 'next/server'
import { seguimientoPublicoCtrl } from '@/lib/server/seguimiento-publico-controller'
import { respuestaError } from '@/lib/server/errores'
import { limitar, ipDe } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/propuestas/publica/:token/seguimiento → el avance de la campaña que
// nació de la propuesta, para la liga del cliente (estilo rastreo de pedido).
// SIN auth a propósito, como la liga misma: el token es la autorización.
// `{ hayCampana: false }` mientras la propuesta no se haya convertido.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  // La página lo consulta al abrir; 60/min por IP sobra para un humano y corta
  // a quien quiera adivinar tokens a ráfagas.
  const lim = limitar(`seguimiento:${ipDe(req)}`, 60, 60_000)
  if (!lim.ok) {
    return NextResponse.json(
      { error: `Demasiados intentos. Espera ${lim.retrySeg}s.` },
      { status: 429, headers: { 'Retry-After': String(lim.retrySeg) } },
    )
  }
  try {
    return NextResponse.json(await seguimientoPublicoCtrl(params.id))
  } catch (e) {
    return respuestaError(e)
  }
}
