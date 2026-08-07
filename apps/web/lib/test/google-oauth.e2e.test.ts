import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'
import {
  arrancarDoble,
  pararDoble,
  prepararIdToken,
  prepararFallo,
  ultimoCanje,
  olvidarCanje,
  idTokenFalso,
  claimsBuenos,
  CLIENT_ID_PRUEBA,
} from './doble-google'

// ============================================================================
//  ADR 0012 · el flujo de acceso con Google, de punta a punta.
//
//  El ADR anota como consecuencia negativa que «las pruebas e2e no pueden
//  hablar con Google». Esto lo cierra: el canje del código va a un doble local
//  (GOOGLE_TOKEN_ENDPOINT), y todo lo demás —cookies, state, nonce, PKCE,
//  validación de claims, resolución del usuario, apertura de sesión, vínculo y
//  bitácora— es la aplicación de verdad, por HTTP, contra Postgres de verdad.
//
//  Lo que hace falta probar aquí y NO cubren las unitarias de `validarClaims`:
//  la COSTURA. Que el nonce que emite /inicio es el que exige el callback, que
//  la cookie de state llega y se compara, que el verifier de PKCE viaja al
//  canje, y que un rechazo NO deja sesión abierta. Cada una de esas uniones se
//  puede romper sin que falle una sola unitaria.
//
//  Casi todo son casos NEGATIVOS a propósito: una prueba que solo recorre el
//  camino feliz daría verde con las comprobaciones de seguridad comentadas.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('goog')
  await arrancarDoble()
  await arrancarServidor()
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await pararDoble()
  await cerrarPool()
})

beforeEach(() => {
  olvidarCanje()
})

// ─── Utilidades ─────────────────────────────────────────────────────────────

// Arranca el flujo y devuelve el `state` y el `nonce` REALES que emitió la
// aplicación. Se leen de la URL de Google, no se inventan: inventarlos probaría
// otra cosa.
async function iniciar(c: Cliente): Promise<{ state: string; nonce: string; destino: URL }> {
  const r = await c.pedir('/api/auth/google/inicio/')
  expect(r.status).toBe(302)
  const destino = new URL(r.ubicacion!)
  return {
    state: destino.searchParams.get('state')!,
    nonce: destino.searchParams.get('nonce')!,
    destino,
  }
}

async function callback(c: Cliente, params: Record<string, string>) {
  const q = new URLSearchParams(params).toString()
  return c.pedir(`/api/auth/google/callback/?${q}`)
}

// El motivo que el callback puso en la redirección al login.
function motivoDe(ubicacion: string | null): string | null {
  if (!ubicacion) return null
  return new URL(ubicacion).searchParams.get('google')
}

async function contarIdentidades(): Promise<number> {
  const r = await poolTest().query('select count(*)::int as n from identidades_externas')
  return r.rows[0].n
}

async function vinculosEnBitacora(): Promise<number> {
  const r = await poolTest().query(
    `select count(*)::int as n from acciones where accion = 'Vinculó su cuenta de Google'`,
  )
  return r.rows[0].n
}

// ─── 1. La ida ──────────────────────────────────────────────────────────────

describe('1 · el arranque del flujo', () => {
  it('redirige a Google con state, nonce y PKCE S256', async () => {
    const { destino } = await iniciar(new Cliente())
    expect(destino.origin + destino.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(destino.searchParams.get('state')).toBeTruthy()
    expect(destino.searchParams.get('nonce')).toBeTruthy()
    expect(destino.searchParams.get('code_challenge')).toBeTruthy()
    expect(destino.searchParams.get('code_challenge_method')).toBe('S256')
    expect(destino.searchParams.get('client_id')).toBe(CLIENT_ID_PRUEBA)
  })

  it('no pide ningún permiso más allá de la identidad', async () => {
    // Pedir Gmail, Drive o Calendar convertiría un login en un acceso a los
    // datos del usuario.
    const { destino } = await iniciar(new Cliente())
    expect(destino.searchParams.get('scope')).toBe('openid email profile')
  })

  it('el state y el nonce cambian en cada intento', async () => {
    const a = await iniciar(new Cliente())
    const b = await iniciar(new Cliente())
    expect(a.state).not.toBe(b.state)
    expect(a.nonce).not.toBe(b.nonce)
  })
})

// ─── 2. El camino bueno ─────────────────────────────────────────────────────

describe('2 · primera entrada: se vincula por correo y se abre sesión', () => {
  it('entra, deja sesión utilizable, graba el vínculo y lo anota en bitácora', async () => {
    const c = new Cliente()
    const { state, nonce } = await iniciar(c)
    prepararIdToken(idTokenFalso(claimsBuenos({ sub: 'sub-1', email: org.usuarioEmail, nonce })))

    const r = await callback(c, { code: 'codigo-bueno', state })

    expect(r.status).toBe(302)
    expect(r.ubicacion).toContain('/inicio/')
    expect(motivoDe(r.ubicacion)).toBeNull() // sin error
    expect(c.tieneCookie('spaces_sesion')).toBe(true)
    expect(c.tieneCookie('spaces_csrf')).toBe(true)

    // La sesión SIRVE: no basta con que la cookie exista.
    const estado = await c.pedir('/api/estado/')
    expect(estado.status).toBe(200)

    expect(await contarIdentidades()).toBe(1)
    expect(await vinculosEnBitacora()).toBe(1)
  })

  it('el canje manda el code_verifier de PKCE y el código recibido', async () => {
    // Sin esta comprobación, quitar PKCE del flujo no rompería ninguna prueba.
    // La prueba hace SU PROPIO recorrido en vez de mirar el de la anterior: el
    // `beforeEach` limpia el registro del canje a propósito, para que ninguna
    // aserción pueda pasar por lo que dejó otra.
    const c = new Cliente()
    const { state, nonce } = await iniciar(c)
    prepararIdToken(idTokenFalso(claimsBuenos({ sub: 'sub-1', email: org.usuarioEmail, nonce })))

    await callback(c, { code: 'codigo-a-canjear', state })

    const cuerpo = ultimoCanje()
    expect(cuerpo?.get('code_verifier')).toBeTruthy()
    expect(cuerpo?.get('code')).toBe('codigo-a-canjear')
    expect(cuerpo?.get('grant_type')).toBe('authorization_code')
    // El secreto va en el canje servidor-a-servidor, nunca por el navegador.
    expect(cuerpo?.get('client_secret')).toBeTruthy()
  })

  it('borra las tres cookies de un solo uso', async () => {
    // Vivas permitirían reintentar un callback con el mismo state.
    const c = new Cliente()
    const { state, nonce } = await iniciar(c)
    prepararIdToken(idTokenFalso(claimsBuenos({ sub: 'sub-1', email: org.usuarioEmail, nonce })))
    await callback(c, { code: 'x', state })
    expect(c.tieneCookie('g_state')).toBe(false)
    expect(c.tieneCookie('g_nonce')).toBe(false)
    expect(c.tieneCookie('g_verifier')).toBe(false)
  })

  it('la segunda vez entra por `sub`, sin duplicar vínculo ni bitácora', async () => {
    // El camino normal a partir de la primera vez. Que no crezca la bitácora
    // importa: se registra la VINCULACIÓN, no cada acceso, o el evento que
    // delata una toma de cuenta se ahogaría entre inicios de sesión normales.
    const c = new Cliente()
    const { state, nonce } = await iniciar(c)
    // Mismo `sub`, correo DISTINTO: en Google el correo puede cambiar y el
    // `sub` no. Debe resolver igual, por `sub`.
    prepararIdToken(
      idTokenFalso(claimsBuenos({ sub: 'sub-1', email: 'correo.nuevo@ejemplo.mx', nonce })),
    )

    const r = await callback(c, { code: 'otro', state })

    expect(r.status).toBe(302)
    expect(r.ubicacion).toContain('/inicio/')
    expect(await contarIdentidades()).toBe(1)
    expect(await vinculosEnBitacora()).toBe(1)
  })
})

// ─── 3. Lo que tiene que fallar ─────────────────────────────────────────────

describe('3 · Google NO da de alta', () => {
  it('un correo desconocido no entra y NO crea ningún usuario', async () => {
    const antes = await poolTest().query('select count(*)::int as n from usuarios')
    const c = new Cliente()
    const { state, nonce } = await iniciar(c)
    prepararIdToken(
      idTokenFalso(claimsBuenos({ sub: 'sub-desconocido', email: 'nadie@ejemplo.mx', nonce })),
    )

    const r = await callback(c, { code: 'x', state })

    expect(motivoDe(r.ubicacion)).toBe('no_registrado')
    expect(c.tieneCookie('spaces_sesion')).toBe(false)
    const despues = await poolTest().query('select count(*)::int as n from usuarios')
    expect(despues.rows[0].n).toBe(antes.rows[0].n)
  })

  it('un usuario desactivado no entra por Google', async () => {
    // Entrar por Google no puede ser un rodeo para saltarse una baja hecha en
    // Administración.
    await poolTest().query(
      `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
       values ('Baja','baja@goog.test','DUENO'::rol_demo,'x',false,$1)
       on conflict do nothing`,
      [org.id],
    )
    const c = new Cliente()
    const { state, nonce } = await iniciar(c)
    prepararIdToken(idTokenFalso(claimsBuenos({ sub: 'sub-baja', email: 'baja@goog.test', nonce })))

    const r = await callback(c, { code: 'x', state })

    expect(motivoDe(r.ubicacion)).toBe('inactivo')
    expect(c.tieneCookie('spaces_sesion')).toBe(false)
  })
})

describe('4 · state, nonce y PKCE — las protecciones del callback', () => {
  it('un state que no coincide con la cookie no abre sesión', async () => {
    // Sin esta comprobación el callback es un *login CSRF*: un atacante lanza
    // el flujo con SU cuenta y mete a la víctima dentro de ella.
    const c = new Cliente()
    const { nonce } = await iniciar(c)
    prepararIdToken(idTokenFalso(claimsBuenos({ sub: 'sub-x', email: org.usuarioEmail, nonce })))

    const r = await callback(c, { code: 'x', state: 'state-inventado-por-otro' })

    expect(motivoDe(r.ubicacion)).toBe('invalido')
    expect(c.tieneCookie('spaces_sesion')).toBe(false)
  })

  it('sin haber pasado por /inicio (sin cookies) no abre sesión', async () => {
    const c = new Cliente() // nunca llamó a /inicio
    const r = await callback(c, { code: 'x', state: 'cualquiera' })
    expect(motivoDe(r.ubicacion)).toBe('invalido')
    expect(c.tieneCookie('spaces_sesion')).toBe(false)
  })

  it('un nonce distinto del emitido no abre sesión (replay)', async () => {
    const c = new Cliente()
    const { state } = await iniciar(c)
    // Token perfectamente válido salvo por el nonce: es un token de OTRA
    // petición, reproducido aquí.
    prepararIdToken(
      idTokenFalso(claimsBuenos({ sub: 'sub-1', email: org.usuarioEmail, nonce: 'nonce-de-otra' })),
    )

    const r = await callback(c, { code: 'x', state })

    expect(motivoDe(r.ubicacion)).toBe('invalido')
    expect(c.tieneCookie('spaces_sesion')).toBe(false)
  })

  it('no se puede reutilizar el mismo state dos veces', async () => {
    const c = new Cliente()
    const { state, nonce } = await iniciar(c)
    prepararIdToken(idTokenFalso(claimsBuenos({ sub: 'sub-1', email: org.usuarioEmail, nonce })))
    await callback(c, { code: 'x', state })

    // Segundo intento con el mismo state: las cookies ya se borraron.
    prepararIdToken(idTokenFalso(claimsBuenos({ sub: 'sub-1', email: org.usuarioEmail, nonce })))
    const r = await callback(c, { code: 'x', state })
    expect(motivoDe(r.ubicacion)).toBe('invalido')
  })
})

describe('5 · claims que el callback debe rechazar', () => {
  it('email_verified false no entra — es LA barrera de la vinculación', async () => {
    // Al renunciar a GOOGLE_HD, esto es lo único que impide que alguien vincule
    // la cuenta de otro dándose de alta en Google con su correo.
    const c = new Cliente()
    const { state, nonce } = await iniciar(c)
    prepararIdToken(
      idTokenFalso({
        ...claimsBuenos({ sub: 'sub-sin-verificar', email: org.usuarioEmail, nonce }),
        email_verified: false,
      }),
    )

    const r = await callback(c, { code: 'x', state })

    expect(motivoDe(r.ubicacion)).toBe('invalido')
    expect(c.tieneCookie('spaces_sesion')).toBe(false)
  })

  it('un token emitido para OTRA aplicación no entra', async () => {
    const c = new Cliente()
    const { state, nonce } = await iniciar(c)
    prepararIdToken(
      idTokenFalso({
        ...claimsBuenos({ sub: 'sub-1', email: org.usuarioEmail, nonce }),
        aud: 'otra-app.apps.googleusercontent.com',
      }),
    )

    const r = await callback(c, { code: 'x', state })
    expect(motivoDe(r.ubicacion)).toBe('invalido')
    expect(c.tieneCookie('spaces_sesion')).toBe(false)
  })

  it('un token expirado no entra', async () => {
    const c = new Cliente()
    const { state, nonce } = await iniciar(c)
    prepararIdToken(
      idTokenFalso({
        ...claimsBuenos({ sub: 'sub-1', email: org.usuarioEmail, nonce }),
        exp: Math.floor(Date.now() / 1000) - 7200,
      }),
    )

    const r = await callback(c, { code: 'x', state })
    expect(motivoDe(r.ubicacion)).toBe('invalido')
  })
})

// ─── Alta de empresa con Google (ADR 0012 · enmienda del 07/08) ─────────────

describe('7 · crear empresa con Google', () => {
  // El servidor de pruebas arranca con NEXT_PUBLIC_AUTOREGISTRO=0, igual que
  // produccion. Eso hace que el caso importante aqui sea el NEGATIVO: que la
  // puerta nueva este tan cerrada como `/api/signup`.

  async function iniciarAlta(c: Cliente, organizacion: string) {
    return c.pedir(
      `/api/auth/google/inicio/?alta=1&organizacion=${encodeURIComponent(organizacion)}`,
    )
  }

  it('con el autorregistro APAGADO, el alta responde 503 igual que /api/signup', async () => {
    // Es la comprobacion que da sentido a toda la funcion: si esto pasara, se
    // habria reabierto por otra puerta el agujero que el interruptor cerro —y
    // el mismo despliegue sirve la demo publica y produccion sobre la misma
    // base.
    const r = await iniciarAlta(new Cliente(), 'Organizacion Nueva')
    expect(r.status).toBe(503)
  })

  it('y no deja la cookie del alta puesta al responder 503', async () => {
    const c = new Cliente()
    await iniciarAlta(c, 'Organizacion Nueva')
    expect(c.tieneCookie('g_alta_org')).toBe(false)
  })

  it('un «entrar» normal NO arrastra una cookie de alta anterior', async () => {
    // Sin borrarla, un intento de alta fallido dejaria la cookie viva y el
    // siguiente inicio de sesion crearia una organizacion que nadie pidio.
    const c = new Cliente()
    await iniciarAlta(c, 'Organizacion Nueva')
    await iniciar(c) // ahora entra, sin alta
    expect(c.tieneCookie('g_alta_org')).toBe(false)
  })

  it('un correo desconocido SIN cookie de alta sigue sin crear nada', async () => {
    const antesU = await poolTest().query('select count(*)::int as n from usuarios')
    const antesT = await poolTest().query('select count(*)::int as n from tenants')
    const c = new Cliente()
    const { state, nonce } = await iniciar(c)
    prepararIdToken(
      idTokenFalso(claimsBuenos({ sub: 'sub-sin-alta', email: 'sinalta@ejemplo.mx', nonce })),
    )

    const r = await callback(c, { code: 'x', state })

    expect(motivoDe(r.ubicacion)).toBe('no_registrado')
    const despuesU = await poolTest().query('select count(*)::int as n from usuarios')
    const despuesT = await poolTest().query('select count(*)::int as n from tenants')
    expect(despuesU.rows[0].n).toBe(antesU.rows[0].n)
    expect(despuesT.rows[0].n).toBe(antesT.rows[0].n)
  })
})

describe('6 · cuando Google falla', () => {
  it('un canje rechazado no abre sesión', async () => {
    const c = new Cliente()
    const { state } = await iniciar(c)
    prepararFallo(400)

    const r = await callback(c, { code: 'codigo-caducado', state })

    expect(motivoDe(r.ubicacion)).toBe('invalido')
    expect(c.tieneCookie('spaces_sesion')).toBe(false)
  })

  it('el usuario que cancela ve «cancelado», no un error de avería', async () => {
    const c = new Cliente()
    const { state } = await iniciar(c)
    const r = await callback(c, { error: 'access_denied', state })
    expect(motivoDe(r.ubicacion)).toBe('cancelado')
  })
})
