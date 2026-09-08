import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest, URL_APP } from './db-e2e'
import { asegurarPermisos, sembrarTenant, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente, BASE } from './servidor-e2e'
import { opcionesDeProceso, vigilarErrores, esperarMuerte } from './proceso-e2e'
import { arrancarDoble, pararDoble, prepararIdToken, idTokenFalso, claimsBuenos } from './doble-google'
import { PUERTO_DOBLE } from './doble-google'

// `Cliente` no permite cabeceras propias y `servidor-e2e.ts` NO SE TOCA
// (invariante del proyecto), así que las llamadas al bootstrap van con `fetch`
// directo. No pierde nada: la ruta es pública y no usa cookies ni CSRF.
//
// Cada llamada manda una IP distinta para no compartir cubo con el limitador,
// igual que hace `Cliente` — sin eso, seis llamadas seguidas empiezan a recibir
// 429 y el fallo no diría nada del código que se prueba.
let contadorIp = 40
async function llamarBootstrap(opts: { token?: string; cuerpoPropio?: unknown } = {}) {
  const cabeceras: Record<string, string> = {
    'content-type': 'application/json',
    'x-forwarded-for': `10.9.0.${contadorIp++}`,
  }
  if (opts.token !== undefined) cabeceras['x-bootstrap-token'] = opts.token
  const r = await fetch(`${BASE}/api/bootstrap/`, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify(opts.cuerpoPropio ?? cuerpo()),
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

// Deja la base como si la instancia acabara de nacer. El orden NO es cosmetico
// y cada paso lo puso un rojo distinto:
//
//  1. `acciones` con TRUNCATE y no con DELETE. La bitacora es append-only
//     (`20260629_bitacora_append_only.sql`) y su disparador prohibe UPDATE y
//     DELETE por fila; TRUNCATE es de sentencia, asi que no lo dispara. Sin
//     esto, borrar un usuario intenta poner su `usuario_id` a null --un
//     UPDATE-- y la bitacora lo rechaza. Aparecio en cuanto el positivo empezo
//     a entrar con Google, porque vincular la cuenta se anota.
//  2. `identidades_externas` antes que `tenants`: apunta al tenant y la clave
//     foranea no deja borrarlo con la fila puesta.
//
// Se borra tabla por tabla y no con `cascade`: un `cascade` aqui se llevaria
// por delante lo que todavia no sabemos que cuelga de `tenants`.
async function vaciarTenants(): Promise<void> {
  await poolTest().query('truncate acciones')
  await poolTest().query('delete from identidades_externas')
  await poolTest().query('delete from usuarios')
  await poolTest().query('delete from tenants')
}

async function cuantosUsuarios(): Promise<number> {
  const r = await poolTest().query('select count(*)::int as n from usuarios')
  return r.rows[0].n
}


// A3.1 — SIN contraseña. El alta de una instancia ya no produce ninguna: el
// Dueño entra con Google y sus códigos de recuperación se los enseña la propia
// aplicación en su primera entrada (ADR 0028). Antes esto llevaba `password`, y
// esa contraseña la generaba el operador, la veía en su pantalla y se le quedaba
// en el historial.
function cuerpo() {
  return {
    organizacion: 'Instancia de un Owner',
    nombre: 'Duena del Owner',
    email: EMAIL,
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
    // El doble de Google, porque desde A3.1 la prueba de que el Dueño sirve es
    // que ENTRA, y entra por ahí. Va ANTES de `arrancarServidor()`: el arnés le
    // pasa `GOOGLE_TOKEN_ENDPOINT` al servidor cuando lo lanza.
    await arrancarDoble()
    // Desde B4 (ADR 0028) el bootstrap exige Google configurado. Estos casos
    // pasan igual porque `servidor-e2e.ts` ya lo enciende para toda la suite
    // (`GOOGLE_OAUTH: '1'` y las dos credenciales) -- y ese archivo NO SE TOCA.
    await arrancarServidor()
  }, 120_000)

  afterAll(async () => {
    await pararDoble()
  })

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

  it('con la base vacía y el token correcto crea la organización SIN contraseña', async () => {
    await vaciarTenants()
    const r = await llamarBootstrap({ token: TOKEN })

    expect(r.datos?.error).toBeUndefined()
    expect(r.status).toBe(201)
    expect(await cuantosTenants()).toBe(1)
  })

  it('y su Dueño entra CON GOOGLE, que es lo que demuestra que sirve', async () => {
    // Un 201 no demuestra nada: el hash lo produce una función y lo verifica
    // otra, y si divergieran el 201 seguiría saliendo verde con nadie capaz de
    // entrar. Hasta A3.1 esto se comprobaba entrando con la contraseña del
    // operador; ahora esa contraseña no existe, así que se comprueba por donde
    // el Dueño va a entrar de verdad.
    const c = new Cliente()
    const r0 = await c.pedir('/api/auth/google/inicio/')
    const destino = new URL(r0.ubicacion!)
    prepararIdToken(
      idTokenFalso(
        claimsBuenos({
          sub: 'sub-bootstrap',
          email: EMAIL,
          nonce: destino.searchParams.get('nonce')!,
        }),
      ),
    )
    const cb = await c.pedir(
      `/api/auth/google/callback/?code=codigo-bueno&state=${encodeURIComponent(destino.searchParams.get('state')!)}`,
    )
    expect(new URL(cb.ubicacion!).searchParams.get('google')).toBeNull()
    expect(c.tieneCookie('spaces_sesion')).toBe(true)
  })

  it('y NADIE puede entrar con contraseña, que es el riesgo que A3.1 retira', async () => {
    // El Dueño nace con un hash aleatorio que no conoce nadie (`passwordAleatoria`)
    // Y con el candado `solo_google`. Los dos hacen falta: el hash para que pueda
    // desbloquear los cambios de dinero el día que fije la suya, y el candado
    // para que fijarla no le abra la puerta de entrada.
    const c = new Cliente()
    const login = await c.pedir('/api/auth/login/', { cuerpo: { email: EMAIL, password: PASSWORD } })
    expect(login.status).not.toBe(200)
  })

  it('el Dueño nace con hash, con solo_google y obligado a poner el suyo', async () => {
    // Las tres columnas juntas, y ninguna sobra:
    //
    //  · `password_hash` NO NULO. Un usuario sin hash queda ENCERRADO: no puede
    //    desbloquear dinero ni cambiar su perfil, y la única salida le pide algo
    //    que nunca tuvo. Es el estado terminal que describe `auth.ts:48-62`.
    //  · `solo_google` en true: la contraseña no abre la puerta.
    //  · `debe_cambiar_password` en true: es lo que le deja fijar la SUYA sin
    //    teclear la anterior (ADR 0018) -- y sin eso no podría desbloquear
    //    nunca los cambios de dinero, porque la aleatoria no la sabe.
    const { rows } = await poolTest().query(
      'select email, password_hash, solo_google, debe_cambiar_password from usuarios',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].email).toBe(EMAIL.toLowerCase())
    expect(rows[0].password_hash, 'sin hash el Dueno queda encerrado').toBeTruthy()
    expect(rows[0].solo_google, 'el Dueno de una instancia entra solo con Google').toBe(true)
    expect(rows[0].debe_cambiar_password, 'sin esto no puede llegar a tener contrasena propia').toBe(true)
  })

  it('y si alguien manda una contraseña, se RECHAZA en vez de ignorarla', async () => {
    // Una tarjeta vieja sigue mandando `password`. Ignorarla en silencio sería
    // lo peor de los dos mundos: el operador vería una clave impresa en su
    // pantalla y creería haberla entregado, cuando la cuenta nace con otra.
    // Falla, y el mensaje dice qué hacer.
    await vaciarTenants()
    await poolTest().query('delete from usuarios')
    const r = await llamarBootstrap({
      token: TOKEN,
      cuerpoPropio: { ...cuerpo(), password: PASSWORD },
    })
    expect(r.status).toBe(400)
    expect(JSON.stringify(r.datos).toLowerCase()).toContain('google')
    expect(await cuantosTenants()).toBe(0)
    expect(await cuantosUsuarios()).toBe(0)
  })

  it('y una SEGUNDA llamada ya no crea nada: es de un solo uso', async () => {
    // El caso anterior dejó la base vacía a propósito (rechaza y no crea), así
    // que aquí se vuelve a crear una para tener de verdad la segunda llamada.
    await vaciarTenants()
    await poolTest().query('delete from usuarios')
    expect((await llamarBootstrap({ token: TOKEN })).status).toBe(201)
    expect(await cuantosTenants()).toBe(1)

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
    // Una sesión real, y ya no la del Dueño del arranque: desde A3.1 ese Dueño
    // nace `solo_google` y su contraseña NO abre la puerta -- que es el punto de
    // A3.1, no un efecto colateral. Lo que este bloque necesita es una sesión
    // cualquiera para comprobar el CSRF, así que se siembra una organización
    // normal. Usar la del arranque ataba esta prueba a CÓMO nace un Dueño, que
    // es justo lo que cambió debajo de ella.
    const org = await sembrarTenant('csrf-boot')
    const r = await fetch(`${BASE}/api/auth/login/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.9.1.1' },
      body: JSON.stringify({ email: org.usuarioEmail, password: PASSWORD_DEMO }),
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

// ─── 4 · Google es obligatorio: B4 del Plan_Acceso_Duenos (ADR 0028) ────────
//
//  El ADR 0028 decide que el Dueno de una instancia entra SOLO con Google. Si
//  una instancia naciera sin Google configurado, su Dueno **no podria entrar
//  nunca**: no tendria contrasena que valiera y no habria proveedor. Y la puerta
//  es de un solo uso, asi que el error seria definitivo.
//
//  ─── Por que estos casos levantan SU PROPIO servidor ───────────────────────
//  Hicieron falta dos intentos antes de dar con esto, y los dos fallos valen:
//
//   1. Apagar Google desde el entorno NO llega al servidor del arnes:
//      `servidor-e2e.ts` fija `GOOGLE_OAUTH: '1'` y las dos credenciales
//      DESPUES del `...process.env`. Y ese archivo no se toca.
//   2. Importar el handler en este proceso REVIENTA: `tenant.ts` usa `cache()`
//      de React y `cookies()` de `next/headers`, que solo existen dentro del
//      runtime de Next. Sale `TypeError: cache is not a function`.
//
//  Asi que se levanta un `next start` propio, en otro puerto y con Google
//  apagado. El invariante del proyecto es NO MODIFICAR `servidor-e2e.ts`, no
//  «no levantar nunca un servidor»: este arranca aqui, se para aqui, y no toca
//  nada de nadie.
describe('B4 · sin Google configurado, el bootstrap NO crea nada', () => {
  // ─── El puerto: 3313, y NO 3312 ─────────────────────────────────────────
  // Este archivo estrenó el 3312 el 07/09 sin ver que ya era el del doble de
  // Google (`doble-google.ts:21`). Con un solo archivo usando el doble no se
  // notó: `google-oauth` corre ANTES que éste y encontraba el puerto libre.
  // En cuanto apareció un segundo archivo con doble (`primer-dia-dueno`), CI
  // murió con «El puerto 3312 ya está ocupado» — y el mensaje mandaba a buscar
  // un doble suelto que nadie había arrancado.
  //
  // La comprobación de abajo es lo que impide que esto vuelva: si alguien mueve
  // el puerto del doble encima de éste, falla AQUÍ, con el motivo escrito, en
  // vez de en un archivo ajeno once ficheros después.
  const PUERTO_SIN_GOOGLE = 3313
  // Con el `basePath: '/spaces-dooh'` de `next.config.mjs`. Sin el, TODO da 404
  // --incluida `/api/version/`-- y el fallo parece del cerrojo del token. Costo
  // un rato: el aviso de `next start` sobre `output: standalone` que sale por
  // stderr es RUIDO, no la causa; el arnes usa el mismo `next start` y funciona.
  const BASE_SIN_GOOGLE = `http://127.0.0.1:${PUERTO_SIN_GOOGLE}/spaces-dooh`
  let proc: import('node:child_process').ChildProcess | null = null

  if (PUERTO_SIN_GOOGLE === PUERTO_DOBLE) {
    throw new Error(
      `El servidor sin Google y el doble de Google piden el mismo puerto (${PUERTO_DOBLE}). ` +
        'Mueve uno de los dos: compartirlo hace fallar al archivo que corra segundo.',
    )
  }

  let ipB4 = 200
  async function llamar() {
    const r = await fetch(`${BASE_SIN_GOOGLE}/api/bootstrap/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bootstrap-token': TOKEN,
        'x-forwarded-for': `10.9.1.${ipB4++}`,
      },
      body: JSON.stringify(cuerpo()),
      redirect: 'manual',
    })
    return { status: r.status, datos: await r.json().catch(() => ({})) }
  }

  beforeAll(async () => {
    // El del arnes tambien: el ultimo caso lo necesita, y `arrancarServidor()`
    // es idempotente. No se da por hecho que un bloque anterior lo dejara vivo.
    process.env.BOOTSTRAP_TOKEN = TOKEN
    await arrancarServidor()

    const { spawn } = await import('node:child_process')
    proc = spawn('npx', ['next', 'start', '-p', String(PUERTO_SIN_GOOGLE)], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        // El rol de la APP, no el administrador: con el administrador la RLS no
        // se aplica y el aislamiento no se estaria probando.
        DATABASE_URL: URL_APP,
        NODE_ENV: 'production',
        COOKIE_SECURE: '0',
        BOOTSTRAP_TOKEN: TOKEN,
        // Google APAGADO por los dos lados. `next start` lee los `.env` del
        // repo, pero NO pisa lo que ya viene en el entorno -- y `''` viene.
        GOOGLE_OAUTH: '0',
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_SECRET: '',
      },
      stdio: 'ignore',
      // La plataforma decide en `proceso-e2e.ts`, y NO se escribe aqui en linea.
      // Escrita en linea es como estaba, y le faltaba `detached` -- el mismo
      // fallo que `servidor-e2e.ts:93-95` ya habia encontrado y extraido aqui
      // para que no se repitiera. Sin `detached` el hijo no lidera su grupo, asi
      // que en Linux `process.kill(-pid)` se va en ESRCH y el `next start`
      // SOBREVIVE con el puerto tomado: eso es lo que dejo el 3312 ocupado
      // durante los once archivos siguientes en CI. En Windows no se veia porque
      // alli el arbol lo baja `taskkill /F /T`.
      ...opcionesDeProceso(),
    })
    // Un evento `error` sin manejador es excepcion no capturada, y vitest la
    // cuenta como fallo de la corrida aunque todo este en verde.
    vigilarErrores(proc)

    // Se espera a que conteste; sin esto el primer caso mide un puerto muerto.
    const limite = Date.now() + 60_000
    for (;;) {
      try {
        await fetch(`${BASE_SIN_GOOGLE}/api/version/`, { redirect: 'manual' })
        break
      } catch {
        if (Date.now() > limite) throw new Error('el servidor sin Google no respondio en 60 s')
        await new Promise((r) => setTimeout(r, 500))
      }
    }
  }, 120_000)

  afterAll(async () => {
    if (!proc?.pid) return
    const muriendo = proc
    const pid = proc.pid
    proc = null
    if (process.platform === 'win32') {
      const { spawnSync } = await import('node:child_process')
      spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore' })
    } else {
      // Al GRUPO, no al proceso. `spawn` lanza `npx`, y `npx` lanza al `next`
      // de verdad: la senal al pid solo mata al envoltorio y deja vivo al que
      // tiene el puerto. Con `detached` el hijo lidera su grupo, y por eso
      // `-pid` alcanza a los dos.
      try {
        process.kill(-pid, 'SIGTERM')
      } catch {
        try { process.kill(pid, 'SIGTERM') } catch { /* ya murio */ }
      }
    }
    // Mandar la senal no es estar muerto. Sin esperar, el archivo siguiente
    // puede pedir el puerto antes de que este lo suelte.
    await esperarMuerte(muriendo)
  })

  it('devuelve 503 y NO 404: el operador tiene que saber que le falta', async () => {
    // Los otros tres cerrojos callan con 404 para no confirmar que la ruta
    // existe. Este no: a este punto ya se presento el token correcto sobre una
    // base vacia. Un 404 mudo mandaria a buscar «una organizacion que ya
    // existe» cuando lo que falta es una variable -- el defecto 33 otra vez.
    await vaciarTenants()
    await poolTest().query('delete from usuarios')
    const r = await llamar()
    expect(r.status).toBe(503)
    expect(r.status).not.toBe(404)
  })

  it('y no crea NI la organizacion NI el usuario -- ni la mitad', async () => {
    // Lo unico que de verdad importa. Una instancia con organizacion y sin
    // Dueno es PEOR que una sin nada: el cerrojo de un solo uso ya estaria
    // gastado y nadie podria arrancarla nunca.
    await vaciarTenants()
    await poolTest().query('delete from usuarios')
    await llamar()
    expect(await cuantosTenants()).toBe(0)
    expect(await cuantosUsuarios()).toBe(0)
  })

  it('el mensaje dice QUE falta, no solo que fallo', async () => {
    await vaciarTenants()
    await poolTest().query('delete from usuarios')
    const r = await llamar()
    const texto = JSON.stringify(r.datos).toLowerCase()
    expect(texto).toContain('google')
    expect(texto).toContain('google_client_id')
  })

  it('y la puerta NO se gasta: el servidor CON Google sigue pudiendo arrancarla', async () => {
    // Si el intento sin Google hubiera dejado rastro en `tenants`, el cerrojo de
    // un solo uso quedaria consumido y la instancia seria irrecuperable. Se
    // comprueba contra el servidor del arnes, que SI tiene Google.
    await vaciarTenants()
    await poolTest().query('delete from usuarios')
    expect((await llamar()).status).toBe(503)

    const r = await llamarBootstrap({ token: TOKEN })
    expect(r.status).toBe(201)
    expect(await cuantosTenants()).toBe(1)
  })
})
