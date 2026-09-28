import { NextResponse } from 'next/server'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { guardarTemporadaCtrl, desactivarTemporadaCtrl } from '@/lib/server/rejilla-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/rejilla/temporadas/:id — editar o dar de BAJA una temporada.
//  Mismo criterio que las franjas: el `id` de la ruta manda sobre el del cuerpo,
//  y DELETE es una baja LÓGICA.
// ============================================================================
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigirCambioSensible('inventario', 'crear')
  if (!g.ok) return g.res
  try {
    const body = await req.json().catch(() => ({}))
    const t = await guardarTemporadaCtrl({ ...body, id: params.id })
    await registrarAccion(g.usuario, 'Editó una temporada', t.nombre)
    return NextResponse.json(t)
  } catch (e) {
    return respuestaError(e)
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigirCambioSensible('inventario', 'crear')
  if (!g.ok) return g.res
  try {
    const r = await desactivarTemporadaCtrl(params.id)
    await registrarAccion(g.usuario, 'Dio de baja una temporada', params.id)
    return NextResponse.json(r)
  } catch (e) {
    return respuestaError(e)
  }
}
