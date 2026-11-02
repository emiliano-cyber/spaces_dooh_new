import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  ADR 0048 · la moneda de la instancia SOLO la elige el bootstrap.
//
//  `/api/signup` y `/api/bootstrap` comparten `registrarCuentaCtrl`. Con
//  AUTOREGISTRO=1 y la base vacia, un visitante ANONIMO crearia la primera
//  organizacion: si pudiera mandar `moneda`, decidiria la de toda la instancia
//  para siempre. Se prueba aqui, con el resto del alta simulado, porque la e2e
//  arranca el servidor con el autorregistro apagado (`servidor-e2e.ts`, que no
//  se toca) y `/api/signup` contesta 503 antes de llegar al controlador.
// ============================================================================

const insertados: Array<{ moneda: string }> = []
let monedaDeLaBase: string | null = null

vi.mock('./db', () => ({
  withTxBootstrap: async (fn: (x: unknown) => Promise<unknown>) =>
    fn({
      client: { query: async () => ({ rows: monedaDeLaBase ? [{ moneda: monedaDeLaBase }] : [] }) },
      fijarTenant: async () => {},
    }),
}))
vi.mock('./tenant', () => ({
  crearTenant: async (_n: string, _s: string, _c: unknown, moneda: string) => {
    insertados.push({ moneda })
    return { id: 't1', nombre: 'Org', slug: 'org', creadoEn: '' }
  },
}))
vi.mock('./usuarios-repo', () => ({
  emailExiste: async () => false,
  crearUsuario: async () => ({ id: 'u1' }),
}))
vi.mock('./auth', () => ({
  validarPassword: () => null,
  passwordDeAlta: (o: { password?: string }) => ({ password: o.password ?? 'AleatoriaLarga123' }),
}))
vi.mock('./google-oauth', () => ({ googleHabilitado: () => true }))
vi.mock('./moneda-instancia', () => ({ recordarMonedaDeLaInstancia: vi.fn() }))

const { registrarCuentaCtrl } = await import('./cuentas-controller')

const CUERPO = { organizacion: 'Org', nombre: 'Ana', email: 'ana@ejemplo.com', password: 'UnaClaveLarga123' }

beforeEach(() => {
  insertados.length = 0
  monedaDeLaBase = null
})

describe('signup (anonimo) · nunca elige la moneda', () => {
  it('NEGATIVO · con `moneda: USD` en una instancia vacia es 400 y no nace nada', async () => {
    await expect(registrarCuentaCtrl({ ...CUERPO, moneda: 'USD' })).rejects.toMatchObject({
      status: 400,
      message: 'La moneda de la instancia solo se elige al darla de alta',
    })
    expect(insertados).toEqual([])
  })

  it('NEGATIVO · tampoco con la misma que ya tiene: el campo no es suyo', async () => {
    monedaDeLaBase = 'MXN'
    await expect(registrarCuentaCtrl({ ...CUERPO, moneda: 'MXN' })).rejects.toMatchObject({ status: 400 })
    expect(insertados).toEqual([])
  })

  it('sin moneda y la instancia vacia: MXN', async () => {
    await registrarCuentaCtrl(CUERPO)
    expect(insertados).toEqual([{ moneda: 'MXN' }])
  })

  it('sin moneda y la instancia en USD: hereda USD', async () => {
    monedaDeLaBase = 'USD'
    await registrarCuentaCtrl(CUERPO)
    expect(insertados).toEqual([{ moneda: 'USD' }])
  })
})

describe('bootstrap · la unica puerta que la elige', () => {
  const BOOT = { debeCambiarPassword: true, entraConGoogle: true, eligeMoneda: true }
  const { password: _p, ...SIN_PASSWORD } = CUERPO

  it('con `moneda: USD` nace en USD', async () => {
    await registrarCuentaCtrl({ ...SIN_PASSWORD, moneda: 'USD' }, BOOT)
    expect(insertados).toEqual([{ moneda: 'USD' }])
  })

  it('NEGATIVO · con `moneda: EUR` es 400', async () => {
    await expect(registrarCuentaCtrl({ ...SIN_PASSWORD, moneda: 'EUR' }, BOOT)).rejects.toMatchObject({ status: 400 })
    expect(insertados).toEqual([])
  })
})
