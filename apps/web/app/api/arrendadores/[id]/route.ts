import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { exigirCambioSensible, exigirDesbloqueo, respuestaDesbloqueo } from '@/lib/server/cambios'
import { editarArrendadorCtrl, borrarArrendadorCtrl } from '@/lib/server/arrendadores-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Datos bancarios: a DÓNDE se paga la renta. Cambiarlos es un movimiento de
// dinero, así que exige el candado del Dueño (igual que pagar/cancelar contrato).
const CAMPOS_BANCARIOS = ['cuentaBancaria', 'formaPago']

// PATCH /api/arrendadores/[id] → editar propietario/arrendador.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const body = await req.json().catch(() => ({}))
    // Si toca la cuenta/forma de pago, exige la sesión desbloqueada (candado).
    const tocaBanco =
      body && typeof body === 'object' && CAMPOS_BANCARIOS.some((c) => c in (body as object))
    if (tocaBanco) {
      const d = await exigirDesbloqueo()
      if (!d.ok) return respuestaDesbloqueo(d)
    }
    const arr = await editarArrendadorCtrl(params.id, body)
    await registrarAccion(g.usuario, tocaBanco ? 'Editó datos bancarios del propietario' : 'Editó propietario', arr.nombre)
    return NextResponse.json(arr)
  } catch (e) {
    return respuestaError(e)
  }
}

// DELETE /api/arrendadores/[id] → soft-delete (bloquea si tiene predios/contratos activos).
// Catálogo: dar de baja a un propietario es sensible.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const gc = await exigirCambioSensible('arrendadores', 'aprobar')
  if (!gc.ok) return gc.res
  const g = { usuario: gc.usuario }
  try {
    const arr = await borrarArrendadorCtrl(params.id)
    await registrarAccion(g.usuario, 'Borró propietario (soft-delete)', arr.nombre)
    return NextResponse.json({ ok: true, arrendador: arr })
  } catch (e) {
    return respuestaError(e)
  }
}
