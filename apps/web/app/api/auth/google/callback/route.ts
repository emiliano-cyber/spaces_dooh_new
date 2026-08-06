import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { qRaw1 } from '@/lib/server/db'
import { crearSesion, cookieSesion, cookieCsrf, nuevoCsrfToken } from '@/lib/server/auth'
import { limitar, ipDe } from '@/lib/server/rate-limit'
import {
  googleHabilitado,
  redirectUri,
  clientId,
  canjearCodigo,
  decodificarPayload,
  validarClaims,
  COOKIE_ESTADO,
  COOKIE_NONCE,
  COOKIE_VERIFIER,
} from '@/lib/server/google-oauth'
import {
  PROVEEDOR_GOOGLE,
  usuarioPorIdentidad,
  vincularIdentidad,
  marcarUso,
  registrarVinculo,
} from '@/lib/server/identidades-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/auth/google/callback/ → canjea el código y abre la sesión.
//
// Es la superficie más sensible de este ADR: acepta parámetros de un tercero y
// termina emitiendo una cookie de sesión. Se protege con `state` (CSRF del
// propio OAuth), `nonce` (replay del id_token), PKCE (intercepción del código) y
// rate limit. Los tres primeros son obligatorios: sin `state`, esto es un
// *login CSRF* que mete a la víctima en la cuenta del atacante.
//
// TERMINA EXACTAMENTE DONDE TERMINA EL LOGIN — `crearSesion` + las dos cookies
// (login/route.ts:46-56). A partir de ahí la sesión es indistinguible de una
// nacida con contraseña: mismo RLS, mismo CSRF, mismos guards, misma
// revocación. Cero cambios en `exigir()`, en el middleware o en los handlers.

// El usuario llega aquí NAVEGANDO, no por fetch: los fallos se devuelven como
// una redirección al login, no como JSON — un JSON crudo en la ventana del
// navegador no le dice nada a nadie.
//
// Se manda un CÓDIGO y no el texto del error a propósito: el mensaje lo elige el
// cliente a partir de una lista cerrada. Interpolar en la página un texto que
// viene de la URL es como se abre un XSS.
type Motivo =
  | 'no_disponible'
  | 'cancelado'
  | 'invalido'
  | 'no_registrado'
  | 'inactivo'
  | 'ya_vinculada'

function alLogin(req: Request, motivo: Motivo): NextResponse {
  const base = process.env.APP_URL || new URL(req.url).origin
  const res = NextResponse.redirect(`${base}/spaces-dooh/login/?google=${motivo}`, 302)
  return limpiar(res)
}

// Las tres cookies son de un solo uso: se borran SIEMPRE, se hayan usado o no.
// Dejarlas vivas permitiría reintentar un callback con el mismo `state`.
function limpiar(res: NextResponse): NextResponse {
  for (const n of [COOKIE_ESTADO, COOKIE_NONCE, COOKIE_VERIFIER]) {
    res.cookies.set({ name: n, value: '', path: '/', maxAge: 0 })
  }
  return res
}

export async function GET(req: Request) {
  if (!googleHabilitado()) return alLogin(req, 'no_disponible')

  const lim = limitar(`google:callback:${ipDe(req)}`, 10, 5 * 60_000)
  if (!lim.ok) {
    return NextResponse.json(
      { error: `Demasiados intentos. Espera ${lim.retrySeg}s.` },
      { status: 429, headers: { 'Retry-After': String(lim.retrySeg) } },
    )
  }

  const url = new URL(req.url)
  // Google manda `error=access_denied` cuando el usuario pulsa «Cancelar». No es
  // un fallo: se distingue para no enseñarle un mensaje de avería.
  if (url.searchParams.get('error')) return alLogin(req, 'cancelado')

  const code = url.searchParams.get('code') ?? ''
  const state = url.searchParams.get('state') ?? ''

  const galleta = cookies()
  const estadoCookie = galleta.get(COOKIE_ESTADO)?.value ?? ''
  const nonce = galleta.get(COOKIE_NONCE)?.value ?? ''
  const verifier = galleta.get(COOKIE_VERIFIER)?.value ?? ''

  // Sin `state` no hay forma de saber que esta vuelta corresponde a una ida
  // nuestra. Se compara contra la cookie que emitió /inicio.
  if (!code || !state || !estadoCookie || state !== estadoCookie || !nonce || !verifier) {
    return alLogin(req, 'invalido')
  }

  let identidad
  try {
    const idToken = await canjearCodigo({ code, codeVerifier: verifier, redirectUri: redirectUri(req) })
    identidad = validarClaims(decodificarPayload(idToken), { clientId: clientId(), nonce })
  } catch (e) {
    // El motivo exacto ya se distingue en la validación; al usuario se le dice
    // que no se pudo, y el detalle queda en el log del servidor.
    console.error('[google/callback]', e instanceof Error ? e.message : e)
    return alLogin(req, 'invalido')
  }

  // ── Resolución: primero por `sub`, que es el identificador estable ──────────
  let u = await usuarioPorIdentidad(PROVEEDOR_GOOGLE, identidad.sub)
  let recienVinculado = false

  if (!u) {
    // Segundo camino, y el ÚNICO que decide por correo: la cuenta existe pero
    // todavía no está vinculada. `usuarios` es fail-closed, así que la lectura
    // va por la función SECURITY DEFINER, igual que el login.
    const porCorreo = await qRaw1<{
      id: string; nombre: string; email: string; cargo: string | null
      rol: string; activo: boolean; tenant_id: string
    }>(
      `select id, nombre, email, cargo, rol, activo, tenant_id
         from auth_usuario_por_email($1)`,
      [identidad.email],
    )
    // Google NO da de alta. Si el correo no existe, no se crea nada.
    if (!porCorreo) return alLogin(req, 'no_registrado')
    if (!porCorreo.activo) return alLogin(req, 'inactivo')

    const vinculado = await vincularIdentidad({
      proveedor: PROVEEDOR_GOOGLE,
      sub: identidad.sub,
      usuarioId: porCorreo.id,
      tenantId: porCorreo.tenant_id,
      emailExterno: identidad.email,
    })
    // No se insertó: ese usuario ya tiene OTRA cuenta de Google vinculada (hay
    // un unique por (proveedor, usuario_id)). Entrar igualmente dejaría un
    // acceso sin rastro de vínculo, así que se corta y se explica.
    if (!vinculado) return alLogin(req, 'ya_vinculada')

    u = porCorreo
    recienVinculado = true
  }

  // `activo` se comprueba SIEMPRE, no solo en el camino de alta: entrar por
  // Google no es un rodeo para saltarse una baja hecha en Administración.
  if (!u.activo) return alLogin(req, 'inactivo')

  if (recienVinculado) {
    await registrarVinculo({
      usuarioId: u.id,
      usuarioNombre: u.nombre,
      tenantId: u.tenant_id,
      emailExterno: identidad.email,
    })
  } else {
    await marcarUso(PROVEEDOR_GOOGLE, identidad.sub, u.tenant_id)
  }

  const token = await crearSesion(u.id)
  const base = process.env.APP_URL || new URL(req.url).origin
  const res = NextResponse.redirect(`${base}/spaces-dooh/inicio/`, 302)
  res.cookies.set(cookieSesion(token))
  res.cookies.set(cookieCsrf(nuevoCsrfToken()))
  return limpiar(res)
}
