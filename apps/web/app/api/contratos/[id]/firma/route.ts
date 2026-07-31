import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { enviarAFirma, firmasDeContrato, firmarComoArrendatario } from '@/lib/server/firmas-repo'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { ipDeRequest, uaDeRequest } from '@/lib/server/peticion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/contratos/[id]/firma → estado de las firmas + detección de invalidez.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await firmasDeContrato(params.id))
  } catch (e) {
    return respuestaError(e)
  }
}

// POST /api/contratos/[id]/firma → congela el documento y abre el proceso.
//   { accion: 'enviar' }  → congela y genera el enlace del arrendador
//   { accion: 'firmar' }  → firma la parte interna con la sesión actual
export async function POST(req: Request, { params }: { params: { id: string } }) {
  // Firmar compromete a la empresa, así que exige permiso de creación en
  // Arrendadores, igual que capturar el contrato.
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = (await req.json().catch(() => ({}))) as { accion?: string }
  try {
    if (body.accion === 'firmar') {
      await firmarComoArrendatario({
        contratoId: params.id,
        usuarioId: g.usuario.id,
        nombre: g.usuario.nombre,
        ip: ipDeRequest(req),
        userAgent: uaDeRequest(req),
      })
      await registrarAccion(g.usuario, 'Firmó contrato (arrendatario)', params.id)
      return NextResponse.json(await firmasDeContrato(params.id))
    }

    const { token } = await enviarAFirma(params.id)
    await registrarAccion(g.usuario, 'Envió contrato a firma', params.id)
    return NextResponse.json({ token, ...(await firmasDeContrato(params.id)) })
  } catch (e) {
    return respuestaError(e)
  }
}
