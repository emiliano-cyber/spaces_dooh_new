import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  CFG-01 · «Plazos de cobranza (días)» es una configuración que MENTÍA.
//
//  La pantalla de Administración deja capturar los plazos de la organización,
//  se guardan en `config_negocio.plazos_cobranza` y `config-repo` los lee...
//  y la facturación los ignoraba: el schema traía
//  `.refine((v) => [60, 90, 120].includes(v))` a fuego, así que una
//  organización que configurara 45 días recibía «Plazo inválido» al facturar
//  con lo que ella misma había capturado, y el mensaje le recitaba tres plazos
//  que no eran los suyos.
//
//  Lo que se ancla aquí:
//   · el plazo válido es el de ESA organización, leído por el camino con
//     tenant (nunca `qRaw`: invariante 5, y el fallo que devuelve cero filas
//     en silencio),
//   · dos organizaciones con listas distintas no se pisan,
//   · una lista VACÍA no deja a nadie sin facturar,
//   · el mensaje de error dice los plazos de verdad.
// ============================================================================

const sql: string[] = []
let plazosPorTenant: Record<string, unknown> = {}
let tenant = 't1'
const facturado: { campanaId: string; plazoDias: number }[] = []

vi.mock('./db', () => ({
  q1: vi.fn(async (texto: string, params: unknown[] = []) => {
    sql.push(texto)
    if (texto.includes('from config_negocio')) {
      const t = String(params[0])
      return {
        id: `cfg-${t}`,
        tenant_id: t,
        moneda: 'MXN',
        iva_tasas: [16],
        plazos_cobranza: plazosPorTenant[t] ?? null,
      }
    }
    return null
  }),
  q: vi.fn(async (texto: string, params: unknown[] = []) => {
    sql.push(texto)
    return [{ id: 'cfg-nueva', tenant_id: params[0] }]
  }),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => tenant) }))
// El model se dobla entero: aquí se mide la VALIDACIÓN, no la escritura de una
// factura. Doblarlo evita además arrastrar `pool`/`fijarTenant` a una prueba
// unitaria, que es como se acaba necesitando Postgres para probar un `if`.
vi.mock('./finanzas-repo', () => ({
  generarFactura: vi.fn(async (campanaId: string, plazoDias: number) => {
    facturado.push({ campanaId, plazoDias })
    return { id: 'fac-1', folio: 'A-000001' }
  }),
  registrarPagoCobranza: vi.fn(async () => null),
  FacturaError: class FacturaError extends Error {},
}))

const { generarFacturaCtrl } = await import('./finanzas-controller')

async function facturar(cuerpo: unknown) {
  try {
    await generarFacturaCtrl('cmp-1', cuerpo)
    return { ok: true as const, mensaje: '', status: 201 }
  } catch (e) {
    const err = e as Error & { status?: number }
    return { ok: false as const, mensaje: err.message, status: err.status ?? 500 }
  }
}

beforeEach(() => {
  sql.length = 0
  facturado.length = 0
  tenant = 't1'
  plazosPorTenant = { t1: [60, 90, 120], t2: [60, 90, 120] }
})

describe('CFG-01 · manda la configuración de la organización', () => {
  it('acepta un plazo que la organización SÍ configuró', async () => {
    // El caso del hallazgo: 45 días está capturado en Administración y hasta
    // hoy la facturación lo rechazaba.
    plazosPorTenant.t1 = [45, 75]
    const r = await facturar({ plazoDias: 45 })
    expect(r.ok, r.mensaje).toBe(true)
    expect(facturado).toEqual([{ campanaId: 'cmp-1', plazoDias: 45 }])
  })

  it('rechaza un plazo que la organización NO configuró', async () => {
    plazosPorTenant.t1 = [45, 75]
    const r = await facturar({ plazoDias: 90 })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
    // Y no escribe nada: el rechazo es antes de tocar el model.
    expect(facturado).toEqual([])
  })

  it('el mensaje de error dice los plazos DE VERDAD, no 60/90/120', async () => {
    // Era la otra mitad de la mentira: el usuario configuraba 45 y 75, y el
    // error le contestaba «Plazo inválido (60, 90 o 120 días)» — tres plazos
    // que no existen en su organización.
    plazosPorTenant.t1 = [45, 75]
    const r = await facturar({ plazoDias: 90 })
    expect(r.mensaje).toContain('45')
    expect(r.mensaje).toContain('75')
    expect(r.mensaje).not.toContain('60')
    expect(r.mensaje).not.toContain('120')
  })

  it('los 60/90/120 de siempre siguen valiendo cuando son los configurados', async () => {
    // La regresión que más dolería: la inmensa mayoría de organizaciones tiene
    // el default de la columna. A esas no debe cambiarles nada.
    for (const p of [60, 90, 120]) {
      facturado.length = 0
      const r = await facturar({ plazoDias: p })
      expect(r.ok, `${p}: ${r.mensaje}`).toBe(true)
      expect(facturado[0].plazoDias).toBe(p)
    }
  })

  it('sin plazoDias factura al plazo por omisión de la organización', async () => {
    plazosPorTenant.t1 = [30, 45]
    const r = await facturar({})
    // 90 no está configurado, así que el default de siempre no sirve: se toma
    // el plazo MÁS CORTO de los suyos (cobrar antes es el lado prudente).
    expect(r.ok, r.mensaje).toBe(true)
    expect(facturado[0].plazoDias).toBe(30)
  })

  it('con 90 configurado, el plazo por omisión sigue siendo 90', async () => {
    const r = await facturar({})
    expect(r.ok, r.mensaje).toBe(true)
    expect(facturado[0].plazoDias).toBe(90)
  })
})

describe('CFG-01 · la lista vacía no puede dejar a nadie sin facturar', () => {
  it('con plazos_cobranza vacío se factura con 60/90/120', async () => {
    // Si se tomara la lista al pie de la letra, un arreglo vacío haría que
    // NINGÚN plazo fuera válido y la facturación de esa organización se
    // apagaría entera — mucho peor que el fallo que se está corrigiendo.
    plazosPorTenant.t1 = []
    for (const p of [60, 90, 120]) {
      facturado.length = 0
      expect((await facturar({ plazoDias: p })).ok, `${p}`).toBe(true)
      expect(facturado[0].plazoDias).toBe(p)
    }
  })

  it('con la columna en null también', async () => {
    plazosPorTenant.t1 = null
    expect((await facturar({ plazoDias: 90 })).ok).toBe(true)
  })

  it('el error de una lista vacía recita el respaldo, no una lista vacía', async () => {
    plazosPorTenant.t1 = []
    const r = await facturar({ plazoDias: 45 })
    expect(r.ok).toBe(false)
    expect(r.mensaje).toContain('60')
    expect(r.mensaje).toContain('120')
  })
})

describe('CFG-01 · dos organizaciones no se pisan', () => {
  it('cada una valida contra SU lista', async () => {
    plazosPorTenant = { t1: [45], t2: [30] }

    tenant = 't1'
    expect((await facturar({ plazoDias: 45 })).ok).toBe(true)
    expect((await facturar({ plazoDias: 30 })).ok).toBe(false)

    tenant = 't2'
    expect((await facturar({ plazoDias: 30 })).ok).toBe(true)
    expect((await facturar({ plazoDias: 45 })).ok).toBe(false)
  })

  it('la lectura de la config va SIEMPRE filtrada por tenant', async () => {
    // Invariante 5. Con `qRaw` —o con un `select ... limit 1`— esto devuelve
    // la fila de otra organización o cero filas EN SILENCIO, y entonces el
    // plazo válido de una empresa lo decidiría la configuración de otra.
    await facturar({ plazoDias: 90 })
    const lectura = sql.find((s) => s.includes('from config_negocio'))
    expect(lectura).toBeTruthy()
    expect(lectura).toContain('tenant_id = $1')
    expect(lectura).not.toMatch(/from config_negocio\s+limit 1/)
  })
})

describe('CFG-01 · lo que ya se validaba sigue validándose', () => {
  it('un plazo que no es número se rechaza', async () => {
    expect((await facturar({ plazoDias: 'noventa' })).ok).toBe(false)
  })

  it('un plazo negativo se rechaza aunque nadie lo haya configurado', async () => {
    expect((await facturar({ plazoDias: -90 })).ok).toBe(false)
  })

  it('el plan de parcialidades sigue siendo estricto', async () => {
    // No es de este hallazgo, pero comparte schema: si al reconstruirlo se
    // perdiera el `.strict()`, un cliente podría colar cuotas e importes.
    const r = await facturar({
      plazoDias: 90,
      plan: { periodicidad: 'MENSUAL', primerVencimiento: '2026-09-01', cuotas: 40 },
    })
    expect(r.ok).toBe(false)
  })
})
