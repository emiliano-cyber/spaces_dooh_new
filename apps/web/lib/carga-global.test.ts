import { describe, it, expect, beforeEach, vi } from 'vitest'

// ============================================================================
//  El contador de peticiones en vuelo. Lo que hay que garantizar:
//
//   · Sube y BAJA. Si se quedara arriba, la barra de carga no se apagaría nunca
//     y el usuario creería que el sistema está colgado.
//   · Baja también cuando la petición FALLA. Es el caso fácil de olvidar y el
//     que más se nota: un error de red dejaría la barra encendida para siempre.
//   · Ignora lo que no es nuestra API (chunks de Next, prefetch), que no es
//     espera del usuario.
//   · No se instala dos veces, o cada petición contaría doble.
// ============================================================================

const API = '/spaces-dooh/api/estado/'

async function cargarModulo() {
  vi.resetModules()
  return import('./carga-global')
}

function simularNavegador(fetchBase: typeof fetch) {
  const w = { fetch: fetchBase } as unknown as Window & typeof globalThis
  ;(globalThis as any).window = w
  return w
}

beforeEach(() => {
  delete (globalThis as any).window
})

describe('contador de peticiones en vuelo', () => {
  it('sube durante la petición y vuelve a cero al terminar', async () => {
    let resolver: (v: any) => void = () => {}
    const w = simularNavegador((() => new Promise((r) => { resolver = r })) as any)
    const m = await cargarModulo()
    m.instalarContadorDeCarga()

    const vistos: number[] = []
    m.suscribirCarga((n) => vistos.push(n))

    const p = w.fetch(API)
    expect(m.peticionesEnVuelo()).toBe(1)
    resolver(new Response('{}'))
    await p
    expect(m.peticionesEnVuelo()).toBe(0)
    expect(vistos).toEqual([0, 1, 0])
  })

  it('BAJA aunque la petición falle', async () => {
    const w = simularNavegador((() => Promise.reject(new Error('sin red'))) as any)
    const m = await cargarModulo()
    m.instalarContadorDeCarga()

    await expect(w.fetch(API)).rejects.toThrow('sin red')
    expect(m.peticionesEnVuelo()).toBe(0)
  })

  it('cuenta varias a la vez y solo llega a cero con la última', async () => {
    const pendientes: ((v: any) => void)[] = []
    const w = simularNavegador((() => new Promise((r) => pendientes.push(r))) as any)
    const m = await cargarModulo()
    m.instalarContadorDeCarga()

    const a = w.fetch(API), b = w.fetch(API), c = w.fetch(API)
    expect(m.peticionesEnVuelo()).toBe(3)
    pendientes[0](new Response('{}')); await a
    expect(m.peticionesEnVuelo()).toBe(2)
    pendientes[1](new Response('{}')); await b
    pendientes[2](new Response('{}')); await c
    expect(m.peticionesEnVuelo()).toBe(0)
  })

  it('ignora lo que no es nuestra API', async () => {
    const w = simularNavegador((() => Promise.resolve(new Response('{}'))) as any)
    const m = await cargarModulo()
    m.instalarContadorDeCarga()

    for (const url of ['/_next/static/chunks/x.js', 'https://api.fontshare.com/v2/css', '/otra/cosa']) {
      const p = w.fetch(url)
      expect(m.peticionesEnVuelo(), url).toBe(0)
      await p
    }
  })

  it('reconoce la URL absoluta de la API, no solo la relativa', async () => {
    let resolver: (v: any) => void = () => {}
    const w = simularNavegador((() => new Promise((r) => { resolver = r })) as any)
    const m = await cargarModulo()
    m.instalarContadorDeCarga()

    const p = w.fetch('https://demo.space-os.io/spaces-dooh/api/estado/')
    expect(m.peticionesEnVuelo()).toBe(1)
    resolver(new Response('{}'))
    await p
  })

  it('instalarlo dos veces no duplica la cuenta', async () => {
    let resolver: (v: any) => void = () => {}
    const w = simularNavegador((() => new Promise((r) => { resolver = r })) as any)
    const m = await cargarModulo()
    m.instalarContadorDeCarga()
    m.instalarContadorDeCarga() // p. ej. un doble montaje en React

    const p = w.fetch(API)
    expect(m.peticionesEnVuelo()).toBe(1)
    resolver(new Response('{}'))
    await p
    expect(m.peticionesEnVuelo()).toBe(0)
  })

  it('en el servidor no toca nada (no hay window)', async () => {
    const m = await cargarModulo()
    expect(() => m.instalarContadorDeCarga()).not.toThrow()
  })
})

describe('peticiones de fondo', () => {
  it('el sondeo de notificaciones NO enciende la barra', async () => {
    let resolver: (v: any) => void = () => {}
    const w = simularNavegador((() => new Promise((r) => { resolver = r })) as any)
    const m = await cargarModulo()
    m.instalarContadorDeCarga()

    // El usuario no espera esta respuesta: encender la barra cada pocos
    // segundos parecería que la aplicación va lenta.
    const p = w.fetch('/spaces-dooh/api/notificaciones/nuevas/?sondeo=1&desde=2026-01-01')
    expect(m.peticionesEnVuelo()).toBe(0)
    resolver(new Response('{}'))
    await p
  })

  it('la misma ruta SIN la marca sí la enciende', async () => {
    let resolver: (v: any) => void = () => {}
    const w = simularNavegador((() => new Promise((r) => { resolver = r })) as any)
    const m = await cargarModulo()
    m.instalarContadorDeCarga()

    const p = w.fetch('/spaces-dooh/api/notificaciones/nuevas/?desde=2026-01-01')
    expect(m.peticionesEnVuelo()).toBe(1)
    resolver(new Response('{}'))
    await p
  })
})
