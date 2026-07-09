import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { importarSitiosCtrl } from '@/lib/server/sitios-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/sitios/import  { filas, modoDuplicado, precioM2, imagenes? } → resumen
export async function POST(req: Request) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const resumen = await importarSitiosCtrl(await req.json().catch(() => ({})))
    await registrarAccion(
      g.usuario,
      'Importó inventario',
      `${resumen.creadas} nuevos · ${resumen.actualizadas} actualizados`,
    )
    return NextResponse.json(resumen)
  } catch (e) {
    return respuestaError(e)
  }
}
