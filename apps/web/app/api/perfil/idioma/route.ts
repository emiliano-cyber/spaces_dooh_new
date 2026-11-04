import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { usuarioActual, SESSION_COOKIE } from '@/lib/server/auth'
import { leerIdiomaCtrl, guardarIdiomaCtrl } from '@/lib/server/idioma-controller'
import { cookieIdiomaCuenta } from '@/lib/server/idioma-cuenta'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// /api/perfil/idioma → el idioma de la INTERFAZ de la cuenta en sesión
// (IDIOMA-USUARIO, 03/11). Decisión del dueño: «el idioma de papeles y
// contratos es fijo al crearse la app en cada server, pero el idioma de lo
// demás se debe poder configurar por usuario y navegador».
//
// Como `PATCH /api/perfil`, resuelve con `usuarioActual()` y NO con `exigir()`:
// es la cuenta propia, no un módulo, y quien está encerrado con una contraseña
// temporal (ADR 0009) tiene que poder leer la pantalla que le saca de ahí en
// su idioma. El CSRF lo pone el middleware a toda mutación con sesión.

export async function GET() {
  const u = await usuarioActual()
  if (!u) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  try {
    return NextResponse.json(await leerIdiomaCtrl(u.id))
  } catch (e) {
    return respuestaError(e)
  }
}

// PUT { idioma: 'es' | 'en' | 'it' | 'navegador' | null }
//
// Guarda en la cuenta Y deja la cookie de la cuenta de ESTA sesión al día, que
// es lo que hace que la siguiente petición —el `router.refresh()` de la
// pantalla— ya salga en el idioma nuevo sin consultar la base. Las demás
// sesiones abiertas de la persona lo recogen al volver a entrar.
export async function PUT(req: Request) {
  const u = await usuarioActual()
  if (!u) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  try {
    const res = await guardarIdiomaCtrl(u.id, await req.json().catch(() => null))
    const out = NextResponse.json(res)
    const token = cookies().get(SESSION_COOKIE)?.value
    if (token) out.cookies.set(cookieIdiomaCuenta(token, res.preferido))
    return out
  } catch (e) {
    return respuestaError(e)
  }
}
