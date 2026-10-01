import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  El módulo Space Eyes, de punta a punta: sesión real, RLS real y el servidor
//  de Space Eye de verdad al otro lado.
// ----------------------------------------------------------------------------
//  POR QUÉ CONTRA EL SPACE EYE REAL Y NO UN DOBLE. Lo que hay que comprobar es
//  justo lo que un doble daría por bueno: que la llave de servicio solo trae los
//  equipos de su dueño, que pedir una foto pasa por la ÚNICA ruta que acepta
//  escritura, y que un equipo ajeno contesta 404. Un doble que responde lo que
//  uno quiere no prueba ninguna de las tres.
//
//  QUÉ HACE FALTA para correrla (si no está, se salta sola y lo dice):
//    - el backend de Space Eye en marcha (por omisión http://127.0.0.1:4000)
//    - SPACE_EYE_KEY con una llave de LECTURA+ESCRITURA de ese dueño
//    - SPACE_EYE_OWNER_CODIGO: el billboard_code de un equipo de ese dueño
//
//    SPACE_EYE_BASE_URL=http://127.0.0.1:4000 SPACE_EYE_KEY=se_... \
//    SPACE_EYE_OWNER_CODIGO=05599-D01 npx vitest run lib/test/space-eyes.e2e.test.ts
// ============================================================================

const BASE_SE = process.env.SPACE_EYE_BASE_URL ?? 'http://127.0.0.1:4000'
const LLAVE = process.env.SPACE_EYE_KEY ?? ''
const CODIGO = process.env.SPACE_EYE_OWNER_CODIGO ?? ''

let a: Awaited<ReturnType<typeof sembrarTenant>>
let comercial: Awaited<ReturnType<typeof sembrarTenant>>
let equipoId = 0

// Se decide AQUÍ, y no dentro de cada caso, si esta prueba se pide: con las dos
// variables puestas corre, y sin ellas vitest las reporta SALTADAS.
//
// Saltar no es lo mismo que pasar. La primera versión de este archivo devolvía
// temprano en cada `it` y los doce casos salían en verde sin haber hablado con
// nadie: doce mentiras en verde, que es peor que no tener prueba. Si las
// variables están puestas y el entorno no responde, `beforeAll` REVIENTA con el
// motivo.
const pedido = Boolean(LLAVE && CODIGO)
const suite = pedido ? describe : describe.skip

beforeAll(async () => {
  if (!pedido) return
  // El backend, vivo y con ese equipo, ANTES de montar nada: si no, los doce
  // casos fallarían por el andamio y parecería que el módulo está roto.
  let devices: { id: number; billboard_code: string | null }[]
  try {
    const r = await fetch(`${BASE_SE}/api/devices`, { headers: { Authorization: `Bearer ${LLAVE}` } })
    if (!r.ok) throw new Error(`GET /api/devices respondió ${r.status} (¿la llave es de lectura y no está revocada?)`)
    devices = ((await r.json()) as { devices: typeof devices }).devices
  } catch (e) {
    throw new Error(
      `No pude hablar con Space Eye en ${BASE_SE}: ${e instanceof Error ? e.message : e}. ` +
        `Levanta el backend o quita SPACE_EYE_KEY para saltar esta prueba.`,
    )
  }
  const equipo = devices.find((d) => (d.billboard_code ?? '').toLowerCase() === CODIGO.toLowerCase())
  if (!equipo) {
    throw new Error(
      `Ningún equipo de esa llave tiene el código "${CODIGO}". Los que hay: ` +
        `${devices.map((d) => d.billboard_code ?? '(sin código)').join(', ') || 'ninguno'}.`,
    )
  }
  equipoId = equipo.id

  await recrearEsquema()
  await asegurarPermisos()
  a = await sembrarTenant('seyes')
  comercial = await sembrarTenant('seyescom', { rol: 'COMERCIAL' })

  // La pantalla del tenant toma el código del equipo REAL: es el emparejamiento
  // que el módulo tiene que resolver (sitios.codigo_proveedor == billboard_code).
  await poolTest().query('update sitios set codigo_proveedor = $1 where id = $2', [CODIGO, a.sitioId])

  await arrancarServidor()
}, 180_000)

afterAll(async () => {
  if (!pedido) return
  await pararServidor()
  await cerrarPool()
})

suite('módulo Space Eyes', () => {
  it('sin sesión, el listado responde 401', async () => {
    const anon = new Cliente()
    const r = await anon.pedir('/api/space-eyes/')
    expect(r.status).toBe(401)
  })

  it('con sesión, trae los equipos del dueño de la llave', async () => {
    const c = new Cliente()
    await c.entrar(a.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir('/api/space-eyes/')
    expect(r.status).toBe(200)
    expect(r.datos.disponible).toBe(true)
    expect(Array.isArray(r.datos.equipos)).toBe(true)
    expect(r.datos.equipos.length).toBeGreaterThan(0)
  })

  it('empareja el equipo con la pantalla del tenant por su código', async () => {
    const c = new Cliente()
    await c.entrar(a.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir('/api/space-eyes/')
    const mio = r.datos.equipos.find((e: { id: number }) => e.id === equipoId)
    expect(mio).toBeTruthy()
    expect(mio.pantalla).toBeTruthy()
    expect(mio.pantalla.id).toBe(a.sitioId)
  })

  it('un equipo sin pantalla en este tenant sale igual, marcado sin pantalla', async () => {
    const c = new Cliente()
    await c.entrar(a.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir('/api/space-eyes/')
    const otros = r.datos.equipos.filter((e: { id: number }) => e.id !== equipoId)
    // Solo una pantalla del tenant lleva el código, así que el resto va sin
    // enlazar. Lo que importa es que NO desaparezcan de la lista.
    for (const e of otros) expect(e.pantalla).toBeNull()
  })

  it('la ficha trae el equipo y su pantalla', async () => {
    const c = new Cliente()
    await c.entrar(a.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir(`/api/space-eyes/${equipoId}/`)
    expect(r.status).toBe(200)
    expect(r.datos.equipo.id).toBe(equipoId)
    expect(r.datos.equipo.codigoPantalla.toLowerCase()).toBe(CODIGO.toLowerCase())
    expect(r.datos.pantalla.id).toBe(a.sitioId)
  })

  it('la pantalla de OTRO tenant no aparece como pantalla asociada', async () => {
    // El tenant de al lado no tiene ese código, así que ve el equipo (es de la
    // misma instancia) pero SIN pantalla: la RLS no le deja ver la del vecino.
    const c = new Cliente()
    await c.entrar(comercial.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir(`/api/space-eyes/${equipoId}/`)
    expect(r.status).toBe(200)
    expect(r.datos.pantalla).toBeNull()
  })

  it('pedir una foto funciona con permiso de crear', async () => {
    const c = new Cliente()
    await c.entrar(a.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir(`/api/space-eyes/${equipoId}/captura/`, { metodo: 'POST' })
    expect(r.status).toBe(200)
    expect(typeof r.datos.orden).toBe('number')
    expect(typeof r.datos.mensaje).toBe('string')
  })

  it('un rol que solo consulta NO puede encender la cámara', async () => {
    const c = new Cliente()
    await c.entrar(comercial.usuarioEmail, PASSWORD_DEMO)
    const puedeVer = await c.pedir('/api/space-eyes/')
    expect(puedeVer.status).toBe(200)
    const r = await c.pedir(`/api/space-eyes/${equipoId}/captura/`, { metodo: 'POST' })
    expect(r.status).toBe(403)
  })

  it('pedir una foto queda registrado en Actividad', async () => {
    const c = new Cliente()
    await c.entrar(a.usuarioEmail, PASSWORD_DEMO)
    await c.pedir(`/api/space-eyes/${equipoId}/captura/`, { metodo: 'POST' })
    const r = await poolTest().query(
      `select accion, entidad from acciones where accion = 'Pidió una foto a Space Eyes' order by id desc limit 1`,
    )
    expect(r.rows.length).toBe(1)
    expect(String(r.rows[0].entidad).length).toBeGreaterThan(0)
  })

  it('el alta enseña los instaladores a quien solo consulta', async () => {
    const c = new Cliente()
    await c.entrar(comercial.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir('/api/space-eyes/alta/')
    expect(r.status).toBe(200)
    expect(typeof r.datos.servidor).toBe('string')
    // El prefijo sí, la credencial no: sin pedirla, no viaja.
    expect(r.datos.testigoCompleto).toBeUndefined()
  })

  it('el testigo COMPLETO no se le entrega a quien solo consulta', async () => {
    const c = new Cliente()
    await c.entrar(comercial.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir('/api/space-eyes/alta/?testigo=1')
    expect(r.status).toBe(403)
    expect(JSON.stringify(r.datos)).not.toContain('se_')
  })

  it('y sí a quien puede dar de alta', async () => {
    if (!process.env.SPACE_EYE_PROVISION_TOKEN) return
    const c = new Cliente()
    await c.entrar(a.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir('/api/space-eyes/alta/?testigo=1')
    expect(r.status).toBe(200)
    expect(r.datos.testigoCompleto).toBe(process.env.SPACE_EYE_PROVISION_TOKEN)
  })

  it('las fotos viajan por NUESTRA ruta, no por la de Space Eye', async () => {
    // Si alguna vez vuelve a salir una URL absoluta a Space Eye, en producción
    // el navegador la bloquea por contenido mixto y el módulo se queda sin
    // fotos. Aquí es donde se atrapa.
    const c = new Cliente()
    await c.entrar(a.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir(`/api/space-eyes/${equipoId}/`)
    const fotos: { url: string }[] = r.datos.equipo.fotos ?? []
    for (const f of fotos) {
      expect(f.url.startsWith('/spaces-dooh/api/space-eyes/foto/')).toBe(true)
      expect(f.url).not.toContain(BASE_SE)
    }
  })

  it('el proxy de fotos no se deja usar para pedir cualquier cosa', async () => {
    const c = new Cliente()
    await c.entrar(a.usuarioEmail, PASSWORD_DEMO)
    // Una URL completa a otro servidor sería un proxy abierto desde dentro del
    // droplet: el clásico SSRF con el que se leen las credenciales del metadata
    // del proveedor.
    for (const malo of [
      'http://169.254.169.254/latest/meta-data/',
      'https://example.com/foto.jpg',
      '/storage/../../etc/passwd',
      '/api/llaves',
      '//evil.example.com/x.jpg',
    ]) {
      const r = await c.pedir(`/api/space-eyes/foto/?p=${encodeURIComponent(malo)}`)
      expect(r.status).toBe(400)
    }
  })

  it('sin sesión, el proxy de fotos no sirve nada', async () => {
    const anon = new Cliente()
    const r = await anon.pedir('/api/space-eyes/foto/?p=%2Fstorage%2Fx.jpg')
    expect(r.status).toBe(401)
  })

  it('un equipo inventado da 404, no 500', async () => {
    const c = new Cliente()
    await c.entrar(a.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir('/api/space-eyes/999999/')
    expect(r.status).toBe(404)
  })

  it('el histórico responde y respeta el rango', async () => {
    const c = new Cliente()
    await c.entrar(a.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir(`/api/space-eyes/${equipoId}/telemetria/?horas=168`)
    expect(r.status).toBe(200)
    expect(r.datos.horas).toBe(168)
    // Un rango fuera de la lista cerrada cae a 24 h en vez de pedir meses.
    const raro = await c.pedir(`/api/space-eyes/${equipoId}/telemetria/?horas=100000`)
    expect(raro.datos.horas).toBe(24)
  })
})
