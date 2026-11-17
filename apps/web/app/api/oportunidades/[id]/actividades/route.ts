import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { registrarActividadCtrl } from '@/lib/server/oportunidades-controller'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST → una llamada, visita, junta, correo, WhatsApp o nota. Solo se añade:
// la línea de tiempo no se edita ni se borra.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(
      await registrarActividadCtrl(g.usuario, params.id, await req.json().catch(() => ({}))),
      { status: 201 },
    )
  } catch (e) {
    return respuestaError(e)
  }
}
