import { NextResponse } from 'next/server'
import { firmaPorToken, firmarPorToken } from '@/lib/server/firmas-repo'
import { respuestaError } from '@/lib/server/errores'
import { ipDeRequest, uaDeRequest } from '@/lib/server/peticion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Ruta PÚBLICA (sin sesión): el arrendador no es usuario de la plataforma. El
// token de 32 bytes es la única credencial, igual que en el portal de campaña.
//
// Nunca se devuelve el hash ni datos del inquilino más allá del propio texto del
// contrato, que es justamente lo que esta persona tiene derecho a leer y firmar.
// Y solo mientras el enlace viva: pasada su vigencia `firmaPorToken` deja de
// mandar el texto y aquí llega ya en null.

// GET /api/firma/[token] → el documento congelado a firmar (null si expiró).
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const f = await firmaPorToken(params.token)
  if (!f) return NextResponse.json({ error: 'Enlace de firma no válido.' }, { status: 404 })
  return NextResponse.json({
    parte: f.parte,
    nombreEsperado: f.nombreEsperado,
    documento: f.documento,
    expirado: f.expirado,
    yaFirmada: f.yaFirmada,
  })
}

// POST /api/firma/[token] → firma { nombre }.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const body = (await req.json().catch(() => ({}))) as { nombre?: string }
  try {
    await firmarPorToken({
      token: params.token,
      nombre: String(body.nombre ?? ''),
      ip: ipDeRequest(req),
      userAgent: uaDeRequest(req),
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return respuestaError(e)
  }
}
