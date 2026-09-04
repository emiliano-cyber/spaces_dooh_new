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

  it('y el Dueno nace OBLIGADO a cambiar la contrasena que le genero el operador', async () => {
    // ROJO medido el 2026-09-04 EN EL ENSAYO DE F5.6, contra una instancia real:
    //
    //   $ psql -tAc 'select email, debe_cambiar_password from usuarios'
    //   emistreg@gmail.com|f
    //
    //  El Dueno de una instancia nace con una contrasena que GENERA EL OPERADOR
    //  y que se imprime en su consola. Sin esta marca esa contrasena vale para
    //  siempre: queda en el historial de quien hizo el alta y nadie obliga a
    //  cambiarla nunca.
    //
    //  Lo que hacia falso creer que estaba cubierto: `alta-instancia.e2e.test.ts`
    //  afirma «nace OBLIGADO a cambiarla» y pasa en verde -- pero prueba
    //  `bootstrap-auth.mjs`, el arranque del PADRE, que es OTRO camino. El alta
    //  de una instancia va por esta ruta, y `usuarios-repo.ts` no tocaba la
    //  columna, asi que se quedaba en su `default false`
    //  (`20260804_reautenticacion_individual.sql:35`).
    //
    //  Se distinguen a simple vista por la contrasena: el camino del PADRE
    //  genera `XXXX-XXXX-XXXX-XXXX`; esta ruta, 64 hexadecimales.
    //
    //  El mecanismo que lo hace efectivo ya existia y no se toca: `exigir()`
    //  corta con 403 mientras la marca este puesta.
    //
    // Estado heredado de la prueba anterior: la organizacion se acaba de crear.
    const { rows } = await poolTest().query('select email, debe_cambiar_password from usuarios')
    expect(rows).toHaveLength(1)
    expect(rows[0].email).toBe(EMAIL.toLowerCase())
    expect(rows[0].debe_cambiar_password, 'el Dueno nacio SIN obligacion de cambiar la clave').toBe(true)
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

// ─── 3 · La exención de CSRF, acotada ───────────────────────────────────────
//
// F5.2 añade `/api/bootstrap` a la cadena de exentos de CSRF en
// `middleware.ts`. Esa cadena protege TODAS las mutaciones autenticadas de la
// aplicación, y hasta hoy NINGUNA prueba comprobaba que rechace lo que debe
// rechazar: el `Cliente` de `servidor-e2e` siempre manda el token, así que un
// `||` de más habría dejado la puerta abierta con las 225 e2e en verde.
//
// Las dos pruebas se necesitan MUTUAMENTE: la primera demuestra que la
// exención funciona, la segunda que no se derramó al resto.
describe('F5.2 · la exencion de CSRF no se derrama', () => {
  let galleta = ''

  beforeAll(async () => {
    // Sesión real del Dueño creado por el arranque (describe anterior).
    const r = await fetch(`${BASE}/api/auth/login/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.9.1.1' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      redirect: 'manual',
    })
    expect(r.status).toBe(200)
    for (const [n, v] of r.headers) {
      if (n.toLowerCase() !== 'set-cookie') continue
      for (const trozo of v.split(/,(?=\s*[^;=]+=)/)) {
        const par = trozo.trim().split(';')[0]
        if (par.includes('=')) galleta += (galleta ? '; ' : '') + par.trim()
      }
    }
    expect(galleta).toContain('spaces_sesion=')
  }, 60_000)

  it('una mutacion autenticada SIN el token CSRF sigue recibiendo 403', async () => {
    const r = await fetch(`${BASE}/api/perfil/`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: galleta, 'x-forwarded-for': '10.9.1.2' },
      body: JSON.stringify({ nombre: 'Intento sin CSRF' }),
      redirect: 'manual',
    })
    expect(r.status).toBe(403)

    // Y que ese 403 viene del CSRF y no de otra cosa: la MISMA peticion, con el
    // token correcto, deja de darlo. Sin esta segunda mitad, un 403 por permisos
    // o por sesion invalida se leeria como «el CSRF funciona».
    const tok = decodeURIComponent(/spaces_csrf=([^;]+)/.exec(galleta)?.[1] ?? '')
    expect(tok).not.toBe('')
    const ok = await fetch(`${BASE}/api/perfil/`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: galleta,
        'x-csrf-token': tok,
        'x-forwarded-for': '10.9.1.2',
      },
      body: JSON.stringify({ nombre: 'Intento con CSRF' }),
      redirect: 'manual',
    })
    expect(ok.status).not.toBe(403)
  })

  it('y `/api/bootstrap` SI esta exenta: con sesion y sin CSRF no da 403', async () => {
    // Devuelve 404 —la base ya no está vacía—, y ese 404 es justo la prueba:
    // sin la exención, el middleware habría cortado con 403 antes de llegar.
    const r = await fetch(`${BASE}/api/bootstrap/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: galleta,
        'x-bootstrap-token': TOKEN,
        'x-forwarded-for': '10.9.1.3',
      },
      body: JSON.stringify(cuerpo()),
      redirect: 'manual',
    })
    expect(r.status).not.toBe(403)
    expect(r.status).toBe(404)
  })
})
