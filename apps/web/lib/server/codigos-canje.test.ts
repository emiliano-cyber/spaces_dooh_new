import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  COD-01 · EL CÓDIGO SE VALIDA Y SE APLICA ENTERAMENTE EN EL SERVIDOR.
//  ADR 0039, Fase 3.
// ----------------------------------------------------------------------------
//  ⚠️ ESTE ARCHIVO EXISTE POR EL HALLAZGO B40, y conviene que quede escrito.
//
//  La cadena de precio de la Fase 1 vive ENTERA en el navegador: `resolverTarifa`
//  solo se llama desde `app/(app)/(shell)/propuestas/page.tsx`, que es `'use
//  client'`, y `propuestas-controller.ts` copia la `tarifaUnitaria` del cuerpo
//  tal cual. Sobre eso **un cupón no se puede construir**: su vencimiento y su
//  tope de usos son un reloj y un contador, y un contador que vive en el
//  navegador no es un contador.
//
//  Esta fase NO arregla la Fase 1 —es la decisión D11, del dueño— pero nace del
//  lado correcto. Lo que estas pruebas fijan, y es lo que impide que se deshaga
//  sin querer:
//
//   · la pantalla manda EL CÓDIGO TECLEADO y nada más — ni el porcentaje, ni el
//     importe, ni un «ya validado»;
//   · el porcentaje sale de `codigos_promocionales`, leída bajo RLS;
//   · la vigencia la decide `current_date` DE POSTGRES, no `new Date()`;
//   · y el conteo de usos se hace CON LA FILA DEL CUPÓN YA BLOQUEADA, que es lo
//     único que resuelve la carrera del último uso.
// ============================================================================

const ejecutadas: string[] = []
const respuestas: Record<string, any[]> = {}
let confirmada = false
let revertida = false

function responder(sql: string): any[] {
  if (/from propuestas/.test(sql)) return respuestas.propuesta ?? []
  if (/from codigos_promocionales/.test(sql)) return respuestas.cupon ?? []
  if (/from canjes_codigo/.test(sql)) return respuestas.conteo ?? [{ n: 0 }]
  return []
}

const cliente = {
  query: vi.fn(async (sql: string, _params?: unknown[]) => {
    ejecutadas.push(sql)
    if (/^\s*commit/i.test(sql)) confirmada = true
    if (/^\s*rollback/i.test(sql)) revertida = true
    return { rows: responder(sql), rowCount: responder(sql).length }
  }),
  release: vi.fn(),
}

vi.mock('./db', () => ({
  q: vi.fn(async () => []),
  q1: vi.fn(async () => null),
  pool: { connect: vi.fn(async () => cliente) },
  fijarTenant: vi.fn(),
  fijarTenantExplicito: vi.fn(),
  qConTenant: vi.fn(async () => []),
  qRaw1: vi.fn(async () => null),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'T1') }))
vi.mock('./auth', () => ({ usuarioActual: vi.fn(async () => ({ id: 'U1' })) }))

const { canjearCodigo, CanjeImposible } = await import('./codigos-repo')

const CUPON = {
  id: 'C1',
  codigo: 'VERANO20',
  descuento_pct: 20,
  vigente_desde: '2026-09-01',
  vigente_hasta: '2026-09-30',
  usos_maximos: 3,
  hoy: '2026-09-15',
}

beforeEach(() => {
  ejecutadas.length = 0
  confirmada = false
  revertida = false
  cliente.query.mockClear()
  respuestas.propuesta = [{ estatus: 'BORRADOR', codigo_texto: null }]
  respuestas.cupon = [{ ...CUPON }]
  respuestas.conteo = [{ n: 0 }]
})

// ─── 1 · EL ORDEN DE LAS CONSULTAS ES LA SOLUCIÓN A LA CARRERA ─────────────

describe('1 · la carrera del último uso: el bloqueo va ANTES del conteo', () => {
  it('la lectura del cupón lleva `for update`', async () => {
    await canjearCodigo('P1', 'VERANO20')
    const lectura = ejecutadas.find((s) => /from codigos_promocionales/.test(s))
    expect(lectura, 'el cupón tiene que leerse con bloqueo de fila').toMatch(/for update/i)
  })

  it('SE BLOQUEA PRIMERO Y SE CUENTA DESPUÉS, y ése es todo el mecanismo', async () => {
    // Contar antes de bloquear sería el camino ingenuo con un `for update`
    // decorativo detrás: los dos vendedores leerían N−1 y los dos insertarían.
    await canjearCodigo('P1', 'VERANO20')
    const iBloqueo = ejecutadas.findIndex((s) => /for update/i.test(s))
    const iConteo = ejecutadas.findIndex((s) => /count\(\*\)[\s\S]*canjes_codigo/.test(s))
    expect(iBloqueo).toBeGreaterThanOrEqual(0)
    expect(iConteo).toBeGreaterThanOrEqual(0)
    expect(iBloqueo).toBeLessThan(iConteo)
  })

  it('todo ocurre dentro de UNA transacción, y se confirma al final', async () => {
    await canjearCodigo('P1', 'VERANO20')
    expect(ejecutadas[0]).toMatch(/begin/i)
    expect(confirmada).toBe(true)
    // El bloqueo no sirve de nada fuera de una transacción: se soltaría al
    // acabar la sentencia.
    const iBegin = ejecutadas.findIndex((s) => /begin/i.test(s))
    const iBloqueo = ejecutadas.findIndex((s) => /for update/i.test(s))
    expect(iBegin).toBeLessThan(iBloqueo)
  })

  it('el conteo se hace sobre `canjes_codigo` y NO sobre una columna contador', async () => {
    // No existe `usos_consumidos` en ningún sitio: el registro de canjes ES el
    // contador. Dos respuestas a la misma pregunta divergen, y un `on delete
    // cascade` desde `propuestas` desincronizaría la columna sin que se vea.
    await canjearCodigo('P1', 'VERANO20')
    const sqls = ejecutadas.join('\n')
    expect(sqls).toMatch(/count\(\*\)[\s\S]*canjes_codigo/)
    expect(sqls).not.toMatch(/usos_consumidos/)
  })
})

// ─── 2 · LA VIGENCIA Y EL RELOJ ────────────────────────────────────────────

describe('2 · el reloj es el de POSTGRES, no el de Node', () => {
  it('la vigencia se decide con `current_date` traído en la misma consulta', async () => {
    // Con `next dev`, `new Date()` correría en la máquina de quien desarrolla.
    // Y traerlo en la MISMA consulta que bloquea la fila es una sola lectura
    // del reloj, no dos que puedan cruzarse.
    await canjearCodigo('P1', 'VERANO20')
    const lectura = ejecutadas.find((s) => /from codigos_promocionales/.test(s))
    expect(lectura).toMatch(/current_date/)
  })

  it('un cupón VENCIDO no aplica, y no se escribe nada', async () => {
    respuestas.cupon = [{ ...CUPON, hoy: '2026-10-01' }]
    await expect(canjearCodigo('P1', 'VERANO20')).rejects.toThrow(CanjeImposible)
    expect(ejecutadas.some((s) => /insert into canjes_codigo/.test(s))).toBe(false)
    expect(ejecutadas.some((s) => /update propuestas[\s\S]*codigo_texto=/.test(s))).toBe(false)
    expect(revertida).toBe(true)
  })

  it('un cupón que TODAVÍA no empieza tampoco aplica', async () => {
    respuestas.cupon = [{ ...CUPON, hoy: '2026-08-31' }]
    await expect(canjearCodigo('P1', 'VERANO20')).rejects.toThrow(/todavia no/i)
  })
})

// ─── 3 · LOS CASOS NEGATIVOS, QUE AQUÍ SON EL CORAZÓN ──────────────────────

describe('3 · lo que el servidor RECHAZA', () => {
  it('un cupón AGOTADO no aplica', async () => {
    respuestas.conteo = [{ n: 3 }]
    await expect(canjearCodigo('P1', 'VERANO20')).rejects.toThrow(/ya se uso/i)
    expect(ejecutadas.some((s) => /insert into canjes_codigo/.test(s))).toBe(false)
  })

  it('con 2 de 3 todavía se puede: el tope es ESTRICTO', async () => {
    respuestas.conteo = [{ n: 2 }]
    const r = await canjearCodigo('P1', 'VERANO20')
    expect(r.descuentoPct).toBe(20)
  })

  it('UN CÓDIGO DE OTRA ORGANIZACIÓN «NO EXISTE» — y no se dice nada más', async () => {
    // La RLS lo deja fuera, así que la consulta no devuelve fila. El mensaje es
    // el mismo que el de un código inventado: decir «existe pero no es tuyo» ya
    // cuenta algo de la otra empresa (R2).
    respuestas.cupon = []
    await expect(canjearCodigo('P1', 'DE-OTRA-EMPRESA')).rejects.toThrow(/no existe/i)
  })

  it('la consulta del cupón lleva `tenant_id`: segunda capa sobre la RLS', async () => {
    await canjearCodigo('P1', 'VERANO20')
    const lectura = ejecutadas.find((s) => /from codigos_promocionales/.test(s))
    expect(lectura).toMatch(/tenant_id\s*=\s*\$1/)
  })

  it('EL MISMO CÓDIGO NO SE CUENTA DOS VECES en la misma propuesta', async () => {
    respuestas.propuesta = [{ estatus: 'BORRADOR', codigo_texto: 'VERANO20' }]
    await expect(canjearCodigo('P1', 'VERANO20')).rejects.toThrow(/ya tiene el codigo/i)
    expect(ejecutadas.some((s) => /insert into canjes_codigo/.test(s))).toBe(false)
  })

  it('una propuesta YA APROBADA es inmutable: no admite cupón', async () => {
    respuestas.propuesta = [{ estatus: 'APROBADA', codigo_texto: null }]
    await expect(canjearCodigo('P1', 'VERANO20')).rejects.toThrow(/inmutable/i)
    // Y ni siquiera se llega a bloquear el cupón: no se le retiene un uso a una
    // promoción por un intento que no podía prosperar.
    expect(ejecutadas.some((s) => /for update/i.test(s))).toBe(false)
  })

  it('una propuesta de otra organización no existe', async () => {
    respuestas.propuesta = []
    await expect(canjearCodigo('P1', 'VERANO20')).rejects.toThrow(/no existe/i)
  })
})

// ─── 4 · EL CONGELADO Y LA NORMALIZACIÓN ───────────────────────────────────

describe('4 · lo que se escribe al canjear', () => {
  it('el porcentaje que se congela sale del CUPÓN, no de ningún argumento', async () => {
    respuestas.cupon = [{ ...CUPON, descuento_pct: 35 }]
    const r = await canjearCodigo('P1', 'VERANO20')
    expect(r.descuentoPct).toBe(35)
    const upd = ejecutadas.find((s) => /update propuestas[\s\S]*codigo_texto=/.test(s))
    expect(upd).toBeTruthy()
  })

  it('el texto, el porcentaje y el MOMENTO se escriben juntos', async () => {
    // El CHECK `propuestas_codigo_pareja_ck` rechaza dejar uno sin los otros.
    await canjearCodigo('P1', 'VERANO20')
    const upd = ejecutadas.find((s) => /update propuestas[\s\S]*codigo_texto=/.test(s)) ?? ''
    expect(upd).toMatch(/codigo_descuento_pct/)
    expect(upd).toMatch(/codigo_canjeado_en\s*=\s*now\(\)/)
  })

  it('el código se busca SIN distinguir mayúsculas', async () => {
    // Un cupón se dice de viva voz o se pega de un correo: nadie teclea
    // `VERANO20` exactamente.
    const r = await canjearCodigo('P1', '  verano20  ')
    expect(r.codigo).toBe('VERANO20')
    const lectura = ejecutadas.find((s) => /from codigos_promocionales/.test(s))
    expect(lectura).toMatch(/upper\(codigo\)\s*=\s*upper\(\$2\)/)
  })
})

// ─── 5 · EL CANDADO: LA PANTALLA NO PUEDE MANDAR EL PORCENTAJE ─────────────

describe('5 · EL CANDADO — el esquema de entrada solo admite el código', () => {
  const fuente = readFileSync(join(__dirname, 'codigos-controller.ts'), 'utf8')

  /**
   * El trozo del archivo que declara el esquema del CANJE, y solo ése.
   *
   * Se recorta a propósito en vez de mirar el archivo entero: `toContain` sobre
   * todo el texto casaría con un comentario o con el esquema de CAPTURA —que sí
   * declara `descuentoPct`, y debe hacerlo—. Es el modo de fallo número uno de
   * la tabla de mutación, y ya costó cinco veces en este repositorio.
   */
  const canjeSchema = (() => {
    const i = fuente.indexOf('const canjeSchema')
    expect(i, 'no se encontró `const canjeSchema` en codigos-controller.ts').toBeGreaterThan(-1)
    // El ancla tiene que ser ÚNICA, o este recorte podría estar mirando otra
    // declaración y la prueba pasaría por el motivo equivocado.
    expect(
      fuente.split('const canjeSchema').length - 1,
      '`const canjeSchema` tiene que aparecer UNA sola vez',
    ).toBe(1)
    return fuente.slice(i, fuente.indexOf('})', i) + 2)
  })()

  it('el esquema del canje NO declara el porcentaje', () => {
    expect(canjeSchema, 'el canje no puede aceptar el porcentaje del cupón').not.toMatch(
      /descuentoPct/,
    )
    expect(canjeSchema).not.toMatch(/porcentaje/i)
  })

  it('tampoco el importe, ni un «ya validado», ni el id del cupón', () => {
    expect(canjeSchema).not.toMatch(/importe/i)
    expect(canjeSchema).not.toMatch(/monto/i)
    expect(canjeSchema).not.toMatch(/validado/i)
    expect(canjeSchema).not.toMatch(/codigoId/)
  })

  it('declara EXACTAMENTE un campo, y es `codigo`', () => {
    expect(canjeSchema).toMatch(/codigo:\s*z\.string\(\)/)
    // Un solo campo `nombre: z.…` dentro del objeto. Si alguien añade otro,
    // esto cae — y ése es justo el cambio que reabriría el agujero.
    const campos = canjeSchema.match(/\w+\s*:\s*z\./g) ?? []
    expect(campos).toHaveLength(1)
  })

  it('y `canjearCodigo` recibe solo dos argumentos: la propuesta y el código', () => {
    // El candado del TIPO, que es el que no se puede olvidar. Si algún día
    // alguien le añadiera un tercer argumento con el porcentaje, esto no
    // compilaría — y mientras tanto lo deja escrito.
    expect(canjearCodigo.length).toBe(2)
  })
})
