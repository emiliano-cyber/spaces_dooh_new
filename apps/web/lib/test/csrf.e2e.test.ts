import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { asegurarPermisos, sembrarTenant, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, BASE } from './servidor-e2e'

// ============================================================================
//  CSRF — reproducción del hallazgo SEC-01 de la auditoría del 2026-08-26.
// ----------------------------------------------------------------------------
//  La auditoría de caja negra sobre PRODUCCIÓN reportó, como crítico:
//
//      «POST /api/clientes/ sin token/cabecera CSRF → 201.
//       Existe cookie `spaces_csrf` pero el servidor no la exige.»
//
//  Este archivo NO discute el informe: reproduce esa llamada EXACTA contra el
//  código de la rama, con el mismo endpoint y la misma forma. El resultado es
//  el que es.
//
//  ─── Por qué hacía falta un archivo aparte ────────────────────────────────
//  Hasta el 2026-08-26 NINGUNA prueba comprobaba que una mutación sin CSRF se
//  rechazara. El `Cliente` de `servidor-e2e` siempre manda el token, así que
//  la protección estaba ejercitada pero nunca AFIRMADA: si alguien la hubiera
//  desactivado, las 234 pruebas e2e habrían seguido en verde.
//
//  ─── El detalle que decide el resultado, y que una prueba de caja negra no
//      puede ver ───────────────────────────────────────────────────────────
//  `middleware.ts` exige el CSRF solo `if (!exento && sesion)`. Sin cookie de
//  sesión NO hay credencial ambiental que proteger, así que deja pasar — y
//  entonces la ruta contesta 401 por su cuenta. Los dos casos de abajo separan
//  esas dos situaciones a propósito, porque confundirlas es la forma más fácil
//  de leer mal este resultado.
// ============================================================================

let galleta = ''

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  await sembrarTenant('csrf-prueba', { rol: 'DUENO' })
  await arrancarServidor()

  const r = await fetch(`${BASE}/api/auth/login/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.9.5.1' },
    body: JSON.stringify({ email: 'duenio@csrf-prueba.test', password: PASSWORD_DEMO }),
    redirect: 'manual',
  })
  if (r.status === 200) {
    for (const [n, v] of r.headers) {
      if (n.toLowerCase() !== 'set-cookie') continue
      for (const trozo of v.split(/,(?=\s*[^;=]+=)/)) {
        const par = trozo.trim().split(';')[0]
        if (par.includes('=')) galleta += (galleta ? '; ' : '') + par.trim()
      }
    }
  }
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

async function cuantosClientes(): Promise<number> {
  const r = await poolTest().query('select count(*)::int as n from clientes')
  return r.rows[0].n
}

const CUERPO = { nombre: 'Cliente sin CSRF', rfc: 'XAXX010101000', email: 'x@ejemplo.com' }

describe('SEC-01 · la llamada exacta que reporto la auditoria', () => {
  it('CON sesion y SIN cabecera CSRF, `POST /api/clientes/` NO crea nada', async () => {
    expect(galleta, 'la sesion de prueba no se abrio; el caso no probaria nada').toContain(
      'spaces_sesion=',
    )
    const antes = await cuantosClientes()

    const r = await fetch(`${BASE}/api/clientes/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: galleta, 'x-forwarded-for': '10.9.5.2' },
      body: JSON.stringify(CUERPO),
      redirect: 'manual',
    })

    // Lo que la auditoría reportó es un 201. Si esto falla con 201, el informe
    // tiene razón y hay un crítico de verdad.
    expect(r.status).toBe(403)
    expect(await cuantosClientes()).toBe(antes)
  })

  it('y con la cabecera correcta SI crea: el 403 viene del CSRF y no de otra cosa', async () => {
    // Sin esta mitad, un 403 por permisos, por sesión inválida o por una ruta
    // que ya no existe se leería como «el CSRF funciona».
    const tok = decodeURIComponent(/spaces_csrf=([^;]+)/.exec(galleta)?.[1] ?? '')
    expect(tok).not.toBe('')
    const antes = await cuantosClientes()

    const r = await fetch(`${BASE}/api/clientes/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: galleta,
        'x-csrf-token': tok,
        'x-forwarded-for': '10.9.5.3',
      },
      body: JSON.stringify({ ...CUERPO, nombre: 'Cliente con CSRF' }),
      redirect: 'manual',
    })

    expect(r.status).toBe(201)
    expect(await cuantosClientes()).toBe(antes + 1)
  })

  it('SIN sesion no da 403 sino 401, y tampoco crea nada', async () => {
    // Este caso existe para que nadie confunda las dos protecciones. El CSRF
    // protege una credencial AMBIENTAL: sin cookie de sesión no hay nada que
    // proteger y el middleware deja pasar, pero entonces contesta la ruta.
    //
    // Si una prueba de caja negra hiciera esta llamada y viera 201, ESO sí
    // sería catastrófico: alta sin autenticar.
    const antes = await cuantosClientes()

    const r = await fetch(`${BASE}/api/clientes/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.9.5.4' },
      body: JSON.stringify(CUERPO),
      redirect: 'manual',
    })

    expect(r.status).toBe(401)
    expect(await cuantosClientes()).toBe(antes)
  })
})
