import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearActivoCtrl, listarAlmacenCtrl } from '@/lib/server/almacen-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/almacen[?tipo=VEHICULO] → { activos, movimientos } del tenant.
// El catálogo de tipos está en `lib/almacen-tipos.ts`; un tipo fuera de él da 400.
export async function GET(req: Request) {
  const g = await exigir('operaciones', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await listarAlmacenCtrl(new URL(req.url).searchParams))
  } catch (e) {
    return respuestaError(e)
  }
}

// POST /api/almacen { etiqueta, descripcion, tipoActivo?, notas? } → alta en almacén.
export async function POST(req: Request) {
  const g = await exigir('operaciones', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const activo = await crearActivoCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Registró activo en almacén', activo.etiqueta)
    return NextResponse.json(activo, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
