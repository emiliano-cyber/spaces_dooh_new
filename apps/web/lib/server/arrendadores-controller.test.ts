import { describe, it, expect, vi } from 'vitest'

// ============================================================================
//  Contrato: el PREDIO es obligatorio (Fase 1.6/1.7).
//  El P&L atribuye la renta por predio (derive.ts ignora los contratos con
//  predio_id NULL), así que un contrato sin predio no costaría nada e inflaría
//  el margen por el monto completo de la renta. La validación debe rechazarlo
//  ANTES de llegar a la BD.
// ============================================================================

// El repo abre un pool de Postgres al importarse: se mockea porque estas
// pruebas solo ejercitan la validación del controller.
vi.mock('./arrendadores-repo', () => ({
  crearContratoConSitio: vi.fn(async (i: unknown) => i),
  agregarPantallaAPredio: vi.fn(async (predioId: string, sitio: unknown) => ({ predioId, sitio })),
  crearPredio: vi.fn(), editarPredio: vi.fn(), crearArrendador: vi.fn(),
  iniciarRenovacion: vi.fn(), registrarPagoRenta: vi.fn(), editarArrendador: vi.fn(),
  borrarArrendador: vi.fn(), editarContrato: vi.fn(), cancelarContrato: vi.fn(),
  crearRazonSocial: vi.fn(),
}))

const { crearContratoCtrl, agregarPantallaAPredioCtrl } = await import('./arrendadores-controller')

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
