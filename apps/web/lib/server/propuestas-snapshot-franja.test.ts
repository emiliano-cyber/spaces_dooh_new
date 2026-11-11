import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  LA FRANJA SE CONGELA AL APROBAR. Es el invariante 3 del ADR 0039 y el que
//  decide si esta fase está bien hecha «por muy bien que calcule».
// ----------------------------------------------------------------------------
//  `propuestas.snapshot_economico` ya congela la escalera económica —bruto,
//  descuento, comisión, neto, IVA, total y `porSitio`— y es lo que hace que el
//  precio del contrato firmado mande (B39, medido el 25/09). El reporte de
//  «publicada vs neta» lee de ahí y NO de `sitio_modalidades`, precisamente
//  porque la tarifa de hoy puede no ser la que se cotizó.
//
//  Con la rejilla aparece un modo de fallo NUEVO y peor: el precio ya no
//  depende solo de la pantalla, sino de QUÉ FRANJA se contrató. Si el snapshot
//  guardara solo el importe, dentro de seis meses «1 800» no se podría auditar
//  —¿era el prime?, ¿era el Buen Fin?— y el día que el dueño suba el prime, una
//  propuesta ya aprobada empezaría a explicarse con el precio nuevo.
//
//  SE CONGELAN LOS NOMBRES, NO SOLO LOS IDs, y es deliberado. Es lo contrario
//  de lo que se decidió el mismo día con el vendedor —ahí NO se denormaliza el
//  nombre porque una propuesta es un registro VIVO y el nombre debe seguir al
//  usuario—. Aquí no: un snapshot es una línea de bitácora congelada, como
//  `acciones.usuario_nombre`. Si el dueño renombra «Prime» o lo desactiva, la
//  propuesta firmada tiene que seguir imprimiendo lo que se vendió.
//
//  Se mockea `./db` y se miran las consultas y el JSON que sale. Lo que esto NO
//  afirma: nada contra Postgres. Eso está en las e2e.
// ============================================================================

const consultas: { sql: string; params: unknown[] }[] = []
/** Lo que se escribió en `snapshot_economico`, ya parseado. */
let congelado: any = null

const filas: Record<string, any[]> = {}

/** Empareja una consulta con la respuesta preparada, por una marca del SQL. */
function responder(sql: string): any[] {
  if (/from propuestas p/.test(sql)) return filas.propuesta ?? []
  if (/from propuesta_items/.test(sql)) return filas.items ?? []
  if (/from temporadas/.test(sql)) return filas.temporadas ?? []
  // B43 · lo que lee el congelado para saber qué temporada PUSO el precio: la
  // pantalla, sus modalidades y su rejilla (`tarifas-repo.ts`).
  if (/from sitios where/.test(sql)) return filas.sitios ?? []
  if (/from sitio_modalidades/.test(sql)) return filas.modalidades ?? []
  if (/from sitio_tarifas/.test(sql)) return filas.rejilla ?? []
  return []
}

const db = {
  q: vi.fn(async (sql: string, params?: unknown[]) => {
    consultas.push({ sql, params: params ?? [] })
    if (/update propuestas set snapshot_economico/.test(sql)) {
      congelado = JSON.parse(String((params ?? [])[1]))
      return []
    }
    return responder(sql)
  }),
  q1: vi.fn(async () => null),
  qConTenant: vi.fn(async (_t: string, sql: string, params?: unknown[]) => {
    consultas.push({ sql, params: params ?? [] })
    return responder(sql)
  }),
  qRaw1: vi.fn(async () => null),
  pool: { connect: vi.fn() },
  fijarTenant: vi.fn(),
  fijarTenantExplicito: vi.fn(),
  withTenantTx: vi.fn(),
}
vi.mock('./db', () => db)
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'T1') }))
vi.mock('./auth', () => ({ usuarioActual: vi.fn(async () => ({ id: 'U1' })) }))
vi.mock('./config-repo', () => ({ topeDescuentoDelTenant: vi.fn(async () => null) }))
vi.mock('./folios', () => ({ folioDocumento: vi.fn(async () => 'PR-2026-0001') }))

const { congelarSnapshotEconomico } = await import('./propuestas-repo')

/**
 * Un UUID de verdad y no 'S1': `datosParaTarifar` descarta antes de consultar
 * los ids que no lo son (un `any($1::uuid[])` con texto revienta), así que con
 * 'S1' la pantalla «no existiría» y la prueba de B43 no probaría nada.
 */
const S1 = '11111111-1111-4111-8111-111111111111'

const PROPUESTA = {
  id: 'P1',
  comision_pct: 0,
  descuento_pct: 0,
  cliente_iva: 16,
  version: 1,
  snapshot_economico: null,
}

/** Un ítem vendido en la franja «Prime», del 13 al 16 de noviembre. */
const ITEM_PRIME = {
  id: 'I1',
  sitio_id: S1,
  precio: 1800,
  tarifa_unitaria: 1800,
  cantidad: 1,
  unidad: 'spot',
  fecha_inicio: '2026-11-13',
  fecha_fin: '2026-11-16',
  aprobado: true,
  franja_id: 'F-PRIME',
  franja_nombre: 'Prime',
  franja_hora_inicio: '06:00',
  franja_hora_fin: '10:00',
}

const TEMPORADA_BUEN_FIN = {
  id: 'T-BF',
  nombre: 'Buen Fin',
  desde: '2026-11-13',
  hasta: '2026-11-16',
}

beforeEach(() => {
  consultas.length = 0
  congelado = null
  filas.propuesta = [{ ...PROPUESTA }]
  filas.items = [{ ...ITEM_PRIME }]
  filas.temporadas = [{ ...TEMPORADA_BUEN_FIN }]
  filas.sitios = [{ id: S1, nombre: 'Pantalla', tarifa_publicada: '1000', tarifa_mensual: '1000' }]
  filas.modalidades = [{ sitio_id: S1, unidad: 'spot', tarifa_publicada: '1000' }]
  // El prime del Buen Fin vale 1 800: ESA fila es la que pone el precio del
  // ítem de arriba, y por eso el congelado puede nombrar la temporada.
  filas.rejilla = [{ ...FILA_PRIME_BUEN_FIN }]
  vi.clearAllMocks()
})

const FILA_PRIME_BUEN_FIN = {
  sitio_id: S1,
  unidad: 'spot',
  franja_id: 'F-PRIME',
  temporada_id: 'T-BF',
  tarifa_publicada: '1800',
}

const sqls = () => consultas.map((c) => c.sql.replace(/\s+/g, ' ').trim())

describe('1 · qué queda congelado', () => {
  it('congela la FRANJA contratada con su nombre y su horario, no solo el id', () => {
    return congelarSnapshotEconomico('P1').then(() => {
      expect(congelado).not.toBeNull()
      const sitio = congelado.porSitio[0]
      expect(sitio.franja).toEqual({
        id: 'F-PRIME',
        nombre: 'Prime',
        horaInicio: '06:00',
        horaFin: '10:00',
      })
    })
  })

  it('congela la TEMPORADA cuando fue ella la que puso el precio (ganó su fila)', async () => {
    await congelarSnapshotEconomico('P1')
    expect(congelado.porSitio[0].temporada).toEqual({ id: 'T-BF', nombre: 'Buen Fin' })
  })

  it('congela la TARIFA que le tocó a esa franja', async () => {
    await congelarSnapshotEconomico('P1')
    expect(congelado.porSitio[0].tarifaUnitaria).toBe(1800)
    expect(congelado.porSitio[0].lista).toBe(1800)
  })

  it('deja constancia de que la franja NO viajó al CMS', async () => {
    // El snapshot es lo que se imprime y lo que se audita seis meses después.
    // Si ahí no consta, la advertencia vive solo en una pantalla que nadie
    // volverá a abrir.
    await congelarSnapshotEconomico('P1')
    expect(String(congelado.avisoFranja)).toMatch(/CMS/)
  })
})

describe('2 · lo que NO puede pasar — los casos negativos', () => {
  it('un ítem SIN franja congela `franja: null`, no un objeto inventado', async () => {
    filas.items = [{ ...ITEM_PRIME, franja_id: null, franja_nombre: null, franja_hora_inicio: null, franja_hora_fin: null }]
    await congelarSnapshotEconomico('P1')
    expect(congelado.porSitio[0].franja).toBeNull()
  })

  it('una fecha fuera de toda temporada congela `temporada: null`', async () => {
    filas.items = [{ ...ITEM_PRIME, fecha_inicio: '2026-07-04' }]
    await congelarSnapshotEconomico('P1')
    expect(congelado.porSitio[0].temporada).toBeNull()
  })

  it('SIN franjas ni temporadas capturadas el snapshot sigue saliendo igual que hoy', async () => {
    // INVARIANTE 1. Toda la base instalada está así, y aprobar no puede fallar
    // ni cambiar un importe por no haber capturado una rejilla.
    filas.items = [
      { ...ITEM_PRIME, franja_id: null, franja_nombre: null, franja_hora_inicio: null, franja_hora_fin: null },
    ]
    filas.temporadas = []
    await congelarSnapshotEconomico('P1')
    expect(congelado.bruto).toBe(1800)
    expect(congelado.neto).toBe(1800)
    expect(congelado.porSitio[0]).toMatchObject({ sitioId: S1, lista: 1800, neto: 1800 })
    expect(congelado.porSitio[0].franja).toBeNull()
    expect(congelado.porSitio[0].temporada).toBeNull()
  })

  it('NO RE-ESCRIBE un snapshot ya congelado: la propuesta aprobada no cambia', async () => {
    // El corazón del invariante. Si mañana el dueño sube el prime de 1 800 a
    // 2 500, esto es lo único que impide que la propuesta firmada lo adopte.
    const viejo = { version: 1, bruto: 1800, porSitio: [{ sitioId: S1, lista: 1800, neto: 1800 }] }
    filas.propuesta = [{ ...PROPUESTA, snapshot_economico: viejo }]
    // Y la rejilla de HOY dice otra cosa bien distinta.
    filas.items = [{ ...ITEM_PRIME, precio: 2500, tarifa_unitaria: 2500 }]

    const r = await congelarSnapshotEconomico('P1')

    expect(r).toEqual(viejo)
    expect(congelado).toBeNull() // no hubo `update`
    expect(sqls().some((s) => /update propuestas set snapshot_economico/.test(s))).toBe(false)
  })
})

// ─── B43 (2026-10-29) · la temporada que PUSO el precio, no la de la fecha ──
//
// Hasta hoy el congelado guardaba `temporadaDeFecha(...)`: la temporada que
// CUBRE la fecha de inicio, ganara o no su fila. Una venta del 14 de noviembre
// a tarifa base quedaba congelada diciendo «Buen Fin», y seis meses después eso
// se lee como «se cobró el precio del Buen Fin». No se cobró. Decisión del
// dueño (29/10): congelar la temporada que devuelve la RESOLUCIÓN —la misma
// `tarifaCalculada` con la que el servidor fija la tarifa desde PRECIO-01— y
// solo si esa resolución da el precio que de verdad se vendió.
describe('2b · B43 · la temporada congelada es la que puso el precio', () => {
  it('NEGATIVO · venta a tarifa BASE en fecha del Buen Fin, sin rejilla → `temporada: null`', async () => {
    // El caso exacto de la ficha: la temporada cubre la fecha y no tocó el precio.
    filas.rejilla = []
    filas.items = [{ ...ITEM_PRIME, precio: 1000, tarifa_unitaria: 1000 }]
    await congelarSnapshotEconomico('P1')
    expect(congelado.porSitio[0].temporada).toBeNull()
  })

  it('NEGATIVO · ganó la fila de la FRANJA sin temporada → `temporada: null`', async () => {
    filas.rejilla = [{ ...FILA_PRIME_BUEN_FIN, temporada_id: null }]
    await congelarSnapshotEconomico('P1')
    expect(congelado.porSitio[0].temporada).toBeNull()
  })

  it('NEGATIVO · un gerente puso OTRO precio → la temporada no lo puso', async () => {
    filas.items = [{ ...ITEM_PRIME, precio: 1500, tarifa_unitaria: 1500, tarifa_calculada: 1800, precio_ajustado_por: 'U-GERENTE' }]
    await congelarSnapshotEconomico('P1')
    expect(congelado.porSitio[0].temporada).toBeNull()
    // Y el importe sigue siendo el del ítem: el congelado no lee precios de la rejilla.
    expect(congelado.porSitio[0].lista).toBe(1500)
  })

  it('NEGATIVO · la rejilla CAMBIÓ entre cotizar y aprobar → no se afirma nada', async () => {
    // El dueño subió el prime del Buen Fin a 2 500 después de cotizar a 1 800:
    // con la regla de hoy, esa temporada ya no da el precio vendido.
    filas.rejilla = [{ ...FILA_PRIME_BUEN_FIN, tarifa_publicada: '2500' }]
    await congelarSnapshotEconomico('P1')
    expect(congelado.porSitio[0].temporada).toBeNull()
    expect(congelado.porSitio[0].lista).toBe(1800)
  })

  it('ganó la fila (—, temporada) a su precio → se congela la temporada', async () => {
    filas.rejilla = [{ ...FILA_PRIME_BUEN_FIN, franja_id: null }]
    filas.items = [{ ...ITEM_PRIME, franja_id: null, franja_nombre: null, franja_hora_inicio: null, franja_hora_fin: null }]
    await congelarSnapshotEconomico('P1')
    expect(congelado.porSitio[0].temporada).toEqual({ id: 'T-BF', nombre: 'Buen Fin' })
  })
})

describe('3 · el SQL — segunda capa sobre la RLS', () => {
  it('lee el nombre de la franja con `and .tenant_id =` sobre el join', async () => {
    // R2: una franja de otra organización no puede prestarle su nombre a esta
    // propuesta. La RLS ya lo impediría; esto es lo que queda en pie el día que
    // alguien conecte con un rol que la salte.
    await congelarSnapshotEconomico('P1')
    const join = sqls().find((s) => /join franjas_horarias/.test(s))
    expect(join).toBeDefined()
    expect(join).toMatch(/franjas_horarias\s+\w+\s+on\s+[\w.]+\.id\s*=\s*[\w.]+\.franja_id\s+and\s+[\w.]+\.tenant_id\s*=\s*[\w.]+\.tenant_id/)
  })

  it('lee las temporadas ordenadas por `desde`', async () => {
    await congelarSnapshotEconomico('P1')
    const t = sqls().find((s) => /from temporadas/.test(s))
    expect(t).toBeDefined()
    expect(t).toMatch(/order by desde/)
  })

  it('B44 · las temporadas se leen con `and tenant_id` — el de la sesión', async () => {
    // Hasta el 29/10 era `where activo = true` a secas: la RLS cortaba, pero el
    // día que falle, la temporada de otra organización le pondría nombre a
    // este congelado.
    await congelarSnapshotEconomico('P1')
    const c = consultas.find((x) => /from temporadas/.test(x.sql))!
    expect(c.sql.replace(/\s+/g, ' ')).toMatch(/where activo = true and tenant_id = \$1/)
    expect(c.params).toEqual(['T1'])
  })

  it('B44 · por la liga PÚBLICA, el tenant es el que se pasa, no el de una sesión', async () => {
    await congelarSnapshotEconomico('P1', 'T-PUBLICO')
    const c = consultas.find((x) => /from temporadas/.test(x.sql))!
    expect(c.params).toEqual(['T-PUBLICO'])
  })
})

describe('4 · el fuente, para lo que no se puede simular', () => {
  const fuente = readFileSync(join(__dirname, 'propuestas-repo.ts'), 'utf8')
  /** Sin comentarios: un `toContain` sobre el fuente casa con la prosa que explica lo contrario. */
  const sinComentarios = fuente
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|--)/.test(l))
    .join('\n')

  it('la resolución de la temporada NO se reimplementa aquí: usa `tarifaCalculada`', () => {
    // B43 (29/10): la MISMA función con la que el servidor fija la tarifa al
    // crear la propuesta. Y ya NO `temporadaDeFecha`, que da la temporada que
    // cubre la fecha aunque no haya puesto el precio.
    expect(sinComentarios).toMatch(/from '@\/lib\/tarifa-calculada'/)
    expect(sinComentarios).toMatch(/tarifaCalculada\(/)
    expect(sinComentarios).not.toMatch(/temporadaDeFecha/)
  })

  it('NO recalcula la tarifa desde `sitio_tarifas` al congelar', () => {
    // El snapshot congela lo que se VENDIÓ (el precio del ítem), no lo que la
    // rejilla diga en el momento de aprobar. Si leyera la rejilla aquí, entre
    // cotizar y aprobar podría cambiar el precio sin que nadie lo decidiera.
    // Desde B43 la rejilla SÍ se lee al congelar (por `datosParaTarifar`), pero
    // solo para NOMBRAR la temporada: el importe sigue saliendo del ítem, y §2b
    // lo comprueba con una rejilla que cambió de precio.
    const cuerpo = sinComentarios.slice(
      sinComentarios.indexOf('export async function congelarSnapshotEconomico'),
      sinComentarios.indexOf('export async function obtenerPropuestaPublica'),
    )
    expect(cuerpo.length).toBeGreaterThan(200)
    expect(cuerpo).not.toMatch(/from sitio_tarifas/)
  })
})
