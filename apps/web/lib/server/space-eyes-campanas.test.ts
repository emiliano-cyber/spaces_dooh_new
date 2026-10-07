import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  Space Eyes · las campañas vendidas llegan a los equipos de su pantalla.
//
//  Lo que se prueba son las decisiones que, equivocadas, no dan error visible:
//    · que la lista vaya con el origen de LA empresa (cada una apaga solo lo
//      suyo en Space Eye);
//    · que el arte viaje solo cuando Space Eye lo pide (nuevo o cambiado);
//    · que la consulta solo lea y filtre por empresa;
//    · el respiro de 2 min, y que «forzar» se lo salte;
//    · que nunca lance: si Space Eye no está o no contesta, la página sigue.
// ============================================================================

vi.hoisted(() => {
  process.env.SPACE_EYE_BASE_URL = 'http://eyes.test'
  process.env.SPACE_EYE_KEY = 'llave-de-prueba'
})

let filas: Record<string, unknown>[]
let arte: string | null
let consultas: { tenant: string; texto: string; params?: unknown[] }[]
let estado: 'activo' | 'no_contratado' | 'sin_respuesta'

vi.mock('./db', () => ({
  qConTenant: vi.fn(async (tenant: string, texto: string, params?: unknown[]) => {
    consultas.push({ tenant, texto, params })
    if (texto.includes('from reservas')) return filas
    if (texto.includes('from creatividades where id')) return [{ archivo_url: arte }]
    return []
  }),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'empresa-1') }))
vi.mock('./space-eye', () => ({ estadoDelModulo: vi.fn(async () => estado) }))

const { sincronizarCampanasEyes } = await import('./space-eyes-campanas')

const FILA = {
  campana_id: 'c1',
  creatividad_id: 'k1',
  campana: 'Verano',
  creativo: 'Arte A',
  marca: 'Refresco',
  desde: '2026-10-01',
  hasta: '2026-10-31',
  codigos: ['tlalpan-01', 'interlomas-02'],
  sha: 'a'.repeat(64),
}

let llamadas: { url: string; init: RequestInit }[]
let necesita: boolean

beforeEach(() => {
  filas = [FILA]
  arte = 'data:image/png;base64,' + Buffer.from('PNGDATA').toString('base64')
  consultas = []
  estado = 'activo'
  necesita = true
  llamadas = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      llamadas.push({ url, init })
      if (url.endsWith('/api/campaigns/sincronizar')) {
        return new Response(
          JSON.stringify({ campanas: [{ origen_id: 'c1:k1', id: 41, necesita_creativo: necesita }], apagadas: 2 }),
          { status: 200 },
        )
      }
      return new Response('{}', { status: 200 })
    }),
  )
})

describe('sincronizarCampanasEyes', () => {
  it('manda la lista de la empresa con su origen y sube el arte que falta', async () => {
    const r = await sincronizarCampanasEyes({ forzar: true, tenant: 'empresa-1' })
    expect(r).toEqual({ campanas: 1, arteSubido: 1, apagadas: 2 })

    const sync = llamadas[0]
    expect(sync.url).toBe('http://eyes.test/api/campaigns/sincronizar')
    const cuerpo = JSON.parse(String(sync.init.body))
    expect(cuerpo.origen).toBe('spaceos:empresa-1')
    expect(cuerpo.campanas).toEqual([
      {
        origen_id: 'c1:k1',
        nombre: 'Verano · Arte A',
        anunciante: 'Refresco',
        desde: '2026-10-01',
        hasta: '2026-10-31',
        codigos: ['tlalpan-01', 'interlomas-02'],
        sha: 'a'.repeat(64),
      },
    ])
    expect((sync.init.headers as Record<string, string>).Authorization).toBe('Bearer llave-de-prueba')

    const subida = llamadas[1]
    expect(subida.url).toBe('http://eyes.test/api/campaigns/41/creative')
    const fd = subida.init.body as FormData
    expect(fd.get('origen_sha')).toBe('a'.repeat(64))
    const archivo = fd.get('creative') as Blob
    expect(archivo.type).toBe('image/png')
    expect(Buffer.from(await archivo.arrayBuffer()).toString()).toBe('PNGDATA')
  })

  it('no resube el arte que Space Eye ya tiene', async () => {
    necesita = false
    const r = await sincronizarCampanasEyes({ forzar: true, tenant: 'empresa-1' })
    expect(r?.arteSubido).toBe(0)
    expect(llamadas).toHaveLength(1)
  })

  it('solo lee, con la empresa explícita y solo lo confirmado y validado', async () => {
    await sincronizarCampanasEyes({ forzar: true, tenant: 'empresa-1' })
    const lectura = consultas.find((c) => c.texto.includes('from reservas'))!
    expect(lectura.tenant).toBe('empresa-1')
    expect(lectura.params).toEqual(['empresa-1'])
    expect(lectura.texto).toMatch(/r\.estatus = 'CONFIRMADA'/)
    expect(lectura.texto).toMatch(/estado_comercial in \('CONFIRMADA', 'ACTIVA'\)/)
    expect(lectura.texto).toMatch(/estatus_validacion = 'VALIDADA'/)
    expect(lectura.texto).toMatch(/retirado_en is null/)
    expect(lectura.texto).not.toMatch(/\b(insert|update|delete)\b/i)
    const delArte = consultas.find((c) => c.texto.includes('from creatividades where id'))!
    expect(delArte.params).toEqual(['k1', 'empresa-1'])
  })

  it('sin campañas manda la lista vacía (Space Eye apaga las de antes)', async () => {
    filas = []
    await sincronizarCampanasEyes({ forzar: true, tenant: 'empresa-1' })
    expect(JSON.parse(String(llamadas[0].init.body)).campanas).toEqual([])
  })

  it('respeta el respiro de 2 minutos, y forzar se lo salta', async () => {
    expect(await sincronizarCampanasEyes({ tenant: 'empresa-2' })).not.toBeNull()
    expect(await sincronizarCampanasEyes({ tenant: 'empresa-2' })).toBeNull()
    expect(await sincronizarCampanasEyes({ tenant: 'empresa-2', forzar: true })).not.toBeNull()
  })

  it('sin Space Eyes activo no llama a nadie', async () => {
    estado = 'no_contratado'
    expect(await sincronizarCampanasEyes({ forzar: true, tenant: 'empresa-1' })).toBeNull()
    expect(llamadas).toHaveLength(0)
  })

  it('nunca lanza si Space Eye falla', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })))
    await expect(sincronizarCampanasEyes({ forzar: true, tenant: 'empresa-1' })).resolves.toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('sin red') }))
    await expect(sincronizarCampanasEyes({ forzar: true, tenant: 'empresa-1' })).resolves.toBeNull()
  })

  it('un creativo en HTML no tiene arte que subir', async () => {
    arte = '<html>no es imagen</html>'
    const r = await sincronizarCampanasEyes({ forzar: true, tenant: 'empresa-1' })
    expect(r?.arteSubido).toBe(0)
  })
})
