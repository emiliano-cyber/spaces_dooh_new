import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buscarDireccion, _reiniciarGeo } from './geo-buscar'

// ============================================================================
//  NEG-01 · El buscador de direcciones, sin red.
// ----------------------------------------------------------------------------
//  Va por el SERVIDOR y no desde el navegador por tres motivos, y cada uno
//  tiene aquí su prueba:
//   · la política de uso de Nominatim (OpenStreetMap) pide UNA consulta por
//     segundo como máximo y una aplicación que se identifique: eso solo se
//     puede garantizar en un punto, no en cada navegador;
//   · así no hay que abrir la CSP a un host nuevo (`next.config.mjs`);
//   · lo que sale de la organización es solo el texto buscado, recortado.
// ============================================================================

const RESPUESTA = [
  { display_name: 'Avenida Insurgentes Sur 1420, Del Valle, CDMX', lat: '19.3765', lon: '-99.1781' },
  { display_name: 'Insurgentes Sur 1420, Benito Juárez', lat: '19.3770', lon: '-99.1779' },
  { display_name: 'Sin coordenadas', lat: 'x', lon: 'y' },
]

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  _reiniciarGeo()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-22T12:00:00Z'))
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => RESPUESTA })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('la consulta', () => {
  it('pregunta a Nominatim en formato JSON, en México y en español, con 5 resultados', async () => {
    await buscarDireccion('Insurgentes Sur 1420', 'u1')
    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.origin + url.pathname).toBe('https://nominatim.openstreetmap.org/search')
    expect(url.searchParams.get('q')).toBe('Insurgentes Sur 1420')
    expect(url.searchParams.get('format')).toBe('jsonv2')
    expect(url.searchParams.get('limit')).toBe('5')
    expect(url.searchParams.get('countrycodes')).toBe('mx')
    expect(url.searchParams.get('accept-language')).toBe('es')
  })

  it('se identifica: la política de uso lo exige y sin ello bloquean la IP', async () => {
    await buscarDireccion('Insurgentes Sur 1420', 'u1')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).get('user-agent')).toMatch(/SPACE-OS/)
  })

  it('la dirección del buscador se puede cambiar por instancia (servidor propio)', async () => {
    vi.stubEnv('GEO_BUSCADOR_URL', 'https://geo.ejemplo.test/search')
    await buscarDireccion('Insurgentes Sur 1420', 'u1')
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^https:\/\/geo\.ejemplo\.test\/search\?/)
  })

  it('devuelve nombre y coordenadas, y descarta los que no traen coordenadas válidas', async () => {
    const r = await buscarDireccion('Insurgentes Sur 1420', 'u1')
    expect(r.proveedor).toBe('osm')
    expect(r.resultados).toEqual([
      { nombre: 'Avenida Insurgentes Sur 1420, Del Valle, CDMX', lat: 19.3765, lng: -99.1781 },
      { nombre: 'Insurgentes Sur 1420, Benito Juárez', lat: 19.377, lng: -99.1779 },
    ])
  })
})

describe('lo que se rechaza antes de salir a la red', () => {
  it('una consulta de menos de 3 letras o de más de 200 es un 400 y no llama a nadie', async () => {
    await expect(buscarDireccion('  a ', 'u1')).rejects.toMatchObject({ status: 400 })
    await expect(buscarDireccion('x'.repeat(201), 'u1')).rejects.toMatchObject({ status: 400 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('el ritmo', () => {
  it('la misma búsqueda otra vez sale de la memoria, sin volver a preguntar', async () => {
    await buscarDireccion('Insurgentes Sur 1420', 'u1')
    vi.setSystemTime(new Date('2026-10-22T12:00:05Z'))
    const r = await buscarDireccion('  insurgentes   SUR 1420 ', 'u2')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(r.resultados).toHaveLength(2)
  })

  it('dos búsquedas DISTINTAS en el mismo segundo: la segunda espera (429), de quien sea', async () => {
    await buscarDireccion('Insurgentes Sur 1420', 'u1')
    await expect(buscarDireccion('Viaducto Miguel Alemán 312', 'u2')).rejects.toMatchObject({ status: 429 })
    vi.setSystemTime(new Date('2026-10-22T12:00:01.100Z'))
    await expect(buscarDireccion('Viaducto Miguel Alemán 312', 'u2')).resolves.toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('cada persona tiene un tope de búsquedas por cada 10 minutos', async () => {
    for (let i = 0; i < 30; i++) {
      vi.setSystemTime(new Date(Date.UTC(2026, 9, 22, 12, 0, 2 * i)))
      await buscarDireccion(`Calle ${i} número ${i}`, 'u1')
    }
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 22, 12, 1, 30)))
    await expect(buscarDireccion('Calle nueva 31', 'u1')).rejects.toMatchObject({ status: 429 })
    // Otra persona no hereda el tope.
    await expect(buscarDireccion('Calle nueva 31', 'u2')).resolves.toBeTruthy()
  })
})

describe('cuando el buscador falla', () => {
  it('una respuesta de error es un 502 con frase, no un 500 ni una lista vacía', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
    await expect(buscarDireccion('Insurgentes Sur 1420', 'u1')).rejects.toMatchObject({
      status: 502,
      message: expect.stringMatching(/buscador/),
    })
  })

  it('si la red revienta, también 502', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'))
    await expect(buscarDireccion('Insurgentes Sur 1420', 'u1')).rejects.toMatchObject({ status: 502 })
  })

  it('un fallo NO se guarda en memoria: la siguiente vez se vuelve a preguntar', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'))
    await expect(buscarDireccion('Insurgentes Sur 1420', 'u1')).rejects.toBeTruthy()
    vi.setSystemTime(new Date('2026-10-22T12:00:02Z'))
    await expect(buscarDireccion('Insurgentes Sur 1420', 'u1')).resolves.toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('lleva tiempo máximo: la petición sale con una señal de cancelación', async () => {
    await buscarDireccion('Insurgentes Sur 1420', 'u1')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
})
