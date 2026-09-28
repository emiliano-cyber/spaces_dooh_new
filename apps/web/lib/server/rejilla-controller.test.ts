import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  El controller de la rejilla: qué entra y, sobre todo, qué NO entra.
// ----------------------------------------------------------------------------
//  Aquí vive la aplicación de las reglas de `lib/rejilla.ts` —formato y
//  SOLAPE— contra lo que ya hay guardado. El módulo puro sabe decir si dos
//  franjas se pisan; quién le pasa «las otras» es este archivo, y ése es
//  exactamente el punto donde un olvido deja entrar dos precios para las 09:30.
//
//  Lo que NO se prueba aquí: el SQL (está en `rejilla-repo.test.ts`) ni el
//  candado de la ruta (en `modalidades-candado.test.ts` y en la e2e).
// ============================================================================

const { repo } = vi.hoisted(() => ({
  repo: {
    listarFranjas: vi.fn(async () => [] as any[]),
    listarTemporadas: vi.fn(async () => [] as any[]),
    guardarFranja: vi.fn(async (f: any) => ({ id: 'F-NUEVA', ...f })),
    guardarTemporada: vi.fn(async (t: any) => ({ id: 'T-NUEVA', ...t })),
    desactivarFranja: vi.fn(async () => true),
    desactivarTemporada: vi.fn(async () => true),
    rejillaDeSitio: vi.fn(async () => [] as any[]),
    actualizarRejilla: vi.fn(async () => [] as any[]),
  },
}))
vi.mock('./rejilla-repo', () => repo)

const { guardarFranjaCtrl, guardarTemporadaCtrl } = await import('./rejilla-controller')

const PRIME = {
  id: 'F-PRIME',
  nombre: 'Prime',
  horaInicio: '06:00',
  horaFin: '10:00',
  orden: 1,
  activo: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  repo.listarFranjas.mockResolvedValue([])
  repo.listarTemporadas.mockResolvedValue([])
  repo.guardarFranja.mockImplementation(async (f: any) => ({ id: 'F-NUEVA', ...f }))
  repo.guardarTemporada.mockImplementation(async (t: any) => ({ id: 'T-NUEVA', ...t }))
})

describe('1 · una franja se guarda cuando cabe', () => {
  it('con el catálogo vacío entra sin más', async () => {
    await guardarFranjaCtrl({ nombre: 'Prime', horaInicio: '06:00', horaFin: '10:00' })
    expect(repo.guardarFranja).toHaveBeenCalledTimes(1)
  })

  it('normaliza el nombre quitando los espacios de los extremos', async () => {
    await guardarFranjaCtrl({ nombre: '  Prime  ', horaInicio: '06:00', horaFin: '10:00' })
    expect(repo.guardarFranja.mock.calls[0][0].nombre).toBe('Prime')
  })

  it('una que se TOCA con otra entra: el fin es exclusivo', async () => {
    repo.listarFranjas.mockResolvedValue([PRIME])
    await guardarFranjaCtrl({ nombre: 'Tarde', horaInicio: '10:00', horaFin: '14:00' })
    expect(repo.guardarFranja).toHaveBeenCalledTimes(1)
  })
})

describe('2 · los casos negativos — el corazón', () => {
  it('RECHAZA una franja que se solapa, y NO llama al repo', async () => {
    repo.listarFranjas.mockResolvedValue([PRIME])
    await expect(
      guardarFranjaCtrl({ nombre: 'Media mañana', horaInicio: '09:00', horaFin: '12:00' }),
    ).rejects.toThrow(/solapa/i)
    expect(repo.guardarFranja).not.toHaveBeenCalled()
  })

  it('el mensaje NOMBRA la franja con la que choca', async () => {
    repo.listarFranjas.mockResolvedValue([PRIME])
    await expect(
      guardarFranjaCtrl({ nombre: 'Media mañana', horaInicio: '09:00', horaFin: '12:00' }),
    ).rejects.toThrow(/Prime/)
  })

  it('compara contra TODAS las franjas, incluidas las DESACTIVADAS', async () => {
    // Si solo comparara con las activas, se podría guardar una franja que se
    // solapa con una apagada — y el día que alguien la reactive quedarían dos
    // precios para la misma hora, sin ningún error y sin saber desde cuándo.
    await guardarFranjaCtrl({ nombre: 'Prime', horaInicio: '06:00', horaFin: '10:00' })
    expect(repo.listarFranjas).toHaveBeenCalledWith({ incluirInactivas: true })
  })

  it('RECHAZA una hora mal escrita', async () => {
    await expect(
      guardarFranjaCtrl({ nombre: 'X', horaInicio: '6:00', horaFin: '10:00' }),
    ).rejects.toThrow(/HH:MM|hora/i)
    expect(repo.guardarFranja).not.toHaveBeenCalled()
  })

  it('RECHAZA una franja sin nombre', async () => {
    await expect(
      guardarFranjaCtrl({ nombre: '   ', horaInicio: '06:00', horaFin: '10:00' }),
    ).rejects.toThrow()
    expect(repo.guardarFranja).not.toHaveBeenCalled()
  })

  it('al EDITAR, no se compara consigo misma', async () => {
    repo.listarFranjas.mockResolvedValue([PRIME])
    await guardarFranjaCtrl({ id: 'F-PRIME', nombre: 'Prime AM', horaInicio: '06:00', horaFin: '10:00' })
    expect(repo.guardarFranja).toHaveBeenCalledTimes(1)
  })

  it('RECHAZA una temporada que se solapa, y la nombra', async () => {
    repo.listarTemporadas.mockResolvedValue([
      { id: 'T-BF', nombre: 'Buen Fin', desde: '2026-11-13', hasta: '2026-11-16', activo: true },
    ])
    await expect(
      guardarTemporadaCtrl({ nombre: 'Noviembre', desde: '2026-11-01', hasta: '2026-11-30' }),
    ).rejects.toThrow(/Buen Fin/)
    expect(repo.guardarTemporada).not.toHaveBeenCalled()
  })

  it('RECHAZA una temporada que termina antes de empezar', async () => {
    await expect(
      guardarTemporadaCtrl({ nombre: 'X', desde: '2026-11-16', hasta: '2026-11-13' }),
    ).rejects.toThrow(/antes|termina/i)
  })

  it('un `tenantId` en el cuerpo NO llega al repo', async () => {
    // El tenant sale de la sesión dentro del repo. Si entrara por aquí, se
    // podría escribir el catálogo de otra organización con un `curl` — y la
    // fila escrita sería coherente consigo misma, así que el `with check` de la
    // RLS la aprobaría sin rechistar.
    await guardarFranjaCtrl({
      nombre: 'Prime',
      horaInicio: '06:00',
      horaFin: '10:00',
      tenantId: 'T-AJENO',
    })
    const enviado = repo.guardarFranja.mock.calls[0][0]
    expect(JSON.stringify(enviado)).not.toContain('T-AJENO')
    expect(Object.keys(enviado)).not.toContain('tenantId')
  })
})
