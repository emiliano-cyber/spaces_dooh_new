import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarVallasYGrupos } from '@/lib/server/vallas-repo'
import { crearVallaCtrl } from '@/lib/server/vallas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// VALLAS (esqueleto, 19/11). Las vallas son inventario: se leen con
// `inventario.ver` y se escriben con `inventario.crear`. No se inventó un
// módulo de permisos nuevo (eso pediría sembrar `rol_permisos`).

// GET /api/vallas → { vallas, grupos } de la organización.
export async function GET() {
  const g = await exigir('inventario', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json(await listarVallasYGrupos())
}

// POST /api/vallas { sitioId, numero, ancho, alto, cara?, notas? } → alta.
export async function POST(req: Request) {
  const g = await exigir('inventario', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const v = await crearVallaCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Dio de alta una valla', v.numero)
    return NextResponse.json(v, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
