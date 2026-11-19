import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { actualizarCategoriaCtrl, esUuid } from '@/lib/server/vallas-controller'
import { CATEGORIA_NO_ENCONTRADA } from '@/lib/server/vallas-repo'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/vallas/competencia/:id { nombre?, marcas?, activo? }. Sin DELETE:
// la baja es lógica (activo: false).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('inventario', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!esUuid(params.id)) return NextResponse.json({ error: CATEGORIA_NO_ENCONTRADA }, { status: 404 })
  try {
    const k = await actualizarCategoriaCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Actualizó una categoría de competencia', k.nombre)
    return NextResponse.json(k)
  } catch (e) {
    return respuestaError(e)
  }
}
