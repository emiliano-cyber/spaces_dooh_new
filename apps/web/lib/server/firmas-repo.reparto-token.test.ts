import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  Quién recibe el ENLACE de firma del arrendador.
//
//  El token de 32 bytes es una credencial portadora: con él se firma desde la
//  ruta pública, sin sesión. Por eso enviar a firma y firmar exigen permiso de
//  `crear` («firmar compromete a la empresa»). Pero la LECTURA del estado de
//  firmas iba con `ver` y devolvía el token igualmente, en las DOS superficies
//  que la usan —GET /api/contratos/[id]/firma y la página /contrato/[id], que
//  renderiza en servidor y pinta el botón de copiar el enlace—. Un permiso de
//  solo lectura entregaba así la llave que el POST acababa de negarle.
//
//  Ver el ESTADO sigue siendo de `ver`: quién firmó, cuándo y si la firma quedó
//  invalidada son datos del contrato, no una llave. Lo único que se retiene es
//  el token.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const TENANT = 'tenant-A'
const CONTRATO = 'c1'
const TOKEN = 'a'.repeat(64)

const filasFirmas = [
  {
    parte: 'ARRENDADOR', estatus: 'PENDIENTE', nombre_esperado: 'Predios del Norte SA',
    nombre_firmante: null, firmado_en: null, ip: null, user_agent: null,
    documento_hash: null, token: TOKEN, token_expira_en: '2026-08-30T00:00:00.000Z',
  },
  {
    parte: 'ARRENDATARIO', estatus: 'FIRMADA', nombre_esperado: 'RGB Catorce',
    nombre_firmante: 'Jose Lopez', firmado_en: '2026-07-30T18:00:00.000Z',
    ip: '10.0.0.1', user_agent: 'Firefox', documento_hash: 'abc',
    token: null, token_expira_en: null,
  },
]

vi.mock('./db', () => ({
  pool: { connect: vi.fn() },
  // El contrato todavía no está congelado: así no entra el cálculo del hash
  // actual, que no es lo que se prueba aquí.
  q1: vi.fn(async () => ({ documento_hash: null, congelado_en: null, documento_congelado: null })),
  q: vi.fn(async () => filasFirmas),
  fijarTenant: vi.fn(),
  qRaw1: vi.fn(async () => null),
  qConTenant: vi.fn(async () => []),
}))
vi.mock('./tenant', () => ({ tenantActual: async () => TENANT }))
vi.mock('./contrato-expediente', () => ({ expedienteContrato: vi.fn(async () => null) }))

const { firmasDeContrato } = await import('./firmas-repo')

const arrendador = (r: { firmas: { parte: string; token: string | null; tokenExpiraEn: string | null }[] }) =>
  r.firmas.find((f) => f.parte === 'ARRENDADOR')!

beforeEach(() => vi.clearAllMocks())

describe('firmasDeContrato', () => {
  it('entrega el token a quien puede comprometer a la empresa', async () => {
    const r = await firmasDeContrato(CONTRATO, { incluirToken: true })
    expect(arrendador(r).token).toBe(TOKEN)
  })

  it('lo retiene cuando el permiso es de solo lectura', async () => {
    const r = await firmasDeContrato(CONTRATO, { incluirToken: false })
    expect(arrendador(r).token).toBeNull()
  })

  // La fecha no es la llave: dice hasta cuándo sirve el enlace, que es estado
  // del proceso y sin el token no abre nada. La UI la usa para avisar del
  // vencimiento aunque no ofrezca el botón de copiar.
  it('la fecha de vencimiento del enlace viaja en los dos casos', async () => {
    const conToken = await firmasDeContrato(CONTRATO, { incluirToken: true })
    const sinToken = await firmasDeContrato(CONTRATO, { incluirToken: false })
    expect(arrendador(conToken).tokenExpiraEn).toBe('2026-08-30T00:00:00.000Z')
    expect(arrendador(sinToken).tokenExpiraEn).toBe('2026-08-30T00:00:00.000Z')
  })

  it('el resto del estado de firmas no cambia', async () => {
    const r = await firmasDeContrato(CONTRATO, { incluirToken: false })
    const interna = r.firmas.find((f) => f.parte === 'ARRENDATARIO')!
    expect(interna.estatus).toBe('FIRMADA')
    expect(interna.nombreFirmante).toBe('Jose Lopez')
    expect(interna.firmadoEn).toBe('2026-07-30T18:00:00.000Z')
    expect(interna.ip).toBe('10.0.0.1')
  })

  it('la parte interna nunca tiene token, se pida como se pida', async () => {
    const r = await firmasDeContrato(CONTRATO, { incluirToken: true })
    expect(r.firmas.find((f) => f.parte === 'ARRENDATARIO')!.token).toBeNull()
  })
})
