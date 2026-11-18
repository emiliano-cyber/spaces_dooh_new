import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { versionFirmada, versionesFirmadas } from '@/lib/server/firmas-repo'
import { AppError, respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/contratos/[id]/versiones           → versiones firmadas archivadas
// GET /api/contratos/[id]/versiones?version=N → esa versión con su texto exacto
//
// CONTRATO-FIRMADO-EDITABLE (23/10): lo que se firmó antes de editar o reenviar
// un contrato. Es de `ver`, como el estado de las firmas: es evidencia, no una
// llave — el token del enlace público nunca se archiva.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const v = new URL(req.url).searchParams.get('version')
    if (v == null) return NextResponse.json(await versionesFirmadas(params.id))
    const n = Number(v)
    if (!Number.isInteger(n) || n < 1) throw new AppError('Versión inválida', 400)
    const una = await versionFirmada(params.id, n)
    if (!una) throw new AppError('Esa versión firmada no existe', 404)
    return NextResponse.json(una)
  } catch (e) {
    return respuestaError(e)
  }
}
