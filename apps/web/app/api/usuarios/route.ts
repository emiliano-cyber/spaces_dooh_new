import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarUsuariosCtrl, crearUsuarioCtrl } from '@/lib/server/usuarios-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/usuarios → lista (requiere administracion.ver)
export async function GET() {
  const g = await exigir('administracion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await listarUsuariosCtrl())
  } catch (e) {
    return respuestaError(e)
  }
}

// POST /api/usuarios → invita/crea usuario (requiere administracion.crear)
// Con `invitar: true` (ADR 0044) devuelve además `invitacion`: el enlace para
// elegir contraseña, solo si el correo no salió.
export async function POST(req: Request) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    // La misma raíz que usa /api/auth/forgot. APP_URL manda en las instancias
    // (la escribe el aprovisionamiento); el origen es el respaldo en local.
    const baseUrl = process.env.APP_URL || new URL(req.url).origin
    const u = await crearUsuarioCtrl(
      await req.json().catch(() => ({})),
      { id: g.usuario.id, rol: g.usuario.rol },
      { baseUrl },
    )
    await registrarAccion(g.usuario, 'Invitó usuario', u.nombre)
    return NextResponse.json(u, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
