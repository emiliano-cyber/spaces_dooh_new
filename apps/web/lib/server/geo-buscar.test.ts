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

// ============================================================================
//  UBIC-01 (29/10) · Coordenadas, enlaces de Google Maps y el buscador de Google
//  cuando la instancia pone su clave.
// ----------------------------------------------------------------------------
//  Decisión del dueño: sin clave y gratis se pueden pegar coordenadas o un
//  enlace de Google Maps; con la clave del owner (`GOOGLE_MAPS_SERVIDOR_KEY`,
//  en el `app.env` de la instancia, leída al vuelo) el buscador de calles es el
//  de Google; sin ella, sigue el de OpenStreetMap.
// ============================================================================

const GOOGLE_OK = {
  status: 'OK',
  results: [
    {
      formatted_address: 'Av. Insurgentes Sur 1420, Actipan, 03230 CDMX, México',
      geometry: { location: { lat: 19.3767, lng: -99.1786 } },
      place_id: 'ChIJ-prueba-1',
    },
    { formatted_address: 'Sin coordenadas', geometry: { location: { lat: 'x', lng: null } }, place_id: 'ChIJ-x' },
  ],
}

describe('UBIC-01 · coordenadas y enlaces pegados en el buscador', () => {
  it('unas coordenadas se devuelven tal cual, SIN salir a la red ni gastar el tope', async () => {
    const r = await buscarDireccion('19.4326, -99.1332', 'u1')
    expect(r.proveedor).toBe('coordenadas')
    expect(r.resultados).toEqual([expect.objectContaining({ lat: 19.4326, lng: -99.1332 })])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('un enlace largo de Google Maps, igual: se lee sin red (y puede pasar de 200 letras)', async () => {
    const largo = `https://www.google.com/maps/place/Z%C3%B3calo/@19.4326,-99.1332,17z/data=${'!1m1'.repeat(60)}`
    expect(largo.length).toBeGreaterThan(200)
    const r = await buscarDireccion(largo, 'u1')
    expect(r.proveedor).toBe('enlace')
    expect(r.resultados[0]).toMatchObject({ lat: 19.4326, lng: -99.1332 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('un enlace corto se sigue en el servidor y devuelve UN punto', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 302,
      ok: false,
      headers: new Headers({ location: 'https://www.google.com/maps/@19.4326,-99.1332,17z' }),
    })
    const r = await buscarDireccion('https://maps.app.goo.gl/AbC123', 'u1')
    expect(r.proveedor).toBe('enlace')
    expect(r.resultados).toEqual([expect.objectContaining({ lat: 19.4326, lng: -99.1332 })])
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://maps.app.goo.gl/AbC123')
  })

  it('un enlace de otro dominio es un 400 y NO sale a la red (ni a Nominatim)', async () => {
    await expect(buscarDireccion('https://evil.example/maps/@19.4,-99.1,3z', 'u1')).rejects.toMatchObject({ status: 400 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('coordenadas fuera de rango son un 400 con el motivo, sin red', async () => {
    await expect(buscarDireccion('91.5, -99.1332', 'u1')).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/latitud/i),
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('un texto de más de 2000 letras es un 400 aunque parezca enlace', async () => {
    await expect(buscarDireccion(`https://www.google.com/maps/@19.4,-99.1,3z/${'x'.repeat(2000)}`, 'u1')).rejects.toMatchObject({
      status: 400,
    })
  })

  it('los enlaces cortos cuentan para el tope por persona (cada uno es una salida a la red)', async () => {
    fetchMock.mockResolvedValue({
      status: 302,
      ok: false,
      headers: new Headers({ location: 'https://www.google.com/maps/@19.4326,-99.1332,17z' }),
    })
    for (let i = 0; i < 30; i++) await buscarDireccion(`https://maps.app.goo.gl/c${i}`, 'u1')
    await expect(buscarDireccion('https://maps.app.goo.gl/otro', 'u1')).rejects.toMatchObject({ status: 429 })
  })
})

describe('UBIC-01 · el proveedor del buscador de calles', () => {
  it('sin clave de Google (o vacía) busca en OpenStreetMap, como siempre', async () => {
    vi.stubEnv('GOOGLE_MAPS_SERVIDOR_KEY', '   ')
    const r = await buscarDireccion('Insurgentes Sur 1420', 'u1')
    expect(r.proveedor).toBe('osm')
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^https:\/\/nominatim\.openstreetmap\.org\//)
  })

  it('con clave, pregunta a la Geocoding API de Google, en español y sesgada a México', async () => {
    vi.stubEnv('GOOGLE_MAPS_SERVIDOR_KEY', 'clave-de-prueba')
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => GOOGLE_OK })
    const r = await buscarDireccion('Insurgentes Sur 1420', 'u1')
    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/geocode/json')
    expect(url.searchParams.get('address')).toBe('Insurgentes Sur 1420')
    expect(url.searchParams.get('key')).toBe('clave-de-prueba')
    expect(url.searchParams.get('language')).toBe('es')
    expect(url.searchParams.get('region')).toBe('mx')
    expect(url.searchParams.get('components')).toBe('country:MX')
    expect(r.proveedor).toBe('google')
    expect(r.resultados).toEqual([
      {
        nombre: 'Av. Insurgentes Sur 1420, Actipan, 03230 CDMX, México',
        lat: 19.3767,
        lng: -99.1786,
        placeId: 'ChIJ-prueba-1',
      },
    ])
  })

  it('con Google NO se aplica la espera de 1/s (es la política de Nominatim, no la de Google)', async () => {
    vi.stubEnv('GOOGLE_MAPS_SERVIDOR_KEY', 'clave-de-prueba')
    fetchMock.mockResolvedValue({ ok: true, json: async () => GOOGLE_OK })
    await buscarDireccion('Insurgentes Sur 1420', 'u1')
    await expect(buscarDireccion('Viaducto Miguel Alemán 312', 'u2')).resolves.toMatchObject({ proveedor: 'google' })
  })

  it('ZERO_RESULTS es una lista vacía, no un error', async () => {
    vi.stubEnv('GOOGLE_MAPS_SERVIDOR_KEY', 'clave-de-prueba')
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) })
    await expect(buscarDireccion('Calle que no existe 999', 'u1')).resolves.toEqual({ proveedor: 'google', resultados: [] })
  })

  it('una clave rechazada es un 502 que lo dice, SIN la clave en el mensaje y sin pasarse a OSM a escondidas', async () => {
    vi.stubEnv('GOOGLE_MAPS_SERVIDOR_KEY', 'clave-secreta-123')
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'REQUEST_DENIED', error_message: 'The provided API key is invalid. key=clave-secreta-123' }),
    })
    const e = await buscarDireccion('Insurgentes Sur 1420', 'u1').catch((x) => x)
    expect(e).toMatchObject({ status: 502, message: expect.stringMatching(/Google/) })
    expect(String(e.message)).not.toMatch(/clave-secreta-123/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('un fallo de red con Google también es 502, y no se guarda en memoria', async () => {
    vi.stubEnv('GOOGLE_MAPS_SERVIDOR_KEY', 'clave-de-prueba')
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce({ ok: true, json: async () => GOOGLE_OK })
    await expect(buscarDireccion('Insurgentes Sur 1420', 'u1')).rejects.toMatchObject({ status: 502 })
    await expect(buscarDireccion('Insurgentes Sur 1420', 'u1')).resolves.toMatchObject({ proveedor: 'google' })
  })

  it('la memoria es por proveedor: poner la clave no sirve resultados viejos de OSM', async () => {
    await buscarDireccion('Insurgentes Sur 1420', 'u1')
    vi.stubEnv('GOOGLE_MAPS_SERVIDOR_KEY', 'clave-de-prueba')
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => GOOGLE_OK })
    const r = await buscarDireccion('Insurgentes Sur 1420', 'u1')
    expect(r.proveedor).toBe('google')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
