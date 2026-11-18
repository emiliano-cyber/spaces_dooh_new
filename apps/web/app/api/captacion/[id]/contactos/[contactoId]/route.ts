import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { borrarContactoCtrl, editarContactoCtrl } from '@/lib/server/negociacion-controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: { id: string; contactoId: string } }

// NEG-01 · PATCH → corrige un contacto. DELETE → lo quita. A quien firma no se
// le quita la firma ni se le borra si es el único y el espacio está en la
// etapa 5: 409 con la frase que dice qué hacer.
export async function PATCH(req: Request, { params }: Ctx) {
  const g = await exigir('captacion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(
      await editarContactoCtrl(g.usuario, params.id, params.contactoId, await req.json().catch(() => ({}))),
    )
  } catch (e) {
    return respuestaError(e)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const g = await exigir('captacion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await borrarContactoCtrl(g.usuario, params.id, params.contactoId))
  } catch (e) {
    return respuestaError(e)
  }
}
