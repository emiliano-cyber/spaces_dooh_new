import { NextResponse } from 'next/server'
import { limitar, ipDe } from '@/lib/server/rate-limit'
import { cookieSecure } from '@/lib/server/auth'
import {
  googleHabilitado,
  redirectUri,
  urlDeConsentimiento,
  nuevoEstado,
  nuevoVerifier,
  challengeDe,
  COOKIE_ESTADO,
  COOKIE_NONCE,
  COOKIE_VERIFIER,
} from '@/lib/server/google-oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/auth/google/inicio/ → redirige al consentimiento de Google.
//
// PÚBLICA y sin sesión, por definición. El middleware ya trata /api/ como
// pública y los GET no pasan por el filtro CSRF, así que no hace falta añadir
// ninguna exención.

// Los tres secretos de un solo uso viven en cookies httpOnly de vida corta. Van
// en cookies y no en un store del servidor a propósito: el proceso puede
// reiniciarse entre el /inicio y el /callback (un `pm2 reload` a media sesión) y
// un store en memoria dejaría al usuario con un error inexplicable.
const VIDA_SEG = 10 * 60

function cookieCorta(name: string, value: string) {
  return {
    name,
    value,
    httpOnly: true,
    // `lax` y no `strict`: el usuario vuelve de accounts.google.com, o sea una
    // navegación de nivel superior desde OTRO sitio. Con `strict` el navegador
    // no mandaría estas cookies en el callback y el flujo fallaría siempre.
    sameSite: 'lax' as const,
    secure: cookieSecure(),
    path: '/',
    maxAge: VIDA_SEG,
  }
}

export async function GET(req: Request) {
  if (!googleHabilitado()) {
    return NextResponse.json({ error: 'El acceso con Google no está disponible.' }, { status: 503 })
  }
  // Mismo criterio que el login (10 cada 5 min por IP). Esta ruta NO llama a
  // Google —solo construye la URL, fija tres cookies y redirige—, así que el
  // límite no protege de tráfico saliente: la llamada de verdad está en el
  // callback. Está por higiene, para que un endpoint público sin sesión no sea
  // gratis de martillear.
  //
  // El cubo es por IP y nginx pone `X-Forwarded-For $remote_addr`
  // (infra/nginx/demo.space-os.io.conf:123), o sea que REEMPLAZA lo que mande
  // el cliente: nadie elige su propio cubo. La contrapartida es que una oficina
  // entera detrás de un NAT comparte los 10 — mismo trato que ya tiene el
  // login, y por eso se deja igual y no más flojo.
  const lim = limitar(`google:inicio:${ipDe(req)}`, 10, 5 * 60_000)
  if (!lim.ok) {
    return NextResponse.json(
      { error: `Demasiados intentos. Espera ${lim.retrySeg}s.` },
      { status: 429, headers: { 'Retry-After': String(lim.retrySeg) } },
    )
  }

  const state = nuevoEstado()
  const nonce = nuevoEstado()
  const verifier = nuevoVerifier()

  const destino = urlDeConsentimiento({
    redirectUri: redirectUri(req),
    state,
    nonce,
    codeChallenge: challengeDe(verifier),
  })

  const res = NextResponse.redirect(destino, 302)
  res.cookies.set(cookieCorta(COOKIE_ESTADO, state))
  res.cookies.set(cookieCorta(COOKIE_NONCE, nonce))
  res.cookies.set(cookieCorta(COOKIE_VERIFIER, verifier))
  return res
}
