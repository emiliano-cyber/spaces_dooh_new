import { NextResponse } from 'next/server'
import { usuarioActual } from '@/lib/server/auth'
import { importarSitios } from '@/lib/server/sitios-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/sitios/import  { filas, modoDuplicado, precioM2 } → resumen
export async function POST(req: Request) {
  if (!(await usuarioActual())) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body?.filas) return NextResponse.json({ error: 'Faltan filas' }, { status: 400 })
  const resumen = await importarSitios({
    filas: body.filas,
    modoDuplicado: body.modoDuplicado === 'NUEVA_VERSION' ? 'NUEVA_VERSION' : 'ACTUALIZAR',
    precioM2: body.precioM2 ?? null,
  })
  return NextResponse.json(resumen)
}
