import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  PRECIO-01 · la TARIFA la calcula el servidor; apartarse de ella exige
//  `comercial.aprobar`. Decisión del dueño, 2026-10-01 (hallazgo B40).
// ----------------------------------------------------------------------------
//  Aquí se mide la REGLA del controller con el repo simulado: qué le llega al
//  repo, qué se rechaza y con qué palabras. Lo que la base guarda de verdad, y
//  que la tarifa sale de los datos de ESTA organización, lo fija
//  `precio-ajustado.e2e.test.ts` contra Postgres.
// ============================================================================

const UUID_A = '11111111-1111-4111-8111-111111111111'
const UUID_B = '22222222-2222-4222-8222-222222222222'

const m = vi.hoisted(() => ({
  crearPropuesta: vi.fn(async (input: any) => ({ id: 'P1', nombre: input.nombre, input })),
  datosParaTarifar: vi.fn(),
  usuarioActual: vi.fn(),
  tienePermiso: vi.fn(),
  listarFranjas: vi.fn(async () => [
    { id: 'F-PRIME', nombre: 'Prime', horaInicio: '06:00', horaFin: '10:00', orden: 1, activo: true },
  ]),
}))

vi.mock('./propuestas-repo', () => ({
  crearPropuesta: (input: unknown) => m.crearPropuesta(input),
  aprobarItem: vi.fn(),
  PropuestaError: class PropuestaError extends Error {},
  validarRangoFechas: vi.fn(),
}))
vi.mock('./rejilla-repo', () => ({ listarFranjas: () => m.listarFranjas(), listarTemporadas: vi.fn(async () => []) }))
vi.mock('./volumen-repo', () => ({ listarEscalasVolumen: vi.fn(async () => []) }))
vi.mock('./tarifas-repo', () => ({ datosParaTarifar: (ids: string[]) => m.datosParaTarifar(ids) }))
vi.mock('./auth', () => ({
  usuarioActual: () => m.usuarioActual(),
  tienePermiso: (rol: string, mod: string, acc: string) => m.tienePermiso(rol, mod, acc),
}))

import { crearPropuestaCtrl } from './propuestas-controller'
import { AppError } from './errores'

const MSJ_DISTINTA = 'Solo un gerente o superior puede cambiar la tarifa de una pantalla.'
const MSJ_SIN_TARIFA =
  'Esta pantalla no tiene una tarifa calculada para esa unidad. Pide a un gerente o superior que le ponga precio.'

// Pantalla A: mensual 45 000 y spot 1 200, con prime 1 800 y prime del Buen Fin 2 500.
// Pantalla B: sin ninguna tarifa capturada.
const DATOS = {
  temporadas: [{ id: 'T-BUENFIN', nombre: 'Buen Fin', desde: '2026-11-13', hasta: '2026-11-16' }],
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
        rejilla: [
          { unidad: 'spot', franjaId: 'F-PRIME', temporadaId: null, tarifa: 1800 },
          { unidad: 'spot', franjaId: 'F-PRIME', temporadaId: 'T-BUENFIN', tarifa: 2500 },
        ],
      },
    ],
    [UUID_B, { nombre: 'Pantalla sin tarifa', tarifaPublicada: 0, tarifaMensual: 0 }],
  ]),
}

const VENDEDOR = { id: 'U-VEND', rol: 'VENDEDOR', nombre: 'Vera' }
const GERENTE = { id: 'U-GER', rol: 'GERENTE_VENTAS', nombre: 'Gael' }
const PERMISOS: Record<string, boolean> = { VENDEDOR: false, GERENTE_VENTAS: true, DUENO: true }

const cuerpo = (items: any[], fechaInicio = '2026-10-05', fechaFin = '2026-11-03') => ({
  nombre: 'Campaña de prueba',
  fechaInicio,
  fechaFin,
  items,
})

beforeEach(() => {
  vi.clearAllMocks()
  m.datosParaTarifar.mockResolvedValue(DATOS)
  m.usuarioActual.mockResolvedValue(VENDEDOR)
  m.tienePermiso.mockImplementation(async (rol: string, mod: string, acc: string) =>
    mod === 'comercial' && acc === 'aprobar' ? !!PERMISOS[rol] : false,
  )
})

const enviado = () => m.crearPropuesta.mock.calls[0][0] as any

async function rechazo(p: Promise<unknown>): Promise<AppError> {
  const e = await p.then(
    () => null,
    (x) => x,
  )
  expect(e, 'se esperaba un rechazo').toBeInstanceOf(AppError)
  return e as AppError
}

describe('1 · a la TARIFA: vale para cualquiera, y no es un ajuste', () => {
  it('VENDEDOR a la tarifa mensual → llega al repo con la tarifa calculada y SIN ajuste', async () => {
    const r = await crearPropuestaCtrl(cuerpo([{ sitioId: UUID_A, unidad: 'mensual', tarifaUnitaria: 45000 }]))
    const it0 = enviado().items[0]
    expect(it0).toMatchObject({ tarifaUnitaria: 45000, tarifaCalculada: 45000, precioAjustado: false })
    expect(r.ajustes).toEqual([])
  })

  it('el permiso NI SE CONSULTA cuando todo va a la tarifa', async () => {
    await crearPropuestaCtrl(cuerpo([{ sitioId: UUID_A, unidad: 'mensual', tarifaUnitaria: 45000 }]))
    expect(m.tienePermiso).not.toHaveBeenCalled()
  })

  it('la tarifa sale de la REJILLA: prime en el Buen Fin = 2 500', async () => {
    await crearPropuestaCtrl(
      cuerpo([{ sitioId: UUID_A, unidad: 'spot', tarifaUnitaria: 2500, cantidad: 10, franjaId: 'F-PRIME' }], '2026-11-13', '2026-11-16'),
    )
    expect(enviado().items[0]).toMatchObject({ tarifaCalculada: 2500, precioAjustado: false, precio: 25000 })
  })

  it('modo compatible (precio sin unidad) a la tarifa mensual → vale', async () => {
    await crearPropuestaCtrl(cuerpo([{ sitioId: UUID_A, precio: 45000 }]))
    expect(enviado().items[0]).toMatchObject({ precio: 45000, tarifaCalculada: 45000, precioAjustado: false })
  })
})

describe('2 · DISTINTA de la tarifa, sin permiso: NO, y no se guarda nada', () => {
  it('NEGATIVO · VENDEDOR a 1 peso → 403 con la frase, y el repo no se llama', async () => {
    const e = await rechazo(
      crearPropuestaCtrl(cuerpo([{ sitioId: UUID_A, unidad: 'mensual', tarifaUnitaria: 1 }])),
    )
    expect(e.status).toBe(403)
    expect(e.message).toBe(MSJ_DISTINTA)
    expect(m.crearPropuesta).not.toHaveBeenCalled()
    expect(m.tienePermiso).toHaveBeenCalledWith('VENDEDOR', 'comercial', 'aprobar')
  })

  it('NEGATIVO · también POR ENCIMA de la tarifa: el candado no es solo contra bajar', async () => {
    const e = await rechazo(
      crearPropuestaCtrl(cuerpo([{ sitioId: UUID_A, unidad: 'mensual', tarifaUnitaria: 45000.01 }])),
    )
    expect(e.status).toBe(403)
  })

  it('NEGATIVO · el prime vendido a tarifa base (1 200 en vez de 2 500) se rechaza', async () => {
    const e = await rechazo(
      crearPropuestaCtrl(
        cuerpo([{ sitioId: UUID_A, unidad: 'spot', tarifaUnitaria: 1200, cantidad: 1, franjaId: 'F-PRIME' }], '2026-11-13', '2026-11-16'),
      ),
    )
    expect(e.message).toBe(MSJ_DISTINTA)
  })

  it('NEGATIVO · modo compatible con otro precio → 403', async () => {
    const e = await rechazo(crearPropuestaCtrl(cuerpo([{ sitioId: UUID_A, precio: 100 }])))
    expect(e.status).toBe(403)
  })

  it('NEGATIVO · UNA línea mala tumba la propuesta entera: no se guarda ni la buena', async () => {
    await rechazo(
      crearPropuestaCtrl(
        cuerpo([
          { sitioId: UUID_A, unidad: 'mensual', tarifaUnitaria: 45000 },
          { sitioId: UUID_A, unidad: 'spot', tarifaUnitaria: 1, cantidad: 3 },
        ]),
      ),
    )
    expect(m.crearPropuesta).not.toHaveBeenCalled()
  })

  it('NEGATIVO · sin sesión no hay permiso: falla cerrado', async () => {
    m.usuarioActual.mockResolvedValue(null)
    const e = await rechazo(
      crearPropuestaCtrl(cuerpo([{ sitioId: UUID_A, unidad: 'mensual', tarifaUnitaria: 1 }])),
    )
    expect(e.status).toBe(403)
  })

  it('NEGATIVO · el permiso se lee del ROL DE LA SESIÓN, no del cuerpo', async () => {
    const e = await rechazo(
      crearPropuestaCtrl({
        ...cuerpo([{ sitioId: UUID_A, unidad: 'mensual', tarifaUnitaria: 1, rol: 'DUENO' }]),
        rol: 'DUENO',
      }),
    )
    expect(e.status).toBe(403)
    expect(m.tienePermiso).toHaveBeenCalledWith('VENDEDOR', 'comercial', 'aprobar')
  })
})

describe('3 · DISTINTA, con permiso: sí, con la tarifa y el ajuste anotados', () => {
  it('GERENTE_VENTAS a 30 000 → llega al repo con tarifaCalculada 45 000 y ajustado', async () => {
    m.usuarioActual.mockResolvedValue(GERENTE)
    const r = await crearPropuestaCtrl(cuerpo([{ sitioId: UUID_A, unidad: 'mensual', tarifaUnitaria: 30000 }]))
    expect(enviado().items[0]).toMatchObject({
      tarifaUnitaria: 30000, precio: 30000, tarifaCalculada: 45000, precioAjustado: true,
    })
    // Lo que el route anota en Actividad: la pantalla, la tarifa y el precio nuevo.
    expect(r.ajustes).toEqual([
      { sitioId: UUID_A, sitioNombre: 'Pantalla Reforma', unidad: 'mensual', tarifaCalculada: 45000, tarifa: 30000 },
    ])
  })

  it('la línea que va a la tarifa NO queda como ajuste aunque otra sí', async () => {
    m.usuarioActual.mockResolvedValue(GERENTE)
    const r = await crearPropuestaCtrl(
      cuerpo([
        { sitioId: UUID_A, unidad: 'mensual', tarifaUnitaria: 45000 },
        { sitioId: UUID_A, unidad: 'spot', tarifaUnitaria: 900, cantidad: 2 },
      ]),
    )
    expect(enviado().items.map((i: any) => i.precioAjustado)).toEqual([false, true])
    expect(r.ajustes).toHaveLength(1)
  })

  it('el ajuste NO toca la composición: el precio sigue siendo tarifa × cantidad', async () => {
    m.usuarioActual.mockResolvedValue(GERENTE)
    await crearPropuestaCtrl(cuerpo([{ sitioId: UUID_A, unidad: 'spot', tarifaUnitaria: 900, cantidad: 50 }]))
    expect(enviado().items[0]).toMatchObject({ cantidad: 50, precio: 45000 })
  })
})

describe('4 · SIN tarifa calculable', () => {
  it('NEGATIVO · VENDEDOR → 403 con la frase de «pide a un gerente», aunque mande 0', async () => {
    for (const tarifaUnitaria of [0, 30000]) {
      const e = await rechazo(
        crearPropuestaCtrl(cuerpo([{ sitioId: UUID_B, unidad: 'mensual', tarifaUnitaria }])),
      )
      expect(e.status).toBe(403)
      expect(e.message).toBe(MSJ_SIN_TARIFA)
    }
    expect(m.crearPropuesta).not.toHaveBeenCalled()
  })

  it('NEGATIVO · una pantalla que no aparece (de otra organización) no tiene tarifa', async () => {
    const e = await rechazo(
      crearPropuestaCtrl(cuerpo([{ sitioId: '33333333-3333-4333-8333-333333333333', unidad: 'mensual', tarifaUnitaria: 45000 }])),
    )
    expect(e.message).toBe(MSJ_SIN_TARIFA)
  })

  it('GERENTE le pone precio → ajuste SIN tarifa calculada', async () => {
    m.usuarioActual.mockResolvedValue(GERENTE)
    const r = await crearPropuestaCtrl(cuerpo([{ sitioId: UUID_B, unidad: 'mensual', tarifaUnitaria: 30000 }]))
    expect(enviado().items[0]).toMatchObject({ tarifaCalculada: null, precioAjustado: true, precio: 30000 })
    expect(r.ajustes[0]).toMatchObject({ tarifaCalculada: null, tarifa: 30000, sitioNombre: 'Pantalla sin tarifa' })
  })
})

describe('5 · la tarifa se calcula con UNA lectura por propuesta', () => {
  it('datosParaTarifar recibe los ids de las pantallas de la propuesta', async () => {
    await crearPropuestaCtrl(
      cuerpo([
        { sitioId: UUID_A, unidad: 'mensual', tarifaUnitaria: 45000 },
        { sitioId: UUID_A, unidad: 'spot', tarifaUnitaria: 1200, cantidad: 1 },
      ]),
    )
    expect(m.datosParaTarifar).toHaveBeenCalledTimes(1)
    expect(m.datosParaTarifar.mock.calls[0][0]).toEqual([UUID_A, UUID_A])
  })
})
