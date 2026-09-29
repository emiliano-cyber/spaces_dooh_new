import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  EL PAQUETE SE CONGELA AL APROBAR — ADR 0039, invariante 4.  Fase 4.
// ----------------------------------------------------------------------------
//  «Si una fase no congela lo suyo, esa fase está mal hecha, por muy bien que
//  calcule.» Y aquí más que en ninguna de las cuatro, porque el paquete no
//  modifica un precio: lo SUSTITUYE. Si el precio del paquete no quedara
//  congelado, cambiarlo mañana cambiaría el total de una venta firmada — no un
//  porcentaje sobre ella, el número entero.
//
//  Lo que tiene que quedar congelado son CUATRO cosas:
//   · el NOMBRE, porque un «180 000» sin decir de qué paquete salió no se puede
//     auditar seis meses después;
//   · el PRECIO, porque es la venta;
//   · QUÉ PANTALLAS LO FORMABAN, que es lo que el encargo de esta fase pide con
//     todas las letras — y sin ello nadie puede saber por qué a cada pantalla
//     le tocó lo que le tocó;
//   · y EL REPARTO, porque es lo que se factura por pantalla y lo que el
//     reporte de rentabilidad atribuye.
//
//  El congelado NO vuelve a mirar `paquetes`: el nombre, el precio, la bandera
//  y la composición ya están copiados en `propuestas` desde que se aplicó. Es
//  la misma decisión que tomó el cupón en la Fase 3 y la diferencia real con la
//  franja de la Fase 1, que sí relee su catálogo. Dos redes, no una.
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
  if (/from paquetes/.test(sql)) return filas.paquetes ?? []
  if (/from paquete_sitios/.test(sql)) return filas.paqueteSitios ?? []
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

const APLICADO_EN = '2026-09-28T18:00:00.000Z'

/**
 * El caso del encargo: CINCO pantallas cuyas listas suman 250 000, vendidas
 * como paquete por 180 000. La suma de las partes NO es la suma de las listas,
 * y ésa es toda la fase.
 */
const LISTAS = [100_000, 60_000, 40_000, 30_000, 20_000]
const SITIOS = ['S1', 'S2', 'S3', 'S4', 'S5']

const PROPUESTA = {
  id: 'P1',
  comision_pct: 0,
  descuento_pct: 0,
  cliente_iva: 16,
  version: 1,
  snapshot_economico: null,
  codigo_texto: null,
  codigo_descuento_pct: 0,
  codigo_canjeado_en: null,
  paquete_nombre: 'Periferico',
  paquete_precio: 180_000,
  paquete_admite_codigo: false,
  paquete_aplicado_en: new Date(APLICADO_EN),
  paquete_composicion: SITIOS,
}

const items = () =>
  SITIOS.map((s, i) => ({
    id: `I${i + 1}`,
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
  congelado = null
  filas.propuesta = [{ ...PROPUESTA }]
  filas.items = items()
  filas.temporadas = []
  filas.paquetes = []
  filas.paqueteSitios = []
})

describe('1 · qué se congela', () => {
  it('el NOMBRE, el PRECIO, la bandera y el MOMENTO quedan en el snapshot', async () => {
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.paquete.nombre).toBe('Periferico')
    expect(snap.paquete.precio).toBe(180_000)
    expect(snap.paquete.admiteCodigo).toBe(false)
    expect(snap.paquete.aplicadoEn).toBe(APLICADO_EN)
  })

  it('QUÉ PANTALLAS LO FORMABAN, con la parte de cada una', async () => {
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.paquete.sitios.map((s: any) => s.sitioId)).toEqual(SITIOS)
    // Y la composición con la que se cotizó, que puede no ser la de hoy.
    expect(snap.paquete.composicion).toEqual(SITIOS)
  })

  it('LA SUMA DE LAS PARTES ES EL PRECIO DEL PAQUETE, AL PESO', async () => {
    const snap: any = await congelarSnapshotEconomico('P1')
    const suma = snap.paquete.sitios.reduce((s: number, x: any) => s + x.parte, 0)
    expect(suma).toBe(180_000)
  })

  it('el reparto es A PRORRATA de la tarifa de lista', async () => {
    const snap: any = await congelarSnapshotEconomico('P1')
    const partes = snap.paquete.sitios.map((s: any) => s.parte)
    // 100/250 de 180 000 = 72 000; 60/250 = 43 200; 40/250 = 28 800;
    // 30/250 = 21 600; 20/250 = 14 400.  Suman 180 000 exactos.
    expect(partes).toEqual([72_000, 43_200, 28_800, 21_600, 14_400])
  })

  it('`bruto` sigue siendo la SUMA DE LAS LISTAS, sin tocar', async () => {
    // Si `bruto` bajara al precio del paquete, el documento no podría enseñar
    // «lista 250 000 − paquete → 180 000» y el descuento del conjunto sería
    // invisible. Mismo criterio que tomó el volumen con `porSitio[].lista`.
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.bruto).toBe(250_000)
  })

  it('la BASE es el precio del paquete, no la suma de las listas', async () => {
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.base).toBe(180_000)
    expect(snap.total).toBe(180_000 + Math.round(180_000 * 0.16))
  })

  it('`porSitio[].lista` sigue siendo la LISTA, y `neto` sale del REPARTO', async () => {
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.porSitio.map((s: any) => s.lista)).toEqual(LISTAS)
    // Sin descuento ni comisión, el neto de cada pantalla es su parte.
    expect(snap.porSitio.map((s: any) => s.neto)).toEqual([72_000, 43_200, 28_800, 21_600, 14_400])
  })

  it('cada entrada de `porSitio` queda MARCADA como venida de un paquete', async () => {
    // Es lo que impide que el reporte «publicada vs neta» compare una lista
    // contra un neto que no salió de ella. Sin la marca, el reporte inventaría
    // un descuento del 28 % que nadie concedió.
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.porSitio.every((s: any) => s.paquete === true)).toBe(true)
  })

  it('el snapshot lleva el AVISO de que el precio es cerrado', async () => {
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(String(snap.paquete.aviso ?? '')).toContain('cerrado')
  })
})

describe('2 · el congelado NO relee el catálogo', () => {
  it('no consulta `paquetes` ni `paquete_sitios` al congelar', async () => {
    await congelarSnapshotEconomico('P1')
    const tocó = consultas.some((c) => /from paquetes|from paquete_sitios/.test(c.sql))
    expect(tocó).toBe(false)
  })
})

describe('3 · el paquete es PRECIO FINAL (regla 2 del ADR)', () => {
  it('el descuento por VOLUMEN de las líneas NO se aplica encima', async () => {
    filas.items = items().map((i) => ({ ...i, descuento_volumen_pct: 20, volumen_desde: 50 }))
    const snap: any = await congelarSnapshotEconomico('P1')
    // La base sigue siendo el precio del paquete, no 180 000 × 0,8.
    expect(snap.base).toBe(180_000)
    expect(snap.descuentoVolumenMonto).toBeUndefined()
    expect(snap.descuentoVolumenPct).toBeUndefined()
  })

  it('el CÓDIGO promocional NO se aplica si el paquete no lo admite', async () => {
    filas.propuesta = [
      { ...PROPUESTA, codigo_texto: 'VERANO20', codigo_descuento_pct: 20,
        codigo_canjeado_en: new Date(APLICADO_EN) },
    ]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.base).toBe(180_000)
    expect(snap.codigoDescuentoMonto).toBeUndefined()
  })

  it('el CÓDIGO SÍ se aplica cuando la bandera del paquete está encendida', async () => {
    filas.propuesta = [
      { ...PROPUESTA, paquete_admite_codigo: true, codigo_texto: 'VERANO20',
        codigo_descuento_pct: 20, codigo_canjeado_en: new Date(APLICADO_EN) },
    ]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.base).toBe(144_000) // 180 000 × 0,8
    expect(snap.codigoDescuentoMonto).toBe(36_000)
  })

  it('el descuento COMERCIAL sí se sigue aplicando sobre el paquete', async () => {
    filas.propuesta = [{ ...PROPUESTA, descuento_pct: 10 }]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.base).toBe(162_000) // 180 000 × 0,9
  })
})

describe('4 · sin paquete, el snapshot es el de la Fase 3 sin tocar', () => {
  it('ninguna clave de paquete aparece cuando no hay paquete', async () => {
    filas.propuesta = [
      { ...PROPUESTA, paquete_nombre: null, paquete_precio: null,
        paquete_aplicado_en: null, paquete_composicion: null },
    ]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.paquete).toBeUndefined()
    expect(snap.base).toBe(250_000)
    expect(snap.porSitio.every((s: any) => s.paquete === undefined)).toBe(true)
  })
})

describe('5 · la propuesta APROBADA no se mueve nunca más', () => {
  it('con snapshot ya congelado, no se reescribe aunque el paquete cambie', async () => {
    const viejo = { esquema: 3, base: 180_000, paquete: { nombre: 'Periferico', precio: 180_000 } }
    filas.propuesta = [{ ...PROPUESTA, paquete_precio: 999_999, snapshot_economico: viejo }]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap).toEqual(viejo)
    expect(congelado).toBeNull()
  })
})

describe('6 · la forma del JSON se declara', () => {
  it('el snapshot de esta fase es la forma 3', async () => {
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.esquema).toBe(3)
  })
})

describe('7 · quitar una pantalla NO baja el precio', () => {
  it('con cuatro de las cinco, el reparto sigue sumando 180 000 y se AVISA', async () => {
    filas.items = items().slice(0, 4)
    const snap: any = await congelarSnapshotEconomico('P1')
    const suma = snap.paquete.sitios.reduce((s: number, x: any) => s + x.parte, 0)
    expect(suma).toBe(180_000)
    expect(snap.base).toBe(180_000)
    expect(String(snap.paquete.avisoComposicion ?? '')).toContain('NO baja')
    // Y la composición congelada sigue diciendo con cuántas se cotizó.
    expect(snap.paquete.composicion).toHaveLength(5)
    expect(snap.paquete.sitios).toHaveLength(4)
  })
})

describe('8 · el borde que envenenaría todo', () => {
  it('un precio de paquete ilegible se lee como SIN PAQUETE, nunca como NaN', async () => {
    // `numeric` de Postgres ADMITE NaN y lo propaga. Sin la guarda, el neto de
    // la propuesta entera saldría NaN y la aprobación contestaría 200 OK.
    filas.propuesta = [{ ...PROPUESTA, paquete_precio: Number.NaN }]
    const snap: any = await congelarSnapshotEconomico('P1')
    expect(snap.paquete).toBeUndefined()
    expect(snap.base).toBe(250_000)
    expect(Number.isFinite(snap.neto)).toBe(true)
  })
})
