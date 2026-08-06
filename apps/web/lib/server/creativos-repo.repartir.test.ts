import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  M14 (la otra mitad) · Repartir creativos a todas las pantallas de una vez.
//
//  El guard de `enviarADominio` impide PUBLICAR con pantallas sin creativo. Eso
//  cierra el agujero, pero no arregla el motivo por el que se abrió: asignar
//  era pantalla por pantalla, y doce pantallas con dos creativos son
//  veinticuatro campos a mano.
//
//  Lo que se prueba aquí no es la aritmética del reparto —esa vive aparte, en
//  `lib/reparto-creativos`, y tiene sus propias pruebas— sino las decisiones
//  que solo existen aquí y que, equivocadas, no dan error visible:
//    · que no se asigne un creativo de OTRA campaña, o uno sin aprobar;
//    · que `soloVacias` de verdad respete lo ajustado a mano;
//    · que una digital sin slots se NOMBRE en vez de quedar en el olvido, que
//      es lo que dejaría la campaña bloqueada sin decir por cuál;
//    · que todo vaya en UNA transacción: a medias es el peor estado, porque
//      parece hecho y el guard la sigue bloqueando.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

let campanaExiste: boolean
let aprobados: { id: string }[]
let reservas: { id: string; spots_reservados: number | null; nombre: string; tiene: number }[]
let sql: string[]
let updates: { id: string; creativos: unknown }[]

const client = {
  query: vi.fn(async (texto: string, params?: unknown[]) => {
    sql.push(texto)
    if (texto === 'begin' || texto === 'commit' || texto === 'rollback') return { rows: [], rowCount: 0 }
    if (texto.includes('from campanas')) {
      return { rows: campanaExiste ? [{ id: 'c1' }] : [], rowCount: campanaExiste ? 1 : 0 }
    }
    if (texto.includes('from creatividades')) return { rows: aprobados, rowCount: aprobados.length }
    if (texto.includes('from reservas')) return { rows: reservas, rowCount: reservas.length }
    if (texto.includes('update reservas')) {
      updates.push({ id: String(params?.[0]), creativos: JSON.parse(String(params?.[1])) })
      return { rows: [], rowCount: 1 }
    }
    return { rows: [], rowCount: 0 }
  }),
  release: vi.fn(),
}

vi.mock('./db', () => ({
  pool: { connect: vi.fn(async () => client) },
  fijarTenant: vi.fn(),
  q: vi.fn(async () => []),
  q1: vi.fn(async () => null),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 't1') }))

const { repartirCreativosEnCampana, CreatividadError } = await import('./creativos-repo')

beforeEach(() => {
  sql = []
  updates = []
  client.query.mockClear()
  client.release.mockClear()
  campanaExiste = true
  aprobados = [{ id: 'cr1' }, { id: 'cr2' }]
  reservas = [
    { id: 'r1', spots_reservados: 12, nombre: 'GUSTAVO BAZ #83', tiene: 0 },
    { id: 'r2', spots_reservados: 10, nombre: 'JINETES 108', tiene: 0 },
  ]
})

describe('repartirCreativosEnCampana', () => {
  it('reparte los slots DE CADA pantalla, no una cifra copiada', async () => {
    // El caso que motiva todo (M12): 12 y 10 slots conviviendo.
    const r = await repartirCreativosEnCampana('c1', ['cr1', 'cr2'], false)
    expect(r).toEqual({ asignadas: 2, omitidasPorTenerYa: 0, sinSlots: [] })
    expect(updates).toEqual([
      { id: 'r1', creativos: [{ creatividadId: 'cr1', veces: 6 }, { creatividadId: 'cr2', veces: 6 }] },
      { id: 'r2', creativos: [{ creatividadId: 'cr1', veces: 5 }, { creatividadId: 'cr2', veces: 5 }] },
    ])
  })

  it('descarta los creativos que no están aprobados en esta campaña', async () => {
    // La base solo devuelve cr1 como aprobado: cr2 podria ser de otra campaña,
    // estar sin validar o retirado. El id llega del navegador, asi que la
    // fuente de verdad es la consulta, no lo que mande el cliente.
    aprobados = [{ id: 'cr1' }]
    await repartirCreativosEnCampana('c1', ['cr1', 'cr2'], false)
    expect(updates[0].creativos).toEqual([{ creatividadId: 'cr1', veces: 12 }])
  })

  it('si NINGUNO es válido, no escribe nada y lo dice', async () => {
    aprobados = []
    await expect(repartirCreativosEnCampana('c1', ['ajeno'], false)).rejects.toBeInstanceOf(
      CreatividadError,
    )
    expect(updates).toHaveLength(0)
    expect(sql).toContain('rollback')
    expect(sql).not.toContain('commit')
  })

  it('soloVacias respeta lo que ya se ajustó a mano', async () => {
    reservas = [
      { id: 'r1', spots_reservados: 12, nombre: 'A', tiene: 2 },
      { id: 'r2', spots_reservados: 12, nombre: 'B', tiene: 0 },
    ]
    const r = await repartirCreativosEnCampana('c1', ['cr1'], true)
    expect(r).toEqual({ asignadas: 1, omitidasPorTenerYa: 1, sinSlots: [] })
    expect(updates.map((u) => u.id)).toEqual(['r2'])
  })

  it('sin soloVacias, sobrescribe — que es lo que se pidió', async () => {
    reservas = [{ id: 'r1', spots_reservados: 12, nombre: 'A', tiene: 2 }]
    const r = await repartirCreativosEnCampana('c1', ['cr1'], false)
    expect(r?.asignadas).toBe(1)
    expect(updates).toHaveLength(1)
  })

  it('una digital SIN slots se nombra en vez de quedar en el olvido', async () => {
    // El guard de publicación se la va a exigir igual. Si no se nombra, el
    // usuario reparte, la app dice que todo bien, y al enviar se bloquea por una
    // pantalla que no sabe cuál es.
    reservas = [
      { id: 'r1', spots_reservados: 0, nombre: 'REVOLUCION 267', tiene: 0 },
      { id: 'r2', spots_reservados: 12, nombre: 'OK', tiene: 0 },
    ]
    const r = await repartirCreativosEnCampana('c1', ['cr1'], false)
    expect(r?.asignadas).toBe(1)
    expect(r?.sinSlots).toEqual(['REVOLUCION 267'])
    expect(updates.map((u) => u.id)).toEqual(['r2'])
  })

  it('campaña inexistente devuelve null sin escribir', async () => {
    campanaExiste = false
    expect(await repartirCreativosEnCampana('nope', ['cr1'], false)).toBeNull()
    expect(updates).toHaveLength(0)
  })

  it('todo va en UNA transacción y el cliente siempre se libera', async () => {
    await repartirCreativosEnCampana('c1', ['cr1'], false)
    expect(sql[0]).toBe('begin')
    expect(sql.at(-1)).toBe('commit')
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it('exige las MISMAS pantallas que el guard de publicación', async () => {
    // Si este predicado y el de `enviarADominio` se separaran, habría pantallas
    // que el reparto no toca y el guard sí exige: un bloqueo sin salida. Los dos
    // salen de `esPantallaDigitalSql`, y esto lo ancla.
    await repartirCreativosEnCampana('c1', ['cr1'], false)
    const consulta = sql.find((s) => s.includes('from reservas')) ?? ''
    expect(consulta).toContain("tipo_medio = 'PANTALLA_DIGITAL'")
    expect(consulta).toContain('es_rotativo')
    expect(consulta).toContain("exhibicion in ('digital','rotativo')")
    expect(consulta).toContain("estatus <> 'CANCELADA'")
  })
})
