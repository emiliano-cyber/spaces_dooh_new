import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  ADR 0042 · la CALCULADORA DE SPOTS en el controller, con el repo simulado.
// ----------------------------------------------------------------------------
//  Qué le llega al repo, qué se rechaza y con qué código. Lo que la base
//  guarda de verdad lo fija `calculadora-spots.e2e.test.ts` contra Postgres.
// ============================================================================

const UUID_A = '11111111-1111-4111-8111-111111111111'

const m = vi.hoisted(() => ({
  crearPropuesta: vi.fn(async (input: any) => ({ id: 'P1', nombre: input.nombre, input })),
  datosParaTarifar: vi.fn(),
  datosDelLoop: vi.fn(),
  usuarioActual: vi.fn(),
  tienePermiso: vi.fn(),
}))

vi.mock('./propuestas-repo', () => ({
  crearPropuesta: (input: unknown) => m.crearPropuesta(input),
  aprobarItem: vi.fn(),
  PropuestaError: class PropuestaError extends Error {},
  validarRangoFechas: vi.fn(),
}))
vi.mock('./rejilla-repo', () => ({
  listarFranjas: vi.fn(async () => [
    { id: 'F-PRIME', nombre: 'Prime', horaInicio: '06:00', horaFin: '10:00', orden: 1, activo: true },
  ]),
  listarTemporadas: vi.fn(async () => []),
}))
vi.mock('./volumen-repo', () => ({ listarEscalasVolumen: vi.fn(async () => []) }))
vi.mock('./tarifas-repo', () => ({
  datosParaTarifar: (ids: string[]) => m.datosParaTarifar(ids),
  datosDelLoop: (ids: string[]) => m.datosDelLoop(ids),
}))
vi.mock('./auth', () => ({
  usuarioActual: () => m.usuarioActual(),
  tienePermiso: (rol: string, mod: string, acc: string) => m.tienePermiso(rol, mod, acc),
}))

import { crearPropuestaCtrl } from './propuestas-controller'
import { AppError } from './errores'

const TARIFAS = {
  temporadas: [],
  sitios: new Map<string, any>([
    [
      UUID_A,
      {
        nombre: 'Pantalla Reforma',
        tarifaPublicada: 45000,
        modalidadesDetalle: [
          { unidad: 'mensual', tarifaPublicada: 45000 },
          { unidad: 'spot', tarifaPublicada: 1200 },
        ],
        rejilla: [{ unidad: 'spot', franjaId: 'F-PRIME', temporadaId: null, tarifa: 1800 }],
      },
    ],
  ]),
}
// ADR 0043 · 12 espacios de 20 s, 18 h, y 4 campañas vigentes: una línea de 2
// espacios entra a un loop de 6, como el ejemplo de la calculadora HTML.
const LOOP_DE = (campanasActivas: number) => ({
  spotSegOrganizacion: 10,
  sitios: new Map<string, any>([
    [
      UUID_A,
      { digital: true, totalSpots: 12, duracionSpotSeg: 20, horario: '06:00-24:00', spotsDisponibles: null, campanasActivas },
    ],
  ]),
})
const LOOP = LOOP_DE(4)

// Tarifa mensual 45 000 → 4 500 000 centavos. Por spot, con 18 h y 30 días:
//   loop de 6:  45 000 / (30 × 18 × 30)  = 2.777… → $2.78
//   loop de 5:  45 000 / (36 × 18 × 30)  = 2.314… → $2.31
//   Roadblock:  45 000 × 12 / 540 / 180  = 5.555… → $5.56; con prima 25 %, $6.95
const POR_SPOT_6 = 2.78
const POR_SPOT_5 = 2.31
const POR_SPOT_RB = 5.56

const VENDEDOR = { id: 'U-VEND', rol: 'VENDEDOR', nombre: 'Vera' }
const GERENTE = { id: 'U-GER', rol: 'GERENTE_VENTAS', nombre: 'Gael' }
const PERMISOS: Record<string, boolean> = { VENDEDOR: false, GERENTE_VENTAS: true }

// 2026-10-05 … 2026-11-03: 30 días inclusivos.
const cuerpo = (items: any[]) => ({
  nombre: 'Campaña calculadora',
  fechaInicio: '2026-10-05',
  fechaFin: '2026-11-03',
  items: items.map((it) => ({ sitioId: UUID_A, unidad: 'spot', tarifaUnitaria: 1200, ...it })),
})

const rechazo = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(AppError)
    return { status: (e as AppError).status, mensaje: (e as Error).message }
  }
  throw new Error('se esperaba un rechazo')
}

beforeEach(() => {
  vi.clearAllMocks()
  m.datosParaTarifar.mockResolvedValue(TARIFAS)
  m.datosDelLoop.mockResolvedValue(LOOP)
  m.usuarioActual.mockResolvedValue(VENDEDOR)
  m.tienePermiso.mockImplementation(async (rol: string, mod: string, acc: string) =>
    mod === 'comercial' && acc === 'aprobar' ? !!PERMISOS[rol] : false,
  )
})

describe('1 · sin calculadora, nada cambia', () => {
  it('una línea por spot a mano NO lee el loop y llega al repo sin parámetros', async () => {
    await crearPropuestaCtrl(cuerpo([{ cantidad: 10 }]))
    expect(m.datosDelLoop).not.toHaveBeenCalled()
    const it = m.crearPropuesta.mock.calls[0][0].items[0]
    expect(it).toMatchObject({
      cantidad: 10,
      precio: 12000,
      espaciosComprados: null,
      horasDia: null,
      roadblock: false,
      primaRoadblockPct: null,
    })
  })
})

describe('2 · con calculadora, la cantidad Y el precio los decide el servidor (ADR 0043)', () => {
  it('2 espacios en un loop de 6 × 18 h × 30 días → 32 400 spots a $2.78, y 1 080 pases al día', async () => {
    await crearPropuestaCtrl(cuerpo([{ espaciosComprados: 2, cantidad: 32400, spotsPorDia: 3, tarifaUnitaria: POR_SPOT_6 }]))
    const it = m.crearPropuesta.mock.calls[0][0].items[0]
    expect(it).toMatchObject({
      cantidad: 32400,
      tarifaUnitaria: POR_SPOT_6,
      // 2 espacios × 45 000 = 90 000; los 72 pesos son el redondeo al centavo.
      precio: 90072,
      tarifaCalculada: POR_SPOT_6,
      precioAjustado: false,
      // La programación sale de la cuenta, no del cuerpo.
      spotsPorDia: 1080,
      espaciosComprados: 2,
      horasDia: 18,
      roadblock: false,
      primaRoadblockPct: null,
    })
  })

  it('NEGATIVO · la tarifa «spot» de la pantalla YA NO es el precio de la calculadora: 403 para el vendedor', async () => {
    const r = await rechazo(crearPropuestaCtrl(cuerpo([{ espaciosComprados: 2, cantidad: 32400, tarifaUnitaria: 1200 }])))
    expect(r).toEqual({ status: 403, mensaje: 'Solo un gerente o superior puede cambiar la tarifa de una pantalla.' })
    expect(m.crearPropuesta).not.toHaveBeenCalled()
  })

  it('NEGATIVO · una pantalla sin tarifa mensual no tiene precio calculado: solo el gerente', async () => {
    m.datosParaTarifar.mockResolvedValue({
      temporadas: [],
      sitios: new Map([[UUID_A, { nombre: 'Sin mensual', modalidadesDetalle: [{ unidad: 'spot', tarifaPublicada: 1200 }] }]]),
    })
    const r = await rechazo(crearPropuestaCtrl(cuerpo([{ espaciosComprados: 2, cantidad: 32400, tarifaUnitaria: 1200 }])))
    expect(r.status).toBe(403)
    expect(r.mensaje).toMatch(/no tiene una tarifa calculada/)
  })

  it('NEGATIVO · una cantidad que no cuadra → 400 y el repo NO se llama', async () => {
    const r = await rechazo(crearPropuestaCtrl(cuerpo([{ espaciosComprados: 2, cantidad: 100, tarifaUnitaria: POR_SPOT_6 }])))
    expect(r.status).toBe(400)
    expect(r.mensaje).toMatch(/^La cantidad de spots no cuadra con la calculadora/)
    expect(m.crearPropuesta).not.toHaveBeenCalled()
  })

  it('NEGATIVO · la cantidad del loop ENTERO (la regla del ADR 0042) ya no cuadra', async () => {
    const r = await rechazo(crearPropuestaCtrl(cuerpo([{ espaciosComprados: 2, cantidad: 16200, tarifaUnitaria: POR_SPOT_6 }])))
    expect(r.status).toBe(400)
  })

  it('con franja, el techo de horas es la franja; el precio sigue saliendo de las 18 h del horario', async () => {
    // Loop de 5: 36 rotaciones × 4 h × 30 días = 4 320.
    await crearPropuestaCtrl(cuerpo([{ espaciosComprados: 1, franjaId: 'F-PRIME', tarifaUnitaria: POR_SPOT_5, cantidad: 4320 }]))
    expect(m.crearPropuesta.mock.calls[0][0].items[0]).toMatchObject({ cantidad: 4320, horasDia: 4, spotsPorDia: 144 })
    const r = await rechazo(
      crearPropuestaCtrl(cuerpo([{ espaciosComprados: 1, franjaId: 'F-PRIME', tarifaUnitaria: POR_SPOT_5, horasDia: 5, cantidad: 5400 }])),
    )
    expect(r.status).toBe(400)
  })

  it('NEGATIVO · sin espacios libres → 409', async () => {
    m.datosDelLoop.mockResolvedValue(LOOP_DE(11))
    // Loop de min(12, 11 + 2) = 12: 15 × 2 × 18 × 30 = 16 200.
    const r = await rechazo(crearPropuestaCtrl(cuerpo([{ espaciosComprados: 2, cantidad: 16200, tarifaUnitaria: 12.35 }])))
    expect(r.status).toBe(409)
    expect(m.crearPropuesta).not.toHaveBeenCalled()
  })

  it('NEGATIVO · una pantalla que no está en el loop de ESTA organización → 400', async () => {
    m.datosDelLoop.mockResolvedValue({ ...LOOP, sitios: new Map() })
    const r = await rechazo(crearPropuestaCtrl(cuerpo([{ espaciosComprados: 1, cantidad: 8100 }])))
    expect(r.status).toBe(400)
  })
})

describe('3 · Roadblock y su prima', () => {
  // floor(3600 / 20) = 180 spots por hora × 18 h × 30 días.
  const RB = { roadblock: true, cantidad: 180 * 18 * 30 }
  beforeEach(() => {
    // Un Roadblock exige el loop vacío.
    m.datosDelLoop.mockResolvedValue(LOOP_DE(0))
  })

  it('NEGATIVO · VENDEDOR con prima → 403 con la frase, y el repo NO se llama', async () => {
    const r = await rechazo(crearPropuestaCtrl(cuerpo([{ ...RB, primaRoadblockPct: 25, tarifaUnitaria: 6.95 }])))
    expect(r).toEqual({ status: 403, mensaje: 'Solo un gerente o superior puede poner prima a un Roadblock.' })
    expect(m.crearPropuesta).not.toHaveBeenCalled()
  })

  it('VENDEDOR sin prima → entra al precio de la hora repartido entre sus spots, sin ajuste', async () => {
    const r = await crearPropuestaCtrl(cuerpo([{ ...RB, tarifaUnitaria: POR_SPOT_RB }]))
    expect(m.crearPropuesta.mock.calls[0][0].items[0]).toMatchObject({
      espaciosComprados: 12,
      roadblock: true,
      primaRoadblockPct: 0,
      cantidad: 97200,
      tarifaCalculada: POR_SPOT_RB,
      precioAjustado: false,
    })
    expect(r.ajustes).toEqual([])
  })

  it('GERENTE con prima 25 % a $6.95 → ajuste, tarifa calculada $5.56, y el ajuste lleva la prima', async () => {
    m.usuarioActual.mockResolvedValue(GERENTE)
    const r = await crearPropuestaCtrl(cuerpo([{ ...RB, primaRoadblockPct: 25, tarifaUnitaria: 6.95 }]))
    expect(m.crearPropuesta.mock.calls[0][0].items[0]).toMatchObject({
      tarifaUnitaria: 6.95,
      precio: Math.round(6.95 * RB.cantidad),
      tarifaCalculada: POR_SPOT_RB,
      precioAjustado: true,
      primaRoadblockPct: 25,
    })
    expect(r.ajustes).toEqual([
      { sitioId: UUID_A, sitioNombre: 'Pantalla Reforma', unidad: 'spot', tarifaCalculada: POR_SPOT_RB, tarifa: 6.95, primaRoadblockPct: 25 },
    ])
  })

  it('NEGATIVO · VENDEDOR que manda la tarifa CON prima sin poner prima → 403 «distinta»', async () => {
    const r = await rechazo(crearPropuestaCtrl(cuerpo([{ ...RB, tarifaUnitaria: 6.95 }])))
    expect(r).toEqual({ status: 403, mensaje: 'Solo un gerente o superior puede cambiar la tarifa de una pantalla.' })
  })
})
