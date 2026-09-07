import { NextResponse } from 'next/server'
import { qRaw1 as q1, qConTenant } from '@/lib/server/db'
import { verifyPassword, crearSesion, cookieSesion, cookieCsrf, nuevoCsrfToken, permisosDeRol } from '@/lib/server/auth'
import { limitar, ipDe } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/auth/login  { email, password } → set cookie + { usuario, permisos }
export async function POST(req: Request) {
  // Anti fuerza bruta: máx. 10 intentos por IP cada 5 minutos.
  const lim = limitar(`login:${ipDe(req)}`, 10, 5 * 60_000)
  if (!lim.ok) {
    return NextResponse.json(
      { error: `Demasiados intentos. Espera ${lim.retrySeg}s e intenta de nuevo.` },
      { status: 429, headers: { 'Retry-After': String(lim.retrySeg) } },
    )
  }
  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  const { email, password } = body
  if (!email || !password) {
    return NextResponse.json({ error: 'Correo y contraseña requeridos' }, { status: 400 })
  }

  // Pre-sesión y pre-tenant: `usuarios` es fail-closed + FORCE, así que la
  // lectura va por la función SECURITY DEFINER acotada (una fila por correo).
  const u = await q1<{
    id: string; nombre: string; email: string; cargo: string | null
    rol: string; activo: boolean; password_hash: string | null; tenant_id: string
  }>(
    `select id, nombre, email, cargo, rol, activo, password_hash, tenant_id
       from auth_usuario_por_email($1)`,
    [email],
  )

  const ok = u && u.activo && (await verifyPassword(password, u.password_hash))
  if (!u || !ok) {
    return NextResponse.json({ error: 'Correo o contraseña inválidos' }, { status: 401 })
  }

  // ADR 0028 · B3 — esta cuenta no entra con contraseña.
  //
  // ─── Por qué va DESPUÉS de verificarla, y no antes ───────────────────────
  // Porque decir «esta cuenta entra con Google» a quien NO sabe la contraseña
  // sería confirmarle que la cuenta existe: enumeración gratis. Puesto aquí,
  // solo lo oye quien ya demostró tener la credencial — y a ése no se le revela
  // nada que no supiera, mientras que callárselo lo dejaría convencido de que se
  // equivocó al teclear.
  //
  // La contraseña SIGUE valiendo para lo suyo: el punto 4 del ADR exige teclearla
  // para CAMBIAR cosas, aunque se haya entrado con Google. Este candado dice que
  // con ella no se ENTRA; no la borra ni la invalida.
  // La bandera se lee APARTE y no sale de `auth_usuario_por_email()`: añadirle
  // una columna de retorno obligaría a editar `20260720_hard1_usuarios_rls.sql`,
  // que es una migración ya aplicada en producción (R3) y rompería el guard de
  // checksums de toda la flota. Ver la cabecera de `20260907_solo_google.sql`.
  //
  // Aquí ya se conoce el tenant —lo devolvió la función— así que va por
  // `qConTenant` con la RLS puesta. Y va DESPUÉS de verificar la contraseña, así
  // que un intento fallido no cuesta ni esta consulta.
  // `usuarios.tenant_id` es NOT NULL —comprobado contra la base, no supuesto—,
  // así que esto no lleva guarda por si viniera vacío: la llevaría para FALLAR
  // ABIERTO, y un candado que se abre solo cuando el dato falta no es un candado.
  // Si algún día llegara null, `qConTenant` revienta y el login da 500. Es la
  // respuesta correcta: no entra nadie hasta que se sepa por qué.
  const [banderas] = await qConTenant<{ solo_google: boolean }>(
    u.tenant_id,
    `select solo_google from usuarios where id = $1 and tenant_id = $2`,
    [u.id, u.tenant_id],
  )

  if (banderas?.solo_google) {
    return NextResponse.json(
      {
        error:
          'Esta cuenta entra con Google. Usa el botón de Google, o un código de ' +
          'recuperación si perdiste el acceso a esa cuenta.',
        soloGoogle: true,
      },
      { status: 403 },
    )
  }

  const token = await crearSesion(u.id, 'password')
  const permisos = await permisosDeRol(u.rol)
  const res = NextResponse.json({
    usuario: { id: u.id, nombre: u.nombre, email: u.email, cargo: u.cargo, rol: u.rol, activo: u.activo },
    permisos,
  })
  res.cookies.set(cookieSesion(token))
  // Emite el token anti-CSRF junto con la sesión (double-submit). El front lo
  // lee de esta cookie y lo reenvía en X-CSRF-Token; el middleware lo exige.
  res.cookies.set(cookieCsrf(nuevoCsrfToken()))
  return res
}
