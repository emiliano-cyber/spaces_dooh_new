import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  APLICAR Y QUITAR UN PAQUETE — ADR 0039, Fase 4.
// ----------------------------------------------------------------------------
//  Aplicar un paquete es lo único de las cuatro fases que SUSTITUYE el precio
//  de una venta entera, así que lo que se prueba aquí son sobre todo los
//  NEGATIVOS: qué se niega a hacer y por qué.
//
//  El más importante, y el que define la fase: **el precio se COPIA a la
//  propuesta**. A partir de ese instante la venta no depende del catálogo. Lo
//  que se congela son cinco cosas —nombre, precio, bandera, momento y
//  composición— y las cinco se escriben JUNTAS, porque el CHECK
//  `propuestas_paquete_pareja_ck` rechazaría dejar una sin las otras.
//
//  Se mockea `./db`: esto mira las sentencias que salen, no lo que Postgres
//  hace con ellas. La RLS y el aislamiento real están en las e2e.
// ============================================================================

const ejecutadas: { sql: string; params: unknown[] }[] = []
const filas: Record<string, any[]> = {}

function responder(sql: string): any[] {
  if (/from propuestas/.test(sql)) return filas.propuesta ?? []
  if (/from paquete_sitios/.test(sql)) return filas.paqueteSitios ?? []
  if (/from paquetes/.test(sql)) return filas.paquete ?? []
  if (/from propuesta_items/.test(sql)) return filas.items ?? []
  return []
}

const client = {
  query: vi.fn(async (sql: string, params?: unknown[]) => {
    ejecutadas.push({ sql, params: params ?? [] })
    return { rows: responder(sql) }
  }),
  release: vi.fn(),
}

vi.mock('./db', () => ({
  q: vi.fn(async (sql: string, params?: unknown[]) => {
    ejecutadas.push({ sql, params: params ?? [] })
    return responder(sql)
  }),
  q1: vi.fn(async (sql: string, params?: unknown[]) => {
    ejecutadas.push({ sql, params: params ?? [] })
    return responder(sql)[0] ?? null
  }),
  pool: { connect: vi.fn(async () => client) },
  fijarTenant: vi.fn(),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'T1') }))
vi.mock('./auth', () => ({ usuarioActual: vi.fn(async () => ({ id: 'U1' })) }))
// El techo de la organización. Por omisión el respaldo (100 %), que es «no hay
// tope»: así los bloques 1-3 se comportan igual que antes de TOPE-PAQ.
let topeDelTenant = 100
vi.mock('./config-repo', () => ({ topeDescuentoDelTenant: vi.fn(async () => topeDelTenant) }))

const { aplicarPaquete, quitarPaquete, PaqueteImposible } = await import('./paquetes-repo')

const PAQUETE = {
  id: 'PK1',
  nombre: 'Periferico',
  precio_cerrado: '180000.00',
  admite_codigo: false,
  activo: true,
}

const SITIOS = ['S1', 'S2', 'S3']

beforeEach(() => {
  ejecutadas.length = 0
  client.query.mockClear()
  topeDelTenant = 100
  filas.propuesta = [{ id: 'P1', estatus: 'BORRADOR', codigo_texto: null, paquete_nombre: null }]
  filas.paquete = [{ ...PAQUETE }]
  filas.paqueteSitios = SITIOS.map((s) => ({ sitio_id: s }))
  filas.items = SITIOS.map((s, i) => ({ id: `I${i}`, sitio_id: s }))
})

const sql = () => ejecutadas.map((e) => e.sql).join('\n---\n')

describe('1 · el precio se COPIA a la propuesta', () => {
  it('escribe nombre, precio, bandera, momento y composición JUNTOS', async () => {
    await aplicarPaquete('P1', 'PK1')
    const upd = ejecutadas.find((e) => /update propuestas/.test(e.sql))
    expect(upd).toBeTruthy()
    expect(upd!.sql).toMatch(/paquete_nombre/)
    expect(upd!.sql).toMatch(/paquete_precio/)
    expect(upd!.sql).toMatch(/paquete_admite_codigo/)
    expect(upd!.sql).toMatch(/paquete_aplicado_en\s*=\s*now\(\)/)
    expect(upd!.sql).toMatch(/paquete_composicion/)
    // Y el precio que se copia es el del catálogo, no uno que llegue de fuera.
    expect(upd!.params).toContain('Periferico')
    expect(upd!.params).toContain(180000)
  })

  it('la COMPOSICIÓN que se congela son las pantallas del PAQUETE', async () => {
    const devuelto = await aplicarPaquete('P1', 'PK1')
    expect(devuelto.composicion).toEqual(SITIOS)
    const upd = ejecutadas.find((e) => /update propuestas/.test(e.sql))!
    // Viaja como texto JSON hacia la columna `jsonb`, no como arreglo de `pg`.
    expect(upd.params).toContain(JSON.stringify(SITIOS))
  })

  it('deja el ENLACE VIVO en `paquete_aplicaciones`, con quién lo aplicó', async () => {
    await aplicarPaquete('P1', 'PK1')
    const ins = ejecutadas.find((e) => /insert into paquete_aplicaciones/.test(e.sql))
    expect(ins).toBeTruthy()
    // El usuario sale de la SESIÓN, nunca del cuerpo. Mismo candado que el
    // vendedor de VEND-01 y el canje de COD-01.
    expect(ins!.params).toContain('U1')
  })

  it('todas las consultas llevan `tenant_id` como segunda capa sobre la RLS', async () => {
    await aplicarPaquete('P1', 'PK1')
    for (const e of ejecutadas) {
      if (/^\s*select|^\s*update|^\s*delete/i.test(e.sql.trim())) {
        expect(e.sql).toMatch(/tenant_id/)
      }
    }
  })
})

describe('2 · los NEGATIVOS, que son el corazón de la fase', () => {
  it('un paquete de OTRA organización NO EXISTE para ti', async () => {
    filas.paquete = []
    await expect(aplicarPaquete('P1', 'PK-AJENO')).rejects.toBeInstanceOf(PaqueteImposible)
    await expect(aplicarPaquete('P1', 'PK-AJENO')).rejects.toThrow(/no existe/i)
  })

  it('una propuesta APROBADA es inmutable', async () => {
    filas.propuesta = [{ id: 'P1', estatus: 'APROBADA', codigo_texto: null, paquete_nombre: null }]
    await expect(aplicarPaquete('P1', 'PK1')).rejects.toThrow(/aprobada/i)
  })

  it('un paquete DESACTIVADO no se puede vender', async () => {
    filas.paquete = [{ ...PAQUETE, activo: false }]
    await expect(aplicarPaquete('P1', 'PK1')).rejects.toThrow(/desactivado|no esta activo/i)
  })

  it('DOS paquetes en la misma propuesta, no', async () => {
    filas.propuesta = [
      { id: 'P1', estatus: 'BORRADOR', codigo_texto: null, paquete_nombre: 'Otro' },
    ]
    await expect(aplicarPaquete('P1', 'PK1')).rejects.toThrow(/ya tiene/i)
  })

  it('las pantallas de la propuesta tienen que ser las del paquete', async () => {
    filas.items = [{ id: 'I0', sitio_id: 'S1' }, { id: 'I1', sitio_id: 'S9' }]
    await expect(aplicarPaquete('P1', 'PK1')).rejects.toThrow(/pantalla/i)
  })

  it('un paquete que NO admite código se niega si la propuesta ya tiene uno', async () => {
    // Regla 2 del ADR: el paquete es precio final. Dejarlo pasar en silencio
    // retendría el uso del cupón sin descontarlo, que es peor que negarse.
    filas.propuesta = [
      { id: 'P1', estatus: 'BORRADOR', codigo_texto: 'VERANO20', paquete_nombre: null },
    ]
    await expect(aplicarPaquete('P1', 'PK1')).rejects.toThrow(/codigo|código/i)
  })

  it('la propuesta se lee BLOQUEADA, con el mismo `for no key update` que el canje', async () => {
    // 2026-10-05 · sin el bloqueo, la regla 2 tenía una carrera: este paso
    // leía «sin cupón» mientras un canje en vuelo leía «sin paquete», y
    // confirmaban los dos — paquete de precio final y un uso gastado que no
    // descuenta nada. El canje lee la fila con este mismo bloqueo
    // (`codigos-repo.ts`), así que quien llega segundo espera.
    await aplicarPaquete('P1', 'PK1')
    const lectura = ejecutadas.find((e) => /from propuestas/.test(e.sql))
    expect(lectura?.sql).toMatch(/codigo_texto/)
    expect(lectura?.sql).toMatch(/for no key update/i)
  })

  it('pero SÍ se aplica si el paquete admite código', async () => {
    filas.paquete = [{ ...PAQUETE, admite_codigo: true }]
    filas.propuesta = [
      { id: 'P1', estatus: 'BORRADOR', codigo_texto: 'VERANO20', paquete_nombre: null },
    ]
    await expect(aplicarPaquete('P1', 'PK1')).resolves.toBeTruthy()
  })

  it('una propuesta que no existe aquí, no', async () => {
    filas.propuesta = []
    await expect(aplicarPaquete('P1', 'PK1')).rejects.toThrow(/no existe/i)
  })
})

describe('3 · quitar el paquete DEVUELVE los precios de línea', () => {
  beforeEach(() => {
    filas.propuesta = [
      { id: 'P1', estatus: 'BORRADOR', codigo_texto: null, paquete_nombre: 'Periferico' },
    ]
  })

  it('limpia las cinco columnas JUNTAS', async () => {
    const ok = await quitarPaquete('P1')
    expect(ok).toBe(true)
    const upd = ejecutadas.find((e) => /update propuestas/.test(e.sql))!
    expect(upd.sql).toMatch(/paquete_nombre\s*=\s*null/)
    expect(upd.sql).toMatch(/paquete_precio\s*=\s*null/)
    expect(upd.sql).toMatch(/paquete_admite_codigo\s*=\s*false/)
    expect(upd.sql).toMatch(/paquete_aplicado_en\s*=\s*null/)
    expect(upd.sql).toMatch(/paquete_composicion\s*=\s*null/)
  })

  it('borra el enlace vivo', async () => {
    await quitarPaquete('P1')
    expect(sql()).toMatch(/delete from paquete_aplicaciones/)
  })

  it('NO toca el descuento por volumen de las líneas', async () => {
    // Quitar el paquete tiene que devolver la venta EXACTAMENTE a como estaba,
    // y el volumen de cada línea nunca se borró: solo se dejó de aplicar.
    await quitarPaquete('P1')
    expect(sql()).not.toMatch(/descuento_volumen_pct/)
  })

  it('una propuesta APROBADA no se puede desempaquetar', async () => {
    filas.propuesta = [
      { id: 'P1', estatus: 'APROBADA', codigo_texto: null, paquete_nombre: 'Periferico' },
    ]
    await expect(quitarPaquete('P1')).rejects.toThrow(/aprobada/i)
  })

  it('sin paquete puesto devuelve `false`, no revienta', async () => {
    filas.propuesta = [
      { id: 'P1', estatus: 'BORRADOR', codigo_texto: null, paquete_nombre: null },
    ]
    await expect(quitarPaquete('P1')).resolves.toBe(false)
  })

  it('una propuesta de otra organización devuelve `false`', async () => {
    filas.propuesta = []
    await expect(quitarPaquete('P1')).resolves.toBe(false)
  })
})

describe('4 · TOPE-PAQ · quitar el paquete NO deja la venta por encima del tope', () => {
  // Con paquete, el volumen no cuenta contra el tope (PAQ-01): no se aplicó.
  // Por eso un vendedor puede guardar un 15 % comercial con un tope del 20 %
  // aunque las líneas lleven un 10 % de volumen. Al QUITAR el paquete ese
  // volumen vuelve a aplicarse, y la venta queda en 1 − 0,85 × 0,90 = 23,5 %
  // regalado contra un techo de 20. Antes de esta prueba nadie lo revisaba, y
  // la aprobación tampoco: se aprobaba y se congelaba por encima del tope.
  const conVolumen = (pct: number) =>
    SITIOS.map((s, i) => ({
      id: `I${i}`,
      sitio_id: s,
      precio: '10000.00',
      descuento_volumen_pct: String(pct),
    }))

  beforeEach(() => {
    topeDelTenant = 20
    filas.items = conVolumen(10)
    filas.propuesta = [
      {
        id: 'P1',
        estatus: 'BORRADOR',
        codigo_texto: null,
        paquete_nombre: 'Periferico',
        descuento_pct: '15.00',
        codigo_descuento_pct: null,
      },
    ]
  })

  it('se NIEGA si al volver el volumen el descuento compuesto pasa el tope', async () => {
    await expect(quitarPaquete('P1')).rejects.toBeInstanceOf(PaqueteImposible)
    await expect(quitarPaquete('P1')).rejects.toThrow(/20 %/)
  })

  it('y al negarse NO toca nada: ni el enlace ni las cinco columnas', async () => {
    await expect(quitarPaquete('P1')).rejects.toThrow()
    expect(sql()).not.toMatch(/delete from paquete_aplicaciones/)
    expect(sql()).not.toMatch(/update propuestas/)
    expect(sql()).toMatch(/rollback/)
  })

  it('el mensaje dice qué hacer: bajar el descuento comercial antes de quitarlo', async () => {
    await expect(quitarPaquete('P1')).rejects.toThrow(/baja.*descuento comercial/i)
  })

  it('SÍ lo quita si el compuesto cabe: 10 % comercial con 10 % de volumen = 19 %', async () => {
    filas.propuesta[0].descuento_pct = '10.00'
    await expect(quitarPaquete('P1')).resolves.toBe(true)
    expect(sql()).toMatch(/delete from paquete_aplicaciones/)
  })

  it('el límite es INCLUSIVO, como en la edición: exactamente el tope pasa', async () => {
    // 1 − 0,8 × 0,75 = 40 % justo; con tope 40 tiene que pasar.
    topeDelTenant = 40
    filas.items = conVolumen(25)
    filas.propuesta[0].descuento_pct = '20.00'
    await expect(quitarPaquete('P1')).resolves.toBe(true)
  })

  it('sin descuento comercial siempre se puede quitar, aunque el volumen solo pase el tope', async () => {
    // El volumen es la escala del dueño, no discreción del vendedor: con 0 %
    // comercial no hay nada que bajar, y la propuesta queda igual que una
    // recién creada con esas líneas (que `crearPropuesta` admite). Negarse
    // dejaría el paquete pegado sin salida desde la pantalla.
    topeDelTenant = 5
    filas.propuesta[0].descuento_pct = '0.00'
    await expect(quitarPaquete('P1')).resolves.toBe(true)
  })
})
