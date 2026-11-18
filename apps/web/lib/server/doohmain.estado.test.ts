import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  Pausar / reanudar un creativo en DOOHmain y leer su estado, visto desde lo
//  que de verdad recibe el SDK por subproceso (mismo arnés que
//  `doohmain.pantalla.test.ts`).
// ============================================================================

process.env.DOOHMAIN_PUBLISH_ENABLED = '1'

const llamadas: string[][] = []
let respuesta: unknown = { ok: true, estado: 'pause' }
vi.mock('node:child_process', () => ({
  execFile: (_py: string, args: string[], _o: unknown, cb: (e: unknown, r: unknown) => void) => {
    llamadas.push(args)
    cb(null, { stdout: JSON.stringify(respuesta) })
  },
}))
vi.mock('./db', () => ({ q: vi.fn(async () => []), q1: vi.fn(async () => null) }))

const { cambiarEstadoEnDoohmain, consultarCampanasDoohmain } = await import('./doohmain')

beforeEach(() => {
  llamadas.length = 0
  respuesta = { ok: true, estado: 'pause' }
  process.env.DOOHMAIN_PUBLISH_ENABLED = '1'
})

describe('cambiarEstadoEnDoohmain', () => {
  it('pausar manda `estado --status pause` con el id del creativo', async () => {
    const r = await cambiarEstadoEnDoohmain('cr-1', 'pause')
    expect(r.ok).toBe(true)
    expect(llamadas[0]).toEqual(['-m', 'doohmain_sdk', 'estado', '--version', 'cr-1', '--status', 'pause'])
  })

  it('reanudar manda `--status active`', async () => {
    respuesta = { ok: true, estado: 'active' }
    await cambiarEstadoEnDoohmain('cr-1', 'active')
    expect(llamadas[0].slice(-2)).toEqual(['--status', 'active'])
  })

  it('con la integración apagada no llama al SDK', async () => {
    process.env.DOOHMAIN_PUBLISH_ENABLED = '0'
    const r = await cambiarEstadoEnDoohmain('cr-1', 'pause')
    expect(r.ok).toBe(false)
    expect(llamadas).toHaveLength(0)
  })

  it('el error del SDK llega tal cual, no como éxito', async () => {
    respuesta = { ok: false, error: 'El creativo no está publicado en DOOHmain', category: 'validation' }
    const r = await cambiarEstadoEnDoohmain('cr-1', 'pause')
    expect(r).toMatchObject({ ok: false, error: 'El creativo no está publicado en DOOHmain' })
  })
})

describe('consultarCampanasDoohmain', () => {
  it('pide `campanas` con un --auth por campaña y devuelve el payload crudo', async () => {
    respuesta = { ok: true, payload: { A: { status: 'active' } } }
    const r = await consultarCampanasDoohmain(['A', 'B'])
    expect(llamadas[0]).toEqual(['-m', 'doohmain_sdk', 'campanas', '--auth', 'A', '--auth', 'B'])
    expect(r).toEqual({ ok: true, payload: { A: { status: 'active' } } })
  })

  it('sin auths no llama al SDK', async () => {
    const r = await consultarCampanasDoohmain([])
    expect(r.ok).toBe(false)
    expect(llamadas).toHaveLength(0)
  })
})
