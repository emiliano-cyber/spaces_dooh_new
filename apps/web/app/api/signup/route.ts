import { NextResponse } from 'next/server'
import { crearTenant } from '@/lib/server/tenant'
import { crearUsuario, emailExiste } from '@/lib/server/usuarios-repo'
import { limitar, ipDe } from '@/lib/server/rate-limit'
import { esEmailValido, EMAIL_INVALIDO } from '@/lib/validacion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/signup → crea una CUENTA nueva: una organización (CRM propio) + su
// usuario Dueño. Público (auto-registro desde el login).
// body: { organizacion, nombre, email, password }
export async function POST(req: Request) {
  // Anti-abuso: máx. 5 registros por IP cada hora.
  const lim = limitar(`signup:${ipDe(req)}`, 5, 60 * 60_000)
  if (!lim.ok) {
    return NextResponse.json({ error: `Demasiados intentos. Espera ${lim.retrySeg}s.` }, { status: 429 })
  }
  const body = await req.json().catch(() => null)
  if (!body?.organizacion?.trim() || !body?.nombre?.trim() || !body?.email?.trim()) {
    return NextResponse.json({ error: 'Faltan datos: organización, nombre y correo' }, { status: 400 })
  }
  if (!esEmailValido(body.email)) {
    return NextResponse.json({ error: EMAIL_INVALIDO }, { status: 400 })
  }
  if (!body?.password || String(body.password).length < 6) {
    return NextResponse.json({ error: 'La contraseña es requerida (mínimo 6 caracteres)' }, { status: 400 })
  }
  if (await emailExiste(body.email)) {
    return NextResponse.json({ error: 'Ese correo ya está registrado' }, { status: 409 })
  }
  const tenant = await crearTenant(body.organizacion, body.organizacion)
  const usuario = await crearUsuario({
    nombre: body.nombre.trim(),
    email: body.email.trim(),
    cargo: 'Dueño',
    rol: 'DUENO',
    password: body.password,
    tenantId: tenant.id,
  })
  return NextResponse.json({ tenant, usuario }, { status: 201 })
}
