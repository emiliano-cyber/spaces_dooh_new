import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { enviarADominioCtrl } from '@/lib/server/campanas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { notificar } from '@/lib/server/notificaciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/campanas/:id/enviar-dominio → envía la campaña al dominio/CMS y deja
// la validación de publicación en PENDIENTE (requiere comercial.crear).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const c = await enviarADominioCtrl(params.id)
    await registrarAccion(g.usuario, 'Envió campaña al dominio', c.nombre)
    await notificar({
      tipo: 'validacion',
      nivel: 'info',
      titulo: 'Campaña por validar',
      detalle: `${c.nombre} se envió al dominio y espera validación de publicación`,
      link: `/campanas/${c.id}`,
    })
    return NextResponse.json(c)
  } catch (e) {
    return respuestaError(e)
  }
}
