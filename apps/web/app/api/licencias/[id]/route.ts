import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { editarLicenciaCtrl, borrarLicenciaCtrl } from '@/lib/server/arrendadores-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/licencias/[id] → corregir datos o registrar la renovación.
// `crear` y no `editar`: el vocabulario de permisos del sistema es
// ver/crear/aprobar/facturar. Pedir una acción que no existe en `rol_permisos`
// devuelve 403 SIEMPRE, incluso al Dueño — el endpoint quedaría muerto sin que
// nada lo delatara.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const l = await editarLicenciaCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(
      g.usuario,
      'Editó licencia',
      `${l.tipo}${l.folio ? ` ${l.folio}` : ''} — vence ${String(l.fechaVencimiento).slice(0, 10)}`,
    )
    return NextResponse.json(l)
  } catch (e) {
    return respuestaError(e)
  }
}

// DELETE /api/licencias/[id] → borrar una captura equivocada.
// Borrado real y no lógico: una licencia mal capturada no es historia que
// preservar, es un error. La huella de quién la borró queda en la bitácora, que
// es de solo-agregar.
// `aprobar` es el permiso más fuerte del módulo: es el que ya se exige para
// borrar un arrendador. Borrar es destructivo, así que pide el mismo nivel.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'aprobar')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    await borrarLicenciaCtrl(params.id)
    await registrarAccion(g.usuario, 'Borró licencia', params.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return respuestaError(e)
  }
}
