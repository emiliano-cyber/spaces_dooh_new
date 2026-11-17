import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { obtenerOportunidadCtrl, editarOportunidadCtrl } from '@/lib/server/oportunidades-controller'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET → la oportunidad con su línea de tiempo y sus cotizaciones. 404 si no es
// de quien pregunta.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await obtenerOportunidadCtrl(g.usuario, params.id))
  } catch (e) {
    return respuestaError(e)
  }
}

// PATCH → corrige lo que pide el cliente. No cambia la etapa (eso es su ruta),
// ni el vendedor, ni el cliente.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(
      await editarOportunidadCtrl(g.usuario, params.id, await req.json().catch(() => ({}))),
    )
  } catch (e) {
    return respuestaError(e)
  }
}
