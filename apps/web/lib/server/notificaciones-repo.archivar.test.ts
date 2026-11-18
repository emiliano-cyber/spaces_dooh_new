import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  La bandeja de notificaciones es de CADA PERSONA (NOTIF-USUARIO, 21/10).
//
//  Historia: el panel listaba las últimas 100 notificaciones, LEÍDAS INCLUIDAS,
//  y «Marcar todas» solo las atenuaba; el 10/08 se cambió por «Borrar todas»,
//  que ARCHIVA (`archivada_en`) en vez de borrar. Pero `archivada_en` y `leida`
//  vivían en `notificaciones`, una fila por EMPRESA: cuando un vendedor vaciaba
//  su panel se lo vaciaba también al Dueño. Desde el 21/10 lo que cada persona
//  hace con un aviso vive en `notificaciones_usuario`.
//
//  Lo que se fija aquí es la FORMA de las sentencias, que es donde vive la
//  decisión y donde se rompe sin que se vea:
//   · borrar y leer escriben en `notificaciones_usuario`, NUNCA en la fila
//     compartida de `notificaciones` (si no, vuelve el problema de raíz);
//   · borrar marca la fecha y NO destruye nada;
//   · las dos lecturas esconden lo que ESA persona borró (si `listar` no lo
//     filtra, el panel no se vacía; si el sondeo no, revive como aviso);
//   · todo va acotado por tenant EXPLÍCITO y por el usuario que se pasa.
//  El aislamiento de verdad —con RLS y dos personas— lo mide
//  `lib/test/notificaciones-por-usuario.e2e.test.ts`.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

let queries: { sql: string; params: unknown[] }[] = []
let respuestas: unknown[][] = []

vi.mock('./db', () => ({
  q: async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })
    return respuestas.shift() ?? []
  },
  q1: async () => null,
  pool: { connect: vi.fn() },
  fijarTenant: vi.fn(),
}))
vi.mock('./tenant', () => ({
  tenantActual: async () => 'tenant-A',
  tenantDeRequest: async () => 'tenant-A',
}))

const {
  archivarTodasNotificaciones,
  borrarNotificacion,
  marcarNotificacionLeida,
  listarNotificaciones,
  notificacionesDesde,
} = await import('./notificaciones-repo')

const norm = (i = 0) => (queries[i]?.sql ?? '').replace(/\s+/g, ' ').toLowerCase()
const todas = () => queries.map((_, i) => norm(i)).join(' ;; ')

beforeEach(() => {
  queries = []
  respuestas = []
})

describe('«Borrar todas» vacía SOLO la bandeja de quien la pulsa', () => {
  it('escribe en notificaciones_usuario, no en la fila compartida', async () => {
    await archivarTodasNotificaciones('U-ana')
    expect(todas()).toContain('insert into notificaciones_usuario')
    expect(todas()).not.toMatch(/update notificaciones set/)
  })

  it('marca la fecha y NO borra ninguna fila', async () => {
    await archivarTodasNotificaciones('U-ana')
    expect(todas()).toContain('borrada_en')
    expect(todas()).not.toContain('delete from')
  })

  it('va por el usuario que se le pasa y por el tenant explícito', async () => {
    await archivarTodasNotificaciones('U-ana')
    expect(queries[0].params).toEqual(expect.arrayContaining(['tenant-A', 'U-ana']))
    expect(norm()).toContain('n.tenant_id = $1')
  })

  it('no pisa la fecha de lo que ya había borrado antes', async () => {
    // Sin esto, un segundo clic reescribiría la fecha de todo lo ya borrado y una
    // futura papelera («devuélveme lo de ayer») no podría distinguir nada.
    await archivarTodasNotificaciones('U-ana')
    expect(norm()).toContain('coalesce(notificaciones_usuario.borrada_en')
  })
})

describe('borrar UNA', () => {
  it('escribe en notificaciones_usuario para ese usuario, sin destruir', async () => {
    respuestas = [[{ notificacion_id: 'N1' }]]
    const ok = await borrarNotificacion('N1', 'U-ana')
    expect(ok).toBe(true)
    expect(norm()).toContain('insert into notificaciones_usuario')
    expect(norm()).toContain('borrada_en')
    expect(todas()).not.toContain('delete from')
    expect(queries[0].params).toEqual(expect.arrayContaining(['N1', 'U-ana', 'tenant-A']))
  })

  it('solo si el aviso es de SU empresa: el insert sale de un select acotado por tenant', async () => {
    await borrarNotificacion('N1', 'U-ana')
    expect(norm()).toMatch(/from notificaciones n where n\.id = \$1 and n\.tenant_id = \$\d/)
  })

  it('devuelve false si el aviso no existe o es de otra empresa', async () => {
    respuestas = [[]]
    expect(await borrarNotificacion('N-ajena', 'U-ana')).toBe(false)
  })
})

describe('marcar UNA como leída', () => {
  it('escribe en notificaciones_usuario, no `update notificaciones set leida`', async () => {
    respuestas = [[{ notificacion_id: 'N1' }], [{ id: 'N1', titulo: 't', leida_usuario: true }]]
    const n = await marcarNotificacionLeida('N1', 'U-ana')
    expect(n?.leida).toBe(true)
    expect(norm(0)).toContain('insert into notificaciones_usuario')
    expect(norm(0)).toContain('leida_en')
    expect(todas()).not.toMatch(/update notificaciones set/)
  })

  it('null si el aviso no es de su empresa', async () => {
    respuestas = [[]]
    expect(await marcarNotificacionLeida('N-ajena', 'U-ana')).toBeNull()
  })
})

describe('las dos lecturas son de ESA persona', () => {
  it('el panel esconde lo que ella borró y lo que se archivó antes para todos', async () => {
    await listarNotificaciones('U-ana')
    expect(norm()).toContain('left join notificaciones_usuario')
    expect(norm()).toContain('borrada_en is null')
    expect(norm()).toContain('archivada_en is null')
    expect(queries[0].params).toEqual(['tenant-A', 'U-ana'])
  })

  it('el sondeo también: si no, lo recién borrado revive como aviso emergente', async () => {
    await notificacionesDesde(new Date().toISOString(), 'U-ana')
    expect(norm()).toContain('left join notificaciones_usuario')
    expect(norm()).toContain('borrada_en is null')
    expect(queries[0].params).toEqual(expect.arrayContaining(['tenant-A', 'U-ana']))
  })

  it('«leída» para ella = la leyó ella, o se marcó con la columna vieja', async () => {
    respuestas = [[
      { id: 'a', leida: false, leida_usuario: true },
      { id: 'b', leida: true, leida_usuario: true },
      { id: 'c', leida: false, leida_usuario: false },
    ]]
    const r = await listarNotificaciones('U-ana')
    expect(r.map((n) => n.leida)).toEqual([true, true, false])
    expect(norm()).toMatch(/n\.leida or nu\.leida_en is not null/)
  })
})
