import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  M14 · No se publica una campaña digital con pantallas sin creativo asignado.
// ----------------------------------------------------------------------------
//  Tener un creativo CARGADO no es tenerlo ASIGNADO. La auditoría del
//  04/08/2026 encontró campañas Publicadas y Completadas cuyos slots decían
//  todos «Sin asignar»: el creativo existía y estaba aprobado, pero nadie lo
//  ligó a las pantallas. Con eso, el reporte al cliente no puede probar qué se
//  exhibió en cada sitio — que es exactamente lo que se le vendió.
//
//  El guard va en `enviarADominio` y no más tarde a propósito: es el paso previo
//  a que una persona revise la publicación, así que falla antes de gastarle el
//  tiempo a nadie.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

// Estado que gobierna las respuestas del `db` simulado.
let campana: Record<string, unknown> | null
let numCreativos: number
let pantallasSinAsignar: { nombre: string }[]
const sqlEjecutado: string[] = []

vi.mock('./db', () => ({
  pool: {},
  fijarTenant: vi.fn(),
  q1: vi.fn(async (sql: string) => {
    sqlEjecutado.push(sql)
    if (sql.includes('from campanas')) return campana
    if (sql.includes('from creatividades')) return { n: numCreativos }
    return null
  }),
  q: vi.fn(async (sql: string) => {
    sqlEjecutado.push(sql)
    if (sql.includes('from reservas')) return pantallasSinAsignar
    if (sql.includes('update campanas')) return [{ ...campana, enviada_dominio: true }]
    return []
  }),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 't1') }))

const { enviarADominio } = await import('./campanas-repo')

beforeEach(() => {
  sqlEjecutado.length = 0
  campana = { id: 'c1', tipo_campana: 'DOOH', estado_comercial: 'CONFIRMADA' }
  numCreativos = 2
  pantallasSinAsignar = []
})

describe('enviarADominio — asignación de creativos a pantallas', () => {
  it('con todas las pantallas asignadas, envía', async () => {
    const r = await enviarADominio('c1')
    expect(r).toBeTruthy()
    expect(sqlEjecutado.some((s) => s.includes('update campanas'))).toBe(true)
  })

  it('bloquea si una pantalla digital no tiene creativo, y la NOMBRA', async () => {
    pantallasSinAsignar = [{ nombre: 'GUSTAVO BAZ #83' }, { nombre: 'JINETES 108' }]
    await expect(enviarADominio('c1')).rejects.toThrow(/GUSTAVO BAZ #83.*JINETES 108/)
    // Y no debe haber tocado la campaña.
    expect(sqlEjecutado.some((s) => s.includes('update campanas'))).toBe(false)
  })

  it('el mensaje dice DÓNDE arreglarlo', async () => {
    pantallasSinAsignar = [{ nombre: 'REVOLUCION 267' }]
    await expect(enviarADominio('c1')).rejects.toThrow(/Creativos/)
  })

  it('sigue bloqueando primero por «sin creativos», que es el caso más básico', async () => {
    numCreativos = 0
    pantallasSinAsignar = [{ nombre: 'DA IGUAL' }]
    await expect(enviarADominio('c1')).rejects.toThrow(/no tiene anuncios/)
  })

  it('a una campaña OOH no se le exige nada de esto', async () => {
    // Las fijas llevan lona: su trazabilidad va por la OT de montaje y sus
    // fotos, no por `reservas.creativos`. Si este guard las alcanzara, una
    // campaña de espectaculares no podría publicarse nunca.
    campana = { id: 'c1', tipo_campana: 'OOH', estado_comercial: 'CONFIRMADA' }
    numCreativos = 0
    pantallasSinAsignar = [{ nombre: 'ESPECTACULAR SIN CREATIVO' }]
    const r = await enviarADominio('c1')
    expect(r).toBeTruthy()
  })

  it('la consulta solo mira pantallas digitales y reservas vivas', async () => {
    // Dos filtros que si se pierden convierten el guard en un bloqueo absurdo:
    // una reserva CANCELADA no tiene que llevar creativo, y una pantalla fija
    // de una HÍBRIDA tampoco.
    await enviarADominio('c1')
    const consulta = sqlEjecutado.find((s) => s.includes('from reservas'))
    expect(consulta).toContain("estatus <> 'CANCELADA'")
    expect(consulta).toContain('PANTALLA_DIGITAL')
  })

  it('una campaña cancelada no se envía, pase lo que pase', async () => {
    campana = { id: 'c1', tipo_campana: 'DOOH', estado_comercial: 'CANCELADA' }
    await expect(enviarADominio('c1')).rejects.toThrow(/cancelada/i)
  })
})
