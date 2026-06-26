import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { enviarADominio, ValidacionError } from '@/lib/server/campanas-repo'
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
    const c = await enviarADominio(params.id)
    if (!c) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    await registrarAccion(g.usuario, 'Envió campaña al dominio', c.nombre)
    await notificar({
      tipo: 'validacion',
      nivel: 'info',
      titulo: 'Campaña por validar',
      detalle: `${c.nombre} se envió al dominio y espera validación de publicación`,
      link: `/demo/campanas/${c.id}`,
    })
    return NextResponse.json(c)
  } catch (e) {
    if (e instanceof ValidacionError) {
      return NextResponse.json({ error: e.message }, { status: 409 })
    }
    throw e
  }
}
