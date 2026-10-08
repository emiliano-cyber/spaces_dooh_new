import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// El estado del módulo decide si una empresa ve sus equipos, la demostración o
// el aviso de "no responde". Un error aquí le enseñaría la demo a quien ya pagó
// (o errores a quien no tiene el módulo), así que se prueban los tres caminos.
// Las variables se leen al cargar el módulo: cada caso lo carga de nuevo.
async function cargar(env: Record<string, string>) {
  vi.resetModules()
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
  return import('./space-eye')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('estadoDelModulo', () => {
  it('sin Space Eye configurado es no_contratado, sin preguntar a nadie', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const m = await cargar({ SPACE_EYE_BASE_URL: '', SPACE_EYE_KEY: '' })
    expect(await m.estadoDelModulo()).toBe('no_contratado')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('con el servidor de cámaras respondiendo es activo', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetch)
    const m = await cargar({ SPACE_EYE_BASE_URL: 'http://eyes.local', SPACE_EYE_KEY: 'se_x' })
    expect(await m.estadoDelModulo()).toBe('activo')
    expect(fetch.mock.calls[0][0]).toBe('http://eyes.local/health')
  })

  it('caído o sin contestar es sin_respuesta, y no se vuelve a preguntar en 30 s', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    vi.stubGlobal('fetch', fetch)
    const m = await cargar({ SPACE_EYE_BASE_URL: 'http://eyes.local', SPACE_EYE_KEY: 'se_x' })
    expect(await m.estadoDelModulo()).toBe('sin_respuesta')
    expect(await m.estadoDelModulo()).toBe('sin_respuesta')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('un 500 del servidor también es sin_respuesta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const m = await cargar({ SPACE_EYE_BASE_URL: 'http://eyes.local', SPACE_EYE_KEY: 'se_x' })
    expect(await m.estadoDelModulo()).toBe('sin_respuesta')
  })

  // La licencia decide si la empresa tiene licencia (etapa 4). Sin licencia
  // (hijos administrados) manda la configuracion, como antes.
  const dir = mkdtempSync(join(tmpdir(), 'lic-'))
  const lic = (contenido: object | string) => {
    const f = join(dir, `l-${Math.random()}.json`)
    writeFileSync(f, typeof contenido === 'string' ? contenido : JSON.stringify(contenido))
    return f
  }
  const conEyes = { SPACE_EYE_BASE_URL: 'http://eyes.local', SPACE_EYE_KEY: 'se_x' }

  it('con licencia que incluye space-eyes: activo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const m = await cargar({ ...conEyes, LICENCIA_JSON: lic({ instancia: 'x', modulos: ['space-eyes'] }) })
    expect(await m.estadoDelModulo()).toBe('activo')
  })

  it('con licencia firmada SIN space-eyes: la demostracion, aunque el servidor exista', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetch)
    const m = await cargar({ ...conEyes, LICENCIA_JSON: lic({ instancia: 'x', vence: '2027-01-01', modulos: [] }) })
    expect(await m.estadoDelModulo()).toBe('no_contratado')
    expect(fetch).not.toHaveBeenCalled()
  })

  // Las licencias firmadas antes de la etapa 4 no traen `modulos`. Si eso
  // contara como «sin Space Eyes», desplegar esta version le quitaria el modulo
  // a toda instancia con licencia que ya lo usa (revision del 07/10).
  it('con una licencia de antes (sin el campo modulos): manda la configuracion', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const m = await cargar({ ...conEyes, LICENCIA_JSON: lic({ instancia: 'x', vence: '2027-01-01' }) })
    expect(await m.estadoDelModulo()).toBe('activo')
  })

  it('sin archivo de licencia: manda la configuracion', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const m = await cargar({ ...conEyes, LICENCIA_JSON: join(dir, 'no-existe.json') })
    expect(await m.estadoDelModulo()).toBe('activo')
  })

  it('una licencia ilegible no le quita el modulo a nadie', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const m = await cargar({ ...conEyes, LICENCIA_JSON: lic('{ esto no es json') })
    expect(await m.estadoDelModulo()).toBe('activo')
  })
})
