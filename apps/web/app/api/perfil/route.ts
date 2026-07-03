import { NextResponse } from 'next/server'
import { usuarioActual, hashPassword } from '@/lib/server/auth'
import { emailExiste } from '@/lib/server/usuarios-repo'
import { q } from '@/lib/server/db'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { esEmailValido, EMAIL_INVALIDO } from '@/lib/validacion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/perfil → el usuario en sesión cambia su propio correo y/o contraseña.
export async function PATCH(req: Request) {
  const u = await usuarioActual()
  if (!u) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))

  const sets: string[] = []
  const vals: unknown[] = []

  const nuevoEmail = typeof body?.email === 'string' ? body.email.trim() : ''
  if (nuevoEmail && nuevoEmail.toLowerCase() !== u.email.toLowerCase()) {
    if (!esEmailValido(nuevoEmail)) {
      return NextResponse.json({ error: EMAIL_INVALIDO }, { status: 400 })
    }
    if (await emailExiste(nuevoEmail)) {
      return NextResponse.json({ error: 'Ese correo ya está en uso' }, { status: 409 })
    }
    vals.push(nuevoEmail.toLowerCase())
    sets.push(`email = $${vals.length}`)
  }

  if (body?.password) {
    if (String(body.password).length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }
    vals.push(await hashPassword(String(body.password)))
    sets.push(`password_hash = $${vals.length}`)
  }

  if (!sets.length) return NextResponse.json({ error: 'No hay cambios que guardar' }, { status: 400 })

  vals.push(u.id)
  await q(`update usuarios set ${sets.join(', ')} where id = $${vals.length}`, vals)
  await registrarAccion(u, 'Actualizó su cuenta', u.nombre)
  return NextResponse.json({ ok: true })
}
