import { NextResponse } from 'next/server'
import { registrarCuentaCtrl } from '@/lib/server/cuentas-controller'
import { respuestaError } from '@/lib/server/errores'
import { limitar, ipDe } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/signup → crea una CUENTA nueva: organización (CRM) + su usuario Dueño.
// Público (auto-registro desde el login). body: { organizacion, nombre, email, password }
//
// El auto-registro se apaga con NEXT_PUBLIC_AUTOREGISTRO=0. Se comprueba aquí y
// no solo en la UI: ocultar el botón del login dejaría este endpoint abierto, y
// como el mismo despliegue sirve la demo pública y producción, cualquiera con la
// URL podría seguir creando organizaciones y usuarios Dueño en la base real.
// Ausente o distinto de '0' = habilitado (no cambia el comportamiento en dev).
export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_AUTOREGISTRO === '0') {
    return NextResponse.json(
      { error: 'El registro de cuentas nuevas está deshabilitado. Contacta al administrador.' },
      { status: 503 },
    )
  }
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
