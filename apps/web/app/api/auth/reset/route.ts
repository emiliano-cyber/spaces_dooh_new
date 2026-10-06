import { NextResponse } from 'next/server'
import { limitar, ipDe } from '@/lib/server/rate-limit'
import { consumirReset, tokenResetValido } from '@/lib/server/password-reset-repo'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/auth/reset?token=…  → { valido } para que la página decida si muestra
// el formulario o un aviso de "enlace inválido/expirado".
//
// NEXT_PUBLIC_RECUPERAR_PASSWORD=0 NO se comprueba aquí desde el 06/10 (ADR
// 0044), y es deliberado. La bandera apaga PEDIR un enlace —eso lo cierra
// /api/auth/forgot, el único emisor público—, no USARLO. Con ella aquí, la
// invitación de un usuario nuevo, que emite un administrador con sesión, moría
// con 503 en todas las instancias, que nacen con la bandera en 0. Con el emisor
// público apagado, los únicos tokens que existen los creó alguien con sesión.
// Lo fija `lib/server/invitacion-interruptor.test.ts`.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? ''
  // Dentro del try: con la base caída la consulta lanzaba y Next contestaba un
  // 500 con el cuerpo vacío (2026-09-30). El POST de abajo ya lo tenía.
  try {
    return NextResponse.json({ valido: await tokenResetValido(token) })
  } catch (e) {
    return respuestaError(e)
  }
}

// POST /api/auth/reset  { token, password } → fija la nueva contraseña.
// PÚBLICO. Valida token (no usado/no expirado) y la política de contraseña,
// invalida el token y cierra las sesiones del usuario.
export async function POST(req: Request) {
  const lim = limitar(`reset:${ipDe(req)}`, 10, 15 * 60_000)
  if (!lim.ok) {
    return NextResponse.json({ error: `Demasiados intentos. Espera ${lim.retrySeg}s.` }, { status: 429 })
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { token?: unknown; password?: unknown }
    const token = typeof body.token === 'string' ? body.token : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!token) return NextResponse.json({ error: 'Falta el enlace de restablecimiento.' }, { status: 400 })
    await consumirReset(token, password)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return respuestaError(e)
  }
}
