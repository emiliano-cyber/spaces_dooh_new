import { NextResponse } from 'next/server'
import { usuarioActual } from '@/lib/server/auth'
import { leerAvisosCtrl, guardarAvisosCtrl } from '@/lib/server/avisos-controller'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// /api/perfil/avisos → qué avisos quiere la cuenta en sesión, y por dónde
// (AVISOS-CANAL, 12/11). Pedido del dueño: «hacer los avisos por correo y
// dejar sembrada la opción de envío por WhatsApp».
//
// Como `/api/perfil/idioma`, resuelve con `usuarioActual()` y NO con
// `exigir()`: es la cuenta propia, no un módulo. El id sale de la sesión; un
// `usuarioId` en el cuerpo se ignora. El CSRF lo pone el middleware a toda
// mutación con sesión.

export async function GET() {
  const u = await usuarioActual()
  if (!u) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  try {
    return NextResponse.json(await leerAvisosCtrl(u.id))
  } catch (e) {
    return respuestaError(e)
  }
}

// PUT { activos: [{ tipo, canal }], telefono: string | null }
// Deja las preferencias EXACTAMENTE como vienen: lo que no está, se apaga.
export async function PUT(req: Request) {
  const u = await usuarioActual()
  if (!u) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  try {
    return NextResponse.json(await guardarAvisosCtrl(u.id, await req.json().catch(() => null)))
  } catch (e) {
    return respuestaError(e)
  }
}
