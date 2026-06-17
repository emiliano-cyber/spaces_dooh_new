import { NextResponse } from 'next/server'
import { usuarioActual } from '@/lib/server/auth'
import { listarSitios, crearSitio } from '@/lib/server/sitios-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/sitios → lista de sitios (con modalidades)
export async function GET() {
  if (!(await usuarioActual())) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  return NextResponse.json(await listarSitios())
}

// POST /api/sitios → alta de un sitio (cuerpo = AltaSitioInput)
export async function POST(req: Request) {
  if (!(await usuarioActual())) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body?.nombre) return NextResponse.json({ error: 'Falta nombre' }, { status: 400 })
  const sitio = await crearSitio(body)
  return NextResponse.json(sitio, { status: 201 })
}
