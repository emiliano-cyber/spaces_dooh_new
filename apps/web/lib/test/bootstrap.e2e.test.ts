import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { asegurarPermisos } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente, BASE } from './servidor-e2e'

// `Cliente` no permite cabeceras propias y `servidor-e2e.ts` NO SE TOCA
// (invariante del proyecto), así que las llamadas al bootstrap van con `fetch`
// directo. No pierde nada: la ruta es pública y no usa cookies ni CSRF.
//
// Cada llamada manda una IP distinta para no compartir cubo con el limitador,
// igual que hace `Cliente` — sin eso, seis llamadas seguidas empiezan a recibir
// 429 y el fallo no diría nada del código que se prueba.
let contadorIp = 40
async function llamarBootstrap(opts: { token?: string } = {}) {
  const cabeceras: Record<string, string> = {
    'content-type': 'application/json',
    'x-forwarded-for': `10.9.0.${contadorIp++}`,
  }
  if (opts.token !== undefined) cabeceras['x-bootstrap-token'] = opts.token
  const r = await fetch(`${BASE}/api/bootstrap/`, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify(cuerpo()),
    redirect: 'manual',
  })
  const datos = await r.json().catch(() => ({}))
  return { status: r.status, datos }
}

// ============================================================================
//  F5.2 — el alta inicial de una instancia: de un solo uso y con token.
//
//  Es una ruta PÚBLICA nueva en el artefacto de TODA la flota. Cada instancia
//  de cada owner la lleva dentro. Por eso las tres condiciones —token, base
//  vacía y límite por IP— y por eso de los cuatro casos, TRES SON NEGATIVOS.
//
//  ─── Por qué 404 y no 401 ─────────────────────────────────────────────────
//  Un 401 confirmaría que la ruta existe, y con ella que la instancia se
//  aprovisiona por ahí. El 404 no dice nada: en una instancia ya montada tiene
//  que ser indistinguible de una ruta que no existe.
//
//  ─── Por qué el positivo INICIA SESIÓN de verdad ──────────────────────────
//  Comprobar que devuelve 201 no demuestra que el Dueño sirva. El hash lo
//  produce `hashPassword` y lo verifica el login; si algún día divergen, un 201
//  seguiría saliendo verde y nadie podría entrar. La prueba entra por la API
//  real.
// ============================================================================

const TOKEN = 'token-de-arranque-para-pruebas-f52'
const EMAIL = 'duena-arranque@ejemplo.com'
const PASSWORD = 'UnaClaveLarga123'

async function cuantosTenants(): Promise<number> {
  const r = await poolTest().query('select count(*)::int as n from tenants')
  return r.rows[0].n
}

async function vaciarTenants(): Promise<void> {
  await poolTest().query('delete from tenants')
}

function cuerpo() {
  return {
    organizacion: 'Instancia de un Owner',
    nombre: 'Duena del Owner',
    email: EMAIL,
    password: PASSWORD,
  }
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

// ─── 1 · Sin BOOTSTRAP_TOKEN en el entorno: la ruta NACE APAGADA ────────────
describe('F5.2 · sin token configurado, la ruta no existe', () => {
  beforeAll(async () => {
    await pararServidor()
    delete process.env.BOOTSTRAP_TOKEN
    await arrancarServidor()
  }, 120_000)

  it('devuelve 404 aunque la base esté vacía y se mande un token', async () => {
    await vaciarTenants()
    const r = await llamarBootstrap({ token: TOKEN })

    expect(r.status).toBe(404)
    expect(await cuantosTenants()).toBe(0)
  })
})

// ─── 2 · Con el token configurado ───────────────────────────────────────────
describe('F5.2 · con token configurado', () => {
  beforeAll(async () => {
    await pararServidor()
    process.env.BOOTSTRAP_TOKEN = TOKEN
    await arrancarServidor()
  }, 120_000)

  it('con una organización YA existente devuelve 404 y no crea nada', async () => {
    // `recrearEsquema()` siembra `rgb` (`db-e2e.ts:157`), así que basta con
    // volver a montarlo. Es el caso de una instancia ya aprovisionada.
    await vaciarTenants()
    await poolTest().query("insert into tenants (nombre, slug) values ('Ya existe','ya-existe')")

    const r = await llamarBootstrap({ token: TOKEN })

    expect(r.status).toBe(404)
    expect(await cuantosTenants()).toBe(1)
  })

  it('SIN token devuelve 404 y no crea nada', async () => {
    await vaciarTenants()
    const r = await llamarBootstrap()

    expect(r.status).toBe(404)
    expect(await cuantosTenants()).toBe(0)
  })

  it('con un token EQUIVOCADO devuelve 404 y no crea nada', async () => {
    await vaciarTenants()
    const r = await llamarBootstrap({ token: 'token-que-no-es' })

    expect(r.status).toBe(404)
    expect(await cuantosTenants()).toBe(0)
  })

  it('con la base vacía y el token correcto crea la organización, y su Dueño PUEDE ENTRAR', async () => {
    await vaciarTenants()
    const r = await llamarBootstrap({ token: TOKEN })

    expect(r.datos?.error).toBeUndefined()
    expect(r.status).toBe(201)
    expect(await cuantosTenants()).toBe(1)

    // Lo que de verdad demuestra que sirve: entrar por la API real.
    const c2 = new Cliente()
    const login = await c2.pedir('/api/auth/login/', { cuerpo: { email: EMAIL, password: PASSWORD } })
    expect(login.status).toBe(200)
  })

  it('y una SEGUNDA llamada ya no crea nada: es de un solo uso', async () => {
    // Estado heredado de la prueba anterior: ya hay una organización.
    const antes = await cuantosTenants()
    expect(antes).toBe(1)

    const r = await llamarBootstrap({ token: TOKEN })

    expect(r.status).toBe(404)
    expect(await cuantosTenants()).toBe(1)
  })
})
