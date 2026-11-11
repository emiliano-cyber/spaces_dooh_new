import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolverEnlaceCorto } from './geo-enlace'
import { CATALOGO_ERRORES } from '@/lib/i18n/errores-servidor'

// ============================================================================
//  UBIC-01 · Seguir un enlace corto de Google Maps (maps.app.goo.gl/…) en el
//  servidor, sin red de verdad.
// ----------------------------------------------------------------------------
//  Un enlace corto no trae coordenadas: hay que pedirlo y leer a dónde
//  redirige. Hacerlo desde el SERVIDOR es abrir una puerta a que alguien use la
//  aplicación para pedir URLs por él (SSRF), así que lo que se prueba aquí es
//  sobre todo lo que NO hace: no pide nada que no sea un enlace corto de Google
//  por https, no sigue una redirección que salga de Google, no da más de cinco
//  saltos, y no se queda colgado.
// ============================================================================

let fetchMock: ReturnType<typeof vi.fn>
const redirige = (location: string, status = 302) => ({
  status,
  ok: false,
  headers: new Headers({ location }),
})

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('lo que sí hace', () => {
  it('pide el enlace corto SIN seguir solo las redirecciones, y lee el destino', async () => {
    fetchMock.mockResolvedValueOnce(
      redirige('https://www.google.com/maps/place/Z%C3%B3calo/@19.4326,-99.1332,17z/data=!3d19.43261!4d-99.13321'),
    )
    const p = await resolverEnlaceCorto('https://maps.app.goo.gl/AbC123')
    expect(p.lat).toBeCloseTo(19.43261, 5)
    expect(p.lng).toBeCloseTo(-99.13321, 5)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://maps.app.goo.gl/AbC123')
    expect(init.redirect).toBe('manual')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('NO pide el destino largo: lo lee de la URL (con eso basta y no sale nada más)', async () => {
    fetchMock.mockResolvedValueOnce(redirige('https://www.google.com/maps/@19.4326,-99.1332,17z'))
    await resolverEnlaceCorto('https://maps.app.goo.gl/AbC123')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sigue varios saltos mientras sean enlaces cortos de Google', async () => {
    fetchMock
      .mockResolvedValueOnce(redirige('https://maps.app.goo.gl/Xyz789', 301))
      .mockResolvedValueOnce(redirige('https://maps.google.com/?q=19.4326,-99.1332'))
    const p = await resolverEnlaceCorto('https://goo.gl/maps/Viejo1')
    expect(p).toEqual({ lat: 19.4326, lng: -99.1332 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('una redirección relativa se resuelve contra el enlace que la dio', async () => {
    fetchMock
      .mockResolvedValueOnce(redirige('/Xyz789'))
      .mockResolvedValueOnce(redirige('https://www.google.com/maps/@19.4326,-99.1332,17z'))
    await resolverEnlaceCorto('https://maps.app.goo.gl/AbC123')
    expect(fetchMock.mock.calls[1][0]).toBe('https://maps.app.goo.gl/Xyz789')
  })
})

describe('lo que NO hace', () => {
  it('no pide nada que no sea un enlace corto de Google por https: 400 sin salir a la red', async () => {
    for (const u of [
      'https://evil.example/AbC',
      'http://maps.app.goo.gl/AbC',
      'https://maps.app.goo.gl.evil.example/AbC',
      'https://goo.gl/AbC',
      'https://www.google.com/maps/@19.4,-99.1,3z',
      'no es una url',
    ]) {
      await expect(resolverEnlaceCorto(u)).rejects.toMatchObject({ status: 400 })
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('una redirección que sale de Google se corta: 400, y el destino NO se pide', async () => {
    fetchMock.mockResolvedValueOnce(redirige('https://evil.example/maps/@19.4326,-99.1332,17z'))
    await expect(resolverEnlaceCorto('https://maps.app.goo.gl/AbC123')).rejects.toMatchObject({ status: 400 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('una redirección a un servidor interno se corta igual', async () => {
    fetchMock.mockResolvedValueOnce(redirige('http://127.0.0.1:5432/'))
    await expect(resolverEnlaceCorto('https://maps.app.goo.gl/AbC123')).rejects.toMatchObject({ status: 400 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('un bucle de redirecciones se corta a los cinco saltos', async () => {
    fetchMock.mockResolvedValue(redirige('https://maps.app.goo.gl/Bucle'))
    await expect(resolverEnlaceCorto('https://maps.app.goo.gl/AbC123')).rejects.toMatchObject({ status: 400 })
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(5)
  })

  it('un enlace que no redirige (200, 404) no lleva a ningún lugar: 400', async () => {
    fetchMock.mockResolvedValueOnce({ status: 200, ok: true, headers: new Headers() })
    await expect(resolverEnlaceCorto('https://maps.app.goo.gl/AbC123')).rejects.toMatchObject({ status: 400 })
    fetchMock.mockResolvedValueOnce({ status: 404, ok: false, headers: new Headers() })
    await expect(resolverEnlaceCorto('https://maps.app.goo.gl/AbC123')).rejects.toMatchObject({ status: 400 })
  })

  it('un destino de Google Maps SIN coordenadas: 400 que lo dice', async () => {
    fetchMock.mockResolvedValueOnce(redirige('https://www.google.com/maps/place/Z%C3%B3calo/?ftid=0x1:0x2'))
    await expect(resolverEnlaceCorto('https://maps.app.goo.gl/AbC123')).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/coordenadas/i),
    })
  })

  it('los mensajes llegan traducidos al inglés (viajan por constante, la GUARDIA no los ve)', async () => {
    fetchMock.mockResolvedValueOnce(redirige('https://www.google.com/maps/place/x/'))
    const sin = await resolverEnlaceCorto('https://maps.app.goo.gl/AbC123').catch((e) => e)
    const fuera = await resolverEnlaceCorto('https://evil.example/x').catch((e) => e)
    for (const e of [sin, fuera]) expect(CATALOGO_ERRORES[e.message], e.message).toBeTruthy()
  })

  it('si la red falla o se agota el tiempo: 502 con frase, no un 500', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'))
    await expect(resolverEnlaceCorto('https://maps.app.goo.gl/AbC123')).rejects.toMatchObject({
      status: 502,
      message: expect.stringMatching(/enlace/i),
    })
  })
})
