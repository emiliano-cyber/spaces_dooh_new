import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  EL VOLUMEN SE CONGELA AL APROBAR — ADR 0039, invariante 3.
// ----------------------------------------------------------------------------
//  «Si una fase no congela lo suyo, esa fase está mal hecha, por muy bien que
//  calcule.» Lo que esta fase tiene que congelar son DOS cosas por línea —el
//  porcentaje aplicado y el UMBRAL que lo ganó— más el total regalado por
//  volumen en la propuesta entera.
//
//  El umbral no es adorno. Un «10 %» congelado sin decir «por llegar a 50» no
//  se puede auditar seis meses después: nadie sabrá si salió de la escala o de
//  un dedazo, y el día que el dueño mueva el tramo a 80 la propuesta firmada
//  quedará sin explicación posible.
//
//  Y lo que de verdad prueba el congelado: MOVER LA ESCALA DESPUÉS NO MUEVE
//  NADA. Aquí hay una diferencia con la Fase 1 que conviene tener escrita: la
//  franja se congela leyendo `franjas_horarias` en el momento de aprobar, así
//  que el snapshot depende de esa tabla. El volumen NO: el porcentaje y el
//  umbral ya están copiados en `propuesta_items` desde la captura, así que el
//  congelado **no vuelve a mirar `escalas_volumen`**. Son dos redes, no una.
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
  if (/from escalas_volumen/.test(sql)) return filas.escalas ?? []
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

const PROPUESTA = {
  id: 'P1',
  comision_pct: 0,
  descuento_pct: 0,
  cliente_iva: 16,
  version: 1,
  snapshot_economico: null,
}

/** 50 spots a 1 200 = 60 000 de lista, con el tramo «desde 50 → 10 %». */
const ITEM_CON_VOLUMEN = {
  id: 'I1',
  sitio_id: 'S1',
  precio: 60000,
  tarifa_unitaria: 1200,
  cantidad: 50,
  unidad: 'spot',
  fecha_inicio: '2026-11-13',
  fecha_fin: '2026-11-16',
  aprobado: true,
  franja_id: null,
  descuento_volumen_pct: 10,
  volumen_desde: 50,
}

beforeEach(() => {
  consultas.length = 0
  congelado = null
  filas.propuesta = [{ ...PROPUESTA }]
  filas.items = [{ ...ITEM_CON_VOLUMEN }]
  filas.temporadas = []
  filas.escalas = []
  db.q.mockClear()
})

describe('1 · qué queda congelado', () => {
  it('la linea congela el porcentaje Y el umbral que lo gano', async () => {
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.porSitio[0].descuentoVolumenPct).toBe(10)
    expect(snap.porSitio[0].volumenDesde).toBe(50)
  })

  it('`lista` sigue siendo el importe DE LISTA, no el ya descontado', async () => {
    // Si `lista` bajara, el reporte de publicada vs neta compararía la neta
    // contra una «publicada» que nadie publicó nunca.
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.porSitio[0].lista).toBe(60000)
    expect(snap.porSitio[0].tarifaUnitaria).toBe(1200)
  })

  it('la propuesta congela el bruto de lista, lo regalado por volumen y el bruto resultante', async () => {
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.bruto).toBe(60000)
    expect(snap.descuentoVolumenMonto).toBe(6000)
    expect(snap.brutoConVolumen).toBe(54000)
    expect(snap.descuentoVolumenPct).toBeCloseTo(10, 10)
  })

  it('el NETO de la linea lleva el volumen dentro', async () => {
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.porSitio[0].neto).toBe(54000)
  })

  it('el congelado NO vuelve a leer `escalas_volumen`: el dato ya viaja en el item', async () => {
    await congelarSnapshotEconomico('P1')
    expect(consultas.some((c) => /escalas_volumen/.test(c.sql))).toBe(false)
  })
})

describe('2 · se COMPONE, no se suma — ADR 0039, regla 1', () => {
  it('20 % de volumen y 20 % comercial dejan al cliente pagando el 64 %', async () => {
    filas.propuesta = [{ ...PROPUESTA, descuento_pct: 20 }]
    filas.items = [{ ...ITEM_CON_VOLUMEN, precio: 100000, descuento_volumen_pct: 20, volumen_desde: 50 }]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.bruto).toBe(100000)
    expect(snap.descuentoVolumenMonto).toBe(20000)
    expect(snap.brutoConVolumen).toBe(80000)
    // El comercial se calcula sobre lo que queda, no sobre el bruto de lista:
    // ahí es donde componer deja de ser una frase y pasa a ser la aritmética.
    expect(snap.descuentoMonto).toBe(16000)
    expect(snap.base).toBe(64000) // y no 60 000
  })

  it('el IVA y el total salen de la base compuesta', async () => {
    filas.propuesta = [{ ...PROPUESTA, descuento_pct: 20 }]
    filas.items = [{ ...ITEM_CON_VOLUMEN, precio: 100000, descuento_volumen_pct: 20, volumen_desde: 50 }]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.iva).toBe(10240)
    expect(snap.total).toBe(74240)
  })

  it('el volumen entra ANTES de la comision de agencia', async () => {
    filas.propuesta = [{ ...PROPUESTA, comision_pct: 20 }]
    const snap: any = await congelarSnapshotEconomico('P1')
    // 60 000 × 0,9 × 0,8
    expect(snap.neto).toBe(43200)
    expect(snap.porSitio[0].neto).toBe(43200)
  })
})

describe('3 · sin volumen, el snapshot es EXACTAMENTE el de antes', () => {
  it('no aparece ningun campo nuevo cuando ninguna linea lleva volumen', async () => {
    // Un snapshot que engorda con ceros en toda la base instalada es ruido que
    // se acaba dejando de leer, y encima cambiaría el JSON de propuestas que no
    // cambiaron de precio. Se guarda SOLO cuando hay algo que decir — el mismo
    // criterio que `avisoFranja` de la Fase 1.
    filas.items = [{ ...ITEM_CON_VOLUMEN, descuento_volumen_pct: 0, volumen_desde: null }]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.bruto).toBe(60000)
    expect(snap.base).toBe(60000)
    expect('descuentoVolumenMonto' in snap).toBe(false)
    expect('brutoConVolumen' in snap).toBe(false)
    expect('descuentoVolumenPct' in snap).toBe(false)
    expect('descuentoVolumenPct' in snap.porSitio[0]).toBe(false)
    expect('volumenDesde' in snap.porSitio[0]).toBe(false)
  })

  it('con una linea CON volumen y otra SIN, solo la que lo lleva trae los campos', async () => {
    filas.items = [
      { ...ITEM_CON_VOLUMEN },
      { ...ITEM_CON_VOLUMEN, id: 'I2', sitio_id: 'S2', precio: 40000, descuento_volumen_pct: 0, volumen_desde: null },
    ]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.porSitio[0].descuentoVolumenPct).toBe(10)
    expect('descuentoVolumenPct' in snap.porSitio[1]).toBe(false)
    expect(snap.bruto).toBe(100000)
    expect(snap.descuentoVolumenMonto).toBe(6000)
    // El efectivo de la propuesta es el PONDERADO: 6 000 de 100 000.
    expect(snap.descuentoVolumenPct).toBeCloseTo(6, 10)
  })
})

describe('4 · una propuesta aprobada NO se mueve al mover la escala', () => {
  it('el snapshot ya escrito es inmutable: se devuelve tal cual', async () => {
    // Que la escala haya cambiado es irrelevante — el snapshot ni siquiera la
    // mira—, pero se deja capturado el caso completo: aunque alguien reescriba
    // `escalas_volumen` Y vuelva a llamar a congelar, no se recalcula nada.
    const yaCongelado = {
      version: 1, bruto: 60000, descuentoVolumenPct: 10, descuentoVolumenMonto: 6000,
      brutoConVolumen: 54000, descuentoPct: 0, descuentoMonto: 0, base: 54000,
      comisionPct: 0, neto: 54000, ivaPct: 16, iva: 8640, total: 62640,
      porSitio: [{ sitioId: 'S1', lista: 60000, neto: 54000, tarifaUnitaria: 1200, descuentoVolumenPct: 10, volumenDesde: 50 }],
    }
    filas.propuesta = [{ ...PROPUESTA, snapshot_economico: yaCongelado }]
    filas.escalas = [{ id: 'T2', unidad: 'spot', desde_cantidad: 50, descuento_pct: 40 }]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap).toEqual(yaCongelado)
    expect(consultas.some((c) => /update propuestas set snapshot_economico/.test(c.sql))).toBe(false)
  })

  it('y el item guarda el porcentaje que le tocó, no el que diga la escala de hoy', async () => {
    // La escala dice 40 % hoy; el ítem se capturó con 10 %. Manda el ítem.
    filas.escalas = [{ id: 'T2', unidad: 'spot', desde_cantidad: 50, descuento_pct: 40 }]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.porSitio[0].descuentoVolumenPct).toBe(10)
    expect(snap.brutoConVolumen).toBe(54000)
  })
})

describe('5 · lo ilegible no contamina el dinero', () => {
  it('un porcentaje NaN en una fila se lee como sin volumen', async () => {
    // `numeric` de Postgres admite NaN y lo propaga. Sin la guarda, el bruto, el
    // neto y el total de esa propuesta serían NaN y la petición diría 200 OK.
    filas.items = [{ ...ITEM_CON_VOLUMEN, descuento_volumen_pct: 'NaN' }]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.bruto).toBe(60000)
    expect(snap.base).toBe(60000)
    expect(Number.isNaN(snap.total)).toBe(false)
  })

  it('y tampoco llega al NETO POR SITIO, que es lo que acaba cobrando la campaña', async () => {
    // ⚠️ Esta prueba nació de un MUTANTE QUE SOBREVIVIÓ. Quitar la guarda del
    // factor por línea dejaba los totales perfectos —`volumenDeLineas` tiene la
    // suya— y solo envenenaba `porSitio[].neto`. Y ése es justo el número que
    // `campanas-repo.ts` copia a `reservas.precio` cuando genera la campaña:
    // una sola fila corrupta escribiría NaN en el importe que se factura, con
    // la propuesta enseñando un total impecable al lado.
    filas.items = [{ ...ITEM_CON_VOLUMEN, descuento_volumen_pct: 'NaN' }]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(Number.isNaN(snap.porSitio[0].neto)).toBe(false)
    expect(snap.porSitio[0].neto).toBe(60000)
    // Y no se inventa un renglón de volumen para algo que no se pudo leer.
    expect('descuentoVolumenPct' in snap.porSitio[0]).toBe(false)
  })

  it('un porcentaje NEGATIVO tampoco sube el precio', async () => {
    // Del mismo mutante: sin el `> 0`, un `-50` daría factor 1,5 y la línea se
    // cobraría un 50 % MÁS CARA que la tarifa, sin un solo error.
    filas.items = [{ ...ITEM_CON_VOLUMEN, descuento_volumen_pct: -50 }]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.porSitio[0].neto).toBe(60000)
    expect(snap.base).toBe(60000)
  })
})
