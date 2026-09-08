import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente, BASE } from './servidor-e2e'

// ============================================================================
//  La contraseña deja de ser una puerta, y aparece otra.  (ADR 0028 · B3)
// ----------------------------------------------------------------------------
//  Dos piezas que solo tienen sentido juntas:
//
//   · `usuarios.solo_google` cierra la entrada por contraseña. Es lo que retira
//     el riesgo que ROJO-1 y el defecto 22 atacaron dos veces sin quitar: una
//     contraseña que genera el operador, la ve en su pantalla y se le queda en
//     el historial.
//   · `POST /api/auth/codigo` es la puerta que queda para el día que el Dueño
//     pierda su cuenta de Google. **Sin ella, cerrar la de la contraseña dejaría
//     a cada Dueño con una sola llave** — que es justo lo que el ADR evita.
//
//  Casi todo lo de aquí es negativo, y una prueba manda sobre las demás: que un
//  código NO abra una cuenta desactivada. Un código es una llave, no un permiso.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('sologoogle')
  await arrancarServidor()
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

let ip = 60
async function entrarConPassword(email: string, password: string) {
  const r = await fetch(`${BASE}/api/auth/login/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.7.0.${ip++}` },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  })
  return { status: r.status, datos: await r.json().catch(() => ({})) }
}

async function entrarConCodigo(codigo: string) {
  const r = await fetch(`${BASE}/api/auth/codigo/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.7.1.${ip++}` },
    body: JSON.stringify({ codigo }),
    redirect: 'manual',
  })
  return { status: r.status, datos: await r.json().catch(() => ({})) }
}

async function fijar(campo: string, valor: unknown) {
  await poolTest().query(
    `update usuarios set ${campo} = $1 where lower(email) = lower($2)`,
    [valor, org.usuarioEmail],
  )
}

/** Genera un lote para el Dueño entrando primero de forma normal. */
async function unLote(): Promise<string[]> {
  await fijar('solo_google', false)
  await fijar('activo', true)
  const c = new Cliente()
  await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
  const r = await c.pedir('/api/perfil/codigos-recuperacion/', { cuerpo: {} })
  return r.datos.codigos as string[]
}

describe('el candado: solo_google', () => {
  it('con el candado puesto, la contraseña CORRECTA ya no entra', async () => {
    // Es el punto entero de B3. Si esto no cortara, la contraseña que el
    // operador vio en su pantalla seguiría abriendo la cuenta del cliente.
    await fijar('solo_google', true)
    const r = await entrarConPassword(org.usuarioEmail, PASSWORD_DEMO)
    expect(r.status).toBe(403)
    expect(JSON.stringify(r.datos).toLowerCase()).toContain('google')
  })

  it('y a quien NO sabe la contraseña no se le dice que la cuenta existe', async () => {
    // El mensaje del candado solo lo oye quien ya demostró tener la credencial.
    // Dárselo a cualquiera sería enumeración gratis: bastaría probar correos.
    await fijar('solo_google', true)
    const r = await entrarConPassword(org.usuarioEmail, 'ClaveEquivocada123')
    expect(r.status).toBe(401)
    expect(JSON.stringify(r.datos).toLowerCase()).not.toContain('google')
  })

  it('sin el candado, todo sigue exactamente como antes', async () => {
    await fijar('solo_google', false)
    const r = await entrarConPassword(org.usuarioEmail, PASSWORD_DEMO)
    expect(r.status).toBe(200)
  })

  it('nace apagado: la migración no deja fuera a nadie', async () => {
    // Encenderlo de golpe habría dejado fuera a todo el que no tenga Google
    // vinculado, incluido quien lo aplicara.
    const r = await poolTest().query('select count(*)::int as n from usuarios where solo_google')
    expect(r.rows[0].n).toBe(0)
  })
})

describe('la puerta que queda: entrar con un código', () => {
  it('un código válido abre sesión aunque el candado esté puesto', async () => {
    // Es la razón por la que B3 puede existir. Sin esto, cerrar la contraseña
    // dejaría al Dueño con Google como única llave.
    const codigos = await unLote()
    await fijar('solo_google', true)

    const r = await entrarConCodigo(codigos[0])
    expect(r.status).toBe(200)
    expect(r.datos.usuario.email.toLowerCase()).toBe(org.usuarioEmail.toLowerCase())
  })

  it('y le dice cuántos le quedan, para que no gaste el último sin enterarse', async () => {
    const codigos = await unLote()
    const r = await entrarConCodigo(codigos[0])
    expect(r.datos.codigosRestantes).toBe(9)
  })

  it('el MISMO código no vale una segunda vez', async () => {
    const codigos = await unLote()
    expect((await entrarConCodigo(codigos[0])).status).toBe(200)
    expect((await entrarConCodigo(codigos[0])).status).toBe(401)
  })

  it('uno inventado no entra, y dice lo MISMO que uno gastado', async () => {
    // Distinguirlos le diría a quien prueba a ciegas cuándo ha acertado un
    // código gastado — y con eso sabría que la cuenta existe y el formato vale.
    const codigos = await unLote()
    await entrarConCodigo(codigos[0])
    const gastado = await entrarConCodigo(codigos[0])
    const inventado = await entrarConCodigo('ABCDE-FGHJK-MNPQR')
    expect(gastado.status).toBe(inventado.status)
    expect(JSON.stringify(gastado.datos)).toBe(JSON.stringify(inventado.datos))
  })

  it('una cuenta DESACTIVADA no entra ni con código: es una llave, no un permiso', async () => {
    // Manda sobre las demás. Si a alguien se le retiró el acceso, se le retiró
    // por todas las puertas — y un código guardado de antes no puede devolvérselo.
    const codigos = await unLote()
    await fijar('activo', false)
    const r = await entrarConCodigo(codigos[1])
    expect(r.status).toBe(401)
    await fijar('activo', true)
  })

  it('sin código, o con basura, no pasa nada', async () => {
    expect((await entrarConCodigo('')).status).toBe(400)
    expect((await entrarConCodigo('!!!!')).status).toBe(401)
  })
})
