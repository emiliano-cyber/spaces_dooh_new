import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { matrizPermisosUI } from '@/lib/server/usuarios-repo'
import { cambiarPermiso } from '@/lib/server/permisos-edicion'
import { exigirReautenticacionSiempre, respuestaDesbloqueo } from '@/lib/server/cambios'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await exigir('administracion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json(await matrizPermisosUI())
}

// PUT /api/admin/permisos-matriz  { rol, modulo, accion, permitido }   (11/11)
//
// Concede o quita UNA casilla de la matriz. Las guardas de negocio (solo el
// Dueño, su columna intocable, catálogo cerrado, una sola organización) viven
// en `permisos-edicion.ts`. Aquí, el orden de siempre: permiso del rol, y
// después la contraseña PROPIA, incondicional — cambiar quién puede qué es
// tocar el acceso de otras personas, como restablecer o borrar.
export async function PUT(req: Request) {
  const g = await exigir('administracion', 'aprobar')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  const d = await exigirReautenticacionSiempre()
  if (!d.ok) return respuestaDesbloqueo(d)

  const b = await req.json().catch(() => null)
  const cambio = {
    rol: String(b?.rol ?? ''),
    modulo: String(b?.modulo ?? ''),
    accion: String(b?.accion ?? ''),
    permitido: b?.permitido,
  }
  try {
    await cambiarPermiso(cambio, { id: g.usuario.id, rol: g.usuario.rol })
    await registrarAccion(
      g.usuario,
      cambio.permitido ? 'Concedió permiso' : 'Quitó permiso',
      `${cambio.rol} · ${cambio.modulo} · ${cambio.accion}`,
    )
    return NextResponse.json(await matrizPermisosUI())
  } catch (e) {
    return respuestaError(e)
  }
}
