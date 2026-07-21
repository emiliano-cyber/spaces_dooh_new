import { NextResponse } from 'next/server'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { crearContratoCtrl } from '@/lib/server/arrendadores-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/contratos → alta unificada: arrendatario → contrato → pantalla.
// Crea (de forma atómica) el contrato de arrendamiento y la pantalla asociada;
// da de alta el arrendatario si es nuevo. Admite fechas pasadas (contratos ya
// firmados que el dueño sube al empezar a usar SPACE).
export async function POST(req: Request) {
  // Cambio sensible (dinero): exige el permiso del rol Y, si el Dueno activo el
  // control de cambios, que la sesion este desbloqueada.
  const gc = await exigirCambioSensible('arrendadores', 'crear')
  if (!gc.ok) return gc.res
  const g = { usuario: gc.usuario }
  try {
    const { sitio, contrato } = await crearContratoCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Creó contrato de arrendamiento', sitio.nombre)
    return NextResponse.json({ sitio, contrato }, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
