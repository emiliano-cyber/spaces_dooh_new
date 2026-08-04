import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { refrescarEstado } from './estado-api'
import { useDemoStore } from './store'

// ============================================================================
//  Semáforo de hidratación del store.
//  Lo que estas pruebas protegen: que la app distinga "todavía no llegan los
//  datos" de "llegaron y no hay". El store arranca con `buildSeed()`, que son
//  arreglos VACÍOS; sin este semáforo las pantallas pintan "0 de 0" mientras la
//  petición viaja, y si la petición falla se quedan así indefinidamente sin
//  avisar. Eso era el hallazgo C1 de la auditoría QA del 04/08/2026: "al
//  recargar se pierden los datos" — nunca se perdieron, no se habían leído.
//
//  El 401 es el único fallo que NO pinta error: la sesión caducó y el AuthGate
//  ya redirige al login; mostrar "no se pudieron cargar los datos" encima sería
//  ruido sobre una redirección en curso.
// ============================================================================

const RESPUESTA_VACIA = {
  sitios: [], clientes: [], campanas: [], reservas: [], creatividades: [],
  ordenesTrabajo: [], evidencias: [], facturas: [], cobranzas: [],
  ordenesImpresion: [], acciones: [], arrendadores: [], predios: [],
  razonesSociales: [], licencias: [], contratos: [], pagosRenta: [],
  incidencias: [], propuestas: [], ordenesCompra: [], notificaciones: [],
}

function mockFetch(impl: () => Promise<Response> | Response) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

describe('refrescarEstado — estadoCarga', () => {
  beforeEach(() => {
    useDemoStore.setState({ estadoCarga: 'pendiente' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('arranca en "pendiente": el store nace vacío, no cargado', () => {
    expect(useDemoStore.getState().estadoCarga).toBe('pendiente')
  })

  it('respuesta correcta → "listo"', async () => {
    mockFetch(() => new Response(JSON.stringify(RESPUESTA_VACIA), { status: 200 }))
    await refrescarEstado()
    expect(useDemoStore.getState().estadoCarga).toBe('listo')
  })

  it('marca "listo" aunque la respuesta venga sin datos: vacío real ≠ no cargado', async () => {
    mockFetch(() => new Response(JSON.stringify(RESPUESTA_VACIA), { status: 200 }))
    await refrescarEstado()
    expect(useDemoStore.getState().estadoCarga).toBe('listo')
    expect(useDemoStore.getState().campanas).toEqual([])
  })

  it('error 500 → "error", no se queda en silencio con el store vacío', async () => {
    mockFetch(() => new Response('boom', { status: 500 }))
    await refrescarEstado()
    expect(useDemoStore.getState().estadoCarga).toBe('error')
  })

  it('401 → sigue "pendiente": lo resuelve el AuthGate redirigiendo al login', async () => {
    mockFetch(() => new Response('no autorizado', { status: 401 }))
    await refrescarEstado()
    expect(useDemoStore.getState().estadoCarga).toBe('pendiente')
  })

  it('caída de red → "error" en vez de propagar la excepción', async () => {
    mockFetch(() => Promise.reject(new Error('sin conexión')))
    await expect(refrescarEstado()).resolves.toBeUndefined()
    expect(useDemoStore.getState().estadoCarga).toBe('error')
  })
})
