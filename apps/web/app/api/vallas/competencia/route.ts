import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarCategorias } from '@/lib/server/vallas-repo'
import { crearCategoriaCtrl } from '@/lib/server/vallas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Categorías de marcas que compiten («Refrescos de cola»: Coca-Cola, Pepsi).
// Esqueleto: las edita quien tiene `inventario.crear` (pregunta abierta al
// dueño: ¿debería ser `comercial` o solo el Dueño?).

export async function GET() {
  const g = await exigir('inventario', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json(await listarCategorias())
}

// POST /api/vallas/competencia { nombre, marcas[] } → alta.
export async function POST(req: Request) {
  const g = await exigir('inventario', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const k = await crearCategoriaCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Dio de alta una categoría de competencia', k.nombre)
    return NextResponse.json(k, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
