import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearOrdenCompraCtrl } from '@/lib/server/ordenes-compra-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { notificar } from '@/lib/server/notificaciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/ordenes-compra { campanaId, numeroOc?, monto?, fecha?, documentoUrl?, notas? }
// Registra la ODC del cliente y marca oc_recibida en la campaña.
//
// La validación vive en `ordenes-compra-controller`: hasta el 26/08 esta ruta
// era la única de dinero que se la saltaba y le pasaba el cuerpo crudo al model.
export async function POST(req: Request) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const odc = await crearOrdenCompraCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Registró ODC del cliente', odc.folio)
    await notificar({ tipo: 'ODC', nivel: 'ok', titulo: 'ODC registrada', detalle: `${odc.folio} · ${odc.monto.toLocaleString('es-MX')}`, link: `/campanas/${odc.campanaId}` })
    return NextResponse.json(odc, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
