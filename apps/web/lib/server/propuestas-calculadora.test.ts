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
const LOOP = {
  spotSegOrganizacion: 10,
  sitios: new Map<string, any>([
    [
      UUID_A,
      { digital: true, totalSpots: 12, duracionSpotSeg: 20, horario: '06:00-24:00', spotsDisponibles: null, campanasActivas: 0 },
    ],
  ]),
}

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

describe('2 · con calculadora, la cantidad la decide el servidor', () => {
  it('2 espacios × 18 h × 30 días → el repo recibe 16 200, los parámetros y 540 pases al día', async () => {
    await crearPropuestaCtrl(cuerpo([{ espaciosComprados: 2, cantidad: 16200, spotsPorDia: 3 }]))
    const it = m.crearPropuesta.mock.calls[0][0].items[0]
    expect(it).toMatchObject({
      cantidad: 16200,
      precio: 1200 * 16200,
      // La programación sale de la cuenta, no del cuerpo.
      spotsPorDia: 540,
      espaciosComprados: 2,
      horasDia: 18,
      roadblock: false,
      primaRoadblockPct: null,
    })
  })

  it('NEGATIVO · una cantidad que no cuadra → 400 y el repo NO se llama', async () => {
    const r = await rechazo(crearPropuestaCtrl(cuerpo([{ espaciosComprados: 2, cantidad: 100 }])))
    expect(r.status).toBe(400)
    expect(r.mensaje).toMatch(/^La cantidad de spots no cuadra con la calculadora/)
    expect(m.crearPropuesta).not.toHaveBeenCalled()
  })

  it('con franja, el techo de horas es la franja: 4 h de prime, a 1 800', async () => {
    await crearPropuestaCtrl(cuerpo([{ espaciosComprados: 1, franjaId: 'F-PRIME', tarifaUnitaria: 1800, cantidad: 60 * 30 }]))
    expect(m.crearPropuesta.mock.calls[0][0].items[0]).toMatchObject({ cantidad: 1800, horasDia: 4, spotsPorDia: 60 })
    const r = await rechazo(
      crearPropuestaCtrl(cuerpo([{ espaciosComprados: 1, franjaId: 'F-PRIME', tarifaUnitaria: 1800, horasDia: 5, cantidad: 75 * 30 }])),
    )
    expect(r.status).toBe(400)
  })

  it('NEGATIVO · sin espacios libres → 409', async () => {
    m.datosDelLoop.mockResolvedValue({
      ...LOOP,
      sitios: new Map([[UUID_A, { ...LOOP.sitios.get(UUID_A), campanasActivas: 11 }]]),
    })
    const r = await rechazo(crearPropuestaCtrl(cuerpo([{ espaciosComprados: 2, cantidad: 16200 }])))
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
  const RB = { roadblock: true, cantidad: 12 * 270 * 30 }

  it('NEGATIVO · VENDEDOR con prima → 403 con la frase, y el repo NO se llama', async () => {
    const r = await rechazo(crearPropuestaCtrl(cuerpo([{ ...RB, primaRoadblockPct: 25, tarifaUnitaria: 1500 }])))
    expect(r).toEqual({ status: 403, mensaje: 'Solo un gerente o superior puede poner prima a un Roadblock.' })
    expect(m.crearPropuesta).not.toHaveBeenCalled()
  })

  it('VENDEDOR sin prima → entra a la tarifa, sin ajuste', async () => {
    const r = await crearPropuestaCtrl(cuerpo([RB]))
    expect(m.crearPropuesta.mock.calls[0][0].items[0]).toMatchObject({
      espaciosComprados: 12,
      roadblock: true,
      primaRoadblockPct: 0,
      tarifaCalculada: 1200,
      precioAjustado: false,
    })
    expect(r.ajustes).toEqual([])
  })

  it('GERENTE con prima 25 % a 1 500 → ajuste, tarifa calculada 1 200, y el ajuste lleva la prima', async () => {
    m.usuarioActual.mockResolvedValue(GERENTE)
    const r = await crearPropuestaCtrl(cuerpo([{ ...RB, primaRoadblockPct: 25, tarifaUnitaria: 1500 }]))
    expect(m.crearPropuesta.mock.calls[0][0].items[0]).toMatchObject({
      tarifaUnitaria: 1500,
      precio: 1500 * RB.cantidad,
      tarifaCalculada: 1200,
      precioAjustado: true,
      primaRoadblockPct: 25,
    })
    expect(r.ajustes).toEqual([
      { sitioId: UUID_A, sitioNombre: 'Pantalla Reforma', unidad: 'spot', tarifaCalculada: 1200, tarifa: 1500, primaRoadblockPct: 25 },
    ])
  })

  it('NEGATIVO · VENDEDOR que manda la tarifa CON prima sin poner prima → 403 «distinta»', async () => {
    const r = await rechazo(crearPropuestaCtrl(cuerpo([{ ...RB, tarifaUnitaria: 1500 }])))
    expect(r).toEqual({ status: 403, mensaje: 'Solo un gerente o superior puede cambiar la tarifa de una pantalla.' })
  })
})
