import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolClient } from 'pg'

// ============================================================================
//  El SQL de la rejilla: qué consulta sale de verdad.
// ----------------------------------------------------------------------------
//  Las pruebas del controller mockean el repo entero y no ven una línea de este
//  SQL. Aquí se mockea `./db` y SE MIRAN LAS CONSULTAS, que es el único plano
//  donde se puede fijar lo que R2 exige: el `and tenant_id = $n` como segunda
//  capa sobre la RLS en toda operación por id.
//
//  Por qué importa especialmente aquí: el modo de fallo de R2 NO DA ERROR.
//  Leer la rejilla sin contexto de tenant devuelve cero filas en silencio, y
//  cero filas de rejilla significa «esta pantalla no tiene tarifa por franja»
//  — o sea, se cobra la tarifa base. Nadie ve un fallo: se ve un precio más
//  barato. Ya pasó dos veces en este repositorio con `qRaw`.
//
//  Lo que estas pruebas NO afirman: que Postgres acepte el SQL. Eso son las e2e.
// ============================================================================

const consultas: { sql: string; params: unknown[] }[] = []

const clienteFalso = {
  query: vi.fn(async (sql: string, params?: unknown[]) => {
    consultas.push({ sql, params: params ?? [] })
    return { rows: [] }
  }),
} as unknown as PoolClient

const db = {
  pool: { connect: vi.fn(async () => clienteFalso) },
  q: vi.fn(async (sql: string, params?: unknown[]) => {
    consultas.push({ sql, params: params ?? [] })
    return []
  }),
  // El tipo se declara ancho a propósito: `vi.fn` infiere el retorno del cuerpo
  // inicial, y sin esto un `mockResolvedValue` con una fila no compila.
  q1: vi.fn(async (sql: string, params?: unknown[]): Promise<any> => {
    consultas.push({ sql, params: params ?? [] })
    return null
  }),
  qConTenant: vi.fn(async () => []),
  qRaw1: vi.fn(async () => null),
  fijarTenant: vi.fn(),
  fijarTenantExplicito: vi.fn(),
  withTenantTx: vi.fn(async (fn: (c: PoolClient) => Promise<unknown>) => fn(clienteFalso)),
}
vi.mock('./db', () => db)
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'T1') }))

const {
  listarFranjas,
  listarTemporadas,
  guardarFranja,
  guardarTemporada,
  desactivarFranja,
  rejillaDeSitio,
  actualizarRejilla,
} = await import('./rejilla-repo')

beforeEach(() => {
  consultas.length = 0
  vi.clearAllMocks()
  db.q.mockImplementation(async (sql: string, params?: unknown[]) => {
    consultas.push({ sql, params: params ?? [] })
    return []
  })
  db.q1.mockImplementation(async (sql: string, params?: unknown[]) => {
    consultas.push({ sql, params: params ?? [] })
    return { id: 'S1', tenant_id: 'T1' }
  })
  db.withTenantTx.mockImplementation(async (fn: (c: PoolClient) => Promise<unknown>) =>
    fn(clienteFalso),
  )
})

const sqls = () => consultas.map((c) => c.sql.replace(/\s+/g, ' ').trim())
const params = () => consultas.flatMap((c) => c.params)

describe('1 · leer el catálogo de la organización', () => {
  it('las franjas salen en el orden que el dueño decidió, no en el alfabético', async () => {
    await listarFranjas()
    expect(sqls()[0]).toMatch(/from franjas_horarias/)
    expect(sqls()[0]).toMatch(/order by orden/)
  })

  it('por omisión solo las ACTIVAS: una franja apagada no se puede vender', async () => {
    await listarFranjas()
    expect(sqls()[0]).toMatch(/activo\s*=\s*true/)
  })

  it('con `incluirInactivas` salen todas — la pantalla de configuración las necesita', async () => {
    await listarFranjas({ incluirInactivas: true })
    expect(sqls()[0]).not.toMatch(/activo\s*=\s*true/)
  })

  it('las temporadas salen ordenadas por `desde`, y con las fechas como texto', async () => {
    // `to_char` y no el `Date` del driver: un `new Date('2026-11-13')` es un
    // instante UTC y en México se imprime como el día 12.
    await listarTemporadas()
    expect(sqls()[0]).toMatch(/from temporadas/)
    expect(sqls()[0]).toMatch(/order by desde/)
    expect(sqls()[0]).toMatch(/to_char\(\s*desde/)
  })
})

describe('2 · escribir el catálogo — el tenant SIEMPRE explícito', () => {
  it('un alta de franja lleva el tenant de la SESIÓN, nunca del argumento', async () => {
    await guardarFranja({ nombre: 'Prime', horaInicio: '06:00', horaFin: '10:00', orden: 1 })
    const ins = sqls().find((s) => /insert into franjas_horarias/.test(s))
    expect(ins).toBeDefined()
    expect(ins).toMatch(/tenant_id/)
    expect(params()).toContain('T1')
  })

  it('una EDICIÓN por id lleva `and tenant_id` — segunda capa sobre la RLS', async () => {
    await guardarFranja({ id: 'F1', nombre: 'Prime', horaInicio: '06:00', horaFin: '10:00' })
    const upd = sqls().find((s) => /update franjas_horarias/.test(s))
    expect(upd).toBeDefined()
    expect(upd).toMatch(/where id\s*=\s*\$\d+ and tenant_id\s*=\s*\$\d+/)
  })

  it('una temporada por id, igual', async () => {
    await guardarTemporada({ id: 'T-BF', nombre: 'Buen Fin', desde: '2026-11-13', hasta: '2026-11-16' })
    const upd = sqls().find((s) => /update temporadas/.test(s))
    expect(upd).toMatch(/where id\s*=\s*\$\d+ and tenant_id\s*=\s*\$\d+/)
  })

  it('NO se BORRA una franja: se desactiva', async () => {
    // Una franja vendida es un hecho, y `propuesta_items_franja_fkey` es
    // `on delete restrict`: un borrado real devolvería un 500 sin explicar por
    // qué. La baja es lógica, como en `entidades_fiscales` y `arrendadores`.
    await desactivarFranja('F1')
    expect(sqls().some((s) => /delete from franjas_horarias/.test(s))).toBe(false)
    const upd = sqls().find((s) => /update franjas_horarias/.test(s))
    expect(upd).toMatch(/activo\s*=\s*false/)
    expect(upd).toMatch(/and tenant_id\s*=\s*\$\d+/)
  })
})

describe('3 · la rejilla de una pantalla', () => {
  it('se lee filtrada por el sitio, con el nombre de franja y temporada', async () => {
    await rejillaDeSitio('S1')
    const sel = sqls().find((s) => /from sitio_tarifas/.test(s))
    expect(sel).toBeDefined()
    expect(sel).toMatch(/where\s+\w*\.?sitio_id\s*=\s*\$1/)
    expect(sel).toMatch(/left join franjas_horarias/)
    expect(sel).toMatch(/left join temporadas/)
  })

  it('los JOIN del catálogo llevan `and .tenant_id =` — R2', async () => {
    await rejillaDeSitio('S1')
    const sel = sqls().find((s) => /from sitio_tarifas/.test(s))!
    expect(sel).toMatch(/join franjas_horarias \w+ on [\w.]+\.id = [\w.]+\.franja_id and [\w.]+\.tenant_id = [\w.]+\.tenant_id/)
    expect(sel).toMatch(/join temporadas \w+ on [\w.]+\.id = [\w.]+\.temporada_id and [\w.]+\.tenant_id = [\w.]+\.tenant_id/)
  })
})

describe('4 · escribir la rejilla — lo que NO puede pasar', () => {
  const FILA = { unidad: 'spot', franjaId: 'F1', temporadaId: null, tarifaPublicada: 1400 }

  it('el tenant sale de la FILA DE LA PANTALLA, no de la sesión ni del cuerpo', async () => {
    // Mismo invariante que `insertarSitio` y `actualizarModalidades`: una tarifa
    // no puede acabar en otro tenant que su pantalla.
    db.q1.mockResolvedValue({ id: 'S1', tenant_id: 'T-DE-LA-PANTALLA' })
    await actualizarRejilla('S1', { guardar: [FILA], quitar: [] })
    expect(params()).toContain('T-DE-LA-PANTALLA')
  })

  it('NO hay borrado en bloque: guardar una fila no se lleva las demás', async () => {
    // La trampa de `actualizarSitioCompleto`, que hace
    // `delete from sitio_modalidades where sitio_id = $1`. Aquí llega una
    // EDICIÓN: lo que no viene no es «bórralo», es «no se tocó». Perder una
    // fila de rejilla no da error, solo deja de cobrarse.
    await actualizarRejilla('S1', { guardar: [FILA], quitar: [] })
    const borrados = sqls().filter((s) => /delete from sitio_tarifas/.test(s))
    expect(borrados.every((s) => /franja_id/.test(s) || /unidad/.test(s))).toBe(true)
    expect(sqls()).not.toContain('delete from sitio_tarifas where sitio_id = $1')
  })

  it('el alta usa `on conflict` sobre las MISMAS expresiones COALESCE del índice', async () => {
    // Si el `on conflict` no reprodujera exactamente el índice de
    // `20260928_rejilla_franja_temporada.sql`, Postgres no lo encontraría y el
    // upsert sería un insert duplicado — o un error de restricción.
    await actualizarRejilla('S1', { guardar: [FILA], quitar: [] })
    const ins = sqls().find((s) => /insert into sitio_tarifas/.test(s))!
    expect(ins).toMatch(/on conflict \(\s*sitio_id, unidad, coalesce\(franja_id, '00000000-0000-0000-0000-000000000000'::uuid\), coalesce\(temporada_id, '00000000-0000-0000-0000-000000000000'::uuid\)\s*\)/)
    expect(ins).toMatch(/do update set tarifa_publicada = excluded\.tarifa_publicada/)
  })

  it('la BAJA de una fila lleva `and tenant_id` — R2', async () => {
    await actualizarRejilla('S1', {
      guardar: [],
      quitar: [{ unidad: 'spot', franjaId: 'F1', temporadaId: null }],
    })
    const del = sqls().find((s) => /delete from sitio_tarifas/.test(s))!
    expect(del).toMatch(/and tenant_id\s*=\s*\$\d+/)
  })

  it('la BAJA compara con `is not distinct from` y NO con `=`', async () => {
    // ESTO LO ENCONTRÓ UN MUTANTE VIVO, no la lectura. Cambiar
    // `is not distinct from` por `=` deja las pruebas en verde y rompe algo que
    // NO da ningún error: con `=`, un `franja_id = NULL` no casa con nada —en
    // SQL `null = null` es `null`, no `true`— así que la fila «Todo el día /
    // todo el año», que es la más común de la rejilla, NO SE PODRÍA BORRAR
    // NUNCA. El usuario pulsaría la papelera, la petición saldría 200, y la
    // tarifa seguiría ahí. Es exactamente el modo de fallo que este repositorio
    // persigue: el sistema afirma que hizo algo que no hizo.
    await actualizarRejilla('S1', {
      guardar: [],
      quitar: [{ unidad: 'spot', franjaId: null, temporadaId: null }],
    })
    const del = sqls().find((s) => /delete from sitio_tarifas/.test(s))!
    expect(del).toMatch(/franja_id\s+is not distinct from\s+\$\d+/)
    expect(del).toMatch(/temporada_id\s+is not distinct from\s+\$\d+/)
    // Y que no se cuele un `=` sobre esas dos columnas por otro lado.
    expect(del).not.toMatch(/franja_id\s*=/)
    expect(del).not.toMatch(/temporada_id\s*=/)
  })

  it('una pantalla que no existe —o que es de OTRA organización— devuelve null sin escribir', async () => {
    // La lectura pasa por `q`, con RLS: una pantalla ajena simplemente no
    // aparece, y aquí eso tiene que traducirse en «no se escribe nada», no en
    // un insert con el tenant de la sesión.
    db.q1.mockResolvedValue(null)
    const r = await actualizarRejilla('S-AJENA', { guardar: [FILA], quitar: [] })
    expect(r).toBeNull()
    expect(sqls().some((s) => /insert into sitio_tarifas/.test(s))).toBe(false)
  })

  it('todo o nada: las altas y las bajas van en UNA transacción', async () => {
    await actualizarRejilla('S1', {
      guardar: [FILA],
      quitar: [{ unidad: 'hora', franjaId: null, temporadaId: null }],
    })
    expect(db.withTenantTx).toHaveBeenCalledTimes(1)
  })
})
