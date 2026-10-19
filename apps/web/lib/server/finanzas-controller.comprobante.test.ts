import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  COB-COMP · el comprobante de un pago de cliente.
//
//  Se ancla la VALIDACIÓN, que es lo que vive en el controller: el archivo
//  pasa por los mismos límites que el de un pago de renta (PDF o imagen, 5 MB)
//  y, si no los cumple, el repo NI SE LLAMA — un pago con un archivo inválido
//  no puede quedar registrado a medias. Que el archivo acabe en su abono y bajo
//  la RLS lo mide `lib/test/comprobante-cobranza.e2e.test.ts`.
// ============================================================================

const llamadas: { fn: string; args: unknown[] }[] = []
let respuestaAdjuntar: unknown = { id: 'ab-1', folio: 'A-000001' }
let respuestaComprobante: string | null = null

vi.mock('./finanzas-repo', () => ({
  generarFactura: vi.fn(),
  registrarPagoCobranza: vi.fn(async (...args: unknown[]) => {
    llamadas.push({ fn: 'registrarPagoCobranza', args })
    return { id: 'cob-1', folio: 'A-000001', abono: 100, liquidado: false }
  }),
  adjuntarComprobanteAbono: vi.fn(async (...args: unknown[]) => {
    llamadas.push({ fn: 'adjuntarComprobanteAbono', args })
    return respuestaAdjuntar
  }),
  obtenerComprobanteAbono: vi.fn(async () => respuestaComprobante),
  listarAbonosCobranza: vi.fn(async () => null),
  FacturaError: class FacturaError extends Error {},
  datosFinanzas: vi.fn(),
  clienteDeMiOrganizacion: vi.fn(),
  hoyDeLaBase: vi.fn(),
}))
vi.mock('./config-repo', () => ({ plazosCobranzaDelTenant: vi.fn(), plazoPorDefecto: vi.fn() }))
vi.mock('./entidades-repo', () => ({ obtenerEntidad: vi.fn() }))

const { registrarPagoCtrl, adjuntarComprobanteCtrl, obtenerComprobanteAbonoCtrl } = await import('./finanzas-controller')

const PDF = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n%%EOF\n').toString('base64')
const TEXTO = 'data:text/plain;base64,' + Buffer.from('hola').toString('base64')
// 6 MB de bytes de PDF: pasa la firma y se pasa del límite de 5.
const PDF_GRANDE =
  'data:application/pdf;base64,' + Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(6 * 1024 * 1024)]).toString('base64')

async function estado(p: Promise<unknown>): Promise<number> {
  try {
    await p
    return 200
  } catch (e) {
    return (e as { status?: number }).status ?? 500
  }
}

beforeEach(() => {
  llamadas.length = 0
  respuestaAdjuntar = { id: 'ab-1', folio: 'A-000001' }
  respuestaComprobante = null
})

describe('registrar el pago con comprobante', () => {
  it('un PDF válido llega al repo junto con el pago', async () => {
    await registrarPagoCtrl('cob-1', { monto: 100, comprobanteUrl: PDF }, 'u-1')
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0].args[2]).toMatchObject({ comprobanteUrl: PDF, usuarioId: 'u-1' })
  })

  it('sin comprobante, el repo recibe null (no se inventa nada)', async () => {
    await registrarPagoCtrl('cob-1', { monto: 100 }, 'u-1')
    expect(llamadas[0].args[2]).toMatchObject({ comprobanteUrl: null })
  })

  it('un tipo no permitido es 422 y el pago NO se registra', async () => {
    expect(await estado(registrarPagoCtrl('cob-1', { monto: 100, comprobanteUrl: TEXTO }, 'u-1'))).toBe(422)
    expect(llamadas).toHaveLength(0)
  })

  it('más de 5 MB es 422 y el pago NO se registra', async () => {
    expect(await estado(registrarPagoCtrl('cob-1', { monto: 100, comprobanteUrl: PDF_GRANDE }, 'u-1'))).toBe(422)
    expect(llamadas).toHaveLength(0)
  })
})

describe('adjuntarlo después', () => {
  it('pasa la cobranza, el abono y el archivo al repo', async () => {
    await adjuntarComprobanteCtrl('cob-1', 'ab-1', { comprobanteUrl: PDF })
    expect(llamadas).toEqual([{ fn: 'adjuntarComprobanteAbono', args: ['cob-1', 'ab-1', PDF] }])
  })

  it('sin archivo es 400; con uno inválido, 422; y en ninguno se escribe', async () => {
    expect(await estado(adjuntarComprobanteCtrl('cob-1', 'ab-1', {}))).toBe(400)
    expect(await estado(adjuntarComprobanteCtrl('cob-1', 'ab-1', { comprobanteUrl: TEXTO }))).toBe(422)
    expect(llamadas).toHaveLength(0)
  })

  it('un campo de más se rechaza: el cuerpo no puede tocar el importe', async () => {
    expect(await estado(adjuntarComprobanteCtrl('cob-1', 'ab-1', { comprobanteUrl: PDF, monto: 1 }))).toBe(400)
    expect(llamadas).toHaveLength(0)
  })

  it('un abono que no existe (o de otra cobranza) es 404', async () => {
    respuestaAdjuntar = null
    expect(await estado(adjuntarComprobanteCtrl('cob-1', 'ab-x', { comprobanteUrl: PDF }))).toBe(404)
  })
})

describe('servir el archivo', () => {
  it('sin comprobante es 404', async () => {
    expect(await estado(obtenerComprobanteAbonoCtrl('cob-1', 'ab-1'))).toBe(404)
  })

  it('con comprobante devuelve el data URL', async () => {
    respuestaComprobante = PDF
    expect(await obtenerComprobanteAbonoCtrl('cob-1', 'ab-1')).toBe(PDF)
  })
})
