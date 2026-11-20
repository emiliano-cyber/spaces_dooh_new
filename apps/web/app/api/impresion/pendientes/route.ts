import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { pendientesDeImpresionCtrl } from '@/lib/server/pendientes-creativo-controller'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/impresion/pendientes → sitios FIJOS con creativo aprobado y sin
// orden de impresión: «Por mandar a impresión» (FLUJO-CREA, 20/11). Derivado,
// sin tabla (`lib/pendientes-creativo.ts`). Requiere imprenta.ver.
export async function GET() {
  const g = await exigir('imprenta', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await pendientesDeImpresionCtrl())
  } catch (e) {
    return respuestaError(e)
  }
}
