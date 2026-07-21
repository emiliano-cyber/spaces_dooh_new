import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { cerrarOT } from '@/lib/server/ot-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { respuestaError } from '@/lib/server/errores'
import { LIMITES, validarUpload } from '@/lib/server/uploads'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/ot/:id/cerrar  { fotoUrl, tomadaEn, lat, lng } (requiere operaciones.crear)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('operaciones', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const body = await req.json().catch(() => null)
    if (!body?.fotoUrl) return NextResponse.json({ error: 'Falta la foto comprobatoria' }, { status: 400 })
    // La evidencia es una foto tomada en sitio: imagen real, máximo 8 MB
    // (Bloque D). Antes se aceptaba cualquier cadena de cualquier peso.
    validarUpload({
      base64: body.fotoUrl,
      allowlist: LIMITES.evidenciaOT.allowlist,
      maxMB: LIMITES.evidenciaOT.maxMB,
      campo: 'fotoUrl',
    })
    const ot = await cerrarOT(params.id, { ...body, uploadedBy: g.usuario.id })
    if (!ot) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    await registrarAccion(g.usuario, 'Cerró OT con testigo', ot.folio)
    return NextResponse.json(ot)
  } catch (e) {
    return respuestaError(e)
  }
}
