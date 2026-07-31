import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearLicenciaCtrl } from '@/lib/server/arrendadores-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/licencias → alta de licencia o permiso con vigencia.
// La lectura va por /api/estado, como el resto del módulo.
export async function POST(req: Request) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const l = await crearLicenciaCtrl(await req.json().catch(() => ({})))
    await registrarAccion(
      g.usuario,
      'Registró licencia',
      `${l.tipo}${l.folio ? ` ${l.folio}` : ''} — vence ${String(l.fechaVencimiento).slice(0, 10)}`,
    )
    return NextResponse.json(l, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
