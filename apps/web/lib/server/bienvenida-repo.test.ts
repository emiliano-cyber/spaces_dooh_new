import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolClient } from 'pg'

// ============================================================================
//  El cuestionario de bienvenida — lo que toda consulta tiene que llevar dentro.
// ----------------------------------------------------------------------------
//  Estas pruebas no miran resultados: miran el SQL que sale del repo. El motivo
//  es el modo de fallo R2 de este repositorio, que NO da error: una consulta
//  acotada solo por `id` —o solo por `entidad_id`— devuelve cero filas en
//  silencio, o filas de otra organización, según con qué rol y con qué GUC
//  corra. Ya pasó dos veces y una dejó el desbloqueo de usuarios inservible un
//  despliegue entero.
//
//  `entidad_id` NO es una frontera de seguridad. La frontera es UNA:
//  `tenant_id` con RLS. Aquí se fija que la segunda capa —el `and tenant_id
//  = $n` explícito— esté en TODAS las consultas del módulo.
//
//  Una unitaria no puede demostrar aislamiento: simula la base. Lo que sí puede
//  hacer, y es lo que hace, es ponerse ROJA el día que alguien borre un
//  `and tenant_id` al refactorizar, o cambie la escritura del cuestionario por
//  una llamada por entidad y pierda la atomicidad.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const TENANT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

let consultas: { sql: string; params: unknown[] }[] = []
/** Cuántas razones sociales ve el repo DENTRO de la transacción. */
let yaExistentes = 0

const PLAN = [
  { razonSocial: 'Inmuebles del Norte SA de CV', roles: ['ARRENDAMIENTOS', 'ACTIVOS'] },
  { razonSocial: 'Operadora Comercial SA de CV', roles: ['OPERACION', 'VENTAS'] },
]

let siguienteId = 0

function responder(sql: string): { rows: any[]; rowCount: number } {
  if (/count\(\*\)/.test(sql)) return { rows: [{ total: yaExistentes }], rowCount: 1 }
  if (/insert into entidades_fiscales/.test(sql)) {
    siguienteId += 1
    return {
      rows: [
        {
          id: `E${siguienteId}`,
          tenant_id: TENANT,
          razon_social: PLAN[siguienteId - 1]?.razonSocial ?? 'X',
          activo: true,
          creado_en: new Date('2026-09-18T00:00:00Z'),
        },
      ],
      rowCount: 1,
    }
  }
  if (/from catalogo_roles_entidad/.test(sql)) {
    return {
      rows: [
        { rol: 'ARRENDAMIENTOS', etiqueta: 'Paga las rentas a los arrendadores' },
        { rol: 'VENTAS', etiqueta: 'Vende publicidad' },
      ],
      rowCount: 2,
    }
  }
  if (/from entidades_fiscales/.test(sql)) {
    return {
      rows: [
        {
          id: 'E1',
          tenant_id: TENANT,
          razon_social: 'Inmuebles del Norte SA de CV',
          activo: true,
          creado_en: new Date('2026-09-18T00:00:00Z'),
          roles: ['ARRENDAMIENTOS'],
        },
      ],
      rowCount: 1,
    }
  }
  return { rows: [], rowCount: 0 }
}

const anotar = async (sql: string, params: unknown[] = []) => {
  consultas.push({ sql, params })
  return responder(sql)
}

const client = { query: anotar } as unknown as PoolClient

vi.mock('./db', () => ({
  q: vi.fn(async (sql: string, params: unknown[] = []) => (await anotar(sql, params)).rows),
  q1: vi.fn(
    async (sql: string, params: unknown[] = []) => (await anotar(sql, params)).rows[0] ?? null,
  ),
  // Si el repo llamara a `qRaw`, la prueba muere aquí en vez de pasar en verde
  // sobre una consulta SIN contexto de tenant. Es el fallo R2 exacto.
  qRaw: vi.fn(async () => {
    throw new Error('el repo de bienvenida NO puede usar qRaw')
  }),
  qRaw1: vi.fn(async () => {
    throw new Error('el repo de bienvenida NO puede usar qRaw1')
  }),
  pool: { connect: vi.fn() },
  fijarTenant: vi.fn(),
  withTenantTx: async (fn: (c: PoolClient) => Promise<unknown>) => fn(client),
}))
vi.mock('./tenant', () => ({ tenantActual: async () => TENANT }))

const repo = await import('./bienvenida-repo')

const sqlDe = (patron: RegExp) => consultas.find((c) => patron.test(c.sql))
const todasLas = (patron: RegExp) => consultas.filter((c) => patron.test(c.sql))
/** Las consultas que tocan las tablas POR TENANT del módulo. */
const consultasDelModulo = () =>
  consultas.filter((c) => /entidades_fiscales|entidad_roles/.test(c.sql))

beforeEach(() => {
  consultas = []
  yaExistentes = 0
  siguienteId = 0
})

// ─────────────────────────────────────────────────────────────────────────────
describe('1 · NINGUNA consulta por tenant se queda sin su tenant_id', () => {
  it('el recuento va acotado a la organización', async () => {
    await repo.contarEntidadesDelTenant()
    const sel = sqlDe(/count\(\*\)/)!
    expect(sel, 'no se contó nada').toBeDefined()
    expect(sel.sql).toMatch(/tenant_id\s*=\s*\$\d/)
    expect(sel.params).toContain(TENANT)
  })

  it('el listado lleva tenant_id, y la subconsulta de roles el SUYO', async () => {
    // La subconsulta no puede apoyarse en que el padre ya esté acotado: si un
    // día el `from` cambia, se queda leyendo `entidad_roles` de toda la base.
    await repo.listarEntidadesConRoles()
    const sel = sqlDe(/from entidades_fiscales/)!
    expect(sel).toBeDefined()
    expect(sel.params).toContain(TENANT)
    const tenants = sel.sql.match(/tenant_id\s*=\s*\$\d/g) ?? []
    expect(tenants.length, `solo hay ${tenants.length} acotaciones: ${sel.sql}`).toBeGreaterThan(1)
  })

  it('y el barrido: TODA consulta del módulo nombra tenant_id y lo pasa', async () => {
    // La red de seguridad para lo que se añada mañana: una función nueva que se
    // olvide del tenant cae aquí sin que nadie escriba su caso.
    await repo.contarEntidadesDelTenant()
    await repo.listarEntidadesConRoles()
    await repo.crearEntidadesDelCuestionario(PLAN)
    const delModulo = consultasDelModulo()
    expect(delModulo.length).toBeGreaterThan(4)
    for (const c of delModulo) {
      expect(c.sql, `consulta sin tenant_id: ${c.sql}`).toMatch(/tenant_id/)
      expect(c.params, `consulta sin el tenant en los parámetros: ${c.sql}`).toContain(TENANT)
    }
  })

  it('el catálogo de roles se lee SIN tenant_id, y eso es correcto', async () => {
    // `catalogo_roles_entidad` no tiene `tenant_id`: es vocabulario del
    // producto, igual para toda la flota, y por eso queda fuera del invariante
    // de RLS — mismo criterio que `folios_consecutivos`. Se fija aquí para que
    // nadie «arregle» la consulta añadiéndole un filtro que no existe.
    const roles = await repo.catalogoRolesConEtiqueta()
    const sel = sqlDe(/from catalogo_roles_entidad/)!
    expect(sel).toBeDefined()
    expect(sel.sql).not.toMatch(/tenant_id/)
    expect(roles.map((r) => r.rol)).toContain('VENTAS')
    // La etiqueta viaja con el rol: la pantalla la necesita para preguntar, y
    // traérsela aparte sería una segunda consulta por el mismo dato.
    expect(roles[0].etiqueta).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('2 · o quedan TODAS las razones sociales, o ninguna', () => {
  it('las dos entidades y sus cuatro roles entran por el MISMO cliente', async () => {
    // Si cada entidad fuera una llamada suelta y fallara la segunda, quedaría
    // media identidad fiscal escrita: una razón social con rol y las demás sin
    // existir. A medias es peor que no haber contestado.
    const r = await repo.crearEntidadesDelCuestionario(PLAN)
    expect(r.ok).toBe(true)
    expect(todasLas(/insert into entidades_fiscales/)).toHaveLength(2)
    expect(todasLas(/insert into entidad_roles/).length).toBeGreaterThan(0)
  })

  it('la entidad se inserta ANTES que sus roles', async () => {
    await repo.crearEntidadesDelCuestionario(PLAN)
    const orden = consultas
      .filter((c) => /insert into entidades_fiscales|insert into entidad_roles/.test(c.sql))
      .map((c) => (/entidades_fiscales/.test(c.sql) ? 'entidad' : 'rol'))
    expect(orden[0]).toBe('entidad')
    expect(orden).toContain('rol')
  })

  it('los roles nacen con el MISMO tenant que su entidad', async () => {
    // Un rol con otro tenant sería invisible para su propia entidad y visible
    // para nadie: una fila huérfana que ninguna consulta encuentra.
    await repo.crearEntidadesDelCuestionario(PLAN)
    for (const c of todasLas(/insert into entidad_roles/)) expect(c.params).toContain(TENANT)
  })

  it('el tenant sale de la SESIÓN: no hay forma de mandarlo en el cuerpo', async () => {
    await repo.crearEntidadesDelCuestionario(PLAN)
    for (const c of todasLas(/insert into entidades_fiscales/)) expect(c.params).toContain(TENANT)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('3 · contestarlo dos veces no escribe nada', () => {
  it('si dentro de la transacción ya hay entidades, no inserta ni una', async () => {
    // Éste es el cerrojo que de verdad impide el duplicado: el recuento de
    // fuera y el insert no son la misma transacción, así que comprobarlo solo
    // en el controller deja pasar la segunda pestaña.
    yaExistentes = 2
    const r = await repo.crearEntidadesDelCuestionario(PLAN)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.yaHabia).toBe(2)
    expect(todasLas(/insert into entidades_fiscales/)).toHaveLength(0)
    expect(todasLas(/insert into entidad_roles/)).toHaveLength(0)
  })

  it('el recuento dentro de la transacción es lo PRIMERO que se hace tras el cerrojo', async () => {
    // Y el cerrojo va antes que el recuento, o dos transacciones simultáneas
    // contarían las dos cero y las dos insertarían.
    await repo.crearEntidadesDelCuestionario(PLAN)
    const iCerrojo = consultas.findIndex((c) => /pg_advisory_xact_lock/.test(c.sql))
    const iRecuento = consultas.findIndex((c) => /count\(\*\)/.test(c.sql))
    const iInsert = consultas.findIndex((c) => /insert into entidades_fiscales/.test(c.sql))
    expect(iCerrojo, 'no se tomó ningún cerrojo').toBeGreaterThanOrEqual(0)
    expect(iCerrojo).toBeLessThan(iRecuento)
    expect(iRecuento).toBeLessThan(iInsert)
  })

  it('el recuento cuenta TAMBIÉN las dadas de baja', async () => {
    // Quien contestó el cuestionario y luego desactivó sus razones sociales ya
    // lo contestó: el estado es un hecho histórico. Filtrar por `activo` lo
    // volvería a ofrecer y crearía el duplicado que este módulo evita.
    await repo.contarEntidadesDelTenant()
    const sel = sqlDe(/count\(\*\)/)!
    expect(sel.sql).not.toMatch(/\bactivo\b/)
  })
})
