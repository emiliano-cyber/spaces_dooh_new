import { describe, it, expect } from 'vitest'
// @ts-expect-error — módulo .mjs sin tipos, como el resto de `apps/flota`
import { manejar, escapar, RUTAS, resumenDeAlta } from './servidor.mjs'

// ============================================================================
//  El servidor del panel de flota (ADR 0026).
//
//  `manejar()` devuelve `{status, cabeceras, cuerpo}` en vez de escribir en un
//  socket: asi se prueba entera la decision de cada peticion sin levantar nada.
//
//  Lo que esta pantalla enseña es LA LISTA DE CLIENTES CON SUS DOMINIOS, que es
//  justo lo que el modelo de instancias soberanas protege. Por eso la mayoria de
//  estas pruebas comprueban que NO sale.
// ============================================================================

const FILAS = [
  { nombre: 'pixeled', dominio: 'space-os.pixeled.mx', canal: 'estable', version: 'v0.3.0', estado: 'al-dia', fecha: '2026-09-04T10:00:00Z', origen: 'consulta' },
  { nombre: 'sankofa', dominio: 'inventario.sankofa.mx', canal: 'estable', version: '—', estado: 'sin-respuesta', fecha: '—', origen: 'consulta' },
]

/** Dependencias de mentira; apuntan si se las llamo. */
function deps(opciones: any = {}) {
  const registro: any[] = []
  let consultas = 0
  return {
    registro,
    get consultas() {
      return consultas
    },
    d: {
      verificar: async () => opciones.acceso ?? { permitido: true, usuario: { email: 'jefa@asnetwork.io' } },
      obtenerFilas: async () => {
        consultas++
        return opciones.filas ?? FILAS
      },
      registrar: (e: any) => registro.push(e),
    },
  }
}

describe('sin permiso no sale ni un dominio', () => {
  it('sin cookie responde 401', async () => {
    const { d } = deps({ acceso: { permitido: false, motivo: 'sin cookie de sesion' } })
    const r = await manejar({ metodo: 'GET', ruta: '/flota/', cookie: undefined }, d)
    expect(r.status).toBe(401)
  })

  it('y el cuerpo del 401 NO filtra la flota', async () => {
    // Un 401 que enseñe la tabla seria peor que no tener panel.
    const { d } = deps({ acceso: { permitido: false, motivo: 'sin permiso administracion:ver' } })
    const r = await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, d)
    expect(r.status).toBe(401)
    for (const fila of FILAS) {
      expect(r.cuerpo).not.toContain(fila.dominio)
      expect(r.cuerpo).not.toContain(fila.nombre)
    }
  })

  it('ni siquiera se consulta a las instancias cuando se deniega', async () => {
    // Denegar tiene que ser barato y silencioso: no hay por que ir a tocar los
    // servidores de los clientes para acabar contestando 401.
    const dd = deps({ acceso: { permitido: false, motivo: 'sin sesion' } })
    await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, dd.d)
    expect(dd.consultas).toBe(0)
  })

  it('el motivo del rechazo NO se le cuenta al visitante', async () => {
    // Distinguir «sin sesion» de «sin permiso» le dice a quien prueba si acerto
    // con la cookie. Al registro si va; a la respuesta no.
    const { d } = deps({ acceso: { permitido: false, motivo: 'sin permiso administracion:ver' } })
    const r = await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, d)
    expect(r.cuerpo).not.toMatch(/administracion|permiso|sesion/i)
  })
})

describe('con permiso, la tabla', () => {
  it('responde 200 y trae las siete columnas', async () => {
    const { d } = deps()
    const r = await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, d)
    expect(r.status).toBe(200)
    for (const col of ['nombre', 'dominio', 'canal', 'version', 'estado', 'fecha', 'origen']) {
      expect(r.cuerpo.toLowerCase()).toContain(col)
    }
  })

  it('y las instancias, con su estado', async () => {
    const { d } = deps()
    const r = await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, d)
    expect(r.cuerpo).toContain('space-os.pixeled.mx')
    expect(r.cuerpo).toContain('sin-respuesta')
  })

  it('no se cachea en ningun sitio', async () => {
    // La flota cambia sola. Una tabla cacheada dice que todo va bien cuando ya
    // no va bien, que es la peor forma de fallar de un panel de estado.
    const { d } = deps()
    const r = await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, d)
    expect(r.cabeceras['cache-control']).toMatch(/no-store/)
  })

  it('sirve tanto /flota/ como / (nginx puede recortar el prefijo)', async () => {
    const { d } = deps()
    for (const ruta of RUTAS) {
      const r = await manejar({ metodo: 'GET', ruta, cookie: 'spaces_sesion=x' }, d)
      expect(r.status, ruta).toBe(200)
    }
  })
})

describe('lo que llega de una instancia es TEXTO AJENO', () => {
  it('un nombre con etiquetas no sale crudo', async () => {
    // `/api/version` lo contesta el servidor de un owner. Si un dia devuelve
    // algo con `<script>`, esta pantalla NO es el sitio donde se ejecuta.
    const { d } = deps({
      filas: [{ ...FILAS[0], nombre: '<script>alert(1)</script>', dominio: 'a"b\'c<d>' }],
    })
    const r = await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, d)
    expect(r.cuerpo).not.toContain('<script>alert(1)</script>')
    expect(r.cuerpo).toContain('&lt;script&gt;')
  })

  it('escapar() cubre los cinco de siempre', () => {
    expect(escapar('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#39;')
    expect(escapar(null)).toBe('')
    expect(escapar(3)).toBe('3')
  })
})

describe('queda constancia de quien mira', () => {
  it('cada acceso concedido se registra con el correo', async () => {
    // Deuda anotada en el ADR 0026: por SSH quedaba rastro, y publicarlo por web
    // lo quitaba. Aqui se repone.
    const dd = deps()
    await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, dd.d)
    expect(dd.registro).toHaveLength(1)
    expect(dd.registro[0].usuario).toBe('jefa@asnetwork.io')
    expect(dd.registro[0].permitido).toBe(true)
  })

  it('y los rechazados tambien, con su motivo', async () => {
    const dd = deps({ acceso: { permitido: false, motivo: 'sin permiso administracion:ver' } })
    await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, dd.d)
    expect(dd.registro).toHaveLength(1)
    expect(dd.registro[0].permitido).toBe(false)
    expect(dd.registro[0].motivo).toMatch(/permiso/)
  })
})

describe('todo lo demas', () => {
  it('una ruta que no existe es 404, y no consulta nada', async () => {
    const dd = deps()
    const r = await manejar({ metodo: 'GET', ruta: '/flota/secreto', cookie: 'spaces_sesion=x' }, dd.d)
    expect(r.status).toBe(404)
    expect(dd.consultas).toBe(0)
  })

  it('solo se sirve GET', async () => {
    const { d } = deps()
    const r = await manejar({ metodo: 'POST', ruta: '/flota/', cookie: 'spaces_sesion=x' }, d)
    expect(r.status).toBe(405)
  })
})

// @ts-expect-error — módulo .mjs sin tipos
import { filasDeLaFlota, consultarConToken } from './servidor.mjs'

describe('la costura entre el panel y estado.mjs', () => {
  // Los dos fallos que esto atrapa se midieron EN PRODUCCION el 2026-09-04, con
  // el panel ya publicado, porque las pruebas de arriba inyectan `obtenerFilas`
  // y nunca tocaban el cableado de verdad. La leccion es la de siempre aqui:
  // probar la decision y dejar sin probar la union es como no probar.
  //
  //  1. `leerReportes()` devuelve `{reportes, avisos}`, NO una lista. Pasarle el
  //     objeto a `fusionar()` daba «reportes is not iterable» -- ruidoso, se ve.
  //  2. `cargarInventario()` devuelve `canales`, no `versiones`. Leer la clave
  //     que no es daba `undefined`, y con eso `clasificar()` marca REZAGADA a
  //     TODA la flota aunque este al dia. Ese no se ve: miente en silencio.
  //
  //  Los dobles de aqui devuelven las MISMAS formas que los de verdad. Si esas
  //  formas cambian, esta prueba se cae, que es justo para lo que esta.

  const inventarioFalso = async () => ({
    archivo: 'flota.json',
    esEjemplo: false,
    canales: { estable: 'v0.3.0', beta: 'v0.3.0' },
    instancias: [{ nombre: 'demo', dominio: 'demo.invalid', canal: 'beta' }],
  })

  it('no se rompe con lo que leerReportes() devuelve de verdad', async () => {
    const filas = await filasDeLaFlota({
      dirEstado: '/lo/que/sea',
      cargar: inventarioFalso,
      consultarUna: async (i: any) => ({ ...i, version: 'v0.3.0', fecha: '2026-09-04T00:00:00Z' }),
      leer: async () => ({ reportes: [], avisos: [] }),
    })
    expect(filas).toHaveLength(1)
  })

  it('una instancia que corre la version de su canal sale AL DIA, no rezagada', async () => {
    const filas = await filasDeLaFlota({
      dirEstado: undefined,
      cargar: inventarioFalso,
      consultarUna: async (i: any) => ({ ...i, version: 'v0.3.0', fecha: '2026-09-04T00:00:00Z' }),
      leer: async () => ({ reportes: [], avisos: [] }),
    })
    expect(filas[0].estado, 'si sale rezagada, se esta leyendo mal el inventario').toBe('al-dia')
  })

  it('y una que corre otra version, rezagada', async () => {
    const filas = await filasDeLaFlota({
      cargar: inventarioFalso,
      consultarUna: async (i: any) => ({ ...i, version: 'v0.2.0', fecha: '2026-09-04T00:00:00Z' }),
      leer: async () => ({ reportes: [], avisos: [] }),
    })
    expect(filas[0].estado).toBe('rezagada')
  })
})

describe('la consulta lleva su token, o la flota entera miente', () => {
  it('manda `x-flota-token` con el token de ESA instancia', async () => {
    // El tercer fallo del 2026-09-04, y el unico que no daba error: se llamaba
    // a `consultar()` pelado. Sin token, `/api/version` contesta `{ok:true}` y
    // nada mas, asi que la instancia sale `sin-respuesta` -- exactamente igual
    // que si estuviera caida. Una flota entera en rojo por una cabecera que
    // falta es de lo peor que puede hacer un panel de estado.
    process.env.FLOTA_TOKEN_DEMO = 'tok-de-demo'
    let vistas: any = null
    await consultarConToken(
      { nombre: 'demo', dominio: 'demo.invalid', canal: 'beta' },
      {
        pedir: async (_u: string, o: any) => {
          vistas = o.headers
          return { ok: true, status: 200, json: async () => ({ ok: true, version: 'v0.3.0' }) }
        },
      },
    )
    expect(vistas?.['x-flota-token']).toBe('tok-de-demo')
    delete process.env.FLOTA_TOKEN_DEMO
  })

  it('y lo lee del ARCHIVO, no solo del entorno', async () => {
    // El cuarto fallo del mismo sitio, medido en el PADRE el 2026-09-08: el CLI
    // (`estado.mjs`) enseñaba `ensayo4 v0.3.0 rezagada` y el panel web, la misma
    // fila, `sin-respuesta`. Mismo usuario, misma maquina, distinto resultado.
    //
    // La causa: `servidor.mjs` llamaba `tokenDe(nombre)` sin el tercer
    // argumento, asi que leia el entorno y NUNCA
    // `/etc/space-os/flota-tokens.env`. O sea que el unico componente que no
    // leia ese archivo era EL PANEL -- que es para quien se creo (TH-FLOTA).
    //
    // La prueba de al lado no lo vio porque pone la variable en el entorno, que
    // es el camino que SI funcionaba. Esta usa solo el archivo, a proposito.
    let cabeceras: any = null
    const soloDemo = async () => ({
      archivo: 'flota.json',
      esEjemplo: false,
      canales: { beta: 'v0.3.0' },
      instancias: [{ nombre: 'demo', dominio: 'demo.invalid', canal: 'beta' }],
    })
    await filasDeLaFlota({
      cargar: soloDemo,
      leerTokens: async () => ({ FLOTA_TOKEN_DEMO: 'del-archivo' }),
      consultarUna: (i: any, o: any) =>
        consultarConToken(i, {
          ...o,
          pedir: async (_u: string, op: any) => {
            cabeceras = op.headers
            return { ok: true, status: 200, json: async () => ({ ok: true, version: 'v0.3.0' }) }
          },
        }),
      leer: async () => ({ reportes: [], avisos: [] }),
    })
    expect(cabeceras?.['x-flota-token'], 'el panel no leyo el archivo de tokens').toBe('del-archivo')
  })
})

// ============================================================================
//  Que cuenta el panel de cada alta.  (A2.4, ADR 0029)
// ----------------------------------------------------------------------------
//  Con la maquina de estados hay CINCO sitios donde pararse en vez de dos, y esa
//  es la consecuencia negativa que el ADR declara. Se paga aqui: el nombre del
//  estado no le dice a nadie que hacer, y el resumen si.
// ============================================================================
describe('el resumen de un alta, en la pantalla', () => {
  it('esperando DNS dice a QUIEN se espera, que es lo unico accionable', () => {
    const t = resumenDeAlta({ estado: 'esperando-dns', ip: '203.0.113.1' })
    expect(t).toMatch(/DNS/i)
    expect(t).toMatch(/owner|apunt/i)
  })

  it('si el DNS apunta a OTRA IP lo dice, porque eso no se arregla solo', () => {
    // Es el caso que nadie miraria: la fila parece que «espera», y en realidad
    // esta mal apuntada y va a esperar para siempre.
    const t = resumenDeAlta({ estado: 'esperando-dns', ip: '203.0.113.1', dnsOtraIp: '198.51.100.9' })
    expect(t).toContain('198.51.100.9')
    expect(t).toMatch(/otra/i)
  })

  it('emitiendo el certificado dice por que intento va', () => {
    const t = resumenDeAlta({ estado: 'emitiendo-cert', intentos: 2 })
    expect(t).toContain('2')
    expect(t).toMatch(/3/)
  })

  it('cert-agotado dice CLARAMENTE que espera a una persona', () => {
    // Si esto no lo dijera, la fila se quedaria ahi para siempre sin que nadie
    // supiera que le toca a un humano.
    const t = resumenDeAlta({ estado: 'cert-agotado', intentos: 3 })
    expect(t).toMatch(/persona/i)
  })

  it('lista avisa de que TODAVIA falta la primera empresa', () => {
    // «lista» a secas se lee como «terminada», y no lo esta.
    const t = resumenDeAlta({ estado: 'lista' })
    expect(t).toMatch(/empresa|organizacion|organizaci/i)
  })

  it('una fallida enseña su motivo, no solo la palabra fallida', () => {
    const t = resumenDeAlta({ estado: 'fallida', historial: [{ estado: 'fallida', codigo: 1 }] })
    expect(t).toMatch(/1/)
  })

  it('y si alguna comprobacion salio rara, lo dice', () => {
    const t = resumenDeAlta({ estado: 'lista', comprobaciones: { login: 200, signup: 200, 'login-post': 401 } })
    expect(t).toMatch(/signup/)
  })

  it('un estado desconocido no revienta la pantalla', () => {
    expect(typeof resumenDeAlta({ estado: 'lo-que-sea' })).toBe('string')
    expect(typeof resumenDeAlta({})).toBe('string')
  })
})

import { pagina } from './servidor.mjs'

// ============================================================================
//  El panel WEB nunca vio el motivo: `resumen()` lo calculaba y lo tiraba, y
//  solo el terminal lo imprimia (aparte, debajo de la tabla). Estas pruebas
//  fijan las tres decisiones de la sub-fila.
// ============================================================================
// ============================================================================
//  La pantalla de tickets (T9, ADR 0038): la red y el HTML. La logica de
//  conteo (`filasDeTickets`, T8) ya esta probada en tickets.test.ts y no se
//  recuenta aqui.
//
//  Dos cosas manda comprobar el ADR y el encargo:
//   1. El texto del ticket lo escribe un TERCERO -- el dueño de la instancia --
//      y se pinta en el panel de AS OOH: es XSS con un cliente como atacante.
//   2. Una instancia MUDA (sin-respuesta) no puede verse igual que una sana sin
//      tickets: la primera trae pendientes/total en `null`, la segunda en `0`,
//      y la pantalla tiene que pintarlas distinto.
// ============================================================================
import { paginaTickets, fechaLegible, RUTAS_TICKETS } from './servidor.mjs'
import { OK, SIN_RESPUESTA } from './tickets.mjs'

function ticket(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'id-1',
    folio: 'TK-2026-0001',
    tenant_id: 'a1b2c3d4-0000-0000-0000-000000000001',
    asunto: 'la pantalla de reportes no carga',
    cuerpo: 'al abrir /reportes se queda en blanco',
    estado: 'ABIERTO',
    prioridad: 'NORMAL',
    creado_en: '2026-09-20T10:00:00.000Z',
    respuesta: null,
    respondido_en: null,
    ...over,
  }
}

/** Dependencias de mentira para la ruta de tickets; apuntan si se las llamo. */
function depsTickets(opciones: any = {}) {
  const registro: any[] = []
  let consultas = 0
  const llamadasContestar: any[] = []
  return {
    registro,
    llamadasContestar,
    get consultas() {
      return consultas
    },
    d: {
      verificar: async () => opciones.acceso ?? { permitido: true, usuario: { email: 'jefa@asnetwork.io' } },
      obtenerRespuestasTickets: async () => {
        consultas++
        return opciones.respuestas ?? []
      },
      registrar: (e: any) => registro.push(e),
      // El PATCH de verdad (con `x-flota-token`) se prueba aparte, contra
      // `contestarTicket()` real -- ver «el POST contesta a la instancia».
      // Aqui es un doble para probar el CABLEADO del formulario del panel.
      contestarTicket: async (instancia: any, cambios: any) => {
        llamadasContestar.push({ instancia, cambios })
        return opciones.resultadoContestar ?? { ok: true }
      },
      origenEsperado: opciones.origenEsperado ?? ORIGEN_TICKETS,
    },
  }
}

const ORIGEN_TICKETS = 'https://space-os.io'
const CSRF_TICKETS = 'csrf-tickets-1'

const postTicket = (cuerpo: any, extra: any = {}) => ({
  metodo: 'POST',
  ruta: '/flota/tickets/',
  cookie: `spaces_sesion=s; flota_csrf=${CSRF_TICKETS}`,
  origen: ORIGEN_TICKETS,
  csrf: CSRF_TICKETS,
  cuerpo,
  ...extra,
})

describe('la pantalla de tickets exige sesion, igual que /flota/', () => {
  it('sin cookie responde 401 y no consulta a ninguna instancia', async () => {
    const dd = depsTickets({ acceso: { permitido: false, motivo: 'sin cookie de sesion' } })
    const r = await manejar({ metodo: 'GET', ruta: '/flota/tickets', cookie: undefined }, dd.d)
    expect(r.status).toBe(401)
    expect(dd.consultas).toBe(0)
  })

  // ── Las CUATRO variantes, ESCRITAS A MANO ────────────────────────────────
  //
  // La version anterior de esta prueba iteraba `RUTAS_TICKETS`, o sea la MISMA
  // constante que venia a comprobar: era tautologica y no podia ponerse roja
  // por una variante que faltara --- con `RUTAS_TICKETS = []` habria pasado con
  // cero iteraciones. Y faltaban dos: el `proxy_pass` de
  // `infra/nginx/snippets/flota-panel.conf:16` lleva BARRA FINAL, que RECORTA
  // el prefijo, asi que detras del nginx de verdad el panel recibe `/tickets/`
  // --- que no estaba en la lista y daba 404. Por eso `RUTAS_ALTAS` tiene
  // cuatro desde siempre.
  const VARIANTES_TICKETS = ['/flota/tickets/', '/flota/tickets', '/tickets/', '/tickets']

  it('la constante lista EXACTAMENTE las cuatro variantes de prefijo', () => {
    expect([...RUTAS_TICKETS].sort()).toEqual([...VARIANTES_TICKETS].sort())
  })

  it('el GET sirve las cuatro variantes, incluidas las que deja nginx al recortar', async () => {
    for (const ruta of VARIANTES_TICKETS) {
      const dd = depsTickets()
      const r = await manejar({ metodo: 'GET', ruta, cookie: 'spaces_sesion=x' }, dd.d)
      expect(r.status, ruta).toBe(200)
    }
  })

  it('el POST del formulario tambien llega por las cuatro', async () => {
    // El `action` del formulario es `/flota/tickets/` --- la direccion que ve
    // el NAVEGADOR --- y nginx se la entrega al panel recortada a `/tickets/`.
    // Si el GET se arreglara y el POST no, contestar un ticket daria 404
    // despues de escribir la respuesta: el fallo mas caro de los dos.
    for (const ruta of VARIANTES_TICKETS) {
      const dd = depsTickets()
      const r = await manejar(postTicket({ id: 'id-1', instancia: 'g500', dominio: 'g500.ejemplo.invalid', respuesta: 'ya va', estado: 'ABIERTO' }, { ruta }), dd.d)
      expect(r.status, ruta).toBe(303)
      expect(dd.llamadasContestar.length, ruta).toBe(1)
    }
  })

  it('POST ya no es 405 (T12: contesta un ticket) -- sin csrf, 403', async () => {
    // Hasta la T12 esta ruta solo aceptaba GET. Con el formulario del panel un
    // POST es legitimo, asi que dejo de ser 405 -- pero SIN el token CSRF del
    // formulario sigue rechazado, igual que en `/flota/altas/`.
    const dd = depsTickets()
    const r = await manejar({ metodo: 'POST', ruta: '/flota/tickets', cookie: 'spaces_sesion=x' }, dd.d)
    expect(r.status).toBe(403)
  })

  it('no se cachea', async () => {
    const dd = depsTickets()
    const r = await manejar({ metodo: 'GET', ruta: '/flota/tickets', cookie: 'spaces_sesion=x' }, dd.d)
    expect(r.cabeceras['cache-control']).toMatch(/no-store/)
  })
})

describe('paginaTickets · el texto del ticket es de un TERCERO', () => {
  it('un asunto con <script> sale escapado, no crudo', () => {
    const html = paginaTickets(
      [{ nombre: 'g500', dominio: 'g500.ejemplo.invalid', tickets: [ticket({ asunto: '<script>alert(1)</script>' })] }],
      null,
    )
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('el cuerpo del ticket tambien va escapado', () => {
    const html = paginaTickets(
      [{ nombre: 'g500', dominio: 'g500.ejemplo.invalid', tickets: [ticket({ cuerpo: '<img src=x onerror=alert(1)>' })] }],
      null,
    )
    expect(html).not.toContain('<img src=x onerror=alert(1)>')
    expect(html).toContain('&lt;img')
  })

  it('el folio va escapado', () => {
    const html = paginaTickets(
      [{ nombre: 'g500', dominio: 'g500.ejemplo.invalid', tickets: [ticket({ folio: '"><script>x</script>' })] }],
      null,
    )
    expect(html).not.toContain('"><script>x</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('el motivo de una instancia caida va escapado, como en pagina()', () => {
    const html = paginaTickets(
      [{ nombre: 'g500', dominio: 'g500.ejemplo.invalid', motivo: '<script>alert(2)</script>' }],
      null,
    )
    expect(html).not.toContain('<script>alert(2)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('el dominio y el nombre de instancia tambien se escapan', () => {
    const html = paginaTickets(
      [{ nombre: '<b>g500</b>', dominio: 'a"b\'c<d>', tickets: [] }],
      null,
    )
    expect(html).not.toContain('<b>g500</b>')
    expect(html).toContain('&lt;b&gt;')
  })
})

describe('paginaTickets · una instancia MUDA no se ve como una sana sin tickets', () => {
  // Es la consecuencia que el ADR 0038 marca por escrito, y el error que este
  // proyecto ya penalizo con el panel de versiones ("Sale SIEMPRE con 0"):
  // sin-respuesta trae pendientes/total en null, una instancia ok sin tickets
  // los trae en 0 -- y la pantalla tiene que decirlo distinto.
  const muda = { nombre: 'muda', dominio: 'muda.ejemplo.invalid', motivo: 'el dominio no resuelve (ENOTFOUND)' }
  const sanaSinTickets = { nombre: 'sana', dominio: 'sana.ejemplo.invalid', tickets: [] }

  it('la muda sale con estado sin-respuesta y SIN un "0" en pendientes/total', () => {
    const html = paginaTickets([muda], null)
    expect(html).toContain(SIN_RESPUESTA)
    // La fila entera de esta instancia no puede contener un 0: ni pendientes
    // ni total lo son, y si apareciera seria indistinguible de "cero tickets".
    const filaDeMuda = html.slice(html.indexOf('muda.ejemplo.invalid'))
    expect(filaDeMuda.slice(0, 400)).not.toMatch(/<td[^>]*>0<\/td>/)
  })

  it('la sana sin tickets sale con estado ok y CON 0 explicito', () => {
    const html = paginaTickets([sanaSinTickets], null)
    expect(html).toContain(OK)
    expect(html).toMatch(/<td[^>]*>0<\/td>/)
  })

  it('las dos filas, una al lado de otra, no son iguales', () => {
    const html = paginaTickets([muda, sanaSinTickets], null)
    const filaMuda = html.slice(html.indexOf('>muda<'), html.indexOf('sana.ejemplo.invalid'))
    const filaSana = html.slice(html.indexOf('>sana<'))
    expect(filaMuda).not.toBe(filaSana)
    // La pista visible: la clase de estado de cada <td> tiene que ser distinta.
    expect(filaMuda).toContain(SIN_RESPUESTA)
    expect(filaSana).toContain(OK)
  })
})

describe('pagina · el motivo se ve', () => {
  const sana = {
    nombre: 'g500',
    dominio: 'g500.ejemplo.invalid',
    canal: 'estable',
    version: 'v0.5.0',
    estado: 'al-dia',
    fecha: '2026-09-10T12:00:00Z',
    origen: 'consulta',
    motivo: null,
    ultimaVezBien: '2026-09-10T12:00:00Z',
  }
  const caida = {
    ...sana,
    nombre: 'otra',
    version: '—',
    estado: 'sin-respuesta',
    motivo: 'el dominio no resuelve (ENOTFOUND)',
    ultimaVezBien: '2026-09-10T09:00:00Z',
  }

  it('una instancia caida enseña su motivo', () => {
    expect(pagina([caida], null)).toContain('el dominio no resuelve (ENOTFOUND)')
  })

  it('una instancia sana NO enseña motivo: el silencio es la señal', () => {
    expect(pagina([sana], null)).not.toContain('class="motivo"')
  })

  it('el motivo va escapado, como todo lo que viene de fuera', () => {
    const html = pagina([{ ...caida, motivo: '<script>alert(1)</script>' }], null)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('el motivo se acompaña de la ultima vez que estuvo bien', () => {
    expect(pagina([caida], null)).toContain('2026-09-10T09:00:00Z')
  })

  it('una caida sin memoria previa no inventa un «ultima vez bien»', () => {
    const html = pagina([{ ...caida, ultimaVezBien: null }], null)
    expect(html).toContain('el dominio no resuelve (ENOTFOUND)')
    expect(html).not.toContain('ultima vez bien')
  })
})

// ============================================================================
//  Encontrado MIRANDO la pagina entera renderizada, no leyendo el codigo: una
//  instancia con 2 pendientes salia con la MISMA clase verde (`ok`) que una con
//  0. La clase pintaba el estado de CONEXION, no el de ATENCION -- y esta
//  pantalla existe, segun el ADR 0038, para ensenar lo que hay que atender.
//
//  El resultado practico era que un cliente esperando respuesta se veia igual
//  de "bien" que uno sin ninguna incidencia. Ninguna prueba lo veia porque
//  todas afirmaban fragmentos, y el fragmento era correcto por separado.
// ============================================================================
describe('paginaTickets · lo que tiene pendientes se ve distinto de lo que no', () => {
  const conTickets = (n) => ({
    nombre: 'g500',
    dominio: 'g500.ejemplo.invalid',
    tickets: Array.from({ length: n }, () => ({
      id: 'x', folio: 'TK-2026-0001', tenant_id: 't', asunto: 'a', cuerpo: 'b',
      estado: 'ABIERTO', prioridad: 'NORMAL', creado_en: '2026-09-22T10:00:00.000Z',
      respuesta: null, respondido_en: null,
    })),
  })

  it('una instancia CON pendientes no se pinta igual que una sin ninguno', () => {
    const conPendientes = paginaTickets([conTickets(2)], { email: 'a@b.c' })
    const sinPendientes = paginaTickets([conTickets(0)], { email: 'a@b.c' })

    const claseDe = (html) => (html.match(/<td class="([^"]+)">2?0?<\/td>/) ?? [])[1]
    expect(conPendientes).toContain('class="hay-pendientes"')
    expect(sinPendientes).not.toContain('class="hay-pendientes"')
    expect(claseDe(conPendientes)).not.toBe(claseDe(sinPendientes))
  })

  it('la instancia muda sigue sin confundirse con ninguna de las dos', () => {
    const muda = paginaTickets([{ nombre: 'g500', dominio: 'g.invalid', motivo: 'ECONNREFUSED' }], { email: 'a@b.c' })
    expect(muda).toContain('sin-respuesta')
    expect(muda).not.toContain('class="hay-pendientes"')
  })
})

// ============================================================================
//  Tarea 11 · lo que dejo pendiente la pasada visual del 23/09.
// ----------------------------------------------------------------------------
//  Hasta esta tarea `/flota/tickets` no pintaba `respuesta` ni `respondido_en`
//  porque no habia forma de contestar. Con el PATCH del panel ya existe, y sin
//  esta distincion quien mira la pantalla no sabe si ya respondio -- y
//  contesta dos veces. La columna `creado` en ISO crudo es el mismo defecto,
//  de otra forma: obliga a descifrar la cadena en vez de leerla.
//
//  NO se toca `hay-pendientes` ni la distincion de tres estados de la columna
//  de pendientes (bloque de arriba): eso ya tiene su prueba y se arreglo el
//  23/09.
// ============================================================================
describe('paginaTickets · un ticket contestado se ve distinto de uno sin contestar', () => {
  const base = {
    id: 'x', folio: 'TK-2026-0001', tenant_id: 't', asunto: 'la pantalla no prende',
    cuerpo: 'el detalle', estado: 'ABIERTO', prioridad: 'NORMAL',
    creado_en: '2026-09-22T10:00:00.000Z',
  }
  const sinContestar = { ...base, respuesta: null, respondido_en: null }
  const contestado = { ...base, respuesta: 'Ya se reviso, era el fusible.', respondido_en: '2026-09-22T12:30:00.000Z' }

  it('un ticket sin respuesta sale marcado "Sin responder"', () => {
    const html = paginaTickets([{ nombre: 'g500', dominio: 'g500.ejemplo.invalid', tickets: [sinContestar] }], null)
    expect(html).toContain('Sin responder')
    expect(html).toContain('class="sin-contestar"')
    expect(html).not.toContain('class="contestado"')
  })

  it('un ticket YA contestado se ve distinto -- clase distinta y el texto de la respuesta visible', () => {
    const html = paginaTickets([{ nombre: 'g500', dominio: 'g500.ejemplo.invalid', tickets: [contestado] }], null)
    expect(html).toContain('class="contestado"')
    expect(html).not.toContain('class="sin-contestar"')
    expect(html).toContain('Ya se reviso, era el fusible.')
    expect(html).not.toContain('Sin responder')
  })

  it('las dos filas, una al lado de otra, no son iguales', () => {
    const html = paginaTickets(
      [{ nombre: 'g500', dominio: 'g500.ejemplo.invalid', tickets: [sinContestar, contestado] }],
      null,
    )
    // Dos clases distintas presentes a la vez: no es que una pantalla sin
    // contestados se vea "bien" de casualidad, las dos conviven aqui.
    expect(html).toContain('class="sin-contestar"')
    expect(html).toContain('class="contestado"')
  })

  it('el texto de la respuesta pasa por escapar() igual que el resto -- lo escribe AS OOH, pero el origen puede dejar de ser de confianza', () => {
    const conScript = { ...base, respuesta: '<script>alert(1)</script>', respondido_en: '2026-09-22T12:30:00.000Z' }
    const html = paginaTickets([{ nombre: 'g500', dominio: 'g500.ejemplo.invalid', tickets: [conScript] }], null)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('una instancia SIN tickets contestados no pinta ninguna sub-fila de respuesta', () => {
    const html = paginaTickets([{ nombre: 'g500', dominio: 'g500.ejemplo.invalid', tickets: [sinContestar] }], null)
    expect(html).not.toContain('class="respuesta-ticket"')
  })
})

describe('paginaTickets · la columna "creado" se pinta legible, no en ISO crudo', () => {
  const t = {
    id: 'x', folio: 'TK-2026-0001', tenant_id: 't', asunto: 'a', cuerpo: 'b',
    estado: 'ABIERTO', prioridad: 'NORMAL', creado_en: '2026-09-22T10:00:00.000Z',
    respuesta: null, respondido_en: null,
  }

  it('el ISO crudo no aparece en la pagina', () => {
    const html = paginaTickets([{ nombre: 'g500', dominio: 'g500.ejemplo.invalid', tickets: [t] }], null)
    expect(html).not.toContain('2026-09-22T10:00:00.000Z')
  })

  it('en su lugar sale la fecha formateada por fechaLegible()', () => {
    const html = paginaTickets([{ nombre: 'g500', dominio: 'g500.ejemplo.invalid', tickets: [t] }], null)
    expect(html).toContain(fechaLegible(t.creado_en))
  })
})

describe('fechaLegible · fecha corta, en es-MX, con dia y hora', () => {
  it('formatea un ISO a dia/mes/año y hora:minuto', () => {
    const f = fechaLegible('2026-09-22T10:00:00.000Z')
    // No se afirma la cadena exacta (depende de la zona horaria del proceso
    // que corre la prueba): se afirma que trae los tres numeros de la fecha Y
    // que YA NO es el ISO crudo.
    expect(f).not.toBe('2026-09-22T10:00:00.000Z')
    expect(f).toMatch(/22/)
    expect(f).toMatch(/2026/)
    expect(f).not.toContain('T')
  })

  it('un valor vacio o nulo da una cadena vacia, no "Invalid Date"', () => {
    expect(fechaLegible(null)).toBe('')
    expect(fechaLegible(undefined)).toBe('')
    expect(fechaLegible('')).toBe('')
  })

  it('un valor que no es fecha se devuelve TAL CUAL -- no se esconde el dato en silencio', () => {
    expect(fechaLegible('no-es-una-fecha')).toBe('no-es-una-fecha')
  })
})

// ============================================================================
//  Tarea 12 · el formulario del panel -- contestar desde el navegador.
// ----------------------------------------------------------------------------
//  La T11 dejo el PATCH funcionando y la pantalla enseñando si un ticket ya se
//  contesto, pero emitirlo solo se podia con `curl`. Aqui se cierra eso, con el
//  MISMO patron de `pedirAlta()`/`paginaAltas()`: la cookie `flota_csrf` propia
//  del panel, Origin como segundo cerrojo, y la consulta con token de la T9
//  (`contestarTicket()`, el PATCH equivalente de `consultarTickets()`).
//
//  Lo que mas importa, y es la prueba que da nombre a este bloque: si la
//  instancia NO contesta, la pantalla lo DICE -- no puede repintarse como si
//  se hubiera guardado. Quien acaba de escribir una respuesta se quedaria
//  creyendo que se guardo.
// ============================================================================
import { contestarTicket, contestarTicketDeConfianza } from './servidor.mjs'

describe('el formulario de tickets, para contestar desde el navegador (T12)', () => {
  it('cada ticket trae su formulario, con el token CSRF del panel', async () => {
    const dd = depsTickets({
      respuestas: [{ nombre: 'g500', dominio: 'g500.ejemplo.invalid', tickets: [ticket()] }],
    })
    const r = await manejar(
      { metodo: 'GET', ruta: '/flota/tickets/', cookie: `spaces_sesion=s; flota_csrf=${CSRF_TICKETS}` },
      dd.d,
    )
    expect(r.status).toBe(200)
    expect(r.cuerpo).toContain('<form')
    expect(r.cuerpo).toContain(`name="csrf" value="${CSRF_TICKETS}"`)
    expect(r.cuerpo).toContain('name="respuesta"')
    expect(r.cuerpo).toContain('name="estado"')
    // El formulario tiene que poder decir A QUE instancia y A QUE ticket
    // corresponde: sin esto el POST no sabria a donde mandar el PATCH.
    expect(r.cuerpo).toContain('name="id" value="id-1"')
    expect(r.cuerpo).toContain('name="dominio" value="g500.ejemplo.invalid"')
  })

  it('un POST sin el token CSRF no manda nada a la instancia y da 403', async () => {
    const dd = depsTickets()
    const r = await manejar(
      postTicket({ id: 'id-1', instancia: 'g500', dominio: 'g500.ejemplo.invalid', respuesta: 'Ya se reviso.' }, { csrf: undefined }),
      dd.d,
    )
    expect(r.status).toBe(403)
    expect(dd.llamadasContestar).toHaveLength(0)
  })

  it('con un token que no coincide con la cookie, tampoco', async () => {
    const dd = depsTickets()
    const r = await manejar(
      postTicket({ id: 'id-1', instancia: 'g500', dominio: 'g500.ejemplo.invalid', respuesta: 'x' }, { csrf: 'otro-token' }),
      dd.d,
    )
    expect(r.status).toBe(403)
    expect(dd.llamadasContestar).toHaveLength(0)
  })

  it('y si el Origin es de otro sitio, tampoco', async () => {
    const dd = depsTickets()
    const r = await manejar(
      postTicket(
        { id: 'id-1', instancia: 'g500', dominio: 'g500.ejemplo.invalid', respuesta: 'x' },
        { origen: 'https://malo.example' },
      ),
      dd.d,
    )
    expect(r.status).toBe(403)
    expect(dd.llamadasContestar).toHaveLength(0)
  })

  it('con sesion valida y CSRF correcto, llega al resolutor de la T9 con lo que trae el formulario', async () => {
    const dd = depsTickets()
    const r = await manejar(
      postTicket({ id: 'id-1', instancia: 'g500', dominio: 'g500.ejemplo.invalid', respuesta: 'Ya se reviso.', estado: 'RESUELTO' }),
      dd.d,
    )
    expect(r.status).toBe(303)
    expect(dd.llamadasContestar).toHaveLength(1)
    expect(dd.llamadasContestar[0].instancia).toMatchObject({ nombre: 'g500', dominio: 'g500.ejemplo.invalid' })
    expect(dd.llamadasContestar[0].cambios).toMatchObject({ id: 'id-1', respuesta: 'Ya se reviso.', estado: 'RESUELTO' })
  })

  it('si la instancia NO contesta, se dice — no se finge que se guardo', async () => {
    const dd = depsTickets({
      resultadoContestar: { ok: false, motivo: 'no contesto en 5 s (ETIMEDOUT)' },
      respuestas: [{ nombre: 'g500', dominio: 'g500.ejemplo.invalid', tickets: [ticket()] }],
    })
    const r = await manejar(
      postTicket({ id: 'id-1', instancia: 'g500', dominio: 'g500.ejemplo.invalid', respuesta: 'Ya se reviso.' }),
      dd.d,
    )
    // NI 303 (redirigir como si hubiera ido bien) NI un 200 silencioso: el
    // fallo tiene que verse EN ESTA respuesta, con su motivo.
    expect(r.status).not.toBe(303)
    expect(r.status).toBe(502)
    expect(r.cuerpo).toMatch(/no se guard/i)
    expect(r.cuerpo).toContain('no contesto en 5 s (ETIMEDOUT)')
  })

  it('la respuesta ya escrita vuelve escapada dentro del formulario', () => {
    // Aunque la escriba AS OOH: el dia que alguien pegue ahi un fragmento del
    // correo de un cliente, el origen deja de ser de confianza sin que nadie
    // lo note. Se afirma DENTRO del <textarea>, no en cualquier parte de la
    // pagina -- la sub-fila de solo-lectura ya escapaba esto antes de la T12.
    const conScript = { ...ticket(), respuesta: '<script>alert(1)</script>', respondido_en: '2026-09-22T12:30:00.000Z' }
    const html = paginaTickets(
      [{ nombre: 'g500', dominio: 'g500.ejemplo.invalid', tickets: [conScript] }],
      null,
      CSRF_TICKETS,
    )
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain(
      '<textarea name="respuesta" rows="2">\n&lt;script&gt;alert(1)&lt;/script&gt;</textarea>',
    )
  })
})

// ============================================================================
//  Hallazgo de la revision final: mover el estado FALSIFICABA la fecha de
//  respuesta.
//
//  El <textarea> viene precargado con la respuesta que ya habia y el <select>
//  manda valor SIEMPRE, asi que abrir un ticket ya contestado, cambiar solo el
//  estado y pulsar Guardar reenviaba la respuesta vieja --- `cambios.respuesta`
//  se rellenaba y `tickets-repo.ts:157-160` escribia `respondido_en = now()`.
//  El cliente veia «Respuesta de AS OOH · 25/09» de algo escrito el 22. Es
//  justo el dato que el ADR 0038 vende como valor.
//
//  Se arregla EN EL PANEL, no en el repo: el repo escribe solo lo que llega, y
//  eso esta bien. Lo que estaba mal es lo que el panel le mandaba.
// ============================================================================
describe('mover el estado NO puede falsificar la fecha de respuesta', () => {
  const contestado = { ...ticket(), respuesta: 'Ya se reviso.', respondido_en: '2026-09-22T12:30:00.000Z' }

  it('el formulario lleva la respuesta que YA habia, para poder saber si cambio', () => {
    const html = paginaTickets(
      [{ nombre: 'g500', dominio: 'g500.ejemplo.invalid', tickets: [contestado] }],
      null,
      CSRF_TICKETS,
    )
    expect(html).toContain('name="respuesta_previa" value="Ya se reviso."')
  })

  it('reenviar la MISMA respuesta con otro estado no la manda como cambio', async () => {
    const dd = depsTickets()
    const r = await manejar(
      postTicket({
        id: 'id-1',
        instancia: 'g500',
        dominio: 'g500.ejemplo.invalid',
        respuesta: 'Ya se reviso.',
        respuesta_previa: 'Ya se reviso.',
        estado: 'CERRADO',
      }),
      dd.d,
    )
    expect(r.status).toBe(303)
    // Y esto es el PATCH de UN SOLO CAMPO que hasta hoy el panel no emitia
    // nunca: los dos caminos de un campo de `actualizarTicketDesdePanel()`
    // solo eran alcanzables con `curl`.
    expect(dd.llamadasContestar[0].cambios).toEqual({ id: 'id-1', estado: 'CERRADO' })
  })

  it('si la respuesta CAMBIO de verdad, si viaja', async () => {
    const dd = depsTickets()
    const r = await manejar(
      postTicket({
        id: 'id-1',
        instancia: 'g500',
        dominio: 'g500.ejemplo.invalid',
        respuesta: 'Ya se reviso, y ademas se reinicio el servicio.',
        respuesta_previa: 'Ya se reviso.',
        estado: 'CERRADO',
      }),
      dd.d,
    )
    expect(r.status).toBe(303)
    expect(dd.llamadasContestar[0].cambios).toEqual({
      id: 'id-1',
      respuesta: 'Ya se reviso, y ademas se reinicio el servicio.',
      estado: 'CERRADO',
    })
  })

  it('la PRIMERA respuesta de un ticket sin contestar viaja igual que siempre', async () => {
    const dd = depsTickets()
    await manejar(
      postTicket({
        id: 'id-1',
        instancia: 'g500',
        dominio: 'g500.ejemplo.invalid',
        respuesta: 'Ya se reviso.',
        respuesta_previa: '',
        estado: 'ABIERTO',
      }),
      dd.d,
    )
    expect(dd.llamadasContestar[0].cambios).toMatchObject({ respuesta: 'Ya se reviso.' })
  })

  it('un cambio SOLO de finales de linea no cuenta como cambio', async () => {
    // El navegador manda el contenido de un <textarea> con CRLF
    // (`application/x-www-form-urlencoded` lo normaliza asi), y lo que hay en
    // la base lleva LF. Comparando crudo, CUALQUIER respuesta de dos lineas
    // se veria siempre como cambiada y el defecto volveria intacto para justo
    // los tickets con mas texto.
    const dd = depsTickets()
    await manejar(
      postTicket({
        id: 'id-1',
        instancia: 'g500',
        dominio: 'g500.ejemplo.invalid',
        respuesta: 'primera linea\r\nsegunda linea',
        respuesta_previa: 'primera linea\nsegunda linea',
        estado: 'CERRADO',
      }),
      dd.d,
    )
    expect(dd.llamadasContestar[0].cambios).toEqual({ id: 'id-1', estado: 'CERRADO' })
  })

  it('y lo que SI viaja va con finales de linea normalizados, no con CRLF', async () => {
    const dd = depsTickets()
    await manejar(
      postTicket({
        id: 'id-1',
        instancia: 'g500',
        dominio: 'g500.ejemplo.invalid',
        respuesta: 'uno\r\ndos',
        respuesta_previa: '',
        estado: 'ABIERTO',
      }),
      dd.d,
    )
    expect(dd.llamadasContestar[0].cambios.respuesta).toBe('uno\ndos')
  })

  it('sin `respuesta_previa` (un POST a mano) se comporta como antes: la manda', async () => {
    // El campo oculto decide si un dato YA autorizado se incluye, nada mas.
    // Manipularlo o quitarlo no puede escribir texto que nadie tecleo: en el
    // peor caso se vuelve al comportamiento de hoy.
    const dd = depsTickets()
    await manejar(
      postTicket({ id: 'id-1', instancia: 'g500', dominio: 'g500.ejemplo.invalid', respuesta: 'a mano' }),
      dd.d,
    )
    expect(dd.llamadasContestar[0].cambios).toMatchObject({ respuesta: 'a mano' })
  })
})

// ============================================================================
//  Hallazgo de la revision final: el guard miraba un campo del que se decidio
//  NO fiarse. `contestarTicketDeConfianza()` ignora el `dominio` del
//  formulario a proposito y resuelve el real por `nombre` contra el
//  inventario, asi que exigir `dominio` para dejar pasar el POST ataba el
//  camino feliz a un dato que ya no decide nada: quitar ese input oculto por
//  limpieza habria puesto toda la pantalla en 502.
// ============================================================================
describe('el guard del POST mira el NOMBRE, que es lo que de verdad se usa', () => {
  it('sin `dominio` en el formulario, el PATCH sale igual', async () => {
    const dd = depsTickets()
    const r = await manejar(
      postTicket({ id: 'id-1', instancia: 'g500', respuesta: 'Ya se reviso.' }),
      dd.d,
    )
    expect(r.status).toBe(303)
    expect(dd.llamadasContestar).toHaveLength(1)
    expect(dd.llamadasContestar[0].instancia.nombre).toBe('g500')
  })

  it('sin `instancia` no se manda nada: no hay nombre que resolver', async () => {
    const dd = depsTickets()
    const r = await manejar(
      postTicket({ id: 'id-1', dominio: 'g500.ejemplo.invalid', respuesta: 'x' }),
      dd.d,
    )
    expect(r.status).toBe(502)
    expect(dd.llamadasContestar).toHaveLength(0)
    expect(r.cuerpo).toMatch(/nombre de la instancia/i)
  })

  it('sin `id` tampoco', async () => {
    const dd = depsTickets()
    const r = await manejar(postTicket({ instancia: 'g500', respuesta: 'x' }), dd.d)
    expect(r.status).toBe(502)
    expect(dd.llamadasContestar).toHaveLength(0)
  })
})

describe('el POST contesta a la instancia, con su token (T9, el mismo camino que el GET)', () => {
  it('el POST emite el PATCH a la instancia con x-flota-token', async () => {
    process.env.FLOTA_TOKEN_G500 = 'tok-de-g500'
    let vistos: any = null
    const resultado = await contestarTicket(
      { nombre: 'g500', dominio: 'g500.ejemplo.invalid' },
      { id: 'id-1', respuesta: 'Ya se reviso.', estado: 'RESUELTO' },
      {
        leerTokens: async () => ({}),
        pedir: async (url: string, o: any) => {
          vistos = { url, metodo: o.method, headers: o.headers, cuerpo: JSON.parse(String(o.body)) }
          return { ok: true, status: 200 }
        },
      },
    )
    expect(vistos?.url).toContain('g500.ejemplo.invalid')
    expect(vistos?.metodo).toBe('PATCH')
    expect(vistos?.headers?.['x-flota-token']).toBe('tok-de-g500')
    expect(vistos?.cuerpo).toMatchObject({ id: 'id-1', respuesta: 'Ya se reviso.', estado: 'RESUELTO' })
    expect(resultado).toEqual({ ok: true })
    delete process.env.FLOTA_TOKEN_G500
  })

  it('y lo lee del ARCHIVO, no solo del entorno -- mismo defecto que costo el 2026-09-08 en el GET', async () => {
    let cabeceras: any = null
    const resultado = await contestarTicket(
      { nombre: 'g500', dominio: 'g500.ejemplo.invalid' },
      { id: 'id-1', estado: 'CERRADO' },
      {
        leerTokens: async () => ({ FLOTA_TOKEN_G500: 'del-archivo' }),
        pedir: async (_u: string, o: any) => {
          cabeceras = o.headers
          return { ok: true, status: 200 }
        },
      },
    )
    expect(cabeceras?.['x-flota-token'], 'el PATCH no leyo el archivo de tokens').toBe('del-archivo')
    expect(resultado).toEqual({ ok: true })
  })

  it('si la instancia contesta con un error HTTP, se traduce con clasificarFallo() -- no un ok:true a medias', async () => {
    const resultado = await contestarTicket(
      { nombre: 'g500', dominio: 'g500.ejemplo.invalid' },
      { id: 'id-1', respuesta: 'x' },
      {
        leerTokens: async () => ({}),
        pedir: async () => ({ ok: false, status: 401 }),
      },
    )
    expect(resultado.ok).toBe(false)
    expect(resultado.motivo).toMatch(/token/i)
  })

  it('si la red falla (timeout, DNS...), tampoco se finge exito', async () => {
    const resultado = await contestarTicket(
      { nombre: 'g500', dominio: 'g500.ejemplo.invalid' },
      { id: 'id-1', respuesta: 'x' },
      {
        leerTokens: async () => ({}),
        pedir: async () => {
          throw new Error('fetch failed')
        },
      },
    )
    expect(resultado.ok).toBe(false)
    expect(typeof resultado.motivo).toBe('string')
  })
})

// ============================================================================
//  Hallazgo de la revision de codigo antes de cerrar la T12: el formulario
//  manda `{nombre, dominio}` en campos ocultos, y un campo oculto de un POST
//  lo pone el NAVEGADOR -- quien ya tiene sesion en el panel podria editarlo a
//  mano y mandar el `x-flota-token` de una instancia real a un host que
//  controla. `contestarTicketDeConfianza()` es lo que cierra eso: resuelve el
//  dominio de VERDAD desde el inventario, nunca desde lo que trae el cliente.
// ============================================================================
describe('el PATCH no confia en el dominio del formulario (fuga de token / SSRF)', () => {
  it('usa el dominio del INVENTARIO, no el que venga en el formulario', async () => {
    let vistaUrl: any = null
    const resultado = await contestarTicketDeConfianza(
      { nombre: 'g500', dominio: 'atacante.example' },
      { id: 'id-1', respuesta: 'x' },
      {
        cargar: async () => ({ instancias: [{ nombre: 'g500', dominio: 'g500.real.invalid' }] }),
        leerTokens: async () => ({}),
        pedir: async (url: string) => {
          vistaUrl = url
          return { ok: true, status: 200 }
        },
      },
    )
    expect(vistaUrl).toContain('g500.real.invalid')
    expect(vistaUrl).not.toContain('atacante.example')
    expect(resultado.ok).toBe(true)
  })

  it('una instancia que no esta en el inventario se rechaza y no se manda a ningun lado', async () => {
    let llamado = false
    const resultado = await contestarTicketDeConfianza(
      { nombre: 'fantasma', dominio: 'lo-que-sea.example' },
      { id: 'id-1', respuesta: 'x' },
      {
        cargar: async () => ({ instancias: [{ nombre: 'g500', dominio: 'g500.real.invalid' }] }),
        pedir: async () => {
          llamado = true
          return { ok: true, status: 200 }
        },
      },
    )
    expect(resultado.ok).toBe(false)
    expect(llamado, 'con la instancia sin resolver no puede salir ni un fetch').toBe(false)
  })
})

// ============================================================================
//  Hallazgo de la revision final: el diagnostico mentia para TODA la flota.
//
//  `consultarTickets()` y `contestarTicket()` reutilizan `clasificarFallo()`,
//  que se escribio SOLO para `/api/version` y lleva esa ruta quemada en el
//  texto del 404. Y hoy NINGUNA instancia tiene `/api/tickets` --- g500 va por
//  `v0.5.1`---, asi que en cuanto la pantalla fuera alcanzable toda la flota
//  habria dicho que le falta `/api/version`, que existe y funciona.
// ============================================================================
// @ts-expect-error — módulo .mjs sin tipos
import { consultarTickets } from './servidor.mjs'

describe('un 404 de la ruta de tickets no acusa a /api/version', () => {
  it('en el GET de tickets, el motivo nombra /api/tickets', async () => {
    const r = await consultarTickets(
      { nombre: 'g500', dominio: 'g500.ejemplo.invalid' },
      { pedir: async () => ({ ok: false, status: 404 }) },
    )
    expect(r.motivo).toContain('/api/tickets')
    expect(r.motivo, 'mandaria a investigar una regresion que no existe').not.toContain(
      '/api/version',
    )
  })

  it('y en el PATCH tambien --- ahi el 404 puede ser el ticket, no la ruta', async () => {
    const r = await contestarTicket(
      { nombre: 'g500', dominio: 'g500.ejemplo.invalid' },
      { id: 'id-1', estado: 'CERRADO' },
      { leerTokens: async () => ({}), pedir: async () => ({ ok: false, status: 404 }) },
    )
    expect(r.ok).toBe(false)
    expect(r.motivo).toContain('/api/tickets')
    expect(r.motivo).not.toContain('/api/version')
  })

  it('los demas estados siguen diciendo lo de siempre: esto no toca el resto', async () => {
    const r = await consultarTickets(
      { nombre: 'g500', dominio: 'g500.ejemplo.invalid' },
      { pedir: async () => ({ ok: false, status: 502 }) },
    )
    expect(r.motivo).toBe('nginx contesta pero la aplicacion no (HTTP 502)')
  })
})

// ============================================================================
//  Hallazgo de la revision final: la pantalla de tickets no tenia entrada
//  desde ningun sitio. `paginaTickets()` enlaza «← la flota», pero ni la flota
//  ni las altas enlazaban hacia ella: habia que saberse la URL de memoria.
// ============================================================================
// @ts-expect-error — módulo .mjs sin tipos
import { paginaAltas } from './servidor.mjs'

describe('se puede LLEGAR a la pantalla de tickets sin saberse la URL', () => {
  it('la flota enlaza a los tickets', async () => {
    const { d } = deps()
    const r = await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, d)
    expect(r.cuerpo).toContain('href="/flota/tickets/"')
  })

  it('y la pantalla de altas tambien', () => {
    expect(paginaAltas([], null, 'csrf-1')).toContain('href="/flota/tickets/"')
  })

  it('el enlace apunta a una ruta que el panel SIRVE de verdad', async () => {
    // Un enlace a una ruta que da 404 es peor que no tener enlace: promete una
    // pantalla y entrega un error. Se comprueba contra `manejar()`, no contra
    // la lista de rutas.
    const dd = depsTickets()
    const r = await manejar({ metodo: 'GET', ruta: '/flota/tickets/', cookie: 'spaces_sesion=x' }, dd.d)
    expect(r.status).toBe(200)
  })
})
