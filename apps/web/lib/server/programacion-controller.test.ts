import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  PROG-01 · el controller de la franja PROGRAMADA: qué entra y qué NO entra.
// ----------------------------------------------------------------------------
//  Lo que se fija aquí es la forma de la entrada (zod `.strict()`, uuid, al
//  menos una campaña, `franjaId` explícito aunque sea null) y la traducción de
//  lo que dice el repo a un 404 con frase. Lo que NO se prueba aquí: la
//  atomicidad ni el aislamiento, que solo se ven contra Postgres de verdad
//  (`lib/test/franja-programada.e2e.test.ts`).
// ============================================================================

const { repo } = vi.hoisted(() => ({
  repo: {
    asignarFranjaProgramada: vi.fn(async (): Promise<any> => ({ ok: true, franja: null, campanas: [] })),
    listarProgramacion: vi.fn(async (): Promise<any> => ({ franjas: [], campanas: [] })),
  },
}))
vi.mock('./programacion-repo', () => repo)

const { asignarFranjaProgramadaCtrl, programacionCtrl } = await import('./programacion-controller')

const C1 = '11111111-1111-4111-8111-111111111111'
const C2 = '22222222-2222-4222-8222-222222222222'
const F1 = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  vi.clearAllMocks()
  repo.asignarFranjaProgramada.mockResolvedValue({
    ok: true,
    franja: { id: F1, nombre: 'Prime', horaInicio: '06:00', horaFin: '10:00' },
    campanas: [{ id: C1, folio: 'CMP-1', nombre: 'Uno' }],
  })
})

describe('1 · la entrada', () => {
  it('asigna una franja a varias campañas en UNA llamada al repo', async () => {
    await asignarFranjaProgramadaCtrl({ franjaId: F1, campanaIds: [C1, C2] })
    expect(repo.asignarFranjaProgramada).toHaveBeenCalledTimes(1)
    expect(repo.asignarFranjaProgramada).toHaveBeenCalledWith([C1, C2], F1)
  })

  it('quita la franja con `franjaId: null` explícito', async () => {
    await asignarFranjaProgramadaCtrl({ franjaId: null, campanaIds: [C1] })
    expect(repo.asignarFranjaProgramada).toHaveBeenCalledWith([C1], null)
  })

  it('quita duplicados: la misma campaña dos veces cuenta una', async () => {
    await asignarFranjaProgramadaCtrl({ franjaId: F1, campanaIds: [C1, C1, C2] })
    expect(repo.asignarFranjaProgramada).toHaveBeenCalledWith([C1, C2], F1)
  })
})

describe('2 · los negativos — y NINGUNO llega al repo', () => {
  const casos: [string, unknown][] = [
    ['sin campañas', { franjaId: F1, campanaIds: [] }],
    ['sin `franjaId` (hay que decir null para quitar)', { campanaIds: [C1] }],
    ['un id de campaña que no es uuid', { franjaId: F1, campanaIds: ['no-soy-uuid'] }],
    ['una franja que no es uuid', { franjaId: 'x', campanaIds: [C1] }],
    // `.strict()`: un campo de más se rechaza. Si entrara `tenantId`, alguien
    // creería que puede elegir la organización con un curl.
    ['un campo que no existe (tenantId)', { franjaId: F1, campanaIds: [C1], tenantId: C2 }],
    // Y el precio NO viaja por aquí: programar no toca lo contratado.
    ['un intento de cambiar la franja CONTRATADA', { franjaId: F1, campanaIds: [C1], franjaContratadaId: F1 }],
  ]
  for (const [nombre, cuerpo] of casos) {
    it(`rechaza ${nombre} con 400`, async () => {
      await expect(asignarFranjaProgramadaCtrl(cuerpo)).rejects.toMatchObject({ status: 400 })
      expect(repo.asignarFranjaProgramada).not.toHaveBeenCalled()
    })
  }

  it('tope de campañas por operación', async () => {
    const muchas = Array.from({ length: 501 }, (_, i) =>
      `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`,
    )
    await expect(asignarFranjaProgramadaCtrl({ franjaId: F1, campanaIds: muchas })).rejects.toMatchObject({
      status: 400,
    })
  })
})

describe('3 · lo que dice el repo se traduce a un 404 con frase', () => {
  it('franja ajena o dada de baja → 404 que nombra la franja', async () => {
    repo.asignarFranjaProgramada.mockResolvedValue({ ok: false, motivo: 'franja', faltan: [] })
    await expect(asignarFranjaProgramadaCtrl({ franjaId: F1, campanaIds: [C1] })).rejects.toMatchObject({
      status: 404,
      message: expect.stringMatching(/franja/i),
    })
  })

  it('alguna campaña ajena → 404 que dice que NO se programó ninguna', async () => {
    repo.asignarFranjaProgramada.mockResolvedValue({ ok: false, motivo: 'campanas', faltan: [C2] })
    await expect(
      asignarFranjaProgramadaCtrl({ franjaId: F1, campanaIds: [C1, C2] }),
    ).rejects.toMatchObject({ status: 404, message: expect.stringMatching(/ninguna/i) })
  })

  it('devuelve el texto de bitácora armado con la regla pura', async () => {
    const r = await asignarFranjaProgramadaCtrl({ franjaId: F1, campanaIds: [C1] })
    expect(r.bitacora.accion).toMatch(/Programó .*Prime/)
    expect(r.bitacora.entidad).toContain('CMP-1')
  })
})

describe('4 · la lectura', () => {
  it('rechaza un campanaId que no es uuid sin tocar el repo', async () => {
    await expect(programacionCtrl({ campanaId: 'x' })).rejects.toMatchObject({ status: 400 })
    expect(repo.listarProgramacion).not.toHaveBeenCalled()
  })

  it('calcula los avisos de cada campaña con la regla pura', async () => {
    repo.listarProgramacion.mockResolvedValue({
      franjas: [
        { id: F1, nombre: 'Prime', horaInicio: '06:00', horaFin: '10:00', activo: true },
        { id: 'F-NOCHE', nombre: 'Noche', horaInicio: '20:00', horaFin: '23:00', activo: true },
      ],
      campanas: [
        {
          id: C1,
          folio: 'CMP-1',
          nombre: 'Uno',
          estadoComercial: 'ACTIVA',
          fechaInicio: '2026-10-01',
          fechaFin: '2026-10-31',
          franjaProgramadaId: 'F-NOCHE',
          contratadas: [{ franjaId: F1, franjaNombre: 'Prime', pantallas: 2 }],
        },
      ],
    })
    const r = await programacionCtrl()
    expect(r.campanas[0].avisos).toHaveLength(1)
    expect(r.campanas[0].avisos[0].texto).toMatch(/«Prime».*«Noche»/)
  })
})
