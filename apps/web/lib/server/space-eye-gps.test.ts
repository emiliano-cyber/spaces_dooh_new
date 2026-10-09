import { afterEach, describe, expect, it, vi } from 'vitest'

// Space Eye guarda el GPS en columnas DECIMAL y mysql2 las entrega como TEXTO.
// La ficha del equipo hace `gps.lat.toFixed(5)`: con texto, la pagina entera
// tronaba («Application error») en cuanto un telefono mandaba su ubicacion
// (g500, 09/10/2026). Lo que sale del adaptador tiene que ser numero siempre.
async function cargar() {
  vi.resetModules()
  vi.stubEnv('SPACE_EYE_BASE_URL', 'http://eyes.local')
  vi.stubEnv('SPACE_EYE_KEY', 'se_x')
  return import('./space-eye')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('gpsDeFoto', () => {
  it('el texto de una columna DECIMAL sale como numero', async () => {
    const m = await cargar()
    expect(m.gpsDeFoto({ gps_lat: '19.43260000', gps_lng: '-99.13320000' })).toEqual({ lat: 19.4326, lng: -99.1332 })
  })

  it('los numeros pasan igual', async () => {
    const m = await cargar()
    expect(m.gpsDeFoto({ gps_lat: 19.5, gps_lng: -99.1 })).toEqual({ lat: 19.5, lng: -99.1 })
  })

  it('sin ubicacion, o con basura, no hay GPS (en vez de NaN)', async () => {
    const m = await cargar()
    expect(m.gpsDeFoto({ gps_lat: null, gps_lng: '-99.1' })).toBeNull()
    expect(m.gpsDeFoto({})).toBeNull()
    expect(m.gpsDeFoto({ gps_lat: '', gps_lng: '' })).toBeNull()
    expect(m.gpsDeFoto({ gps_lat: 'abc', gps_lng: '1' })).toBeNull()
  })
})

describe('equipoDetalle con un telefono que manda ubicacion', () => {
  it('las fotos llegan con el GPS en numeros, listas para toFixed', async () => {
    const respuestas: Record<string, unknown> = {
      '/api/devices/1': {
        device: { id: 1, name: 'Device android-', owner: 'g500', online: 1, battery_pct: 68 },
        latest_status: { battery_temp: '31.50' },
        data_usage: null,
      },
      '/api/photos?device_id=1&limit=24': {
        photos: [{ device_id: 1, storage_path: '/storage/1/a.jpg', taken_at: null, width: 10, height: 10,
          gps_lat: '19.43260000', gps_lng: '-99.13320000', verification_status: null, is_correct: null,
          verification_score: null }],
      },
    }
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const ruta = url.replace('http://eyes.local', '')
      const cuerpo = respuestas[ruta]
      return { ok: cuerpo !== undefined, status: cuerpo !== undefined ? 200 : 404, json: async () => cuerpo ?? {} }
    }))
    const m = await cargar()
    const d = await m.equipoDetalle(1)
    expect(d).not.toBeNull()
    const gps = d!.fotos[0].gps!
    expect(typeof gps.lat).toBe('number')
    expect(gps.lat.toFixed(5)).toBe('19.43260')
    expect(gps.lng.toFixed(5)).toBe('-99.13320')
  })
})
