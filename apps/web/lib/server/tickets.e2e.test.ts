import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, poolTest, cerrarPool } from '@/lib/test/db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from '@/lib/test/semillas-e2e'
import { arrancarServidor, pararServidor, Cliente, BASE } from '@/lib/test/servidor-e2e'

// ============================================================================
//  ANTES DE AÑADIR OTRO `arrancarServidor()` AQUI: LEE ESTO.
// ----------------------------------------------------------------------------
//  Este archivo hace TRES ciclos de servidor. Los otros 32 archivos e2e hacen
//  uno (y `bootstrap.e2e.test.ts`, tres). Cada ciclo de mas no cuesta tiempo:
//  cuesta una CARRERA, y la carrera ya se cobro un CI en rojo sobre `main`.
//
//  Como es la carrera, medida el 2026-09-23 sobre el runner de CI:
//
//    1. `arrancarServidor()` (servidor-e2e.ts:30) sondea `/login/` y vuelve en
//       cuanto ALGO contesta con un status > 0. No comprueba QUIEN contesta.
//    2. `pararServidor()` (servidor-e2e.ts:119) manda la senal al grupo y
//       espera a que muera el ENVOLTORIO `npx`, con techo de 5 s
//       (proceso-e2e.ts:esperarMuerte, que al agotarse devuelve 'timeout' y
//       sigue). El `next start` de dentro puede seguir escuchando un instante.
//    3. Resultado de encadenar 2 y 3: el sondeo del arranque nuevo saluda al
//       servidor VIEJO que todavia agoniza y vuelve sin error; el `next start`
//       nuevo no consigue el puerto y muere; el viejo termina de morir; y
//       entonces no escucha NADIE. El `beforeAll` ya habia vuelto en verde, asi
//       que el fallo sale mucho despues y disfrazado:
//
//         TypeError: fetch failed  ...  connect ECONNREFUSED 127.0.0.1:3311
//
//  Por eso lo que se arreglo NO fue el arnes —`servidor-e2e.ts` es el
//  invariante 7 y no se toca— sino el NUMERO DE REINICIOS: de cuatro ciclos a
//  tres, y de tres transiciones parar→arrancar a UNA SOLA, la del ultimo
//  bloque, que cambia de entorno y por eso no se puede evitar.
//
//  Los dos bloques del panel (GET y PATCH) COMPARTEN servidor: mismo entorno,
//  cada uno siembra lo suyo. Si necesitas otro escenario, siembralo dentro de
//  un bloque que ya exista antes que arrancar un cuarto servidor.
// ============================================================================

describe('tabla tickets', () => {
  beforeAll(async () => { await recrearEsquema() })

  it('existe, tiene tenant_id y RLS encendida', async () => {
    const p = poolTest()
    const { rows } = await p.query(
      `select relrowsecurity from pg_class where relname = 'tickets'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].relrowsecurity).toBe(true)
  })

  it('tiene la politica tenant_isolation', async () => {
    const p = poolTest()
    const { rows } = await p.query(
      `select policyname from pg_policies where tablename = 'tickets'`,
    )
    expect(rows.map((r) => r.policyname)).toContain('tenant_isolation')
  })
})

// ============================================================================
//  Tarea 5 · GET/POST /api/tickets — la ruta del CLIENTE.
// ----------------------------------------------------------------------------
//  El aislamiento entre organizaciones se demuestra aquí, por HTTP, y no en las
//  unitarias del repo/controlador: las unitarias simulan la base y ya se han
//  visto pasar con la RLS rota (vault/06-Operacion/zonas-de-riesgo.md, R2).
// ============================================================================
describe('GET/POST /api/tickets — la ruta del cliente', () => {
  let alfa: Awaited<ReturnType<typeof sembrarTenant>>
  let beta: Awaited<ReturnType<typeof sembrarTenant>>
  let cAlfa: Cliente
  let cBeta: Cliente

  beforeAll(async () => {
    await recrearEsquema()
    await asegurarPermisos()
    alfa = await sembrarTenant('tka')
    beta = await sembrarTenant('tkb')
    // COMERCIAL no tiene el módulo `administracion` en absoluto
    // (semillas-e2e.ts:asegurarPermisos) — es el escenario real para el 403,
    // no uno supuesto.
    await sembrarTenant('tkc', { rol: 'COMERCIAL' })

    await arrancarServidor()
    cAlfa = new Cliente()
    cBeta = new Cliente()
    await cAlfa.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
    await cBeta.entrar(beta.usuarioEmail, PASSWORD_DEMO)
  }, 180_000)

  afterAll(async () => {
    await pararServidor()
    await cerrarPool()
  })

  it('un tenant NO ve los tickets del otro', async () => {
    const altaAlfa = await cAlfa.pedir('/api/tickets/', {
      cuerpo: { asunto: 'Solo de alfa', cuerpo: 'El detalle del problema de alfa' },
    })
    expect(altaAlfa.status, JSON.stringify(altaAlfa.datos)).toBe(201)

    const altaBeta = await cBeta.pedir('/api/tickets/', {
      cuerpo: { asunto: 'Solo de beta', cuerpo: 'El detalle del problema de beta' },
    })
    expect(altaBeta.status, JSON.stringify(altaBeta.datos)).toBe(201)

    const listaAlfa = await cAlfa.pedir('/api/tickets/')
    const listaBeta = await cBeta.pedir('/api/tickets/')
    expect(listaAlfa.status).toBe(200)
    expect(listaBeta.status).toBe(200)

    const asuntosAlfa = (listaAlfa.datos as Array<{ asunto: string }>).map((t) => t.asunto)
    const asuntosBeta = (listaBeta.datos as Array<{ asunto: string }>).map((t) => t.asunto)
    expect(asuntosAlfa).toContain('Solo de alfa')
    expect(asuntosAlfa).not.toContain('Solo de beta')
    expect(asuntosBeta).toContain('Solo de beta')
    expect(asuntosBeta).not.toContain('Solo de alfa')

    // Ningún ticket del cliente lleva `tenantId`: ya sabe de quién es
    // (tickets-repo.ts:36, filaATicket).
    expect(listaAlfa.datos[0]).not.toHaveProperty('tenantId')
  })

  it('sin sesion da 401', async () => {
    const anonimo = new Cliente()
    const r = await anonimo.pedir('/api/tickets/')
    expect(r.status).toBe(401)
  })

  it('sin permiso de administracion da 403', async () => {
    const comercial = new Cliente()
    await comercial.entrar('duenio@tkc.test', PASSWORD_DEMO)
    const r = await comercial.pedir('/api/tickets/')
    expect(r.status).toBe(403)
  })
})

// ============================================================================
//  Tarea 6 · GET /api/tickets con `x-flota-token` — la ruta del PANEL.
// ----------------------------------------------------------------------------
//  Esta es la mitad peligrosa del par que el ADR 0038 exige: la del cliente
//  AÍSLA (arriba) y la del panel ATRAVIESA (aquí). Una sola de las dos no
//  demuestra nada — un guard roto pasaría la primera sin despeinarse, y el modo
//  de fallo de R2 no da error: devuelve datos de más, en silencio.
//
//  Se pide con `fetch` crudo y no con `Cliente`, que es el tarro de cookies de
//  una sesión: el panel NO tiene sesión, su credencial es la cabecera. Es el
//  mismo patrón que `version.e2e.test.ts`, la otra ruta tras `FLOTA_TOKEN`.
// ============================================================================

// Token de PRUEBA, inventado aquí. Ningún valor real vive en un archivo
// versionado (restricción 10 del encargo).
const TOKEN_FLOTA = 'token-de-flota-para-pruebas-t6'

// Las claves EXACTAS del contrato que fija el plan y que consume
// `apps/flota/tickets.mjs`. Se afirman una a una, no por la ausencia de unas
// cuantas: el día que el repo gane una columna, esta prueba se pone roja en vez
// de dejar que el campo nuevo se cuele hasta el PADRE.
const CLAVES_DEL_CONTRATO = [
  'id',
  'folio',
  'tenant_id',
  'asunto',
  'cuerpo',
  'estado',
  'prioridad',
  'creado_en',
  'respuesta',
  'respondido_en',
]

const ASUNTO_PRIMERA = 'Falla la pantalla de la primera'
const ASUNTO_SEGUNDA = 'Falla el reporte de la segunda'

// Cada petición con su IP: los limitadores van por IP, y un fichero con muchas
// peticiones empezaría a recibir 429 por un motivo que no es el que se prueba.
let contadorIpPanel = 40
async function pedirAlPanel(opts: { token?: string } = {}) {
  const cabeceras: Record<string, string> = { 'x-forwarded-for': `10.9.6.${contadorIpPanel++}` }
  if (opts.token !== undefined) cabeceras['x-flota-token'] = opts.token
  const r = await fetch(`${BASE}/api/tickets/`, { headers: cabeceras, redirect: 'manual' })
  const texto = await r.text()
  let datos: any = null
  try { datos = texto ? JSON.parse(texto) : null } catch { datos = texto }
  return { status: r.status, datos, texto }
}

describe('GET /api/tickets — la ruta del panel', () => {
  let primera: Awaited<ReturnType<typeof sembrarTenant>>
  let segunda: Awaited<ReturnType<typeof sembrarTenant>>

  beforeAll(async () => {
    await recrearEsquema()
    await asegurarPermisos()
    primera = await sembrarTenant('tkpa')
    segunda = await sembrarTenant('tkpb')

    // El token se pone ANTES de arrancar: `arrancarServidor()` hereda
    // `process.env` al hacer `spawn`, así que ponerlo después no llegaría al
    // proceso que contesta.
    process.env.FLOTA_TOKEN = TOKEN_FLOTA
    await arrancarServidor()

    // Los tickets se abren por la puerta del CLIENTE, con sesión, que es como
    // nacen de verdad. Sembrarlos con SQL directo probaría la lectura contra
    // filas que la aplicación nunca escribió.
    const cPrimera = new Cliente()
    const cSegunda = new Cliente()
    await cPrimera.entrar(primera.usuarioEmail, PASSWORD_DEMO)
    await cSegunda.entrar(segunda.usuarioEmail, PASSWORD_DEMO)
    for (const [cliente, asunto] of [
      [cPrimera, ASUNTO_PRIMERA],
      [cSegunda, ASUNTO_SEGUNDA],
    ] as const) {
      const alta = await cliente.pedir('/api/tickets/', {
        cuerpo: { asunto, cuerpo: `El detalle de ${asunto.toLowerCase()}` },
      })
      if (alta.status !== 201) {
        throw new Error(
          `No se pudo sembrar el ticket «${asunto}»: ${alta.status} ${JSON.stringify(alta.datos)}`,
        )
      }
    }
  }, 180_000)

  // A PROPOSITO no hay `afterAll` con `pararServidor()`: el bloque del PATCH
  // que viene justo debajo corre sobre ESTE MISMO servidor y lo apaga el. Ver
  // el recuadro de los ciclos al principio del archivo.

  it('con x-flota-token correcto, devuelve tickets de TODOS los tenants', async () => {
    const r = await pedirAlPanel({ token: TOKEN_FLOTA })

    expect(r.status, r.texto).toBe(200)
    const tickets = r.datos.tickets as Array<Record<string, any>>
    expect(Array.isArray(tickets)).toBe(true)

    // Lo que ninguna prueba del lado del cliente puede afirmar: las DOS
    // organizaciones en la misma respuesta.
    const asuntos = tickets.map((t) => t.asunto)
    expect(asuntos).toContain(ASUNTO_PRIMERA)
    expect(asuntos).toContain(ASUNTO_SEGUNDA)

    // Y con su `tenant_id`, que es lo que le permite al panel agrupar por
    // organización sin aprender de quién es (ADR 0038 §4).
    const tenants = new Set(tickets.map((t) => t.tenant_id))
    expect(tenants.has(primera.id)).toBe(true)
    expect(tenants.has(segunda.id)).toBe(true)
  })

  it('con x-flota-token incorrecto, NO devuelve nada de otro tenant', async () => {
    const r = await pedirAlPanel({ token: 'este-no-es-el-token-de-flota' })

    // Cae al camino de sesión, y sin sesión eso es 401. Lo que se prohíbe es
    // que un token equivocado abra la bandeja de la instancia entera.
    expect(r.status).toBe(401)
    expect(r.datos).not.toHaveProperty('tickets')
    expect(r.texto).not.toContain(ASUNTO_PRIMERA)
    expect(r.texto).not.toContain(ASUNTO_SEGUNDA)

    // Con el token vacío, igual: una cadena vacía no es «cualquier token vale».
    const vacio = await pedirAlPanel({ token: '' })
    expect(vacio.status).toBe(401)
    expect(vacio.texto).not.toContain(ASUNTO_PRIMERA)
    expect(vacio.texto).not.toContain(ASUNTO_SEGUNDA)
  })

  it('la respuesta del panel no trae el nombre de ninguna organizacion', async () => {
    const r = await pedirAlPanel({ token: TOKEN_FLOTA })

    expect(r.status, r.texto).toBe(200)
    // El cuerpo de primer nivel es EXACTAMENTE `{ tickets: [...] }`.
    expect(Object.keys(r.datos).sort()).toEqual(['tickets'])

    const tickets = r.datos.tickets as Array<Record<string, any>>
    expect(tickets.length).toBeGreaterThan(0)
    for (const t of tickets) {
      // Claves EXACTAS: ni `creado_por_usuario`, ni `actualizado_en`, ni nada
      // de `tenants`. La lista blanca del route es lo que sostiene esto.
      expect(Object.keys(t).sort()).toEqual([...CLAVES_DEL_CONTRATO].sort())
    }

    // Y el caso que de verdad importa: la base TIENE organizaciones con nombre
    // y con slug. Si alguno se colara en el cuerpo, aquí se ve.
    const orgs = await poolTest().query('select slug, nombre from tenants')
    expect(orgs.rows.length).toBeGreaterThan(0)
    for (const o of orgs.rows) {
      expect(r.texto).not.toContain(o.slug)
      expect(r.texto).not.toContain(o.nombre)
    }
  })
  // ────────────────────────────────────────────────────────────────────────
  //  EL HUECO QUE LA TAREA 6 DECLARO SIN MEDIR, y era el que mas importaba de
  //  los que quedaban: un usuario con SESION VALIDA que ademas manda un token
  //  de flota inventado.
  //
  //  Por que importa: si `esElPanel()` mirara la sesion ademas del token -o si
  //  alguien lo "mejorara" asi algun dia-, cualquier usuario de la instancia
  //  veria los tickets de TODAS las organizaciones. Que hoy no pase era
  //  LECTURA DEL CODIGO; esto lo convierte en medicion.
  //
  //  Se hace con `fetch` crudo porque `Cliente` no sabe mandar cabeceras extra
  //  y `servidor-e2e.ts` no se toca (invariante 7). No hacia falta tocarlo:
  //  `BASE` esta exportado y el login es un POST normal.
  it('sesion valida MAS un token inventado sigue viendo solo lo suyo', async () => {
    const login = await fetch(`${BASE}/api/auth/login/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': `10.9.7.${contadorIpPanel++}`,
      },
      body: JSON.stringify({ email: primera.usuarioEmail, password: PASSWORD_DEMO }),
      redirect: 'manual',
    })
    expect(login.status, await login.clone().text()).toBe(200)

    const cookie = [...login.headers]
      .filter(([n]) => n.toLowerCase() === 'set-cookie')
      .flatMap(([, v]) => v.split(/,(?=\s*[^;=]+=)/))
      .map((t) => t.trim().split(';')[0])
      .join('; ')
    expect(cookie).not.toBe('')

    const r = await fetch(`${BASE}/api/tickets/`, {
      headers: {
        cookie,
        'x-flota-token': 'este-token-no-vale-nada',
        'x-forwarded-for': `10.9.7.${contadorIpPanel++}`,
      },
      redirect: 'manual',
    })
    const texto = await r.text()
    expect(r.status, texto).toBe(200)

    // Cae al camino de SESION: lista cruda, no el `{tickets:[...]}` del panel.
    const datos = JSON.parse(texto)
    expect(Array.isArray(datos), texto).toBe(true)
    const asuntos = (datos as Array<Record<string, any>>).map((t) => t.asunto)
    expect(asuntos).toContain(ASUNTO_PRIMERA)
    expect(asuntos, 'un token inventado le abrio los tickets de la otra organizacion').not.toContain(
      ASUNTO_SEGUNDA,
    )
  })
})

// ============================================================================
//  Tarea 11 · PATCH /api/tickets — la ruta del panel: responder y mover el
//  estado, ADR 0038.
// ----------------------------------------------------------------------------
//  Mismo patrón que el GET de arriba: `fetch` crudo, porque el panel no tiene
//  sesión y su credencial es la cabecera. Las dos pruebas que el encargo pide
//  explícitamente llevan su nombre citado; las demás cierran huecos vecinos
//  que el propio encargo señala — sobre todo el punto 3: responder NO mueve
//  el estado por su cuenta, y viceversa.
//
//  COMPARTE EL SERVIDOR con el bloque del GET de arriba, y no es por ahorrar
//  segundos: es el mismo entorno (`FLOTA_TOKEN` puesto) y cada reinicio de más
//  es una carrera de menos — ver el recuadro de los ciclos al principio del
//  archivo. Por eso aquí no hay `recrearEsquema()` ni `arrancarServidor()`:
//  `tkpatch` se siembra SOBRE el esquema que el bloque de arriba dejó montado.
// ============================================================================
describe('PATCH /api/tickets — la ruta del panel (Tarea 11)', () => {
  let tenant: Awaited<ReturnType<typeof sembrarTenant>>
  let idTicket: string

  beforeAll(async () => {
    // Sin `recrearEsquema()`: borraría los tickets de `tkpa`/`tkpb` y, sobre
    // todo, obligaría a reiniciar el servidor. `sembrarTenant` crea una
    // organización nueva con su propio slug, así que convive con las de arriba
    // sin pisarlas; el PATCH siempre apunta a `idTicket`, nunca a una lista.
    tenant = await sembrarTenant('tkpatch')

    // El ticket nace por la puerta del CLIENTE, con sesión, como en la vida
    // real: sembrarlo con SQL directo probaría un PATCH contra una fila que
    // la aplicación nunca escribió.
    const cliente = new Cliente()
    await cliente.entrar(tenant.usuarioEmail, PASSWORD_DEMO)
    const alta = await cliente.pedir('/api/tickets/', {
      cuerpo: { asunto: 'No prende la pantalla del lobby', cuerpo: 'Se apagó anoche y no volvió.' },
    })
    if (alta.status !== 201) {
      throw new Error(`No se pudo sembrar el ticket para el PATCH: ${alta.status} ${JSON.stringify(alta.datos)}`)
    }
    idTicket = (alta.datos as { id: string }).id
  }, 180_000)

  // El `pararServidor()` de los DOS bloques del panel vive aquí, en el último.
  // El pool NO se cierra: lo usa el bloque que viene detrás.
  afterAll(async () => {
    await pararServidor()
  })

  async function patchAlPanel(cuerpo: unknown, opts: { token?: string } = {}) {
    const cabeceras: Record<string, string> = {
      'content-type': 'application/json',
      'x-forwarded-for': `10.9.8.${contadorIpPanel++}`,
    }
    if (opts.token !== undefined) cabeceras['x-flota-token'] = opts.token
    const r = await fetch(`${BASE}/api/tickets/`, {
      method: 'PATCH',
      headers: cabeceras,
      body: JSON.stringify(cuerpo),
      redirect: 'manual',
    })
    const texto = await r.text()
    let datos: any = null
    try { datos = texto ? JSON.parse(texto) : null } catch { datos = texto }
    return { status: r.status, datos, texto }
  }

  async function filaDelTicket() {
    const { rows } = await poolTest().query(
      'select estado, respuesta, respondido_en, actualizado_en from tickets where id = $1',
      [idTicket],
    )
    return rows[0]
  }

  it('PATCH sin x-flota-token NO cambia nada', async () => {
    const antes = await filaDelTicket()
    expect(antes.estado).toBe('ABIERTO')
    expect(antes.respuesta).toBeNull()

    const r = await patchAlPanel({ id: idTicket, estado: 'RESUELTO' })
    // Cae al camino de sesión de la ruta (`esElPanel` es fail-closed sin
    // token), y un PATCH sin sesión tampoco tiene camino: 401.
    expect(r.status, r.texto).toBe(401)

    const despues = await filaDelTicket()
    expect(despues.estado, 'un PATCH sin token movió el estado').toBe('ABIERTO')
    expect(despues.respuesta, 'un PATCH sin token escribió una respuesta').toBeNull()
  })

  it('PATCH con x-flota-token mueve el estado a RESUELTO', async () => {
    const r = await patchAlPanel({ id: idTicket, estado: 'RESUELTO' }, { token: TOKEN_FLOTA })

    expect(r.status, r.texto).toBe(200)
    expect(r.datos.estado).toBe('RESUELTO')
    // Mover el estado no responde por su cuenta: sin `respuesta` en el
    // cuerpo, `respuesta`/`respondido_en` se quedan intactos.
    expect(r.datos.respuesta).toBeNull()
    expect(r.datos.respondido_en).toBeNull()

    const fila = await filaDelTicket()
    expect(fila.estado).toBe('RESUELTO')
    expect(fila.respuesta).toBeNull()
    expect(fila.respondido_en).toBeNull()
  })

  it('PATCH con respuesta fija respondido_en y NO mueve el estado por su cuenta', async () => {
    // Parte de RESUELTO (lo dejó la prueba anterior) a propósito: si
    // responder moviera el estado, aquí se vería un valor distinto de
    // RESUELTO sin que nadie lo haya pedido.
    const r = await patchAlPanel({ id: idTicket, respuesta: 'Se cambió el driver de video.' }, { token: TOKEN_FLOTA })

    expect(r.status, r.texto).toBe(200)
    expect(r.datos.respuesta).toBe('Se cambió el driver de video.')
    expect(r.datos.respondido_en).not.toBeNull()
    expect(r.datos.estado, 'responder movió el estado sin que nadie lo pidiera').toBe('RESUELTO')

    const fila = await filaDelTicket()
    expect(fila.respuesta).toBe('Se cambió el driver de video.')
    expect(fila.respondido_en).not.toBeNull()
    expect(fila.estado).toBe('RESUELTO')
  })

  it('PATCH vacío (sin respuesta ni estado) da 400 y no toca el ticket', async () => {
    const antes = await filaDelTicket()
    const r = await patchAlPanel({ id: idTicket }, { token: TOKEN_FLOTA })
    expect(r.status, r.texto).toBe(400)
    const despues = await filaDelTicket()
    expect(despues.actualizado_en).toEqual(antes.actualizado_en)
  })

  it('PATCH a un id inexistente da 404', async () => {
    const r = await patchAlPanel(
      { id: '00000000-0000-0000-0000-000000000000', estado: 'CERRADO' },
      { token: TOKEN_FLOTA },
    )
    expect(r.status, r.texto).toBe(404)
  })

  it('la respuesta del PATCH lleva las mismas claves EXACTAS que el contrato del GET', async () => {
    const r = await patchAlPanel({ id: idTicket, estado: 'CERRADO' }, { token: TOKEN_FLOTA })
    expect(r.status, r.texto).toBe(200)
    expect(Object.keys(r.datos).sort()).toEqual([...CLAVES_DEL_CONTRATO].sort())
  })
})

// ============================================================================
//  EL ÚLTIMO DEL ARCHIVO, y no por orden de lectura: es el único bloque que
//  necesita un entorno distinto, así que dejándolo al final el archivo entero
//  tiene UN SOLO parar→arrancar, y ocurre cuando ya no queda nada detrás.
//  Si alguien lo sube en el archivo, vuelve a meter reinicios en medio.
// ============================================================================
describe('GET /api/tickets — sin FLOTA_TOKEN configurado', () => {
  beforeAll(async () => {
    // El servidor se reinicia SIN la variable: es la única forma de probar
    // «ausente = cerrado», porque el proceso la lee de su propio entorno.
    await pararServidor()
    delete process.env.FLOTA_TOKEN
    await arrancarServidor()
  }, 180_000)

  afterAll(async () => {
    await pararServidor()
    await cerrarPool()
  })

  it('sin FLOTA_TOKEN configurado, el token no abre nada', async () => {
    // Se manda el MISMO token que arriba abría la puerta. Sin la variable en el
    // servidor no abre ninguna: un `.env` que se quedó corto no puede dejar la
    // bandeja de la instancia al alcance de cualquiera que adivine una cadena.
    const r = await pedirAlPanel({ token: TOKEN_FLOTA })

    expect(r.status).toBe(401)
    expect(r.datos).not.toHaveProperty('tickets')
    expect(r.texto).not.toContain(ASUNTO_PRIMERA)
    expect(r.texto).not.toContain(ASUNTO_SEGUNDA)
  })

})
