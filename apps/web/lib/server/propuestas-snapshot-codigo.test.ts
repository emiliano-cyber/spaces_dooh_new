import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  EL CÓDIGO PROMOCIONAL SE CONGELA AL APROBAR — ADR 0039, invariante 3.
//  Fase 3.
// ----------------------------------------------------------------------------
//  «Si una fase no congela lo suyo, esa fase está mal hecha, por muy bien que
//  calcule.» Lo que esta fase tiene que congelar son TRES cosas: el CÓDIGO que
//  se usó, el PORCENTAJE que dio, y el MOMENTO en que se canjeó.
//
//  Las tres son necesarias y ninguna sobra:
//   · el texto, porque un «20 %» sin decir de qué cupón salió no se puede
//     auditar seis meses después — nadie sabrá si vino de una promoción o de un
//     dedazo;
//   · el porcentaje, porque es el precio;
//   · y el momento, porque es la respuesta a la tercera pregunta con trampa —
//     un cupón aplicado el día 30 y aprobado el día 3 sigue valiendo, y esa
//     fecha es lo que lo demuestra.
//
//  Y lo que de verdad prueba el congelado: BORRAR O CAMBIAR EL CUPÓN DESPUÉS NO
//  MUEVE NADA. Aquí hay la misma diferencia con la Fase 1 que tenía el volumen:
//  la franja se congela LEYENDO `franjas_horarias` al aprobar, así que el
//  snapshot depende de esa tabla. El código NO: el texto y el porcentaje ya
//  están copiados en `propuestas` desde el canje, así que el congelado **no
//  vuelve a mirar `codigos_promocionales`**. Son dos redes, no una.
//
//  Se mockea `./db` y se mira el JSON que sale. Esto no afirma nada contra
//  Postgres: eso está en las e2e.
// ============================================================================

const consultas: { sql: string; params: unknown[] }[] = []
let congelado: any = null
const filas: Record<string, any[]> = {}

function responder(sql: string): any[] {
  if (/from propuestas p/.test(sql)) return filas.propuesta ?? []
  if (/from propuesta_items/.test(sql)) return filas.items ?? []
  if (/from temporadas/.test(sql)) return filas.temporadas ?? []
  if (/from codigos_promocionales/.test(sql)) return filas.codigos ?? []
  if (/from canjes_codigo/.test(sql)) return filas.canjes ?? []
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

const CANJEADO_EN = '2026-09-30T18:00:00.000Z'

/** Una propuesta de 100 000 de lista con VERANO20 aplicado al 20 %. */
const PROPUESTA = {
  id: 'P1',
  comision_pct: 0,
  descuento_pct: 0,
  cliente_iva: 16,
  version: 1,
  snapshot_economico: null,
  codigo_texto: 'VERANO20',
  codigo_descuento_pct: 20,
  codigo_canjeado_en: new Date(CANJEADO_EN),
}

const ITEM = {
  id: 'I1',
  sitio_id: 'S1',
  precio: 100000,
  tarifa_unitaria: 100000,
  cantidad: 1,
  unidad: 'mensual',
  fecha_inicio: '2026-11-13',
  fecha_fin: '2026-12-12',
  aprobado: true,
  franja_id: null,
  descuento_volumen_pct: 0,
  volumen_desde: null,
}

beforeEach(() => {
  consultas.length = 0
  congelado = null
  filas.propuesta = [{ ...PROPUESTA }]
  filas.items = [{ ...ITEM }]
  filas.temporadas = []
  filas.codigos = []
  filas.canjes = []
})

describe('1 · qué se congela', () => {
  it('el CÓDIGO, su PORCENTAJE y el MOMENTO del canje quedan en el snapshot', async () => {
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.codigoTexto).toBe('VERANO20')
    expect(snap.codigoDescuentoPct).toBe(20)
    expect(snap.codigoCanjeadoEn).toBe(CANJEADO_EN)
  })

  it('el DINERO que se regaló con el código va aparte, y cuadra', async () => {
    const snap: any = await congelarSnapshotEconomico('P1')
    // 100 000 de lista, sin volumen ni comercial → baseComercial 100 000.
    expect(snap.baseComercial).toBe(100_000)
    expect(snap.codigoDescuentoMonto).toBe(20_000)
    expect(snap.base).toBe(80_000)
  })

  it('el IVA y el TOTAL salen de la base YA con el código dentro', async () => {
    const snap: any = await congelarSnapshotEconomico('P1')
    // Si el IVA se calculara antes del cupón, el cliente pagaría IVA sobre un
    // importe que no se le cobró.
    expect(snap.iva).toBe(12_800)
    expect(snap.total).toBe(92_800)
  })

  it('el NETO por sitio lleva el código dentro — es el que se factura', async () => {
    // `campanas-repo` copia este número a `reservas.precio`. Si el cupón no
    // entrara aquí, la campaña cobraría MÁS que la propuesta que la originó y
    // el importe sería plausible: el de antes del cupón.
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.porSitio[0].neto).toBe(80_000)
    // Y `lista` NO baja: sigue siendo la publicada, o si no el reporte de
    // publicada contra neta compararía contra una publicada que nadie publicó.
    expect(snap.porSitio[0].lista).toBe(100_000)
  })
})

describe('2 · SIN código, el snapshot es el de siempre', () => {
  beforeEach(() => {
    filas.propuesta = [
      { ...PROPUESTA, codigo_texto: null, codigo_descuento_pct: 0, codigo_canjeado_en: null },
    ]
  })

  it('no aparece NINGUNA clave de código: el JSON es el de antes de la Fase 3', async () => {
    const snap: any = await congelarSnapshotEconomico('P1')
    const claves = Object.keys(snap)
    expect(claves).not.toContain('codigoTexto')
    expect(claves).not.toContain('codigoDescuentoPct')
    expect(claves).not.toContain('codigoDescuentoMonto')
    expect(claves).not.toContain('baseComercial')
    expect(claves).not.toContain('codigoCanjeadoEn')
  })

  it('y los importes no se mueven ni un peso', async () => {
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.base).toBe(100_000)
    expect(snap.total).toBe(116_000)
    expect(snap.porSitio[0].neto).toBe(100_000)
  })
})

describe('3 · EL CONGELADO NO VUELVE A MIRAR EL CUPÓN — es lo que lo hace congelado', () => {
  it('no se consulta `codigos_promocionales` ni `canjes_codigo` al aprobar', async () => {
    await congelarSnapshotEconomico('P1')
    const sqls = consultas.map((c) => c.sql).join('\n')
    expect(sqls).not.toMatch(/from\s+codigos_promocionales/)
    expect(sqls).not.toMatch(/from\s+canjes_codigo/)
  })

  it('con el cupón BORRADO del catálogo, el snapshot sale idéntico', async () => {
    // El catálogo está vacío —el dueño borró VERANO20— y la propuesta se
    // aprueba igual y por el mismo importe: el precio ya no depende del cupón.
    filas.codigos = []
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.codigoTexto).toBe('VERANO20')
    expect(snap.codigoDescuentoPct).toBe(20)
    expect(snap.base).toBe(80_000)
  })

  it('con el cupón CAMBIADO al 60 %, el snapshot sigue diciendo 20', async () => {
    filas.codigos = [{ id: 'C1', codigo: 'VERANO20', descuento_pct: 60 }]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.codigoDescuentoPct).toBe(20)
    expect(snap.codigoDescuentoMonto).toBe(20_000)
  })
})

describe('4 · el orden de la cadena: volumen → comercial → CÓDIGO → comisión', () => {
  it('las tres capas SE COMPONEN, no se suman (ADR 0039 §1)', async () => {
    // 100 000 de lista · volumen 20 % · comercial 20 % · código 20 %.
    // Compuesto: 100 000 × 0,8 × 0,8 × 0,8 = 51 200. Sumado daría 40 000, que
    // son 11 200 regalados de más en una sola venta.
    filas.propuesta = [{ ...PROPUESTA, descuento_pct: 20 }]
    filas.items = [{ ...ITEM, descuento_volumen_pct: 20, volumen_desde: 2 }]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.brutoConVolumen).toBe(80_000)
    expect(snap.descuentoMonto).toBe(16_000)
    expect(snap.baseComercial).toBe(64_000)
    expect(snap.codigoDescuentoMonto).toBe(12_800)
    expect(snap.base).toBe(51_200)
  })

  it('el CÓDIGO va ANTES de la comisión de agencia, no después', async () => {
    // Con comisión del 20 %, el neto del medio es 80 000 × 0,8 = 64 000. Si el
    // cupón se aplicara después de la comisión, el medio cobraría 80 000 y el
    // descuento se lo comería la agencia — que no es lo que dice el ADR.
    filas.propuesta = [{ ...PROPUESTA, comision_pct: 20 }]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.base).toBe(80_000)
    expect(snap.neto).toBe(64_000)
  })
})

describe('5 · lo ILEGIBLE no envenena el congelado', () => {
  it('un porcentaje NaN en la propuesta se lee como CERO, no como NaN', async () => {
    // `numeric` de Postgres ADMITE NaN y lo propaga. Sin guarda, el snapshot se
    // congelaría con `base: null` (NaN no sobrevive a JSON) y la aprobación
    // contestaría 200 OK. Es el mutante M15 de la Fase 2.
    filas.propuesta = [{ ...PROPUESTA, codigo_descuento_pct: Number.NaN }]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.base).toBe(100_000)
    expect(snap.porSitio[0].neto).toBe(100_000)
    expect(Object.keys(snap)).not.toContain('codigoTexto')
  })

  it('un porcentaje por encima de 100 se acota y no regala de más', async () => {
    filas.propuesta = [{ ...PROPUESTA, codigo_descuento_pct: 250 }]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.base).toBe(0)
    expect(snap.porSitio[0].neto).toBe(0)
    // Y el PORCENTAJE CONGELADO también sale acotado. Nació del mutante M21:
    // sin el recorte los importes salían bien igual --`montoDescuentoCodigo` y
    // `factorCodigo` tienen la suya-- y lo único envenenado era el número que
    // queda ESCRITO en el documento: un snapshot que afirma un cupón del 250 %
    // y que nadie podrá explicar.
    expect(snap.codigoDescuentoPct).toBe(100)
  })
})
