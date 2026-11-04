import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  ADR 0049 · el idioma de los DOCUMENTOS solo lo elige el bootstrap.
//
//  El mismo razonamiento que la moneda (`cuentas-controller.moneda.test.ts`):
//  `/api/signup` es anonima, y con AUTOREGISTRO=1 y la base vacia un visitante
//  decidiria en que idioma se redactan los contratos de toda la instancia.
//  Se prueba con el alta simulada porque la e2e arranca con el autorregistro
//  apagado (`servidor-e2e.ts`, que no se toca).
// ============================================================================

const insertados: Array<{ moneda: string; idioma: string }> = []
let deLaBase: { moneda: string; idioma_documentos: string } | null = null
const recordado = vi.hoisted(() => ({ idioma: null as string | null }))

vi.mock('./db', () => ({
  withTxBootstrap: async (fn: (x: unknown) => Promise<unknown>) =>
    fn({
      client: { query: async () => ({ rows: deLaBase ? [deLaBase] : [] }) },
      fijarTenant: async () => {},
    }),
}))
vi.mock('./tenant', () => ({
  crearTenant: async (_n: string, _s: string, _c: unknown, moneda: string, idioma: string) => {
    insertados.push({ moneda, idioma })
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
vi.mock('./idioma-instancia', () => ({
  recordarIdiomaDeLaInstancia: (i: string) => {
    recordado.idioma = i
  },
}))

const { registrarCuentaCtrl, crearOrganizacionCtrl } = await import('./cuentas-controller')

const CUERPO = { organizacion: 'Org', nombre: 'Ana', email: 'ana@ejemplo.com', password: 'UnaClaveLarga123' }
const BOOT = { debeCambiarPassword: true, entraConGoogle: true, eligeMoneda: true, eligeIdiomaDocumentos: true }
const { password: _p, ...SIN_PASSWORD } = CUERPO

beforeEach(() => {
  insertados.length = 0
  deLaBase = null
  recordado.idioma = null
})

describe('signup (anonimo) · nunca elige el idioma de los documentos', () => {
  it('NEGATIVO · con `idiomaDocumentos: en` en una instancia vacia es 400 y no nace nada', async () => {
    await expect(registrarCuentaCtrl({ ...CUERPO, idiomaDocumentos: 'en' })).rejects.toMatchObject({
      status: 400,
      message: 'El idioma de los documentos de la instancia solo se elige al darla de alta',
    })
    expect(insertados).toEqual([])
  })

  it('sin idioma y la instancia vacia: es', async () => {
    await registrarCuentaCtrl(CUERPO)
    expect(insertados).toEqual([{ moneda: 'MXN', idioma: 'es' }])
  })

  it('sin idioma y la instancia en italiano: hereda italiano', async () => {
    deLaBase = { moneda: 'MXN', idioma_documentos: 'it' }
    await registrarCuentaCtrl(CUERPO)
    expect(insertados).toEqual([{ moneda: 'MXN', idioma: 'it' }])
  })
})

describe('bootstrap · la unica puerta que lo elige', () => {
  it('con `idiomaDocumentos: en` nace en ingles, y el proceso lo recuerda', async () => {
    await registrarCuentaCtrl({ ...SIN_PASSWORD, idiomaDocumentos: 'en' }, BOOT)
    expect(insertados).toEqual([{ moneda: 'MXN', idioma: 'en' }])
    expect(recordado.idioma).toBe('en')
  })

  it('NEGATIVO · con `idiomaDocumentos: fr` es 400 y no recuerda nada', async () => {
    await expect(registrarCuentaCtrl({ ...SIN_PASSWORD, idiomaDocumentos: 'fr' }, BOOT)).rejects.toMatchObject({
      status: 400,
    })
    expect(insertados).toEqual([])
    expect(recordado.idioma).toBeNull()
  })

  it('NEGATIVO · eligiendo la moneda NO se elige el idioma: son dos permisos', async () => {
    await expect(
      registrarCuentaCtrl({ ...SIN_PASSWORD, idiomaDocumentos: 'en' }, { ...BOOT, eligeIdiomaDocumentos: false }),
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('/api/tenants (super-admin) · hereda, y otro es un 400', () => {
  const ORG = { nombre: 'Org B', admin: { nombre: 'Bea', email: 'bea@ejemplo.com', password: 'UnaClaveLarga123' } }

  it('NEGATIVO · pedir en en una instancia es es 400', async () => {
    deLaBase = { moneda: 'MXN', idioma_documentos: 'es' }
    await expect(crearOrganizacionCtrl({ ...ORG, idiomaDocumentos: 'en' })).rejects.toMatchObject({ status: 400 })
    expect(insertados).toEqual([])
  })

  it('sin pedir, hereda el de la instancia', async () => {
    deLaBase = { moneda: 'USD', idioma_documentos: 'en' }
    await crearOrganizacionCtrl(ORG)
    expect(insertados).toEqual([{ moneda: 'USD', idioma: 'en' }])
  })
})
