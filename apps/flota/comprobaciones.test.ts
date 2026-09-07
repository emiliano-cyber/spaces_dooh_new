import { describe, expect, it } from 'vitest'
// @ts-expect-error — módulo .mjs sin tipos, como el resto de `apps/flota`
import { comprobar, veredicto, ESPERADO } from './comprobaciones.mjs'

// ============================================================================
//  Las tres comprobaciones del alta.  (A0.1 del Plan_Alta_Desatendida)
// ----------------------------------------------------------------------------
//  Son las de F5.6, que hasta ahora se corrían a mano y cuyo resultado se
//  quedaba en la pantalla de quien las lanzó. Un alta cuyo resultado solo vive
//  en un `journalctl` no es auditable tres semanas después — y eso es
//  exactamente lo que costó el defecto 27 del 2026-09-07.
//
//  Lo que se vigila aquí no es que salgan bien: es que **un resultado raro
//  quede anotado en vez de perderse**, y que una comprobación que falla no se
//  lleve por delante a las otras dos.
// ============================================================================

/** Un `fetch` de mentira: responde por ruta, y puede lanzar. */
function fetchDe(porRuta: Record<string, number | Error>) {
  const vistas: string[] = []
  const cuerpos: string[] = []
  const pedir = async (url: string, opciones?: { method?: string; body?: string }) => {
    vistas.push(`${opciones?.method ?? 'GET'} ${url}`)
    if (opciones?.body) cuerpos.push(String(opciones.body))
    // `endsWith` y rutas COMPLETAS, no `includes`: con `includes` la clave
    // `/login/` casa tambien con `/api/auth/login/`, y las dos comprobaciones
    // reciben la misma respuesta. Paso al escribir esto.
    for (const [trozo, respuesta] of Object.entries(porRuta)) {
      if (String(url).endsWith(trozo)) {
        if (respuesta instanceof Error) throw respuesta
        return { status: respuesta }
      }
    }
    return { status: 404 }
  }
  return { pedir, vistas, cuerpos }
}

const R = {
  login: '/spaces-dooh/login/',
  signup: '/spaces-dooh/api/signup/',
  post: '/spaces-dooh/api/auth/login/',
}
const TODO_BIEN = { [R.login]: 200, [R.signup]: 503, [R.post]: 401 }

describe('las tres comprobaciones del alta', () => {
  it('devuelve los tres codigos, con el nombre de cada uno', async () => {
    const { pedir } = fetchDe(TODO_BIEN)
    const r = await comprobar('http://ensayo4.space-os.io', { pedir })
    expect(r).toEqual({ login: 200, signup: 503, 'login-post': 401 })
  })

  it('un codigo INESPERADO se anota, no se descarta', async () => {
    // Es el corazon de esto. Un 502 en `login` es un dato que hay que
    // conservar, no una razon para tirar el resultado.
    const { pedir } = fetchDe({ ...TODO_BIEN, [R.login]: 502 })
    const r = await comprobar('http://ensayo4.space-os.io', { pedir })
    expect(r.login).toBe(502)
    expect(r.signup).toBe(503)
    expect(r['login-post']).toBe(401)
  })

  it('si una peticion revienta, se anota 000 y las otras DOS siguen', async () => {
    // Una comprobacion que se lleva por delante a las demas no informa: deja
    // ciego. `000` es la misma convencion que usa `curl -w '%{http_code}'`.
    const { pedir } = fetchDe({ ...TODO_BIEN, [R.signup]: new Error('ECONNREFUSED') })
    const r = await comprobar('http://ensayo4.space-os.io', { pedir })
    expect(r.signup).toBe(0)
    expect(r.login).toBe(200)
    expect(r['login-post']).toBe(401)
  })

  it('NUNCA lanza, aunque todo falle', async () => {
    const { pedir } = fetchDe({
      [R.login]: new Error('a'),
      [R.signup]: new Error('b'),
      [R.post]: new Error('c'),
    })
    await expect(comprobar('http://x.mx', { pedir })).resolves.toEqual({
      login: 0,
      signup: 0,
      'login-post': 0,
    })
  })

  it('el intento de login usa un dominio IMPOSIBLE, y ninguna credencial de verdad', async () => {
    // Si esto mandara una credencial real, la comprobacion seria un intento de
    // acceso con credenciales validas registrado en la instancia de un cliente.
    // El correo va a un dominio reservado por la RFC 2606: no existe ni puede
    // existir, igual que los del `flota.example.json`.
    const { pedir, vistas, cuerpos } = fetchDe(TODO_BIEN)
    await comprobar('http://ensayo4.space-os.io', { pedir })

    expect(vistas.filter((v) => v.startsWith('POST'))).toHaveLength(1)
    expect(vistas.find((v) => v.startsWith('POST'))).toContain('/api/auth/login/')

    expect(cuerpos).toHaveLength(1)
    const enviado = JSON.parse(cuerpos[0])
    expect(enviado.email).toMatch(/\.(invalid|test|example)$/)
    expect(enviado.password).toBeTruthy()
  })

  it('los codigos esperados estan declarados, no repartidos por el codigo', () => {
    expect(ESPERADO).toEqual({ login: 200, signup: 503, 'login-post': 401 })
  })
})

describe('el veredicto', () => {
  it('ok solo si los TRES son los esperados', () => {
    expect(veredicto({ login: 200, signup: 503, 'login-post': 401 })).toEqual({ ok: true, raras: [] })
  })

  it('nombra las que no cuadran, para no tener que compararlas a ojo', () => {
    const v = veredicto({ login: 502, signup: 503, 'login-post': 200 })
    expect(v.ok).toBe(false)
    expect(v.raras.sort()).toEqual(['login', 'login-post'])
  })

  it('un 200 en signup NO es ok: significa que el autoregistro esta abierto', () => {
    // Es la comprobacion mas importante de las tres y la mas facil de leer al
    // reves: en la instancia de un cliente, 200 en `signup` es que cualquiera
    // se puede dar de alta.
    const v = veredicto({ login: 200, signup: 200, 'login-post': 401 })
    expect(v.ok).toBe(false)
    expect(v.raras).toContain('signup')
  })
})
