import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================================
//  Los instaladores de Space Eye se bajan POR ESTA aplicación (revisión 06/10).
// ----------------------------------------------------------------------------
//  El botón apuntaba su `href` directo a `${SPACE_EYE_BASE_URL}/space-eye.apk`,
//  que hoy es HTTP plano. Dos fallos con la misma causa:
//
//    · En una instancia (HTTPS), Chrome BLOQUEA una descarga insegura que sale
//      de una página segura. El APK no se bajaba, en producción, y en local
//      —todo http— funcionaba. Es el mismo fallo que ya tenían las fotos y que
//      `/api/space-eyes/foto` existe para resolver.
//    · Desde la wifi de un cliente, alguien en esa red podía cambiar el APK que
//      se instala en un equipo con cámara que va a vivir en un espectacular.
//
//  Ahora el navegador baja de `/api/space-eyes/descarga/<tipo>`, por el mismo
//  dominio y certificado que la página, y la ficha enseña el sha256.
// ============================================================================

const BASE = 'http://space-eye.interno:4200'

let fetchFalso: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('SPACE_EYE_BASE_URL', BASE)
  vi.stubEnv('SPACE_EYE_KEY', 'se_abc_secreto')
  fetchFalso = vi.fn(async (url: string) => {
    if (url.endsWith('.json')) {
      return new Response(JSON.stringify({ version: '0.15.2', bytes: 1048576, sha256: 'ab'.repeat(32) }))
    }
    if (url.endsWith('/api/devices')) return new Response(JSON.stringify({ devices: [] }))
    return new Response('BINARIO', { status: 200, headers: { 'content-type': 'application/octet-stream' } })
  })
  vi.stubGlobal('fetch', fetchFalso)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const exigir = vi.fn(async (..._a: unknown[]) => ({ ok: true, usuario: { id: 'u-1' } }))
vi.mock('@/lib/server/auth', () => ({ exigir: (...a: unknown[]) => exigir(...a) }))

describe('1 · la ficha de alta apunta a esta aplicación, no a Space Eye', () => {
  it('las tres descargas van por /api/space-eyes/descarga, sin la dirección de Space Eye', async () => {
    const { infoDeAlta } = await import('./space-eye')
    const info = await infoDeAlta()
    expect(info.apk?.url).toBe('/spaces-dooh/api/space-eyes/descarga/apk/')
    expect(info.agentePc?.url).toBe('/spaces-dooh/api/space-eyes/descarga/agente-pc/')
    expect(info.agentePi?.url).toBe('/spaces-dooh/api/space-eyes/descarga/agente-pi/')
    for (const d of [info.apk, info.agentePc, info.agentePi]) expect(d?.url).not.toContain(BASE)
  })

  it('y siguen trayendo su sha256, que ahora se enseña', async () => {
    const { infoDeAlta } = await import('./space-eye')
    expect((await infoDeAlta()).apk?.sha256).toBe('ab'.repeat(32))
  })
})

describe('2 · la ruta de descarga', () => {
  const pedir = async (tipo: string) => {
    const { GET } = await import('@/app/api/space-eyes/descarga/[tipo]/route')
    return GET(new Request(`http://127.0.0.1/spaces-dooh/api/space-eyes/descarga/${tipo}/`), {
      params: { tipo },
    })
  }

  it('sirve el APK desde Space Eye, como adjunto', async () => {
    const r = await pedir('apk')
    expect(r.status).toBe(200)
    expect(await r.text()).toBe('BINARIO')
    expect(r.headers.get('content-disposition')).toBe('attachment; filename="space-eye.apk"')
    expect(fetchFalso).toHaveBeenCalledWith(`${BASE}/space-eye.apk`, expect.anything())
  })

  it('un tipo que no está en la lista es un 404 y no se pide nada', async () => {
    const r = await pedir('..%2f..%2fetc%2fpasswd')
    expect(r.status).toBe(404)
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('exige poder ver el inventario', async () => {
    exigir.mockResolvedValueOnce({ ok: false, error: 'No autorizado', status: 401 } as never)
    const r = await pedir('apk')
    expect(r.status).toBe(401)
    expect(exigir).toHaveBeenCalledWith('inventario', 'ver')
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('si Space Eye no lo tiene, se dice, sin disfrazarlo de 200', async () => {
    fetchFalso.mockResolvedValueOnce(new Response('no', { status: 404 }))
    const r = await pedir('agente-pi')
    expect(r.status).toBe(404)
  })
})
