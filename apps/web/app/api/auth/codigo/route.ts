import { NextResponse } from 'next/server'
import { crearSesion, cookieSesion, cookieCsrf, nuevoCsrfToken, permisosDeRol } from '@/lib/server/auth'
import { qConTenant } from '@/lib/server/db'
import { usarCodigo } from '@/lib/server/codigos-recuperacion-repo'
import { limitar, ipDe } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  POST /api/auth/codigo — entrar con un código de recuperación. (ADR 0028)
// ----------------------------------------------------------------------------
//  Es la puerta que existe para el día en que el Dueño pierda su cuenta de
//  Google. Sin ella los códigos serían un secreto que nadie puede usar, y el
//  ADR 0028 dejaría a cada Dueño con una sola llave.
//
//  ─── Por qué NO se pide el correo ─────────────────────────────────────────
//  El código ya identifica al usuario: son ~74 bits aleatorios y la fila dice de
//  quién es. Pedir además el correo no añade seguridad —quien tiene el código ya
//  tiene la cuenta— y sí añade una forma de equivocarse justo cuando la persona
//  está teniendo un mal día.
//
//  ─── Por qué el limitador es MÁS ESTRICTO que el del login ────────────────
//  El login tiene un segundo factor práctico: hay que saber el correo. Aquí no
//  hay más que el código, así que el único freno contra probar códigos a ciegas
//  es este contador. Cinco por IP cada quince minutos.
//
//  ─── Y por qué la sesión se abre como `password` y no como `google` ───────
//  Porque `metodoSesion` describe CÓMO se entró, y de eso cuelgan dos
//  decisiones: la excepción del ADR 0018 —fijar la primera contraseña sin
//  teclear la anterior, que solo vale si Google te acaba de identificar— y el
//  guard de los códigos (B2). Marcar esto como `google` daría por bueno algo
//  que no ocurrió. Se marca `password`, que es lo que evita las dos.
// ============================================================================

export async function POST(req: Request) {
  const lim = limitar(`codigo:${ipDe(req)}`, 5, 15 * 60_000)
  if (!lim.ok) {
    return NextResponse.json(
      { error: `Demasiados intentos. Espera ${lim.retrySeg}s e intenta de nuevo.` },
      { status: 429, headers: { 'Retry-After': String(lim.retrySeg) } },
    )
  }

  let body: { codigo?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  if (!body.codigo) {
    return NextResponse.json({ error: 'Falta el código' }, { status: 400 })
  }

  const r = await usarCodigo(body.codigo)
  if (!r.ok) {
    // Mismo mensaje para «no existe» y «ya usado», y es deliberado: distinguirlos
    // le diría a quien prueba códigos a ciegas cuándo ha acertado uno gastado, y
    // con eso sabría que la cuenta existe y que el formato es el bueno.
    //
    // El motivo SÍ se distingue por dentro (`ResultadoCodigo`), para el día que
    // haya que investigar: un código gastado significa que alguien tiene una
    // lista vieja del Dueño.
    return NextResponse.json({ error: 'Código inválido o ya usado' }, { status: 401 })
  }

  // Aquí YA se sabe el tenant: lo devolvió el propio código. Así que esto no es
  // pre-sesión y no hace falta una función SECURITY DEFINER nueva — va por
  // `qConTenant`, con la RLS puesta, que es lo correcto en cuanto hay contexto.
  const [u] = await qConTenant<{
    id: string; nombre: string; email: string; cargo: string | null; rol: string; activo: boolean
  }>(
    r.tenantId,
    `select id, nombre, email, cargo, rol, activo
       from usuarios where id = $1 and tenant_id = $2`,
    [r.usuarioId, r.tenantId],
  )
  // Una cuenta desactivada no entra ni con código. El código es una llave, no un
  // permiso: si a alguien se le retiró el acceso, se le retiró por todas las
  // puertas.
  if (!u || !u.activo) {
    return NextResponse.json({ error: 'Código inválido o ya usado' }, { status: 401 })
  }

  const token = await crearSesion(u.id, 'password')
  const permisos = await permisosDeRol(u.rol)
  const res = NextResponse.json({
    usuario: { id: u.id, nombre: u.nombre, email: u.email, cargo: u.cargo, rol: u.rol, activo: u.activo },
    permisos,
    // Cuántos le quedan. Se le dice a propósito: si no, gastaría el último sin
    // enterarse y descubriría que se quedó sin puerta el día que la necesitara.
    codigosRestantes: r.quedan,
  })
  res.cookies.set(cookieSesion(token))
  res.cookies.set(cookieCsrf(nuevoCsrfToken()))
  return res
}
