import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { leerIdiomasServidorCtrl, guardarIdiomasServidorCtrl } from '@/lib/server/idiomas-servidor-controller'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// /api/idiomas-servidor → los idiomas que ofrece ESTE SERVIDOR (IDIOMAS-SERVIDOR,
// 10/11). Los mismos permisos que el resto de la configuracion (`/api/config`):
// ver para leer, crear para guardar. No pide el candado de «Cambios
// bloqueados»: no mueve dinero ni catalogo. El CSRF lo pone el middleware.

export async function GET() {
  const g = await exigir('administracion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await leerIdiomasServidorCtrl())
  } catch (e) {
    return respuestaError(e)
  }
}

// PUT { idiomas: Idioma[] | null }   (null = mandan las variables IDIOMA_*)
export async function PUT(req: Request) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const r = await guardarIdiomasServidorCtrl(g.usuario.id, await req.json().catch(() => ({})))
    await registrarAccion(
      g.usuario,
      `Cambio los idiomas del servidor: ${r.idiomas ? r.idiomas.join(', ') : 'los de las variables'}`,
      'Idiomas',
    )
    return NextResponse.json(r)
  } catch (e) {
    return respuestaError(e)
  }
}
