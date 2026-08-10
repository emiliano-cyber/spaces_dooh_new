import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  «Borrar todas» vacía el panel sin borrar nada.
//
//  El panel listaba las últimas 100 notificaciones, LEÍDAS INCLUIDAS, así que el
//  botón anterior —«Marcar todas», un `update … set leida=true`— dejaba la lista
//  igual de larga: solo se atenuaba. Para quien lo usaba era un botón que no
//  hacía nada.
//
//  Lo que se fija aquí es la FORMA de las sentencias, que es donde vive la
//  decisión y donde se rompe sin que se vea:
//   · archivar marca la fecha y NO borra la fila;
//   · las dos lecturas filtran lo archivado (si `listar` no filtra, el panel no
//     se vacía; si el sondeo no filtra, revive como aviso emergente);
//   · la escritura masiva lleva filtro de tenant explícito, no solo la RLS.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

let queries: { sql: string; params: unknown[] }[] = []

vi.mock('./db', () => ({
  q: async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })
    return []
  },
  q1: async () => null,
  pool: { connect: vi.fn() },
  fijarTenant: vi.fn(),
}))
vi.mock('./tenant', () => ({
  tenantActual: async () => 'tenant-A',
  tenantDeRequest: async () => 'tenant-A',
}))

const { archivarTodasNotificaciones, listarNotificaciones, notificacionesDesde } =
  await import('./notificaciones-repo')

const norm = () => (queries[0]?.sql ?? '').replace(/\s+/g, ' ').toLowerCase()

beforeEach(() => {
  queries = []
})

describe('archivarTodasNotificaciones', () => {
  it('archiva con fecha y NO borra la fila', async () => {
    await archivarTodasNotificaciones()
    expect(norm()).toContain('update notificaciones')
    expect(norm()).toContain('archivada_en = now()')
    // La opción elegida fue conservar el histórico. Un `delete` haría
    // irreversible un clic que la gente da para quitarse el punto rojo.
    expect(norm()).not.toContain('delete from')
  })

  it('las da por leídas de paso: archivada sin leer no significa nada', async () => {
    await archivarTodasNotificaciones()
    expect(norm()).toContain('leida = true')
  })

  it('acota por tenant EXPLÍCITAMENTE, no solo por la RLS', async () => {
    // La versión anterior (`update notificaciones set leida=true where
    // leida=false`) no llevaba filtro: dejaba una escritura masiva sostenida por
    // una sola capa.
    await archivarTodasNotificaciones()
    expect(norm()).toContain('tenant_id = $1')
    expect(queries[0].params).toContain('tenant-A')
  })

  it('no vuelve a tocar lo ya archivado', async () => {
    // Sin esto, un segundo clic pisaría la fecha de todo el histórico y una
    // futura papelera («devuélveme lo de ayer») ya no podría distinguir nada.
    await archivarTodasNotificaciones()
    expect(norm()).toContain('archivada_en is null')
  })
})

describe('las dos lecturas esconden lo archivado', () => {
  it('el panel no lista lo archivado — si no, el botón no vacía nada', async () => {
    await listarNotificaciones()
    expect(norm()).toContain('archivada_en is null')
  })

  it('el sondeo tampoco: si no, lo recién vaciado revive como aviso emergente', async () => {
    // La carrera es real y no hipotética: el sondeo pregunta «¿qué hay desde que
    // abrí la pestaña?», no «desde el último clic». Un aviso creado dos segundos
    // antes de pulsar «Borrar todas» sigue siendo posterior a esa marca, así que
    // el siguiente ciclo lo devolvería.
    await notificacionesDesde(new Date().toISOString())
    expect(norm()).toContain('archivada_en is null')
  })
})
