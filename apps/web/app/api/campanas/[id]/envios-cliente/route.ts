import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { exigirQuienAprueba } from '@/lib/server/envios-cliente-controller'
import { listarEnviosPendientes } from '@/lib/server/envios-cliente-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/campanas/:id/envios-cliente → los creativos que mandó el cliente
// desde su liga y esperan revisión (ENVIO-CLIENTE, 18/11). Sin el archivo: la
// vista previa va por `…/envios-cliente/:envioId`. Solo quien los puede
// aprobar (Dueño y Administrador, regla de ACT-CAMP): para los demás, 403.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    exigirQuienAprueba(g.usuario?.rol)
    return NextResponse.json(await listarEnviosPendientes(params.id))
  } catch (e) {
    return respuestaError(e)
  }
}
