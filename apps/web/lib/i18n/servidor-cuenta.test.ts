import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { huellaDeSesion, cookieIdiomaCuenta } from '@/lib/server/idioma-cuenta'
import { valorCookieIdiomaCuenta, COOKIE_IDIOMA_CUENTA, COOKIE_IDIOMA_MAX_AGE } from './idiomas'

// ============================================================================
//  IDIOMA-USUARIO (03/11) · `idiomaDeLaPeticion()` con la preferencia de la
//  cuenta. La preferencia viaja en `spaces_idioma_cuenta`, atada a la sesión
//  por la huella del token de `spaces_sesion` (ver `idiomas.ts`).
// ============================================================================

const estado = {
  modo: 'peticion' as 'fuera' | 'peticion',
  cookies: {} as Record<string, string>,
  accept: null as string | null,
}

vi.mock('next/headers', () => ({
  cookies: () => {
    if (estado.modo === 'fuera') throw new Error('`cookies` was called outside a request scope.')
    return { get: (n: string) => (n in estado.cookies ? { value: estado.cookies[n] } : undefined) }
  },
  headers: () => {
    if (estado.modo === 'fuera') throw new Error('`headers` was called outside a request scope.')
    return { get: (n: string) => (n === 'accept-language' ? estado.accept : null) }
  },
}))

async function idioma() {
  const { idiomaDeLaPeticion } = await import('./servidor')
  return idiomaDeLaPeticion()
}

const TOKEN = 'f'.repeat(64)
const OTRO_TOKEN = '0'.repeat(64)
function conCuenta(idioma: 'es' | 'en' | 'it', tokenDeLaCookie = TOKEN) {
  estado.cookies.spaces_sesion = TOKEN
  estado.cookies[COOKIE_IDIOMA_CUENTA] = valorCookieIdiomaCuenta(idioma, huellaDeSesion(tokenDeLaCookie))
}

beforeEach(() => {
  estado.modo = 'peticion'
  estado.cookies = {}
  estado.accept = null
  process.env.IDIOMA_INGLES = '1'
  process.env.IDIOMA_ITALIANO = '1'
})
afterEach(() => {
  delete process.env.IDIOMA_INGLES
  delete process.env.IDIOMA_ITALIANO
})

describe('huellaDeSesion', () => {
  it('es estable, de 32 hexadecimales, y distinta por token', () => {
    expect(huellaDeSesion(TOKEN)).toMatch(/^[0-9a-f]{32}$/)
    expect(huellaDeSesion(TOKEN)).toBe(huellaDeSesion(TOKEN))
    expect(huellaDeSesion(TOKEN)).not.toBe(huellaDeSesion(OTRO_TOKEN))
  })
  it('NO contiene el token: la cookie no filtra la sesión', () => {
    expect(TOKEN.includes(huellaDeSesion(TOKEN))).toBe(false)
  })
})

describe('el nombre de la cookie de sesión', () => {
  it('huella-sesion.ts repite el de auth.ts: si divergen, la cuenta no se aplica nunca', async () => {
    const { COOKIE_SESION } = await import('@/lib/server/huella-sesion')
    const { SESSION_COOKIE } = await import('@/lib/server/auth')
    expect(COOKIE_SESION).toBe(SESSION_COOKIE)
  })
})

describe('cookieIdiomaCuenta · lo que pone el servidor', () => {
  it('con idioma: httpOnly, lax, path /, un año, atada a la sesión', () => {
    const c = cookieIdiomaCuenta(TOKEN, 'en')
    expect(c).toMatchObject({
      name: COOKIE_IDIOMA_CUENTA,
      value: `en.${huellaDeSesion(TOKEN)}`,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_IDIOMA_MAX_AGE,
    })
  })
  it('sin idioma (seguir al navegador): la BORRA', () => {
    expect(cookieIdiomaCuenta(TOKEN, null)).toMatchObject({ name: COOKIE_IDIOMA_CUENTA, value: '', maxAge: 0, path: '/' })
  })
})

describe('idiomaDeLaPeticion · cuenta > cookie > navegador', () => {
  it('la preferencia de la cuenta gana a la cookie del navegador y a la cabecera', async () => {
    conCuenta('it')
    estado.cookies.spaces_idioma = 'en'
    estado.accept = 'es-MX'
    expect(await idioma()).toBe('it')
  })

  it('la cookie de cuenta de OTRA sesión se ignora: manda el navegador', async () => {
    conCuenta('it', OTRO_TOKEN)
    estado.cookies.spaces_idioma = 'en'
    expect(await idioma()).toBe('en')
  })

  it('SIN sesión la cookie de cuenta no vale (login, páginas públicas)', async () => {
    conCuenta('it')
    delete estado.cookies.spaces_sesion
    estado.accept = 'en-US'
    expect(await idioma()).toBe('en')
  })

  it('con el idioma de la cuenta APAGADO se ignora sin error', async () => {
    delete process.env.IDIOMA_ITALIANO
    conCuenta('it')
    estado.cookies.spaces_idioma = 'en'
    expect(await idioma()).toBe('en')
  })

  it('con TODO apagado: español, diga lo que diga la cuenta', async () => {
    delete process.env.IDIOMA_INGLES
    delete process.env.IDIOMA_ITALIANO
    conCuenta('en')
    expect(await idioma()).toBe('es')
  })

  it('fuera de una petición sigue sin lanzar', async () => {
    estado.modo = 'fuera'
    await expect(idioma()).resolves.toBe('es')
  })
})
