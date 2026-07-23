import { NextResponse } from 'next/server'
import { limitar, ipDe } from '@/lib/server/rate-limit'
import { consumirReset, tokenResetValido } from '@/lib/server/password-reset-repo'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/auth/reset?token=…  → { valido } para que la página decida si muestra
// el formulario o un aviso de "enlace inválido/expirado".
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? ''
  return NextResponse.json({ valido: await tokenResetValido(token) })
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
