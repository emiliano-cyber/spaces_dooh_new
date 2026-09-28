import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  El SQL de la escala de volumen: qué consulta sale de verdad.
// ----------------------------------------------------------------------------
//  Las pruebas del controller mockean el repo entero y no ven una línea de este
//  SQL. Aquí se mockea `./db` y SE MIRAN LAS CONSULTAS, que es el único plano
//  donde se puede fijar lo que R2 exige: el `and tenant_id = $n` como segunda
//  capa sobre la RLS en toda operación por id, y que el tenant salga SIEMPRE de
//  la sesión y nunca del argumento.
//
//  Por qué importa especialmente aquí: el modo de fallo de R2 NO DA ERROR. Leer
//  la escala sin contexto de tenant devuelve cero filas en silencio, y cero
//  tramos no significa «error», significa «esta organización no descuenta por
//  volumen» — o sea, se cobra el precio entero. Nadie ve un fallo: se ve una
//  venta más cara, y quien la pierde no vuelve a preguntar por qué.
// ============================================================================

const consultas: { sql: string; params: unknown[] }[] = []

const db = {
  q: vi.fn(async (sql: string, params?: unknown[]) => {
    consultas.push({ sql, params: params ?? [] })
    return []
  }),
  q1: vi.fn(async (sql: string, params?: unknown[]): Promise<any> => {
    consultas.push({ sql, params: params ?? [] })
    return null
  }),
}
vi.mock('./db', () => db)
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'T1') }))

// `mockResolvedValueOnce` SUSTITUYE la implementación, así que esa llamada no
// pasa por el grabador de `consultas`. Las consultas se leen entonces de las
// llamadas del propio mock — que es la fuente de verdad en los dos casos.
const llamadas = (m: { mock: { calls: unknown[][] } }) =>
  m.mock.calls.map((c) => ({ sql: String(c[0]), params: (c[1] as unknown[]) ?? [] }))

const { listarEscalasVolumen, guardarTramoVolumen, borrarTramoVolumen } =
  await import('./volumen-repo')

beforeEach(() => {
  consultas.length = 0
  db.q.mockClear()
  db.q1.mockClear()
})

describe('listarEscalasVolumen', () => {
  it('lee bajo RLS y pide los tramos ordenados por unidad y umbral', async () => {
    await listarEscalasVolumen()
    expect(consultas).toHaveLength(1)
    expect(consultas[0].sql).toMatch(/from escalas_volumen/)
    expect(consultas[0].sql).toMatch(/order by\s+unidad asc,\s*desde_cantidad asc/)
  })

  it('NO acepta ningun tenant por argumento: la firma no lo admite', async () => {
    // El candado es el tipo, igual que con el vendedor de la propuesta. Si algún
    // día alguien le añade un parámetro de tenant, esta línea deja de compilar.
    expect(listarEscalasVolumen.length).toBe(0)
  })

  it('convierte numeric de Postgres a numero: `pg` devuelve "10.00" como cadena', async () => {
    db.q.mockResolvedValueOnce([
      { id: 'a', unidad: 'spot', desde_cantidad: '50', descuento_pct: '10.00' },
    ] as never)
    const filas = await listarEscalasVolumen()
    expect(filas).toEqual([{ id: 'a', unidad: 'spot', desdeCantidad: 50, descuentoPct: 10 }])
  })
})

describe('guardarTramoVolumen', () => {
  it('en el ALTA el tenant sale de la sesion, no del argumento', async () => {
    db.q1.mockResolvedValueOnce({
      id: 'n', unidad: 'spot', desde_cantidad: 50, descuento_pct: 10,
    } as never)
    await guardarTramoVolumen({ unidad: 'spot', desdeCantidad: 50, descuentoPct: 10 })
    const ins = llamadas(db.q1).find((c) => /insert into escalas_volumen/.test(c.sql))
    expect(ins, 'tiene que haber un insert').toBeTruthy()
    expect(ins!.params[0]).toBe('T1')
  })

  it('la EDICION lleva `and tenant_id = $n`: la segunda capa sobre la RLS', async () => {
    db.q1.mockResolvedValueOnce({
      id: 'x', unidad: 'spot', desde_cantidad: 80, descuento_pct: 12,
    } as never)
    await guardarTramoVolumen({ id: 'x', unidad: 'spot', desdeCantidad: 80, descuentoPct: 12 })
    const upd = llamadas(db.q1).find((c) => /update escalas_volumen/.test(c.sql))
    expect(upd, 'tiene que haber un update').toBeTruthy()
    expect(upd!.sql).toMatch(/where id = \$1 and tenant_id = \$2/)
    expect(upd!.params[1]).toBe('T1')
  })

  it('editar un tramo de OTRA organizacion no encuentra fila y devuelve null', async () => {
    db.q1.mockResolvedValueOnce(null as never)
    expect(await guardarTramoVolumen({ id: 'ajeno', unidad: 'spot', desdeCantidad: 50, descuentoPct: 10 }))
      .toBeNull()
  })
})

describe('borrarTramoVolumen', () => {
  it('borra DE VERDAD (no hay baja logica) y con la segunda capa de tenant', async () => {
    // Un tramo no es un hecho contratado: el item copia el porcentaje y el
    // umbral, así que nada lo referencia y un borrado no pierde historia. Una
    // baja lógica aquí, con el unique sobre el umbral, impediría volver a crear
    // el tramo de 50 mientras existiera el de 50 apagado.
    db.q1.mockResolvedValueOnce({ id: 'x' } as never)
    expect(await borrarTramoVolumen('x')).toBe(true)
    const del = llamadas(db.q1).find((c) => /delete from escalas_volumen/.test(c.sql))
    expect(del, 'tiene que ser un delete, no un update de `activo`').toBeTruthy()
    expect(del!.sql).toMatch(/where id = \$1 and tenant_id = \$2/)
    expect(del!.params).toEqual(['x', 'T1'])
  })

  it('borrar uno ajeno devuelve false, no revienta', async () => {
    db.q1.mockResolvedValueOnce(null as never)
    expect(await borrarTramoVolumen('ajeno')).toBe(false)
  })
})
