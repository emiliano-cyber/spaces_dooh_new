import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { decidirProspectoCtrl } from '@/lib/server/captacion-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  POST /api/captacion/:id/decision — aprobar o rechazar.  CAP-01.
// ----------------------------------------------------------------------------
//  Pide `captacion.aprobar`, que el VENDEDOR no tiene: nadie se aprueba solo.
//  Al aprobar se crea el registro real (cliente, arrendador o predio). Un doble
//  clic contesta 409 al segundo: solo una petición puede reclamar el prospecto.
// ============================================================================
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('captacion', 'aprobar')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const p = await decidirProspectoCtrl(g.usuario, params.id, await req.json().catch(() => ({})))
    await registrarAccion(
      g.usuario,
      p.etapa === 'APROBADO' ? 'Aprobó un prospecto' : 'Rechazó un prospecto',
      `${p.tipo.toLowerCase()} · ${p.nombre}`,
    )
    return NextResponse.json(p)
  } catch (e) {
    return respuestaError(e)
  }
}
