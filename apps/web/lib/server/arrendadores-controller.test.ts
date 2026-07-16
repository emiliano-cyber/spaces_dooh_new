import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  Contrato: el PREDIO es obligatorio (Fase 1.6/1.7).
//  El P&L atribuye la renta por predio (derive.ts ignora los contratos con
//  predio_id NULL), así que un contrato sin predio no costaría nada e inflaría
//  el margen por el monto completo de la renta. La validación debe rechazarlo
//  ANTES de llegar a la BD.
// ============================================================================

// El repo abre un pool de Postgres al importarse: se mockea porque estas
// pruebas solo ejercitan la validación del controller.
const repo = {
  crearContratoConSitio: vi.fn(async (i: unknown) => i),
  agregarPantallaAPredio: vi.fn(async (predioId: string, sitio: unknown) => ({ predioId, sitio })),
  iniciarRenovacion: vi.fn(async () => ({ contrato: { id: 'C1' } })),
  registrarPagoRenta: vi.fn(async () => ({ pago: { id: 'P1' } })),
  adjuntarAPago: vi.fn(async (id: string, d: unknown) => ({ id, ...(d as object) })),
  obtenerAdjuntoPago: vi.fn(async () => 'data:application/pdf;base64,AAAA'),
  crearPredio: vi.fn(), editarPredio: vi.fn(), crearArrendador: vi.fn(),
  editarArrendador: vi.fn(), borrarArrendador: vi.fn(), editarContrato: vi.fn(),
  cancelarContrato: vi.fn(), crearRazonSocial: vi.fn(),
}
vi.mock('./arrendadores-repo', () => repo)

const {
  crearContratoCtrl, agregarPantallaAPredioCtrl, iniciarRenovacionCtrl,
  registrarPagoRentaCtrl, adjuntarAPagoCtrl, obtenerAdjuntoPagoCtrl,
} = await import('./arrendadores-controller')

// Las aserciones de "no se llamó al model" dependen de partir de cero.
beforeEach(() => vi.clearAllMocks())

const CONTRATO = {
  fechaInicio: '2026-01-01', fechaFin: '2026-12-31',
  montoRenta: 10000, periodicidad: 'MENSUAL',
}
const SITIO = { nombre: 'Pantalla 1' }
const ARR = { id: '11111111-1111-1111-1111-111111111111' }

describe('crearContratoCtrl — el predio es obligatorio', () => {
  it('rechaza un contrato SIN predio (si no, nacería con predio_id NULL y no costaría nada en el P&L)', async () => {
    await expect(
      crearContratoCtrl({ arrendador: ARR, contrato: CONTRATO, sitio: SITIO }),
    ).rejects.toThrow(/predio/i)
  })

  it('rechaza un predio nuevo sin nombre', async () => {
    await expect(
      crearContratoCtrl({ arrendador: ARR, predio: { direccion: 'Calle 1' }, contrato: CONTRATO, sitio: SITIO }),
    ).rejects.toThrow(/predio/i)
  })

  it('rechaza coordenadas del predio fuera de rango', async () => {
    await expect(
      crearContratoCtrl({
        arrendador: ARR, predio: { nombre: 'Predio 1', lat: 120, lng: 0 },
        contrato: CONTRATO, sitio: SITIO,
      }),
    ).rejects.toThrow(/latitud/i)
  })

  it('acepta un predio existente por id', async () => {
    const predio = { id: '22222222-2222-2222-2222-222222222222' }
    const r: any = await crearContratoCtrl({ arrendador: ARR, predio, contrato: CONTRATO, sitio: SITIO })
    expect(r.predio).toEqual(predio)
  })

  it('acepta un predio nuevo y lo pasa al repo', async () => {
    const r: any = await crearContratoCtrl({
      arrendador: ARR, predio: { nombre: 'Azotea Reforma 222', direccion: 'Reforma 222' },
      contrato: CONTRATO, sitio: SITIO,
    })
    expect(r.predio.nombre).toBe('Azotea Reforma 222')
    // Estado por defecto del predio recién dado de alta.
    expect(r.predio.estado).toBe('DISPONIBLE')
  })
})

// ============================================================================
//  Agregar pantalla a un predio que YA tiene contrato: N pantallas comparten la
//  renta del predio, sin firmar un segundo contrato (que el P&L no sumaría).
// ============================================================================
describe('agregarPantallaAPredioCtrl', () => {
  const PREDIO = '33333333-3333-3333-3333-333333333333'

  it('liga una pantalla existente por sitioId', async () => {
    const sitioId = '44444444-4444-4444-4444-444444444444'
    const r: any = await agregarPantallaAPredioCtrl(PREDIO, { sitioId })
    expect(r.predioId).toBe(PREDIO)
    expect(r.sitio).toEqual({ id: sitioId })
  })

  it('crea una pantalla nueva ligada al predio', async () => {
    const r: any = await agregarPantallaAPredioCtrl(PREDIO, { nombre: 'Pantalla 2', caras: 2 })
    expect(r.sitio.nombre).toBe('Pantalla 2')
  })

  it('rechaza un cuerpo sin sitioId ni nombre', async () => {
    await expect(agregarPantallaAPredioCtrl(PREDIO, { caras: 2 })).rejects.toThrow()
  })

  it('rechaza un sitioId que no es uuid', async () => {
    await expect(agregarPantallaAPredioCtrl(PREDIO, { sitioId: 'abc' })).rejects.toThrow()
  })
})

// ============================================================================
//  Fechas y montos que antes llegaban crudos a Postgres: el cast fallaba y salía
//  como 500 con el texto del driver, en vez de un 400 con el motivo.
// ============================================================================
describe('iniciarRenovacionCtrl — fecha', () => {
  it('rechaza una fecha que no es fecha (antes: 500 por el cast ::date)', async () => {
    await expect(iniciarRenovacionCtrl('C1', { nuevaFechaFin: 'mañana' })).rejects.toThrow(/fecha/i)
    expect(repo.iniciarRenovacion).not.toHaveBeenCalled()
  })

  it('rechaza un campo desconocido en el cuerpo', async () => {
    await expect(iniciarRenovacionCtrl('C1', { fechaFin: '2027-01-01' })).rejects.toThrow()
  })

  it('acepta renovar sin fecha (el model aplica +365 días)', async () => {
    await expect(iniciarRenovacionCtrl('C1', {})).resolves.toEqual({ id: 'C1' })
  })

  it('traduce fechaNoPosterior del model a 400 con la vigencia actual', async () => {
    repo.iniciarRenovacion.mockResolvedValueOnce({ fechaNoPosterior: '2026-12-31' } as never)
    await expect(iniciarRenovacionCtrl('C1', { nuevaFechaFin: '2026-01-01' }))
      .rejects.toThrow(/posterior a la vigencia actual \(2026-12-31\)/)
  })
})

describe('registrarPagoRentaCtrl — fecha y repago', () => {
  it('rechaza una fecha de pago inválida (antes: 500 por el cast ::timestamptz)', async () => {
    await expect(registrarPagoRentaCtrl('P1', { fechaPago: 'ayer' })).rejects.toThrow(/fecha/i)
    expect(repo.registrarPagoRenta).not.toHaveBeenCalled()
  })

  it('rechaza una fecha de pago futura', async () => {
    const dentroDeUnAno = new Date(Date.now() + 365 * 86_400_000).toISOString()
    await expect(registrarPagoRentaCtrl('P1', { fechaPago: dentroDeUnAno })).rejects.toThrow(/futura/i)
  })

  it('rechaza re-registrar un pago ya PAGADO (409, no sobrescribe la fecha)', async () => {
    repo.registrarPagoRenta.mockResolvedValueOnce({ yaPagado: '2026-03-01' } as never)
    await expect(registrarPagoRentaCtrl('P1', {})).rejects.toThrow(/ya está pagado \(2026-03-01\)/)
  })

  it('registra un pago normal', async () => {
    await expect(registrarPagoRentaCtrl('P1', {})).resolves.toEqual({ id: 'P1' })
  })
})

// ============================================================================
//  Adjuntos (factura/comprobante). El limite del navegador se salta con un curl:
//  el tipo y el tamaño se validan aqui, en el servidor.
// ============================================================================
describe('adjuntos de pago', () => {
  const PDF = 'data:application/pdf;base64,JVBERi0xLjQK'
  const PNG = 'data:image/png;base64,iVBORw0KGgo='
  // ~6 MB de base64 => por encima del limite de 5 MB.
  const GRANDE = 'data:application/pdf;base64,' + 'A'.repeat(8_400_000)

  it('acepta un PDF y una imagen', async () => {
    await expect(adjuntarAPagoCtrl('P1', { facturaUrl: PDF, comprobanteUrl: PNG })).resolves.toBeTruthy()
  })

  it('rechaza un ejecutable disfrazado de adjunto', async () => {
    await expect(adjuntarAPagoCtrl('P1', { facturaUrl: 'data:application/x-msdownload;base64,TVqQ' }))
      .rejects.toThrow(/PDF o una imagen/)
  })

  it('rechaza una URL que no es un adjunto', async () => {
    await expect(adjuntarAPagoCtrl('P1', { facturaUrl: 'https://evil.example/factura.pdf' }))
      .rejects.toThrow(/PDF o una imagen/)
  })

  it('rechaza un adjunto de mas de 5 MB', async () => {
    await expect(adjuntarAPagoCtrl('P1', { facturaUrl: GRANDE })).rejects.toThrow(/5 MB/)
  })

  it('acepta null para borrar un adjunto', async () => {
    const r: any = await adjuntarAPagoCtrl('P1', { facturaUrl: null })
    expect(r.facturaUrl).toBeNull()
  })

  it('rechaza un cuerpo vacio (nada que guardar)', async () => {
    await expect(adjuntarAPagoCtrl('P1', {})).rejects.toThrow(/nada que guardar/)
  })

  it('no re-sella el pago: nunca manda estatus ni fechaPago al model', async () => {
    await adjuntarAPagoCtrl('P1', { facturaUrl: PDF })
    const [, datos] = repo.adjuntarAPago.mock.calls[0] as [string, Record<string, unknown>]
    expect(datos).not.toHaveProperty('estatus')
    expect(datos).not.toHaveProperty('fechaPago')
  })

  it('rechaza un tipo de adjunto desconocido en la ruta', async () => {
    await expect(obtenerAdjuntoPagoCtrl('P1', 'contrato')).rejects.toThrow(/inválido/i)
    expect(repo.obtenerAdjuntoPago).not.toHaveBeenCalled()
  })

  it('devuelve el adjunto pedido', async () => {
    await expect(obtenerAdjuntoPagoCtrl('P1', 'factura')).resolves.toMatch(/^data:application\/pdf/)
  })
})
