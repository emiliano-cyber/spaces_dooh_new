import { NextResponse } from 'next/server'
import { registrarCuentaCtrl } from '@/lib/server/cuentas-controller'
import { respuestaError } from '@/lib/server/errores'
import { limitar, ipDe } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/signup → crea una CUENTA nueva: organización (CRM) + su usuario Dueño.
// Público (auto-registro desde el login). body: { organizacion, nombre, email, password }
export async function POST(req: Request) {
  // Anti-abuso: máx. 5 registros por IP cada hora.
  const lim = limitar(`signup:${ipDe(req)}`, 5, 60 * 60_000)
  if (!lim.ok) {
    return NextResponse.json({ error: `Demasiados intentos. Espera ${lim.retrySeg}s.` }, { status: 429 })
  }
  try {
    const res = await registrarCuentaCtrl(await req.json().catch(() => ({})))
    return NextResponse.json(res, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
