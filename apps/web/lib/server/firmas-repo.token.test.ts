import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  Enlace público de firma: qué se entrega y hasta cuándo.
//
//  El token de 32 bytes es una credencial PORTADORA —no hay sesión detrás—, así
//  que todo el que lo tenga puede leer lo que la función devuelva. Firmar ya
//  estaba acotado a 30 días (`firmarPorToken` responde 410), pero LEER no: el
//  texto del contrato —razón social, RFC, domicilio fiscal, importes y vigencia—
//  se seguía sirviendo indefinidamente. Un enlace reenviado por correo o
//  archivado en la bandeja de cualquiera quedaba como llave permanente.
//
//  Estas pruebas fijan las tres reglas del reparto:
//   · vigente          → se entrega el texto (es el caso de uso).
//   · expirado         → NO se entrega el texto, pero sí el motivo.
//   · ya firmada (viva)→ se sigue entregando: quien firmó necesita su copia.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const TENANT = 'tenant-A'
const TOKEN = 'a'.repeat(64)
const TEXTO = 'CONTRATO DE ARRENDAMIENTO\nRFC: AAA010101AAA\nRenta: $66,000.00'

let fila: Record<string, unknown> = {}

vi.mock('./db', () => ({
  pool: { connect: vi.fn() },
  q: vi.fn(async () => []),
  q1: vi.fn(async () => null),
  fijarTenant: vi.fn(),
  qRaw1: vi.fn(async () => ({ tenant: TENANT })),
  qConTenant: vi.fn(async () => [fila]),
}))
vi.mock('./tenant', () => ({ tenantActual: async () => TENANT }))
vi.mock('./contrato-expediente', () => ({ expedienteContrato: vi.fn() }))

const { firmaPorToken } = await import('./firmas-repo')

const enDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

function filaFirma(over: Record<string, unknown> = {}) {
  return {
    contrato_id: 'c1',
    parte: 'ARRENDADOR',
    estatus: 'PENDIENTE',
    nombre_esperado: 'Predios del Norte SA',
    token_expira_en: enDias(30),
    documento_congelado: TEXTO,
    documento_hash: 'deadbeef',
    ...over,
  }
}

beforeEach(() => {
  fila = filaFirma()
})

describe('firmaPorToken', () => {
  it('con el enlace vigente entrega el texto del contrato', async () => {
    const f = await firmaPorToken(TOKEN)
    expect(f?.expirado).toBe(false)
    expect(f?.documento).toBe(TEXTO)
  })

  // El arreglo: la vigencia de 30 días ahora también acota la LECTURA.
  it('con el enlace expirado NO entrega el texto', async () => {
    fila = filaFirma({ token_expira_en: enDias(-1) })
    const f = await firmaPorToken(TOKEN)
    expect(f?.expirado).toBe(true)
    expect(f?.documento).toBeNull()
  })

  // Se devuelve el resto para poder explicar por qué no se ve nada, en vez de
  // dejar la hoja en blanco o un 404 que se lee como «el enlace no existe».
  it('un enlace expirado sigue diciendo quién debía firmar y que expiró', async () => {
    fila = filaFirma({ token_expira_en: enDias(-1) })
    const f = await firmaPorToken(TOKEN)
    expect(f?.nombreEsperado).toBe('Predios del Norte SA')
    expect(f?.expirado).toBe(true)
  })

  it('ya firmada pero dentro de la vigencia sigue entregando el texto', async () => {
    fila = filaFirma({ estatus: 'FIRMADA' })
    const f = await firmaPorToken(TOKEN)
    expect(f?.yaFirmada).toBe(true)
    expect(f?.documento).toBe(TEXTO)
  })

  it('firmada Y expirada tampoco entrega el texto', async () => {
    fila = filaFirma({ estatus: 'FIRMADA', token_expira_en: enDias(-1) })
    const f = await firmaPorToken(TOKEN)
    expect(f?.documento).toBeNull()
  })

  // Un token sin fecha de expiración es el de la parte interna (ARRENDATARIO),
  // que no se reparte por enlace. No se le inventa un vencimiento.
  it('sin fecha de expiración no se considera expirado', async () => {
    fila = filaFirma({ token_expira_en: null })
    const f = await firmaPorToken(TOKEN)
    expect(f?.expirado).toBe(false)
    expect(f?.documento).toBe(TEXTO)
  })

  it('descarta un token con formato inválido sin consultar la base', async () => {
    const { qRaw1 } = await import('./db')
    vi.mocked(qRaw1).mockClear()
    expect(await firmaPorToken('no-es-un-token')).toBeNull()
    expect(qRaw1).not.toHaveBeenCalled()
  })
})
