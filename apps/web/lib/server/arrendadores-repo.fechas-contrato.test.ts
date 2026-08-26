import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolClient } from 'pg'

// ============================================================================
//  UX-01 · un contrato que termina antes de empezar.
// ----------------------------------------------------------------------------
//  El alta ya lo impedía (`crearContratoCtrl`) y la edición también… pero SOLO
//  cuando el PATCH traía las dos fechas. Un PATCH con `fechaFin` a secas —que
//  es como edita la pantalla: se toca un campo y se manda ese— no tenía con qué
//  comparar y pasaba de largo.
//
//  Lo que sale de ahí no es un dato feo: `generarCalendarioEnTx` construye el
//  calendario de pagos entre las dos fechas, y con la vigencia invertida el
//  contrato queda VENCIDO el mismo día de la edición y sin un solo periodo que
//  cobrar. Nadie recibe un error; simplemente deja de haber renta.
//
//  La regla se comprueba sobre los valores EFECTIVOS —lo que quedará en la
//  fila—, no sobre lo que trae el patch. Es el único sitio que los conoce.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const TENANT = 'tenant-A'
const CONTRATO = '44444444-4444-4444-4444-444444444444'

let queries: { sql: string; params: unknown[] }[] = []

// Un contrato COMPLETO y vigente de todo 2026: es el estado del que parte
// cualquier edición real.
const filaContrato: Record<string, unknown> = {
  id: CONTRATO, tenant_id: TENANT, sitio_id: 'S1',
  arrendador_id: '11111111-1111-1111-1111-111111111111',
  fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', monto_renta: 10000,
  periodicidad: 'MENSUAL', moneda: 'MXN', auto_renovable: false, estatus: 'VIGENTE',
  creado_en: '2026-01-01',
}

const client = {
  query: async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })
    if (/from arrendadores\b/.test(sql)) return { rows: [{ id: params[0] }] }
    if (/arrendador_razon_social/.test(sql)) return { rows: [{ id: params[0] }] }
    if (/^\s*select \* from contratos_arrendamiento/.test(sql)) return { rows: [filaContrato] }
    if (/^\s*update contratos_arrendamiento/.test(sql)) return { rows: [filaContrato] }
    return { rows: [] }
  },
} as unknown as PoolClient

vi.mock('./db', () => ({
  q: vi.fn(async () => []),
  pool: { connect: vi.fn() },
  fijarTenant: vi.fn(),
  withTenantTx: async (fn: (c: PoolClient) => Promise<unknown>) => fn(client),
}))
vi.mock('./tenant', () => ({ tenantActual: async () => TENANT, tenantDeRequest: async () => TENANT }))
vi.mock('./sitios-repo', () => ({ insertarSitio: vi.fn(), rowToSitio: (r: unknown) => r }))

const { editarContrato } = await import('./arrendadores-repo')

const huboUpdate = () => queries.some((q) => /^\s*update contratos_arrendamiento/.test(q.sql))

beforeEach(() => {
  queries = []
  filaContrato.fecha_inicio = '2026-01-01'
  filaContrato.fecha_fin = '2026-12-31'
})

describe('editarContrato — la vigencia no se puede invertir', () => {
  it('un PATCH con SOLO fechaFin anterior al inicio guardado se rechaza y no escribe', async () => {
    // El caso que reportó la auditoría, tal cual: la pantalla manda el campo
    // que se tocó, no los dos.
    const r = await editarContrato(CONTRATO, { fechaFin: '2025-06-30' })
    expect(r).toHaveProperty('fechasInvertidas')
    expect(huboUpdate(), 'se escribió el contrato con la vigencia invertida').toBe(false)
  })

  it('un PATCH con SOLO fechaInicio posterior al fin guardado también', async () => {
    // La misma inversión por el otro lado. Sin este caso, el arreglo podría
    // mirar solo `fechaFin` y dejar media puerta abierta.
    const r = await editarContrato(CONTRATO, { fechaInicio: '2027-03-01' })
    expect(r).toHaveProperty('fechasInvertidas')
    expect(huboUpdate()).toBe(false)
  })

  it('con las dos fechas invertidas en el mismo patch, igual', async () => {
    const r = await editarContrato(CONTRATO, { fechaInicio: '2026-06-01', fechaFin: '2026-05-01' })
    expect(r).toHaveProperty('fechasInvertidas')
    expect(huboUpdate()).toBe(false)
  })

  it('dice QUÉ dos fechas chocan, no solo que chocan', async () => {
    // Sin los valores, quien edita ve «la fecha de fin no puede ser anterior a
    // la de inicio» sobre un formulario donde la de inicio ni se ve.
    const r = await editarContrato(CONTRATO, { fechaFin: '2025-06-30' }) as {
      fechasInvertidas: { inicio: string; fin: string }
    }
    expect(r.fechasInvertidas.inicio).toContain('2026-01-01')
    expect(r.fechasInvertidas.fin).toContain('2025-06-30')
  })
})

describe('editarContrato — lo que SÍ tiene que seguir pasando', () => {
  it('alargar la vigencia se guarda', async () => {
    const r = await editarContrato(CONTRATO, { fechaFin: '2027-12-31' })
    expect(r).toHaveProperty('contrato')
    expect(huboUpdate()).toBe(true)
  })

  it('un contrato de UN SOLO DÍA es válido: fin igual a inicio no es inversión', async () => {
    // La trampa de comparar cadenas: la fila guardada puede llegar como
    // '2026-01-01T06:00:00.000Z' y el patch como '2026-01-01'. Comparadas en
    // crudo, el mismo día parece «fin anterior al inicio» y el arreglo
    // rechazaría una edición legítima.
    filaContrato.fecha_inicio = new Date('2026-03-10T06:00:00.000Z')
    const r = await editarContrato(CONTRATO, { fechaFin: '2026-03-10' })
    expect(r, JSON.stringify(r)).toHaveProperty('contrato')
    expect(huboUpdate()).toBe(true)
  })

  it('editar solo el importe no mira las fechas ni las estorba', async () => {
    const r = await editarContrato(CONTRATO, { montoRenta: 12000 })
    expect(r).toHaveProperty('contrato')
    expect(huboUpdate()).toBe(true)
  })

  it('un contrato INCOMPLETO sin fecha de fin se puede seguir editando', async () => {
    // ADR 0001: el contrato puede nacer sin fecha de fin. Comparar contra null
    // no puede convertirse en un rechazo.
    filaContrato.fecha_fin = null
    const r = await editarContrato(CONTRATO, { montoRenta: 9000 })
    expect(r).toHaveProperty('contrato')
    expect(huboUpdate()).toBe(true)
  })
})

// ─── VAL-10 · la mitad que UX-01 dejó sin cerrar ────────────────────────────
//  El guard del controlador ya comparaba por CALENDARIO desde UX-01, pero el del
//  model —el que actúa cuando el PATCH trae una sola fecha, que es el caso para
//  el que se escribió— se quedó comparando CADENAS: `diaFin < diaInicio`.
//
//  Eso solo funciona si las dos llevan ceros a la izquierda. La fila de la base
//  siempre los lleva; el patch no tiene por qué. Con `fechaFin: '2026-9-1'`
//  sobre un contrato que empieza el '2026-10-01', '2026-9-1' < '2026-10-01' es
//  FALSO como texto (el '9' va después del '1') y verdadero en el calendario:
//  el guard nuevo dejaba pasar justo la inversión que existe para impedir.
describe('VAL-10 · el guard del model compara por calendario, no como texto', () => {
  it('atrapa la inversión aunque el patch venga sin ceros a la izquierda', async () => {
    filaContrato.fecha_inicio = '2026-10-01'
    filaContrato.fecha_fin = '2026-12-31'
    const r = await editarContrato(CONTRATO, { fechaFin: '2026-9-1' })
    expect(r).toHaveProperty('fechasInvertidas')
    expect(huboUpdate()).toBe(false)
  })

  it('y no rechaza el caso correcto con la misma forma', async () => {
    // Control positivo: '2026-9-1' → '2026-10-01' es un periodo válido, y
    // comparado como texto saldría invertido. Si este cayera, la regla nueva
    // estaría rota por el otro lado.
    filaContrato.fecha_inicio = '2026-01-01'
    filaContrato.fecha_fin = '2026-12-31'
    const r = await editarContrato(CONTRATO, { fechaInicio: '2026-9-1', fechaFin: '2026-10-01' })
    expect(r).not.toHaveProperty('fechasInvertidas')
    expect(huboUpdate()).toBe(true)
  })
})
