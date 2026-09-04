import { describe, it, expect } from 'vitest'
// @ts-expect-error — módulo .mjs sin tipos, como el resto de `apps/flota`
import { manejar } from './servidor.mjs'

// ============================================================================
//  El formulario de alta y su vista.  (ADR 0027)
//
//  Aquí un `POST` **crea una máquina y empieza a cobrarse**, así que las pruebas
//  pesan sobre lo que NO debe poder pedirlo:
//
//   · nadie sin sesión del PADRE,
//   · nadie sin permiso,
//   · y nadie desde OTRA página con tu sesión puesta (CSRF) — que es la forma
//     de que lo pidas tú sin querer.
// ============================================================================

const ORIGEN = 'https://space-os.io'
const CSRF = 'csrf-abc'

function deps(opciones: any = {}) {
  const creadas: any[] = []
  return {
    creadas,
    d: {
      verificar: async () => opciones.acceso ?? { permitido: true, usuario: { email: 'jefa@asnetwork.io' } },
      obtenerFilas: async () => [],
      registrar: () => {},
      listarSolicitudes: async () => opciones.solicitudes ?? [],
      crearSolicitud: async (datos: any, quien: string) => {
        creadas.push({ datos, quien })
        return 'id-1'
      },
      origenEsperado: ORIGEN,
    },
  }
}

const post = (cuerpo: any, extra: any = {}) => ({
  metodo: 'POST',
  ruta: '/flota/altas/',
  cookie: `spaces_sesion=s; spaces_csrf=${CSRF}`,
  origen: ORIGEN,
  csrf: CSRF,
  cuerpo,
  ...extra,
})

const BUENA = { instancia: 'pixeled', dominio: 'space-os.pixeled.mx', email: 'jefe@pixeled.mx' }

describe('quién puede pedir un alta', () => {
  it('sin sesión, 401 y no se crea nada', async () => {
    const dd = deps({ acceso: { permitido: false, motivo: 'sin cookie de sesion' } })
    const r = await manejar(post(BUENA), dd.d)
    expect(r.status).toBe(401)
    expect(dd.creadas).toHaveLength(0)
  })

  it('con sesión pero sin permiso, tampoco', async () => {
    const dd = deps({ acceso: { permitido: false, motivo: 'sin permiso administracion:ver' } })
    const r = await manejar(post(BUENA), dd.d)
    expect(r.status).toBe(401)
    expect(dd.creadas).toHaveLength(0)
  })
})

describe('CSRF: que no lo pidas tú sin querer', () => {
  it('sin el token del formulario, se rechaza', async () => {
    // La cookie de sesión es `sameSite: lax`, así que un POST desde otra página
    // ya no la llevaría. Esto es la segunda cerradura, no la única.
    const dd = deps()
    const r = await manejar(post(BUENA, { csrf: undefined }), dd.d)
    expect(r.status).toBe(403)
    expect(dd.creadas).toHaveLength(0)
  })

  it('con un token que no coincide con la cookie, tampoco', async () => {
    const dd = deps()
    const r = await manejar(post(BUENA, { csrf: 'otro-token' }), dd.d)
    expect(r.status).toBe(403)
    expect(dd.creadas).toHaveLength(0)
  })

  it('y si el Origin es de otro sitio, tampoco', async () => {
    const dd = deps()
    const r = await manejar(post(BUENA, { origen: 'https://malo.example' }), dd.d)
    expect(r.status).toBe(403)
    expect(dd.creadas).toHaveLength(0)
  })
})

describe('cuando el alta se pide bien', () => {
  it('se anota, con quién la pidió', async () => {
    const dd = deps()
    const r = await manejar(post(BUENA), dd.d)
    expect(r.status).toBe(303)
    expect(dd.creadas).toHaveLength(1)
    expect(dd.creadas[0].quien).toBe('jefa@asnetwork.io')
    expect(dd.creadas[0].datos.dominio).toBe('space-os.pixeled.mx')
  })

  it('un dato invalido se rechaza y NO se anota', async () => {
    const dd = deps()
    const r = await manejar(post({ ...BUENA, dominio: 'a.mx; id' }), dd.d)
    expect(r.status).toBe(400)
    expect(dd.creadas).toHaveLength(0)
    expect(r.cuerpo).toContain('dominio')
  })
})

describe('la vista de las altas', () => {
  const SOLICITUDES = [
    { id: 'a1', estado: 'en-curso', instancia: 'pixeled', dominio: 'space-os.pixeled.mx', pedidaPor: 'jefa@asnetwork.io', cuando: '2026-09-04T10:00:00Z', registro: ['aprovisionando…'] },
  ]

  it('enseña el estado y quién lo pidió', async () => {
    const dd = deps({ solicitudes: SOLICITUDES })
    const r = await manejar({ metodo: 'GET', ruta: '/flota/altas/', cookie: 'spaces_sesion=s' }, dd.d)
    expect(r.status).toBe(200)
    expect(r.cuerpo).toContain('en-curso')
    expect(r.cuerpo).toContain('jefa@asnetwork.io')
  })

  it('el registro del alta sale ESCAPADO', async () => {
    // Ese texto lo escribe `provision-instancia.sh`, que a su vez repite lo que
    // dijeron `doctl`, `ssh` y `psql`. No es texto nuestro.
    const dd = deps({
      solicitudes: [{ ...SOLICITUDES[0], registro: ['<img src=x onerror=alert(1)>'] }],
    })
    const r = await manejar({ metodo: 'GET', ruta: '/flota/altas/', cookie: 'spaces_sesion=s' }, dd.d)
    expect(r.cuerpo).not.toContain('<img src=x')
    expect(r.cuerpo).toContain('&lt;img')
  })

  it('sin sesión no se ve ninguna', async () => {
    const dd = deps({ acceso: { permitido: false, motivo: 'sin sesion' }, solicitudes: SOLICITUDES })
    const r = await manejar({ metodo: 'GET', ruta: '/flota/altas/', cookie: undefined }, dd.d)
    expect(r.status).toBe(401)
    expect(r.cuerpo).not.toContain('space-os.pixeled.mx')
  })
})
