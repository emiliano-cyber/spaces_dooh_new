import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarImprentas } from '@/lib/server/imprentas-repo'
import { crearImprentaCtrl } from '@/lib/server/imprentas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// IMP-REQ (18/11). Los permisos son los de las órdenes de impresión: quien ve
// Imprenta ve las imprentas; quien crea órdenes (imprenta.crear) las da de alta
// y las edita. No se inventó un permiso nuevo.

// GET /api/imprentas → las imprentas de la organización, activas primero.
export async function GET() {
  const g = await exigir('imprenta', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json(await listarImprentas())
}

// POST /api/imprentas { nombre, requisitos? } → alta.
export async function POST(req: Request) {
  const g = await exigir('imprenta', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const im = await crearImprentaCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Dio de alta una imprenta', im.nombre)
    return NextResponse.json(im, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
