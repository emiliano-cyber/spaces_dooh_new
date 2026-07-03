import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { importarSitios } from '@/lib/server/sitios-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/sitios/import  { filas, modoDuplicado, precioM2 } → resumen
export async function POST(req: Request) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => null)
  if (!body?.filas) return NextResponse.json({ error: 'Faltan filas' }, { status: 400 })
  try {
    const resumen = await importarSitios({
      filas: body.filas,
      modoDuplicado: body.modoDuplicado === 'NUEVA_VERSION' ? 'NUEVA_VERSION' : 'ACTUALIZAR',
      precioM2: body.precioM2 ?? null,
      imagenes: body.imagenes && typeof body.imagenes === 'object' ? body.imagenes : undefined,
    })
    await registrarAccion(
      g.usuario,
      'Importó inventario',
      `${resumen.creadas} nuevos · ${resumen.actualizadas} actualizados`,
    )
    return NextResponse.json(resumen)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo importar' },
      { status: 500 },
    )
  }
}
