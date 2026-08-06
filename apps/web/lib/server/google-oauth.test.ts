import { describe, it, expect } from 'vitest'
import { validarClaims, decodificarPayload, challengeDe, urlDeConsentimiento } from './google-oauth'

// ============================================================================
//  ADR 0012 · validación de los claims del id_token de Google.
//
//  Aquí es donde vive el riesgo de esta función. El resto —canjear el código,
//  redirigir— falla ruidosamente si se rompe; esto falla DEJANDO ENTRAR a quien
//  no debía, que es un fallo que nadie ve.
//
//  Se prueba sobre todo lo que tiene que RECHAZAR. Un test que solo comprueba
//  que un token bueno pasa daría verde con la validación entera comentada.
// ============================================================================

const CLIENT_ID = '123456.apps.googleusercontent.com'
const NONCE = 'nonce-de-esta-peticion'
const AHORA = 1_785_000_000_000 // ms
const EXP = Math.floor(AHORA / 1000) + 3600

const BUENO = {
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  exp: EXP,
  nonce: NONCE,
  email_verified: true,
  sub: 'sub-estable-123',
  email: 'ana@ejemplo.mx',
  name: 'Ana Pérez',
}

const opts = { clientId: CLIENT_ID, nonce: NONCE, ahoraMs: AHORA }
const validar = (over: Record<string, unknown>) => validarClaims({ ...BUENO, ...over }, opts)

describe('validarClaims — el camino bueno', () => {
  it('acepta un token correcto y devuelve sub, correo y nombre', () => {
    expect(validarClaims(BUENO, opts)).toEqual({
      sub: 'sub-estable-123',
      email: 'ana@ejemplo.mx',
      nombre: 'Ana Pérez',
    })
  })

  it('acepta el emisor sin esquema, que Google también usa', () => {
    expect(validar({ iss: 'accounts.google.com' }).sub).toBe('sub-estable-123')
  })

  it('acepta `aud` como arreglo si contiene nuestro client id', () => {
    expect(validar({ aud: ['otro', CLIENT_ID] }).sub).toBe('sub-estable-123')
  })

  it('sin nombre devuelve null en vez de inventarse uno', () => {
    expect(validar({ name: undefined }).nombre).toBeNull()
  })
})

describe('validarClaims — email_verified, que es LA barrera', () => {
  // Al renunciar a GOOGLE_HD (decisión 5 del ADR), esto es lo ÚNICO que impide
  // que alguien vincule la cuenta de otro dándose de alta en Google con su
  // correo. Cada uno de estos casos es una toma de cuenta si pasa.

  it('rechaza email_verified false', () => {
    expect(() => validar({ email_verified: false })).toThrow(/correo verificado/i)
  })

  it('rechaza que el claim no venga', () => {
    expect(() => validar({ email_verified: undefined })).toThrow(/correo verificado/i)
  })

  it('rechaza la CADENA "true" — no se acepta lo «parecido a verdadero»', () => {
    // Con un `if (p.email_verified)` esto pasaría, y con él pasaría también la
    // cadena "false", que es el caso que hay que cortar.
    expect(() => validar({ email_verified: 'true' })).toThrow(/formato inesperado/i)
  })

  it('rechaza la CADENA "false", que en JavaScript es verdadera', () => {
    expect(() => validar({ email_verified: 'false' })).toThrow(/formato inesperado/i)
  })

  it('rechaza 1, que también es «parecido a verdadero»', () => {
    expect(() => validar({ email_verified: 1 })).toThrow(/correo verificado/i)
  })
})

describe('validarClaims — quién emitió y para quién', () => {
  it('rechaza un emisor que no es Google', () => {
    expect(() => validar({ iss: 'https://accounts.google.com.evil.test' })).toThrow(/no la emitió Google/i)
  })

  it('rechaza un token emitido para OTRA aplicación', () => {
    // Sin esta comprobación, cualquiera con una app de Google podría emitir
    // tokens que sirvieran para entrar aquí.
    expect(() => validar({ aud: 'otra-app.apps.googleusercontent.com' })).toThrow(/no es para esta aplicación/i)
  })

  it('rechaza un arreglo de `aud` que no nos incluye', () => {
    expect(() => validar({ aud: ['a', 'b'] })).toThrow(/no es para esta aplicación/i)
  })

  it('rechaza `aud` ausente', () => {
    expect(() => validar({ aud: undefined })).toThrow(/no es para esta aplicación/i)
  })
})

describe('validarClaims — nonce y expiración (replay)', () => {
  it('rechaza un nonce distinto del emitido en /inicio', () => {
    expect(() => validar({ nonce: 'otro' })).toThrow(/no corresponde a esta solicitud/i)
  })

  it('rechaza que no venga nonce', () => {
    expect(() => validar({ nonce: undefined })).toThrow(/no corresponde a esta solicitud/i)
  })

  it('rechaza un token expirado', () => {
    expect(() => validar({ exp: Math.floor(AHORA / 1000) - 3600 })).toThrow(/expiró/i)
  })

  it('tolera un desfase de reloj pequeño', () => {
    // Recién expirado (30 s), dentro del margen de 60 s.
    expect(validar({ exp: Math.floor(AHORA / 1000) - 30 }).sub).toBe('sub-estable-123')
  })

  it('NO tolera un desfase grande', () => {
    expect(() => validar({ exp: Math.floor(AHORA / 1000) - 120 })).toThrow(/expiró/i)
  })
})

describe('validarClaims — lo que hace falta para poder entrar', () => {
  it('rechaza un token sin sub', () => {
    expect(() => validar({ sub: undefined })).toThrow(/identificador/i)
  })

  it('rechaza un sub vacío', () => {
    expect(() => validar({ sub: '' })).toThrow(/identificador/i)
  })

  it('rechaza un token sin correo', () => {
    expect(() => validar({ email: undefined })).toThrow(/correo/i)
  })

  it('no se rompe con un payload que no es un objeto', () => {
    expect(() => validarClaims(null, opts)).toThrow()
    expect(() => validarClaims('cadena', opts)).toThrow()
  })
})

describe('decodificarPayload', () => {
  const jwt = (payload: object) =>
    `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.firma`

  it('lee el payload de un JWT bien formado', () => {
    expect(decodificarPayload(jwt({ sub: 'x' }))).toEqual({ sub: 'x' })
  })

  it('rechaza algo que no tiene tres partes', () => {
    expect(() => decodificarPayload('no.es-un-jwt')).toThrow(/formato esperado/i)
  })

  it('rechaza un payload que no es JSON', () => {
    expect(() => decodificarPayload('a.###.c')).toThrow(/no se pudo leer/i)
  })
})

describe('PKCE y la URL de consentimiento', () => {
  it('el challenge es el SHA-256 del verifier en base64url', () => {
    // Vector de la RFC 7636, apéndice B.
    expect(challengeDe('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })

  it('pide S256 y NUNCA el método `plain`', () => {
    const u = new URL(urlDeConsentimiento({ redirectUri: 'https://x/cb/', state: 's', nonce: 'n', codeChallenge: 'c' }))
    expect(u.searchParams.get('code_challenge_method')).toBe('S256')
  })

  it('no pide ningún scope fuera de identidad', () => {
    // Pedir Gmail, Drive o Calendar convertiría un login en un acceso a los
    // datos del usuario.
    const u = new URL(urlDeConsentimiento({ redirectUri: 'https://x/cb/', state: 's', nonce: 'n', codeChallenge: 'c' }))
    expect(u.searchParams.get('scope')).toBe('openid email profile')
  })

  it('manda state y nonce, que son obligatorios', () => {
    const u = new URL(urlDeConsentimiento({ redirectUri: 'https://x/cb/', state: 'el-state', nonce: 'el-nonce', codeChallenge: 'c' }))
    expect(u.searchParams.get('state')).toBe('el-state')
    expect(u.searchParams.get('nonce')).toBe('el-nonce')
  })

  it('sin forzarLogin no manda prompt (entrega 1)', () => {
    const u = new URL(urlDeConsentimiento({ redirectUri: 'https://x/cb/', state: 's', nonce: 'n', codeChallenge: 'c' }))
    expect(u.searchParams.get('prompt')).toBeNull()
  })

  it('con forzarLogin re-pide credenciales aunque haya sesión (entrega 2)', () => {
    const u = new URL(urlDeConsentimiento({ redirectUri: 'https://x/cb/', state: 's', nonce: 'n', codeChallenge: 'c', forzarLogin: true }))
    expect(u.searchParams.get('prompt')).toBe('login')
    expect(u.searchParams.get('max_age')).toBe('0')
  })
})
