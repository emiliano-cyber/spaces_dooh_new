import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { ordenVallasCtrl } from '@/lib/server/vallas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PUT /api/vallas/orden { vallaIds } → guarda el orden de UNA fila del plano
// (un sitio, una cara), de izquierda a derecha. Dueño, 24/11: «tocar y
// flechas» en el plano de Vallas. Escribir vallas pide `inventario.crear`,
// como el alta y la edición.
export async function PUT(req: Request) {
  const g = await exigir('inventario', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const r = await ordenVallasCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Reacomodó vallas en el plano', 'Vallas')
    return NextResponse.json(r)
  } catch (e) {
    return respuestaError(e)
  }
}
