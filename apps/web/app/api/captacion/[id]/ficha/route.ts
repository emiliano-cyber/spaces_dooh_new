import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { editarFichaCtrl } from '@/lib/server/negociacion-controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// NEG-01 · PATCH → la ficha del espacio en negociación: tipo, búsqueda del
// responsable, visibilidad, medidas, presupuesto y ubicación. Lo que no viene
// no se toca. No cambia la etapa de venta (eso es un avance).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('captacion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await editarFichaCtrl(g.usuario, params.id, await req.json().catch(() => ({}))))
  } catch (e) {
    return respuestaError(e)
  }
}
