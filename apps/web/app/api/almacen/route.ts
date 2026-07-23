import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarActivos, listarMovimientos, crearActivo } from '@/lib/server/almacen-repo'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/almacen → { activos, movimientos } del tenant.
export async function GET() {
  const g = await exigir('operaciones', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const [activos, movimientos] = await Promise.all([listarActivos(), listarMovimientos()])
    return NextResponse.json({ activos, movimientos })
  } catch (e) {
    return respuestaError(e)
  }
}

// POST /api/almacen { etiqueta, descripcion, tipoActivo?, notas? } → alta en almacén.
export async function POST(req: Request) {
  const g = await exigir('operaciones', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const etiqueta = typeof body.etiqueta === 'string' ? body.etiqueta.trim() : ''
    const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : ''
    if (!etiqueta || !descripcion) {
      return NextResponse.json({ error: 'La etiqueta y la descripción son obligatorias.' }, { status: 400 })
    }
    const activo = await crearActivo({
      etiqueta,
      descripcion,
      tipoActivo: typeof body.tipoActivo === 'string' && body.tipoActivo.trim() ? body.tipoActivo.trim() : undefined,
      notas: typeof body.notas === 'string' ? body.notas.trim() || null : null,
    })
    await registrarAccion(g.usuario, 'Registró activo en almacén', activo.etiqueta)
    return NextResponse.json(activo, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
