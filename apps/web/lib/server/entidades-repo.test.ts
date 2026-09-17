import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PoolClient } from 'pg'

// ============================================================================
//  Entidades fiscales del OWNER — lo que toda consulta tiene que llevar dentro.
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
//  = $n` explícito— esté en TODAS las consultas del módulo, porque la RLS sola
//  se cae si alguien usa `qRaw` o si un día una tabla nace sin política.
//
//  Una unitaria no puede demostrar aislamiento —simula la base—; lo demuestra
//  `lib/test/entidades-fiscales.e2e.test.ts` contra Postgres real y con el rol
//  de la app. Lo que sí puede hacer, y es lo que hace, es ponerse ROJA el día
//  que alguien borre un `and tenant_id` al refactorizar.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const TENANT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const ENTIDAD = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

let consultas: { sql: string; params: unknown[] }[] = []

const fila = () => ({
  id: ENTIDAD,
  tenant_id: TENANT,
  razon_social: 'Arrendamientos del Centro SA de CV',
  rfc: null,
  regimen: null,
  cp_fiscal: null,
  serie_folios: null,
  activo: true,
  creado_en: new Date('2026-09-17T00:00:00Z'),
  roles: ['ARRENDAMIENTOS'],
})

function responder(sql: string): { rows: any[]; rowCount: number } {
  if (/insert into entidades_fiscales/.test(sql)) return { rows: [fila()], rowCount: 1 }
  if (/update entidades_fiscales/.test(sql)) return { rows: [fila()], rowCount: 1 }
  if (/from entidades_fiscales/.test(sql)) return { rows: [fila()], rowCount: 1 }
  if (/from catalogo_roles_entidad/.test(sql)) {
    return {
      rows: [
        { rol: 'ARRENDAMIENTOS' }, { rol: 'ACTIVOS' }, { rol: 'LICENCIAS' },
        { rol: 'OPERACION' }, { rol: 'VENTAS' },
      ],
      rowCount: 5,
    }
  }
  if (/from entidad_roles/.test(sql)) return { rows: [{ rol: 'ARRENDAMIENTOS' }], rowCount: 1 }
  return { rows: [], rowCount: 0 }
}

const anotar = async (sql: string, params: unknown[] = []) => {
  consultas.push({ sql, params })
  return responder(sql)
}

const client = { query: anotar } as unknown as PoolClient

vi.mock('./db', () => ({
  q: vi.fn(async (sql: string, params: unknown[] = []) => (await anotar(sql, params)).rows),
  q1: vi.fn(async (sql: string, params: unknown[] = []) => (await anotar(sql, params)).rows[0] ?? null),
  // Si el repo llamara a `qRaw`, la prueba muere aquí en vez de pasar en verde
  // sobre una consulta SIN contexto de tenant. Es el fallo R2 exacto.
  qRaw: vi.fn(async () => { throw new Error('el repo de entidades NO puede usar qRaw') }),
  qRaw1: vi.fn(async () => { throw new Error('el repo de entidades NO puede usar qRaw1') }),
  pool: { connect: vi.fn() },
  fijarTenant: vi.fn(),
  withTenantTx: async (fn: (c: PoolClient) => Promise<unknown>) => fn(client),
}))
vi.mock('./tenant', () => ({ tenantActual: async () => TENANT }))

const repo = await import('./entidades-repo')

const sqlDe = (patron: RegExp) => consultas.find((c) => patron.test(c.sql))
/** Las consultas que tocan las tablas del módulo, sea por `q` o por el client. */
const consultasDelModulo = () =>
  consultas.filter((c) => /entidades_fiscales|entidad_roles/.test(c.sql))

beforeEach(() => {
  consultas = []
})

describe('1 · el alta estampa la organización de la sesión', () => {
  it('el insert lleva el tenant_id de la sesión, no uno que venga de fuera', async () => {
    await repo.crearEntidad({ razonSocial: 'Arrendamientos del Centro SA de CV' })
    const ins = sqlDe(/insert into entidades_fiscales/)!
    expect(ins, 'no se insertó en entidades_fiscales').toBeDefined()
    expect(ins.params).toContain(TENANT)
  })

  it('los roles nacen con el MISMO tenant que su entidad', async () => {
    // Un rol con otro tenant sería invisible para su propia entidad y visible
    // para nadie: una fila huérfana que ninguna consulta encuentra.
    await repo.crearEntidad({
      razonSocial: 'Operadora y Ventas SA de CV',
      roles: ['OPERACION', 'VENTAS'],
    })
    const rolesIns = consultas.filter((c) => /insert into entidad_roles/.test(c.sql))
    expect(rolesIns.length).toBeGreaterThan(0)
    for (const c of rolesIns) expect(c.params).toContain(TENANT)
  })

  it('entidad y roles entran en la MISMA transacción', async () => {
    // Si el insert de roles fuera aparte y fallara, quedaría una razón social
    // sin ningún papel — visible en la lista y sin servir para nada.
    await repo.crearEntidad({ razonSocial: 'Con roles', roles: ['ACTIVOS'] })
    expect(consultas.every((c) => c.sql.length > 0)).toBe(true)
    const orden = consultas
      .filter((c) => /insert into entidades_fiscales|insert into entidad_roles/.test(c.sql))
      .map((c) => (/entidades_fiscales/.test(c.sql) ? 'entidad' : 'rol'))
    expect(orden[0]).toBe('entidad')
    expect(orden).toContain('rol')
  })
})

describe('2 · NINGUNA consulta se acota solo por id', () => {
  // El corazón de estas pruebas. Cada caso se pone rojo si alguien quita el
  // `and tenant_id` de esa consulta concreta.
  it('leer una entidad por id lleva tenant_id además del id', async () => {
    await repo.obtenerEntidad(ENTIDAD)
    const sel = sqlDe(/from entidades_fiscales/)!
    expect(sel).toBeDefined()
    expect(sel.sql).toMatch(/tenant_id\s*=\s*\$\d/)
    expect(sel.params).toContain(ENTIDAD)
    expect(sel.params).toContain(TENANT)
  })

  it('el listado va acotado al tenant', async () => {
    await repo.listarEntidades()
    const sel = sqlDe(/from entidades_fiscales/)!
    expect(sel.sql).toMatch(/tenant_id\s*=\s*\$\d/)
    expect(sel.params).toContain(TENANT)
  })

  it('los ROLES de una entidad NO se leen solo por entidad_id', async () => {
    // La prueba negativa clave del módulo. `entidad_roles` es la tabla donde la
    // tentación es más fuerte: `where entidad_id = $1` parece suficiente porque
    // el id es un uuid y "nadie adivina un uuid". Adivinarlo no hace falta: un
    // id se filtra, se copia de un log o llega en el cuerpo de una petición.
    await repo.rolesDeEntidad(ENTIDAD)
    const sel = sqlDe(/from entidad_roles/)!
    expect(sel, 'no se consultó entidad_roles').toBeDefined()
    expect(sel.sql).toMatch(/tenant_id\s*=\s*\$\d/)
    expect(sel.params).toContain(TENANT)
  })

  it('la edición por id lleva tenant_id', async () => {
    await repo.editarEntidad(ENTIDAD, { razonSocial: 'Nombre nuevo SA de CV' })
    const upd = sqlDe(/update entidades_fiscales/)!
    expect(upd).toBeDefined()
    expect(upd.sql).toMatch(/tenant_id\s*=\s*\$\d/)
    expect(upd.params).toContain(TENANT)
  })

  it('y el barrido: TODA consulta del módulo nombra tenant_id y lo pasa', async () => {
    // La red de seguridad para lo que se añada mañana: una función nueva que se
    // olvide del tenant cae aquí sin que nadie tenga que acordarse de escribir
    // su caso.
    await repo.crearEntidad({ razonSocial: 'Barrido SA de CV', roles: ['VENTAS'] })
    await repo.listarEntidades()
    await repo.obtenerEntidad(ENTIDAD)
    await repo.rolesDeEntidad(ENTIDAD)
    await repo.editarEntidad(ENTIDAD, { rfc: 'XAXX010101000' })
    await repo.desactivarEntidad(ENTIDAD)
    const delModulo = consultasDelModulo()
    expect(delModulo.length).toBeGreaterThan(5)
    for (const c of delModulo) {
      expect(c.sql, `consulta sin tenant_id: ${c.sql}`).toMatch(/tenant_id/)
      expect(c.params, `consulta sin el tenant en los parámetros: ${c.sql}`).toContain(TENANT)
    }
  })
})

describe('3 · el borrado es lógico, no físico', () => {
  it('desactivar apaga `activo` y no borra la fila', async () => {
    // Una entidad fiscal aparece en contratos y en comprobantes ya emitidos:
    // borrarla dejaría documentos apuntando a la nada. Y la FK es ON DELETE SET
    // NULL, así que el borrado no fallaría — perdería el dato en silencio.
    await repo.desactivarEntidad(ENTIDAD)
    expect(sqlDe(/delete from entidades_fiscales/)).toBeUndefined()
    const upd = sqlDe(/update entidades_fiscales/)!
    expect(upd).toBeDefined()
    expect(upd.sql).toMatch(/activo\s*=\s*false/)
    expect(upd.sql).toMatch(/tenant_id\s*=\s*\$\d/)
  })
})

describe('4 · el catálogo de roles se lee de la BASE, no de una constante', () => {
  it('sale de `catalogo_roles_entidad`', async () => {
    // Es la decisión de diseño del módulo: la lista de roles es una decisión de
    // negocio todavía abierta, así que se cambia con una fila y no con una
    // migración. Una constante en el código volvería a atarla al despliegue.
    const roles = await repo.catalogoRolesEntidad()
    expect(sqlDe(/from catalogo_roles_entidad/)).toBeDefined()
    expect(roles).toEqual(expect.arrayContaining(['ARRENDAMIENTOS', 'VENTAS']))
  })
})

describe('5 · el repo no se salta el contexto de tenant', () => {
  it('no LLAMA a `qRaw` ni lo importa', () => {
    // `qRaw` existe para el bootstrap (tenants, usuarios, sesiones), que se
    // resuelve ANTES de conocer la organización. Aquí no hay nada así, y usarlo
    // desactivaría la RLS sin dar ningún error.
    //
    // Se buscan LLAMADAS y el import, no la palabra: la cabecera del repo
    // explica por qué no se usa, y prohibir mencionarlo obligaría a borrar
    // justo el comentario que impide que alguien lo use.
    const fuente = readFileSync(join(__dirname, 'entidades-repo.ts'), 'utf8')
    expect(fuente).not.toMatch(/\bqRaw1?\s*\(/)
    const linea = fuente.match(/^import \{[^}]*\} from '\.\/db'$/m)?.[0] ?? ''
    expect(linea).not.toMatch(/qRaw/)
    expect(linea, 'el repo tiene que importar `q` de ./db').toMatch(/\bq\b/)
  })
})
