import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PoolClient } from 'pg'

// ============================================================================
//  tickets-repo — el archivo mezcla `q` (cliente, con tenant) y `qRaw` (panel,
//  sin tenant) A PROPOSITO (ADR 0038). Es la zona roja R2: su modo de fallo NO
//  da error — devuelve cero filas en silencio, o las de otra organizacion.
//
//  Por eso estas pruebas no miran resultados: miran POR QUE CAMINO salio cada
//  consulta (mock de `./db` que etiqueta cada llamada como `q`/`client`
//  —tenant fijado— o `qRaw` —sin fijar—) y que texto lleva el SQL. Es el mismo
//  patron que `entidades-repo.test.ts`, doblado: alli solo existe el lado
//  `q`/`q1`; aqui hay que mockear y clasificar LOS DOS estilos porque el
//  archivo los usa los dos a proposito.
//
//  Lo que SI puede demostrar una unitaria (que el filtro este ESCRITO, que es
//  justo lo que fallo las dos veces reales: `qRaw` donde tocaba `q`) esta aqui.
//  Que la RLS corte de verdad con el rol de la app lo prueba
//  `aislamiento.e2e.test.ts`, que NO se toca.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const TENANT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const TICKET = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

type Via = 'q' | 'qRaw' | 'client'
let consultas: { sql: string; params: unknown[]; via: Via }[] = []

function filaTicket(extra: Record<string, unknown> = {}) {
  return {
    id: TICKET,
    tenant_id: TENANT,
    folio: 'TK-2026-0001',
    asunto: 'No enciende la pantalla',
    cuerpo: 'La pantalla de Insurgentes 123 no prende desde ayer.',
    estado: 'ABIERTO',
    prioridad: 'NORMAL',
    creado_por_usuario: null,
    creado_en: new Date('2026-09-23T00:00:00Z'),
    actualizado_en: new Date('2026-09-23T00:00:00Z'),
    respuesta: null,
    respondido_en: null,
    ...extra,
  }
}

// El ticket que "hay en la base" para esta prueba. `null` = no existe.
//
// NO es decorado: sin el, el doble devolvia una fila para CUALQUIER `update`,
// asi que una prueba de «un ticket CERRADO no se puede tocar» habria pasado
// igual con el guard puesto y sin el -- no demostraria nada. Con esto, el
// doble evalua el `where` como lo evaluaria Postgres: la fila solo se toca si
// la sentencia la SELECCIONA de verdad.
let ticketEnBase: any = filaTicket()

// Responde con datos plausibles segun la tabla que toque la consulta — el
// mock no es una base de datos, solo necesita devolver una forma valida para
// que el repo pueda mapear la fila.
function responder(sql: string): { rows: any[]; rowCount: number } {
  if (/insert into tickets/.test(sql)) return { rows: [filaTicket()], rowCount: 1 }
  if (/update tickets/.test(sql)) {
    if (!ticketEnBase) return { rows: [], rowCount: 0 }
    // El guard del ticket cerrado, evaluado como lo haria la base: si la
    // sentencia lo trae y la fila esta CERRADA, no se actualiza nada.
    if (/estado\s*<>\s*'CERRADO'/.test(sql) && ticketEnBase.estado === 'CERRADO') {
      return { rows: [], rowCount: 0 }
    }
    return {
      rows: [{ ...ticketEnBase, respuesta: 'Ya se reviso, era el fusible.', respondido_en: new Date() }],
      rowCount: 1,
    }
  }
  if (/from tickets/.test(sql)) {
    return ticketEnBase ? { rows: [ticketEnBase], rowCount: 1 } : { rows: [], rowCount: 0 }
  }
  return { rows: [], rowCount: 0 }
}

// `via` etiqueta CADA llamada capturada con el camino real por el que salio:
// `q` (tenant fijado por `q()`), `client` (tenant fijado por `withTenantTx`
// ANTES de entrar al callback: mismo aislamiento que `q`, otra forma de
// escribirlo) o `qRaw` (sin fijar nada). Es lo que permite que las pruebas de
// abajo digan POR QUE CAMINO salio una consulta y no solo QUE SQL trae.
function anotar(via: Via) {
  return async (sql: string, params: unknown[] = []) => {
    const r = responder(sql)
    consultas.push({ sql, params, via })
    return r
  }
}

const clienteTx = { query: (sql: string, params?: unknown[]) => anotar('client')(sql, params ?? []) } as unknown as PoolClient

vi.mock('./db', () => ({
  q: vi.fn(async (sql: string, params?: unknown[]) => (await anotar('q')(sql, params ?? [])).rows),
  q1: vi.fn(async (sql: string, params?: unknown[]) => (await anotar('q')(sql, params ?? [])).rows[0] ?? null),
  qRaw: vi.fn(async (sql: string, params?: unknown[]) => (await anotar('qRaw')(sql, params ?? [])).rows),
  qRaw1: vi.fn(async (sql: string, params?: unknown[]) => (await anotar('qRaw')(sql, params ?? [])).rows[0] ?? null),
  pool: { connect: vi.fn() },
  fijarTenant: vi.fn(),
  // El tenant ya viene fijado ANTES de entrar aqui (igual que en produccion):
  // por eso el `client.query` de dentro se etiqueta `client` y no `qRaw` — es
  // tenant-scoped, solo que escrito con el client de la transaccion en vez de
  // con la funcion `q()`.
  withTenantTx: async (fn: (c: PoolClient) => Promise<unknown>) => fn(clienteTx),
}))
vi.mock('./tenant', () => ({ tenantActual: async () => TENANT }))
vi.mock('./folios', () => ({ folioDocumento: vi.fn(async () => 'TK-2026-0001') }))

const repo = await import('./tickets-repo')

const sqlDe = (patron: RegExp) => consultas.find((c) => patron.test(c.sql))
const deTickets = () => consultas.filter((c) => /\btickets\b/.test(c.sql))
const delCliente = () => deTickets().filter((c) => c.via === 'q' || c.via === 'client')
const delPanel = () => deTickets().filter((c) => c.via === 'qRaw')

beforeEach(() => {
  consultas = []
  ticketEnBase = filaTicket()
})

describe('el lado del cliente aisla — q/client, con tenant explicito', () => {
  it('el lado del cliente usa q (con tenant), no qRaw', async () => {
    await repo.listarTicketsDelTenant()
    await repo.crearTicket({ asunto: 'a', cuerpo: 'b' })

    const cliente = delCliente()
    expect(cliente.length, 'listarTicketsDelTenant y crearTicket no dispararon ninguna consulta').toBeGreaterThan(0)
    // Ninguna de las dos operaciones del cliente pasó por qRaw.
    expect(delPanel().length, 'una operacion del cliente uso qRaw').toBe(0)
    // Y el tenant de la sesion viaja en los parametros de cada una: es la
    // prueba de que el GUC se fijo con ESTE tenant y no con otro.
    for (const c of cliente) {
      expect(c.params, `consulta del cliente sin el tenant en los parametros:\n${c.sql}`).toContain(TENANT)
    }
  })

  it('toda lectura por id lleva "and tenant_id = $n"', async () => {
    // El archivo NO tiene, hoy, ninguna lectura del CLIENTE acotada por `id`:
    // `listarTicketsDelTenant` lista por tenant (ya trae la `respuesta`, así
    // que no hace falta un detalle por id) y `crearTicket` inserta. La UNICA
    // consulta por `id` de todo el archivo es la del panel
    // (`responderTicket`), y esa esta EXENTA a proposito — lo prueba el
    // bloque de abajo, no este.
    //
    // Este guard es el que se pone rojo el dia que alguien AÑADA una lectura
    // por id del lado del cliente sin `tenant_id`: sin el, ese hueco pasaria
    // en silencio hasta las e2e (o hasta produccion).
    await repo.listarTicketsDelTenant()
    await repo.crearTicket({ asunto: 'a', cuerpo: 'b' })

    const cliente = delCliente()
    expect(cliente.length).toBeGreaterThan(0)
    for (const c of cliente) {
      const soloId = /\bid\s*=\s*\$\d/.test(c.sql) && !/tenant_id\s*=\s*\$\d/.test(c.sql)
      expect(soloId, `consulta del cliente acotada solo por id, sin tenant_id:\n${c.sql}`).toBe(false)
      if (/\bid\s*=\s*\$\d/.test(c.sql)) {
        expect(c.sql, `lectura por id sin "tenant_id = $n":\n${c.sql}`).toMatch(/tenant_id\s*=\s*\$\d/)
      }
    }
    // Control positivo distinto: las DOS consultas del cliente sí llevan
    // `tenant_id` explícito como segunda capa, aunque ninguna sea "por id".
    for (const c of cliente) {
      expect(c.sql, `consulta del cliente sin tenant_id:\n${c.sql}`).toMatch(/tenant_id/)
    }
  })
})

describe('el lado del panel atraviesa — qRaw, sin tenant, a proposito', () => {
  it('el lado del panel usa qRaw a proposito y NO filtra por tenant', async () => {
    await repo.listarTicketsDeLaInstancia()
    await repo.actualizarTicketDesdePanel(TICKET, { respuesta: 'Ya se reviso, era el fusible.' })

    const panel = delPanel()
    expect(panel.length, 'listarTicketsDeLaInstancia y actualizarTicketDesdePanel no dispararon ninguna consulta').toBeGreaterThan(0)
    expect(delCliente().length, 'una operacion del panel uso q/withTenantTx').toBe(0)
    for (const c of panel) {
      expect(c.sql, `consulta del panel filtrando por tenant_id:\n${c.sql}`).not.toMatch(/tenant_id\s*=\s*\$/)
      expect(c.params, 'el tenant de la sesion se colo en una consulta del panel').not.toContain(TENANT)
    }
    // Y la de actualizar SI es por id — es la excepcion documentada, no un
    // descuido: el panel identifica el ticket por su id y cruza cualquier
    // organizacion a proposito.
    const upd = sqlDe(/update tickets/)!
    expect(upd, 'actualizarTicketDesdePanel no actualizo tickets').toBeDefined()
    expect(upd.sql).toMatch(/\bid\s*=\s*\$\d/)
  })

  it('el lado del panel NO selecciona tenants.nombre', async () => {
    await repo.listarTicketsDeLaInstancia()
    await repo.actualizarTicketDesdePanel(TICKET, { respuesta: 'Ya se reviso, era el fusible.' })

    for (const c of delPanel()) {
      expect(c.sql, `el panel selecciona tenants.nombre:\n${c.sql}`).not.toMatch(/tenants\s*\.\s*nombre/i)
      expect(c.sql, `el panel hace join contra tenants:\n${c.sql}`).not.toMatch(/join\s+tenants\b/i)
    }
  })
})

// ============================================================================
//  Tarea 11 · actualizarTicketDesdePanel — escribe SOLO lo que llega.
// ----------------------------------------------------------------------------
//  El modo de fallo que esto evita no es de aislamiento (eso ya lo cubre el
//  bloque de arriba): es que un PATCH que solo mueve el estado deje creer, en
//  la pantalla, que AS OOH ya contesto sin haber escrito una palabra. Por eso
//  estas pruebas miran el TEXTO del SQL generado -- que columna entro al
//  `set` y cual no -- y no solo la fila que el mock devuelve.
// ============================================================================
describe('actualizarTicketDesdePanel · escribe solo lo que llega', () => {
  it('con estado y sin respuesta, no toca respondido_en', async () => {
    await repo.actualizarTicketDesdePanel(TICKET, { estado: 'RESUELTO' })

    const upd = sqlDe(/update tickets/)!
    expect(upd, 'actualizarTicketDesdePanel no actualizo tickets').toBeDefined()
    expect(upd.sql, `un PATCH solo de estado toco respondido_en:\n${upd.sql}`).not.toMatch(/respondido_en/)
    expect(upd.sql).toMatch(/\bestado\s*=\s*\$\d/)
    expect(upd.sql, 'un PATCH solo de estado escribio la columna respuesta').not.toMatch(/\brespuesta\s*=\s*\$\d/)
  })

  it('con respuesta, fija respondido_en', async () => {
    await repo.actualizarTicketDesdePanel(TICKET, { respuesta: 'Ya se reviso, era el fusible.' })

    const upd = sqlDe(/update tickets/)!
    expect(upd, 'actualizarTicketDesdePanel no actualizo tickets').toBeDefined()
    expect(upd.sql).toMatch(/\brespuesta\s*=\s*\$\d/)
    expect(upd.sql, 'una respuesta no fijo respondido_en').toMatch(/respondido_en\s*=\s*now\(\)/)
    // Y responder NO mueve el estado por su cuenta (ruling de la Tarea 3):
    // ninguna columna `estado` en el `set` cuando solo llego `respuesta`.
    //
    // OJO CON ESTA REGEX, que ya se colo una vez. Decia `estado\s*=\s*\$\d`, o
    // sea que solo cazaba la asignacion POR PARAMETRO. Un mutante que ponia
    // `estado = 'RESUELTO'` LITERAL pasaba las 31 unitarias Y las 16 e2e:
    // medido el 23/09. La regla mas repetida del ADR estaba escrita en tres
    // sitios y vigilada en ninguno. Se compara contra CUALQUIER asignacion.
    expect(upd.sql, 'responder movio el estado sin que nadie lo pidiera').not.toMatch(/\bestado\s*=/)
  })

  it('con las dos cosas, escribe las dos -- pero cada una en su propio set', async () => {
    await repo.actualizarTicketDesdePanel(TICKET, { respuesta: 'Se cambio el driver.', estado: 'RESUELTO' })

    const upd = sqlDe(/update tickets/)!
    expect(upd.sql).toMatch(/\brespuesta\s*=\s*\$\d/)
    expect(upd.sql).toMatch(/respondido_en\s*=\s*now\(\)/)
    expect(upd.sql).toMatch(/\bestado\s*=\s*\$\d/)
  })

  it('sin ningun campo, no arma un update vacio: revienta antes de tocar la base', async () => {
    await expect(repo.actualizarTicketDesdePanel(TICKET, {})).rejects.toThrow()
    expect(delPanel().length, 'un PATCH vacio disparo una consulta contra la base').toBe(0)
  })
})

// ============================================================================
//  Un ticket CERRADO no se puede tocar.
// ----------------------------------------------------------------------------
//  Hasta hoy el panel escribia `update tickets ... where id = $1` y nada mas:
//  un ticket cerrado admitia respuesta nueva y cambio de estado igual que uno
//  abierto. CERRADO es el unico estado terminal --- «esta conversacion se
//  acabo»--- y si se puede seguir escribiendo en el no significa nada.
//
//  El guard va en el `where` DEL PROPIO UPDATE y no en un lee-y-luego-escribe:
//  una sola sentencia, sin ventana entre la comprobacion y la escritura. Lo que
//  si hace falta es distinguir «no existe» (404) de «esta cerrado» (409), y eso
//  se resuelve con UNA lectura que solo ocurre cuando el update no toco nada
//  --- el camino feliz sigue costando una sola ida a la base.
//
//  RESUELTO NO se bloquea, y es una decision, no un olvido: «resuelto» es una
//  hipotesis de AS OOH, y el cliente puede volver con un «pues sigue pasando».
//  Bloquearlo dejaria el panel sin forma de corregir una resolucion prematura.
// ============================================================================
describe('actualizarTicketDesdePanel · un ticket CERRADO no se toca', () => {
  it('mover el estado de uno CERRADO no escribe nada, y no se finge que si', async () => {
    ticketEnBase = filaTicket({ estado: 'CERRADO' })
    await expect(
      repo.actualizarTicketDesdePanel(TICKET, { estado: 'ABIERTO' }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('responder uno CERRADO tampoco', async () => {
    ticketEnBase = filaTicket({ estado: 'CERRADO' })
    await expect(
      repo.actualizarTicketDesdePanel(TICKET, { respuesta: 'Una respuesta mas' }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('el guard va en el WHERE del propio update, no en un lee-y-luego-escribe', async () => {
    ticketEnBase = filaTicket({ estado: 'CERRADO' })
    await expect(repo.actualizarTicketDesdePanel(TICKET, { estado: 'ABIERTO' })).rejects.toThrow()

    const upd = sqlDe(/update tickets/)!
    expect(upd, 'actualizarTicketDesdePanel no llego a emitir el update').toBeDefined()
    expect(upd.sql, `el guard no esta en el where:\n${upd.sql}`).toMatch(
      /where[\s\S]*estado\s*<>\s*'CERRADO'/,
    )
  })

  it('el camino feliz sigue costando UNA sola sentencia contra la base', async () => {
    await repo.actualizarTicketDesdePanel(TICKET, { estado: 'RESUELTO' })
    expect(delPanel().length, 'el guard metio una lectura extra en el camino feliz').toBe(1)
  })

  it('un ticket RESUELTO SI admite cambios: se bloquea CERRADO y solo CERRADO', async () => {
    ticketEnBase = filaTicket({ estado: 'RESUELTO' })
    const t = await repo.actualizarTicketDesdePanel(TICKET, { respuesta: 'Sigue pasando, lo reabrimos' })
    expect(t, 'un RESUELTO se bloqueo como si fuera CERRADO').not.toBeNull()
  })

  it('un id que no existe sigue siendo null (404), no el 409 del cerrado', async () => {
    ticketEnBase = null
    expect(await repo.actualizarTicketDesdePanel(TICKET, { estado: 'RESUELTO' })).toBeNull()
  })
})
