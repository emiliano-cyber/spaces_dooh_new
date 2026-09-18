import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  QUIÉN EMITE el comprobante (`facturas.entidad_emisora_id`).
// ----------------------------------------------------------------------------
//  La columna existe desde el 2026-09-17 y hasta hoy NINGÚN endpoint la
//  escribía. Éste es el primero.
//
//  ─── NI UN IMPORTE se toca, y estas pruebas lo FIJAN ──────────────────────
//  Emitir una factura es zona R4: dinero irreversible. Lo único que este cambio
//  añade es a nombre de cuál de MIS razones sociales dice estar emitida. El
//  bloque 3 comprueba que `subtotal`, `igv` y `monto` siguen derivándose en el
//  servidor y que nada del cuerpo de la petición los alcanza — si alguien
//  abriera esa puerta al añadir un campo, se pone rojo.
//
//  ─── Y por qué el default NO viaja del navegador ──────────────────────────
//  La derivación por roles es una SUGERENCIA de la pantalla. Si el cuerpo llega
//  sin `entidadEmisoraId`, el comprobante nace «sin asignar» y eso se pinta: el
//  servidor no adivina. Adivinar aquí sería emitir a nombre de una sociedad que
//  nadie eligió, y encima sin que quedara claro quién lo decidió.
// ============================================================================

const sql: string[] = []
let tenant = 't1'
let entidadValida = true
const facturado: { campanaId: string; plazoDias: number; entidadEmisoraId: unknown }[] = []

vi.mock('./db', () => ({
  q1: vi.fn(async (texto: string, params: unknown[] = []) => {
    sql.push(texto)
    if (texto.includes('from config_negocio')) {
      return {
        id: `cfg-${params[0]}`,
        tenant_id: params[0],
        moneda: 'MXN',
        iva_tasas: [16],
        plazos_cobranza: null,
      }
    }
    // La validación de la entidad emisora contra el tenant.
    if (texto.includes('from entidades_fiscales')) {
      return entidadValida ? { id: params[0] } : null
    }
    return null
  }),
  q: vi.fn(async (texto: string, params: unknown[] = []) => {
    sql.push(texto)
    if (texto.includes('from entidades_fiscales')) {
      return entidadValida ? [{ id: params[0] }] : []
    }
    return [{ id: 'cfg-nueva', tenant_id: params[0] }]
  }),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => tenant) }))
vi.mock('./finanzas-repo', () => ({
  generarFactura: vi.fn(
    async (campanaId: string, plazoDias: number, _plan: unknown, entidadEmisoraId?: unknown) => {
      facturado.push({ campanaId, plazoDias, entidadEmisoraId })
      return { id: 'fac-1', folio: 'A-000001', subtotal: 1000, igv: 160, monto: 1160 }
    },
  ),
  registrarPagoCobranza: vi.fn(async () => null),
  FacturaError: class FacturaError extends Error {},
}))

const { generarFacturaCtrl } = await import('./finanzas-controller')

async function facturar(cuerpo: unknown) {
  try {
    const f = await generarFacturaCtrl('cmp-1', cuerpo)
    return { ok: true as const, mensaje: '', status: 201, factura: f }
  } catch (e) {
    const err = e as Error & { status?: number }
    return { ok: false as const, mensaje: err.message, status: err.status ?? 500, factura: null }
  }
}

const ENT_PROPIA = '55555555-5555-5555-5555-555555555555'
const ENT_AJENA = '66666666-6666-6666-6666-666666666666'

beforeEach(() => {
  sql.length = 0
  facturado.length = 0
  tenant = 't1'
  entidadValida = true
})

// ─── 1 · la referencia llega al model ───────────────────────────────────────
describe('1 · la entidad emisora viaja al model', () => {
  it('con entidadEmisoraId, el model la recibe', async () => {
    const r = await facturar({ plazoDias: 90, entidadEmisoraId: ENT_PROPIA })
    expect(r.ok, r.mensaje).toBe(true)
    expect(facturado[0]?.entidadEmisoraId).toBe(ENT_PROPIA)
  })

  it('sin ella, el comprobante nace SIN ASIGNAR y el servidor no adivina', async () => {
    const r = await facturar({ plazoDias: 90 })
    expect(r.ok, r.mensaje).toBe(true)
    expect(facturado[0]?.entidadEmisoraId ?? null).toBeNull()
  })
})

// ─── 2 · el tenant, antes de escribir ───────────────────────────────────────
describe('2 · aislamiento de la referencia', () => {
  it('se valida contra el TENANT, y el tenant va en la consulta', async () => {
    await facturar({ plazoDias: 90, entidadEmisoraId: ENT_PROPIA })
    const check = sql.find((s) => s.includes('from entidades_fiscales'))
    expect(check, `no se validó la entidad. SQL:\n${sql.join('\n---\n')}`).toBeDefined()
    expect(check!).toMatch(/tenant_id/)
  })

  it('NEGATIVO CLAVE · la entidad de otra organizacion da 404 y NO se factura', async () => {
    // Sin esto, la FK compuesta lo rechazaría con un 23503 que el usuario ve
    // como un 500: un comprobante que no se emitió y un error que no dice nada.
    entidadValida = false
    const r = await facturar({ plazoDias: 90, entidadEmisoraId: ENT_AJENA })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(404)
    expect(facturado, 'se facturó pese al rechazo').toEqual([])
  })

  it('un entidadEmisoraId que no es un uuid se rechaza con 400', async () => {
    const r = await facturar({ plazoDias: 90, entidadEmisoraId: 'la-mia' })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
    expect(facturado).toEqual([])
  })
})

// ─── 3 · NI UN IMPORTE ──────────────────────────────────────────────────────
describe('3 · el dinero no entra por el cuerpo de la peticion', () => {
  for (const campo of ['subtotal', 'igv', 'monto', 'total', 'presupuestoNeto']) {
    it(`${campo} en el cuerpo se RECHAZA, no se ignora`, async () => {
      // El schema es `.strict()`: un importe colado se rechaza con 400 en vez de
      // pasar desapercibido. Ignorarlo en silencio sería peor — quien lo mandó
      // creería que se aplicó.
      const r = await facturar({ plazoDias: 90, [campo]: 999999 })
      expect(r.ok, `«${campo}» entró sin protestar`).toBe(false)
      expect(r.status).toBe(400)
      expect(facturado).toEqual([])
    })
  }
})
