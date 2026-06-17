import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, destruirSesion } from '@/lib/server/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/auth/logout → borra la sesión y limpia la cookie.
export async function POST() {
  const token = cookies().get(SESSION_COOKIE)?.value
  if (token) await destruirSesion(token)
  const res = NextResponse.json({ ok: true })
  res.cookies.set({ name: SESSION_COOKIE, value: '', maxAge: 0, path: '/' })
  return res
}
