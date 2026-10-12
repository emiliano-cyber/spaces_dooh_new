import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
// @ts-expect-error — módulo .mjs sin tipos, como el resto de `apps/flota`
import { manejar, avisoDeSolicitudes } from './servidor.mjs'
// @ts-expect-error — módulo .mjs sin tipos
import { ASUNTO_ACTIVACION_EYES, esSolicitudDeActivacion, solicitudesDeActivacion } from './tickets.mjs'

// ============================================================================
//  Las solicitudes de activación de Space Eyes llegan al padre.
//
//  Una empresa sin el módulo ve la demostración y pulsa «Solicitar
//  activación»: eso abre un ticket en SU instancia. El padre ya recoge los
//  tickets de cada una, pero revuelto con los demás nadie lo veía (pasó con
//  g500 el 08/10). Ahora sale arriba de la lista de empresas, con la orden
//  exacta para activarlo, y su columna de Space Eyes dice «pidió activación».
// ============================================================================

const SOLICITUD = {
  id: 't1',
  folio: 'TK-0007',
  tenant_id: 'x',
  asunto: ASUNTO_ACTIVACION_EYES,
  cuerpo: 'Nos interesa activar Space Eyes',
  estado: 'ABIERTO',
  prioridad: 'NORMAL',
  creado_en: '2026-10-08T15:00:00Z',
  respuesta: null,
  respondido_en: null,
}
const OTRO = { ...SOLICITUD, id: 't2', folio: 'TK-0008', asunto: 'No carga una foto' }

const FILAS = [
  { nombre: 'g500', dominio: 'g500.space-os.io', canal: 'estable', version: 'v0.11.0', estado: 'al-dia', fecha: '2026-10-08T10:00:00Z', origen: 'consulta' },
  { nombre: 'demo', dominio: 'demo.space-os.io', canal: 'estable', version: 'v0.11.0', estado: 'al-dia', fecha: '2026-10-08T10:00:00Z', origen: 'consulta' },
]

function deps(respuestas: any, opciones: any = {}) {
  let consultasTickets = 0
  return {
    get consultasTickets() {
      return consultasTickets
    },
    d: {
      verificar: async () => opciones.acceso ?? { permitido: true, usuario: { email: 'jefa@asnetwork.io' } },
      obtenerFilas: async () => FILAS,
      obtenerRespuestasTickets: async () => {
        consultasTickets++
        if (respuestas instanceof Error) throw respuestas
        return respuestas
      },
      registrar: () => {},
    },
  }
}

describe('solicitudesDeActivacion', () => {
  it('solo las de Space Eyes que siguen sin atender', () => {
    expect(esSolicitudDeActivacion(SOLICITUD)).toBe(true)
    expect(esSolicitudDeActivacion({ ...SOLICITUD, estado: 'EN_PROCESO' })).toBe(true)
    expect(esSolicitudDeActivacion({ ...SOLICITUD, estado: 'RESUELTO' })).toBe(false)
    expect(esSolicitudDeActivacion(OTRO)).toBe(false)
  })

  it('una por instancia (la más reciente), y la que no contestó no aporta nada', () => {
    const r = solicitudesDeActivacion([
      { nombre: 'g500', dominio: 'g500.space-os.io', tickets: [SOLICITUD, { ...SOLICITUD, id: 't3', folio: 'TK-0009', creado_en: '2026-10-08T16:00:00Z' }, OTRO] },
      { nombre: 'demo', dominio: 'demo.space-os.io', tickets: [OTRO] },
      { nombre: 'muda', dominio: 'muda.space-os.io', motivo: 'timeout' },
    ])
    expect(r).toEqual([
      { nombre: 'g500', dominio: 'g500.space-os.io', folio: 'TK-0009', creado_en: '2026-10-08T16:00:00Z', total: 2 },
    ])
  })
})

describe('la lista de empresas del padre avisa', () => {
  it('arriba, con la empresa, el folio y la orden para activarlo', async () => {
    const { d } = deps([{ nombre: 'g500', dominio: 'g500.space-os.io', tickets: [SOLICITUD, OTRO] }])
    const r = await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, d)
    expect(r.status).toBe(200)
    expect(r.cuerpo).toContain('Solicitudes de activación de Space Eyes')
    expect(r.cuerpo).toContain('TK-0007')
    expect(r.cuerpo).toContain('node apps/flota/modulo.mjs --instancia g500 --activar space-eyes')
    expect(r.cuerpo).toContain('pidió activación')
    expect(r.cuerpo).not.toContain('No carga una foto')
  })

  it('sin solicitudes no pinta nada', async () => {
    const { d } = deps([{ nombre: 'g500', dominio: 'g500.space-os.io', tickets: [OTRO] }])
    const r = await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, d)
    expect(r.cuerpo).not.toContain('Solicitudes de activación')
    expect(r.cuerpo).not.toContain('pidió activación')
  })

  it('si la consulta de tickets falla, la lista sale igual', async () => {
    const { d } = deps(new Error('red caída'))
    const r = await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, d)
    expect(r.status).toBe(200)
    expect(r.cuerpo).toContain('g500.space-os.io')
  })

  it('sin permiso ni siquiera pregunta por los tickets', async () => {
    const x = deps([{ nombre: 'g500', dominio: 'g500.space-os.io', tickets: [SOLICITUD] }], {
      acceso: { permitido: false, motivo: 'sin sesion' },
    })
    const r = await manejar({ metodo: 'GET', ruta: '/flota/', cookie: '' }, x.d)
    expect(r.status).not.toBe(200)
    expect(x.consultasTickets).toBe(0)
  })

  it('lo que escribe la instancia va escapado', () => {
    const html = avisoDeSolicitudes([
      { nombre: 'g500', dominio: '<script>x</script>', folio: '<b>f</b>', creado_en: null, total: 1 },
    ])
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('la pantalla de tickets marca la solicitud', () => {
  it('con la orden para activarlo junto al asunto', async () => {
    const { d } = deps([{ nombre: 'g500', dominio: 'g500.space-os.io', tickets: [SOLICITUD] }])
    const r = await manejar({ metodo: 'GET', ruta: '/flota/tickets/', cookie: 'spaces_sesion=x' }, d)
    expect(r.cuerpo).toContain('Para activarlo')
    expect(r.cuerpo).toContain('--instancia g500 --activar space-eyes')
  })
})

describe('el asunto es el mismo de los dos lados', () => {
  it('DemoSpaceEyes abre el ticket con el asunto que el padre reconoce', () => {
    const demo = readFileSync(
      fileURLToPath(new URL('../web/components/demo/space-eyes/DemoSpaceEyes.tsx', import.meta.url)),
      'utf8',
    )
    expect(demo).toContain(`asunto: '${ASUNTO_ACTIVACION_EYES}'`)
  })
})

describe('el módulo Space Eyes del padre las pide en JSON', () => {
  it('con la orden para activar cada una', async () => {
    const { d } = deps([{ nombre: 'g500', dominio: 'g500.space-os.io', tickets: [SOLICITUD, OTRO] }])
    const r = await manejar({ metodo: 'GET', ruta: '/flota/solicitudes.json', cookie: 'spaces_sesion=x' }, d)
    expect(r.status).toBe(200)
    expect(r.cabeceras['content-type']).toMatch(/application\/json/)
    const j = JSON.parse(r.cuerpo)
    expect(j.solicitudes).toEqual([
      {
        nombre: 'g500',
        dominio: 'g500.space-os.io',
        folio: 'TK-0007',
        creado_en: '2026-10-08T15:00:00Z',
        total: 1,
        orden: 'node apps/flota/modulo.mjs --instancia g500 --activar space-eyes',
      },
    ])
  })

  it('también sin el prefijo /flota (nginx lo recorta)', async () => {
    const { d } = deps([])
    const r = await manejar({ metodo: 'GET', ruta: '/solicitudes.json', cookie: 'spaces_sesion=x' }, d)
    expect(r.status).toBe(200)
    expect(JSON.parse(r.cuerpo).solicitudes).toEqual([])
  })

  it('sin permiso: 401 en JSON y sin preguntar a nadie', async () => {
    const x = deps([{ nombre: 'g500', dominio: 'g500.space-os.io', tickets: [SOLICITUD] }], {
      acceso: { permitido: false, motivo: 'sin sesion' },
    })
    const r = await manejar({ metodo: 'GET', ruta: '/flota/solicitudes.json', cookie: '' }, x.d)
    expect(r.status).toBe(401)
    expect(r.cabeceras['content-type']).toMatch(/application\/json/)
    expect(x.consultasTickets).toBe(0)
  })

  it('si no se pudo consultar, lo dice en vez de decir "ninguna"', async () => {
    const { d } = deps(new Error('red caída'))
    const r = await manejar({ metodo: 'GET', ruta: '/flota/solicitudes.json', cookie: 'spaces_sesion=x' }, d)
    expect(JSON.parse(r.cuerpo).error).toBeTruthy()
  })

  it('solo GET', async () => {
    const { d } = deps([])
    const r = await manejar({ metodo: 'POST', ruta: '/flota/solicitudes.json', cookie: 'spaces_sesion=x' }, d)
    expect(r.status).toBe(405)
  })
})
