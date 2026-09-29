import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolClient } from 'pg'

// ============================================================================
//  EL REPOSITORIO DE PROPUESTAS, POR EL LADO DEL PAQUETE. ADR 0039, Fase 4.
// ----------------------------------------------------------------------------
//  ⚠️ ESTE ARCHIVO EXISTE POR UN AGUJERO QUE YA COBRÓ DOS VECES: **el camino
//  VIVO —la propuesta ANTES de aprobarse— se queda sin pruebas si uno solo mira
//  el snapshot.** Lo encontró la Fase 2 con un mutante, y la Fase 3 con otro.
//
//  Y aquí costaría más que en ninguna: el vendedor le enseña al cliente la suma
//  de las tarifas de lista —250 000— y al aprobar se congelan 180 000. Las dos
//  cifras son coherentes cada una consigo misma, nadie ve un error, y la que el
//  cliente vio primero es la mala.
//
//  ⚠️ Y EL SEGUNDO AGUJERO, TAMBIÉN COBRADO DOS VECES:
//  `obtenerPropuestaPublica` **arma su respuesta A MANO, campo por campo**. Un
//  dato añadido a `armarPropuesta` NO llega solo al documento que el cliente
//  firma. Las Fases 2 y 3 lo descubrieron REVISANDO EL DIFF, no corriendo
//  pruebas. Aquí se prueba.
//
//  Se mockea `./db` y se miran los números. Nada de esto afirma algo contra
//  Postgres: eso está en `paquete-cerrado.e2e.test.ts`.
// ============================================================================

const consultas: { sql: string; params: unknown[] }[] = []
const respuestas: Record<string, any[]> = {}

/**
 * EL ORDEN DE LAS REGLAS ES EL MECANISMO, y aquí se pagó una vez: la consulta
 * de `listarPropuestas` trae `(select iva_pct from clientes …)` como SUBCONSULTA,
 * así que una regla de `from clientes` puesta antes se la queda y devuelve la
 * fila equivocada — una prueba en verde midiendo otra cosa, que es peor que una
 * en rojo. `from propuestas` va antes que las tablas que solo aparecen dentro de
 * sus subconsultas.
 */
function responder(sql: string): any[] {
  if (/propuesta_items/.test(sql)) return respuestas.items ?? []
  if (/from propuestas/.test(sql)) return respuestas.propuesta ?? []
  if (/from clientes/.test(sql)) return respuestas.cliente ?? []
  if (/from tenants/.test(sql)) return respuestas.tenant ?? []
  if (/from config_negocio/.test(sql)) return respuestas.config ?? []
  if (/from sitios/.test(sql)) return respuestas.sitios ?? []
  if (/propuestas/.test(sql)) return respuestas.propuesta ?? []
  return []
}

const clienteFalso = {
  query: vi.fn(async (sql: string, params?: unknown[]) => {
    consultas.push({ sql, params: params ?? [] })
    return { rows: responder(sql) }
  }),
  release: vi.fn(),
} as unknown as PoolClient

const db = {
  pool: { connect: vi.fn(async () => clienteFalso) },
  q: vi.fn(async (sql: string, params?: unknown[]) => {
    consultas.push({ sql, params: params ?? [] })
    return responder(sql)
  }),
  q1: vi.fn(async (sql: string, params?: unknown[]): Promise<any> => {
    consultas.push({ sql, params: params ?? [] })
    return responder(sql)[0] ?? null
  }),
  qConTenant: vi.fn(async (_t: string, sql: string, params?: unknown[]) => {
    consultas.push({ sql, params: params ?? [] })
    return responder(sql)
  }),
  qRaw1: vi.fn(async () => ({ tenant: 'T1' })),
  fijarTenant: vi.fn(),
  fijarTenantExplicito: vi.fn(),
  withTenantTx: vi.fn(),
}
vi.mock('./db', () => db)
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'T1') }))
vi.mock('./auth', () => ({ usuarioActual: vi.fn(async () => ({ id: 'U1' })) }))
vi.mock('./folios', () => ({ folioDocumento: vi.fn(async () => 'PR-2026-0001') }))
const tope = vi.fn(async () => 100)
vi.mock('./config-repo', () => ({ topeDescuentoDelTenant: tope }))

const { listarPropuestas, obtenerPropuestaPublica, actualizarPropuesta } = await import(
  './propuestas-repo'
)

const APLICADO_EN = '2026-09-28T18:00:00.000Z'
const LISTAS = [100_000, 60_000, 40_000, 30_000, 20_000]
const SITIOS = ['S1', 'S2', 'S3', 'S4', 'S5']

/** Cinco pantallas que suman 250 000 de lista, vendidas como paquete a 180 000. */
const PROPUESTA = {
  id: 'P1',
  folio: 'PR-2026-0001',
  token_publico: 'tok',
  nombre: 'Viva',
  estatus: 'BORRADOR',
  comision_pct: 0,
  descuento_pct: 0,
  cliente_iva: 16,
  version: 1,
  codigo_texto: null,
  codigo_descuento_pct: 0,
  codigo_canjeado_en: null,
  paquete_nombre: 'Periferico',
  paquete_precio: '180000.00',
  paquete_admite_codigo: false,
  paquete_aplicado_en: new Date(APLICADO_EN),
  paquete_composicion: SITIOS,
}

const items = () =>
  SITIOS.map((s, i) => ({
    id: `I${i + 1}`,
    propuesta_id: 'P1',
    sitio_id: s,
    precio: LISTAS[i],
    tarifa_unitaria: LISTAS[i],
    cantidad: 1,
    unidad: 'mensual',
    fecha_inicio: '2026-11-13',
    fecha_fin: '2026-12-12',
    aprobado: true,
    franja_id: null,
    descuento_volumen_pct: 0,
    volumen_desde: null,
  }))

beforeEach(() => {
  consultas.length = 0
  tope.mockClear()
  tope.mockResolvedValue(100)
  respuestas.propuesta = [{ ...PROPUESTA }]
  respuestas.items = items()
  respuestas.cliente = []
  respuestas.tenant = [{ nombre: 'RGB' }]
  respuestas.config = []
  respuestas.sitios = SITIOS.map((s) => ({ id: s, nombre: s }))
})

describe('1 · el camino VIVO: la propuesta antes de aprobarse', () => {
  it('la BASE es el precio del paquete, no la suma de las listas', async () => {
    const [p]: any = await listarPropuestas()
    expect(p.bruto).toBe(250_000)
    expect(p.brutoConVolumen).toBe(180_000)
    expect(p.base).toBe(180_000)
    expect(p.total).toBe(180_000 + Math.round(180_000 * 0.16))
  })

  it('el paquete viaja con su nombre, su precio y su REPARTO', async () => {
    const [p]: any = await listarPropuestas()
    expect(p.paquete.nombre).toBe('Periferico')
    expect(p.paquete.precio).toBe(180_000)
    expect(p.paquete.admiteCodigo).toBe(false)
    const suma = p.paquete.sitios.reduce((s: number, x: any) => s + x.parte, 0)
    expect(suma).toBe(180_000)
  })

  it('cada LÍNEA sabe qué parte del paquete le tocó', async () => {
    const [p]: any = await listarPropuestas()
    expect(p.items.map((i: any) => i.parteDelPaquete)).toEqual([
      72_000, 43_200, 28_800, 21_600, 14_400,
    ])
  })

  it('el VOLUMEN de las líneas NO se aplica encima (regla 2)', async () => {
    respuestas.items = items().map((i) => ({ ...i, descuento_volumen_pct: 20 }))
    const [p]: any = await listarPropuestas()
    expect(p.base).toBe(180_000)
    expect(p.descuentoVolumenMonto).toBe(0)
    expect(p.descuentoVolumenPct).toBe(0)
  })

  it('el CÓDIGO no descuenta si el paquete no lo admite', async () => {
    respuestas.propuesta = [{ ...PROPUESTA, codigo_texto: 'VERANO20', codigo_descuento_pct: 20 }]
    const [p]: any = await listarPropuestas()
    expect(p.base).toBe(180_000)
    expect(p.codigoDescuentoMonto).toBe(0)
    expect(p.codigoDescuentoPct).toBe(0)
  })

  it('el CÓDIGO sí descuenta cuando la bandera está encendida', async () => {
    respuestas.propuesta = [
      { ...PROPUESTA, paquete_admite_codigo: true, codigo_texto: 'VERANO20', codigo_descuento_pct: 20 },
    ]
    const [p]: any = await listarPropuestas()
    expect(p.base).toBe(144_000)
  })

  it('SIN paquete, todo sale exactamente como antes de esta fase', async () => {
    respuestas.propuesta = [
      { ...PROPUESTA, paquete_nombre: null, paquete_precio: null,
        paquete_aplicado_en: null, paquete_composicion: null },
    ]
    const [p]: any = await listarPropuestas()
    expect(p.base).toBe(250_000)
    expect(p.paquete).toBeNull()
    expect(p.items.every((i: any) => i.parteDelPaquete === null)).toBe(true)
  })

  it('quitar una pantalla NO baja el precio, y la propuesta lo AVISA', async () => {
    respuestas.items = items().slice(0, 4)
    const [p]: any = await listarPropuestas()
    expect(p.base).toBe(180_000)
    expect(String(p.paquete.avisoComposicion ?? '')).toContain('NO baja')
    const suma = p.paquete.sitios.reduce((s: number, x: any) => s + x.parte, 0)
    expect(suma).toBe(180_000)
  })

  it('el presupuesto APROBADO tampoco baja al desmarcar pantallas', async () => {
    // Si bajara, el cliente elegiría su propio descuento desmarcando la pantalla
    // más cara. Un precio cerrado es cerrado también por ese lado.
    respuestas.items = items().map((i, idx) => ({ ...i, aprobado: idx < 2 }))
    const [p]: any = await listarPropuestas()
    expect(p.baseAprobado).toBe(180_000)
  })
})

describe('2 · LA LIGA PÚBLICA — el documento que el cliente firma', () => {
  it('el paquete llega al documento público, con su precio y su reparto', async () => {
    // `obtenerPropuestaPublica` arma su respuesta CAMPO POR CAMPO. Esta prueba
    // es la que impide que añadir algo a `armarPropuesta` parezca suficiente.
    const pub: any = await obtenerPropuestaPublica('tok')
    expect(pub).toBeTruthy()
    expect(pub.paquete).toBeTruthy()
    expect(pub.paquete.nombre).toBe('Periferico')
    expect(pub.paquete.precio).toBe(180_000)
  })

  it('el BRUTO y el TOTAL del documento público CUADRAN entre sí', async () => {
    // Si el paquete no viajara, el cliente leería «subtotal 250 000» junto a un
    // total de 208 800 sin ninguna explicación de la diferencia.
    const pub: any = await obtenerPropuestaPublica('tok')
    expect(pub.bruto).toBe(250_000)
    expect(pub.brutoConVolumen).toBe(180_000)
    expect(pub.base).toBe(180_000)
    expect(pub.total).toBe(180_000 + Math.round(180_000 * 0.16))
  })

  it('cada pantalla del documento público dice su parte del paquete', async () => {
    const pub: any = await obtenerPropuestaPublica('tok')
    expect(pub.items.map((i: any) => i.parteDelPaquete)).toEqual([
      72_000, 43_200, 28_800, 21_600, 14_400,
    ])
  })

  it('sin paquete, el documento público es el de antes', async () => {
    respuestas.propuesta = [
      { ...PROPUESTA, paquete_nombre: null, paquete_precio: null,
        paquete_aplicado_en: null, paquete_composicion: null },
    ]
    const pub: any = await obtenerPropuestaPublica('tok')
    expect(pub.paquete).toBeNull()
    expect(pub.base).toBe(250_000)
  })
})

describe('3 · el TOPE de descuento con un paquete', () => {
  it('el VOLUMEN de las líneas NO cuenta contra el tope si hay paquete', async () => {
    // Sin esto, una propuesta con volumen capturado y un paquete encima
    // rechazaría un descuento comercial por un volumen QUE NO SE APLICÓ —
    // y el vendedor no tendría forma de saber de dónde sale el número.
    tope.mockResolvedValue(20 as any)
    respuestas.items = items().map((i) => ({ ...i, descuento_volumen_pct: 15 }))
    await expect(actualizarPropuesta('P1', { descuentoPct: 20 })).resolves.toBeTruthy()
  })

  it('pero SIN paquete sigue contando, como decidió la Fase 2', async () => {
    tope.mockResolvedValue(20 as any)
    respuestas.propuesta = [
      { ...PROPUESTA, paquete_nombre: null, paquete_precio: null,
        paquete_aplicado_en: null, paquete_composicion: null },
    ]
    respuestas.items = items().map((i) => ({ ...i, descuento_volumen_pct: 15 }))
    await expect(actualizarPropuesta('P1', { descuentoPct: 20 })).rejects.toThrow(/tope|maximo|máximo/i)
  })
})
