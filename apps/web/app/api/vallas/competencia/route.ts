import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { puedeEditarCompetencia } from '@/lib/roles'
import { listarCategorias, SOLO_DUENO_COMPETENCIA } from '@/lib/server/vallas-repo'
import { crearCategoriaCtrl } from '@/lib/server/vallas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Categorías de marcas que compiten («Refrescos de cola»: Coca-Cola, Pepsi).
// Las VE quien ve Inventario; las crea, edita y da de baja SOLO el Dueño
// (decisión del dueño del 19/11, `puedeEditarCompetencia` en `lib/roles.ts`).
// El Administrador tiene `inventario.crear` y aun así recibe 403: la puerta es
// el ROL, no el permiso. Lo vigila `vallas.e2e.test.ts`.

export async function GET() {
  const g = await exigir('inventario', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json(await listarCategorias())
}

// POST /api/vallas/competencia { nombre, marcas[] } → alta.
export async function POST(req: Request) {
  const g = await exigir('inventario', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!puedeEditarCompetencia(g.usuario.rol)) return NextResponse.json({ error: SOLO_DUENO_COMPETENCIA }, { status: 403 })
  try {
    const k = await crearCategoriaCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Dio de alta una categoría de competencia', k.nombre)
    return NextResponse.json(k, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
