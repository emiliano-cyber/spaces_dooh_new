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
  return {
    registro,
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
    },
  }
}

describe('la pantalla de tickets exige sesion, igual que /flota/', () => {
  it('sin cookie responde 401 y no consulta a ninguna instancia', async () => {
    const dd = depsTickets({ acceso: { permitido: false, motivo: 'sin cookie de sesion' } })
    const r = await manejar({ metodo: 'GET', ruta: '/flota/tickets', cookie: undefined }, dd.d)
    expect(r.status).toBe(401)
    expect(dd.consultas).toBe(0)
  })

  it('sirve tanto /flota/tickets como /flota/tickets/', async () => {
    for (const ruta of RUTAS_TICKETS) {
      const dd = depsTickets()
      const r = await manejar({ metodo: 'GET', ruta, cookie: 'spaces_sesion=x' }, dd.d)
      expect(r.status, ruta).toBe(200)
    }
  })

  it('solo GET; POST da 405', async () => {
    const dd = depsTickets()
    const r = await manejar({ metodo: 'POST', ruta: '/flota/tickets', cookie: 'spaces_sesion=x' }, dd.d)
    expect(r.status).toBe(405)
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
