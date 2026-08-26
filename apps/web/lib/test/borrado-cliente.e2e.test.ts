import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  CRUD-01 · no había forma de borrar un cliente.
// ----------------------------------------------------------------------------
//  La auditoría del 2026-08-26 dejó diez clientes de prueba que nadie podía
//  quitar: `/api/clientes` solo exportaba POST y `/api/clientes/[id]` solo
//  PATCH. El borrado es REAL (la fila se va, no se archiva).
//
//  Por qué esto TIENE que ser e2e y no unitario: la mitad de la protección la
//  pone el ESQUEMA, y un mock no tiene claves foráneas. El censo de lo que
//  apunta a `clientes(id)` da CINCO restricciones, y CUATRO bloquean:
//
//    · campanas.cliente_id             not null · on delete restrict
//    · facturas.cliente_id             not null · on delete restrict
//    · clientes.agencia_id             (autorreferencia) · sin `on delete` → NO ACTION
//    · propuestas.agencia_id           sin `on delete`   → NO ACTION
//    · propuestas.cliente_id           on delete SET NULL ← no bloquea: deja huérfanas
//
//  Las dos de `agencia_id` las añadió `20260625_agencia_en_propuesta.sql` sin
//  cláusula `on delete`, así que Postgres las dejó en NO ACTION —que bloquea
//  igual que un RESTRICT—. No estaban en el hallazgo y son la mitad de los
//  casos de bloqueo reales: `propuestas-repo.ts:449-451` escribe
//  `clientes.agencia_id` cada vez que se crea una propuesta con cliente Y
//  agencia, así que una agencia en uso es lo normal, no un caso raro.
//
//  Y el caso que no falla pero duele: `propuestas.cliente_id` es SET NULL. La
//  propuesta sobrevive sin dueño, su liga pública sigue abierta y su IVA pasa
//  a tomar el 16 por omisión (`propuestas-repo.ts:65`) en vez del del cliente
//  — o sea que el documento cambia de precio al borrar. Por eso no se hace en
//  silencio: se cuenta y se pide confirmación.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let ajena: Awaited<ReturnType<typeof sembrarTenant>>
let c: Cliente
let ajeno: Cliente
// Un usuario CON sesión pero SIN `comercial:crear`, para el caso de permisos.
let mirón: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('borracli')
  ajena = await sembrarTenant('borracliajena')
  // OPERACIONES no tiene `comercial:crear` en la rejilla de `asegurarPermisos`:
  // es el rol con el que se comprueba que el guard existe de verdad.
  await sembrarTenant('borraclimiron', { rol: 'OPERACIONES' })
  await arrancarServidor()
  c = new Cliente()
  await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
  ajeno = new Cliente()
  await ajeno.entrar(ajena.usuarioEmail, PASSWORD_DEMO)
  mirón = new Cliente()
  await mirón.entrar('duenio@borraclimiron.test', PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

beforeEach(async () => {
  // Se limpia todo lo que las pruebas cuelgan de un cliente, en orden de
  // dependencia. Los clientes que siembra `sembrarTenant` se conservan.
  const p = poolTest()
  await p.query(`delete from facturas`)
  await p.query(`delete from campanas`)
  await p.query(`delete from propuestas`)
  await p.query(`update clientes set agencia_id = null`)
  await p.query(`delete from clientes where nombre not like 'Cliente %'`)
})

const borrar = (id: string, cuerpo?: Record<string, unknown>) =>
  c.pedir(`/api/clientes/${id}/`, { metodo: 'DELETE', cuerpo })

// Alta por HTTP; devuelve el id ya creado.
async function altaCliente(nombre: string, extra: Record<string, unknown> = {}): Promise<string> {
  const r = await c.pedir('/api/clientes/', { cuerpo: { nombre, ...extra } })
  expect(r.status, JSON.stringify(r.datos)).toBe(201)
  return r.datos.id
}

const existe = async (id: string): Promise<boolean> =>
  (await poolTest().query('select 1 from clientes where id = $1', [id])).rowCount === 1

async function sembrarCampana(clienteId: string, folio: string): Promise<string> {
  const { rows } = await poolTest().query(
    `insert into campanas (folio, nombre, cliente_id, fecha_inicio, fecha_fin, tenant_id)
     values ($1,$2,$3,$4,$5,$6) returning id`,
    [folio, `Campaña ${folio}`, clienteId, enDias(-5), enDias(30), org.id],
  )
  return rows[0].id
}

// `facturas.campana_id` es NOT NULL y además ÚNICO (`facturas_campana_uq`):
// una factura siempre cuelga de una campaña, y cada campaña tiene como mucho
// una. Dos consecuencias que conviene tener presentes al leer estas pruebas:
//
//   · no existe el estado «cliente con facturas pero sin campañas», así que la
//     factura NUNCA es el único motivo de bloqueo — la campaña que la sostiene
//     bloquea también;
//   · el número de facturas nunca puede pasar del de campañas, y por eso aquí
//     hacen falta tres campañas para llegar a tres facturas.
async function sembrarFactura(clienteId: string, campanaId: string, folio: string): Promise<void> {
  await poolTest().query(
    `insert into facturas (folio, campana_id, cliente_id, monto, tenant_id)
     values ($1,$2,$3,1000,$4)`,
    [folio, campanaId, clienteId, org.id],
  )
}

// ─── El caso que debe funcionar ─────────────────────────────────────────────

describe('1 · un cliente limpio se borra DE VERDAD', () => {
  it('responde 200 y la fila desaparece de la base', async () => {
    const id = await altaCliente('Para borrar')
    expect(await existe(id)).toBe(true)

    const r = await borrar(id)
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    // Borrado real, no archivado: la fila NO está, ni siquiera con activo=false.
    expect(await existe(id)).toBe(false)
  })

  it('el mismo borrado dos veces es 404 la segunda, no 200', async () => {
    const id = await altaCliente('Borrar dos veces')
    expect((await borrar(id)).status).toBe(200)
    expect((await borrar(id)).status).toBe(404)
  })

  it('un id que no existe es 404', async () => {
    const r = await borrar('00000000-0000-0000-0000-000000000000')
    expect(r.status).toBe(404)
  })

  it('un id que ni siquiera es un uuid es 400, no un 500 del driver', async () => {
    const r = await borrar('no-soy-un-uuid')
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
  })
})

// ─── Lo que la BASE impide: 409 con cifras, y la fila intacta ───────────────

describe('2 · con facturas NO se borra', () => {
  it('responde 409, dice cuántas, y el cliente SIGUE ahí', async () => {
    const id = await altaCliente('Con facturas')
    for (let i = 1; i <= 3; i++) {
      await sembrarFactura(id, await sembrarCampana(id, `C-FACT-${i}`), `F-BORRA-${i}`)
    }

    const r = await borrar(id)
    expect(r.status, JSON.stringify(r.datos)).toBe(409)
    expect(r.datos.error).toContain('3 factura')
    // Lo que de verdad importa del caso negativo: NO se borró nada.
    expect(await existe(id)).toBe(true)
    expect(
      (await poolTest().query('select 1 from facturas where cliente_id = $1', [id])).rowCount,
    ).toBe(3)
  })
})

describe('3 · con campañas NO se borra', () => {
  it('responde 409, dice cuántas, y el cliente SIGUE ahí', async () => {
    const id = await altaCliente('Con campanas')
    for (let i = 1; i <= 2; i++) {
      await poolTest().query(
        `insert into campanas (folio, nombre, cliente_id, fecha_inicio, fecha_fin, tenant_id)
         values ($1,$2,$3,$4,$5,$6)`,
        [`C-BORRA-${i}`, `Campana ${i}`, id, enDias(-5), enDias(30), org.id],
      )
    }

    const r = await borrar(id)
    expect(r.status, JSON.stringify(r.datos)).toBe(409)
    expect(r.datos.error).toContain('2 campaña')
    expect(await existe(id)).toBe(true)
  })

  it('el 409 enumera campañas Y facturas cuando hay de las dos', async () => {
    const id = await altaCliente('Con las dos cosas')
    const campana = await sembrarCampana(id, 'C-MIX-1')
    await sembrarFactura(id, campana, 'F-MIX-1')

    const r = await borrar(id)
    expect(r.status).toBe(409)
    expect(r.datos.error).toContain('1 campaña')
    expect(r.datos.error).toContain('1 factura')
    expect(await existe(id)).toBe(true)
  })
})

// ─── Las dos FK que el hallazgo no vio ──────────────────────────────────────

describe('4 · una AGENCIA en uso NO se borra', () => {
  it('si otro cliente la tiene como agencia: 409 con la cifra, no un 409 mudo', async () => {
    const agencia = await altaCliente('Agencia ocupada', { tipo: 'AGENCIA' })
    const anunciante = await altaCliente('Anunciante')
    await poolTest().query('update clientes set agencia_id = $2 where id = $1', [
      anunciante,
      agencia,
    ])

    const r = await borrar(agencia)
    expect(r.status, JSON.stringify(r.datos)).toBe(409)
    // Sin contar esta FK, el driver daba 23503 y salía el 409 genérico «El
    // registro está referenciado por otro», que no dice qué lo retiene.
    expect(r.datos.error).toContain('1 cliente')
    expect(await existe(agencia)).toBe(true)
  })

  it('si una propuesta la tiene como agencia: 409 con la cifra', async () => {
    const agencia = await altaCliente('Agencia con propuesta', { tipo: 'AGENCIA' })
    await poolTest().query(
      `insert into propuestas (folio, nombre, agencia_id, tenant_id)
       values ('P-AG-1','Propuesta con agencia',$1,$2)`,
      [agencia, org.id],
    )

    const r = await borrar(agencia)
    expect(r.status, JSON.stringify(r.datos)).toBe(409)
    expect(r.datos.error).toContain('1 propuesta')
    expect(await existe(agencia)).toBe(true)
  })
})

// ─── Las propuestas huérfanas: no bloquean, pero no pasan en silencio ───────

describe('5 · propuestas que quedarían sin dueño', () => {
  it('sin confirmar: 409 con la cuenta, y NO se borra', async () => {
    const id = await altaCliente('Con propuestas')
    for (let i = 1; i <= 2; i++) {
      await poolTest().query(
        `insert into propuestas (folio, nombre, cliente_id, tenant_id) values ($1,$2,$3,$4)`,
        [`P-HUER-${i}`, `Propuesta ${i}`, id, org.id],
      )
    }

    const r = await borrar(id)
    expect(r.status, JSON.stringify(r.datos)).toBe(409)
    expect(r.datos.motivo).toBe('propuestas-huerfanas')
    expect(r.datos.propuestas).toBe(2)
    expect(await existe(id)).toBe(true)
    // Y sobre todo: las propuestas conservan su cliente. Un 409 que ya hubiera
    // puesto los cliente_id en null sería lo peor de los dos mundos.
    expect(
      (await poolTest().query('select 1 from propuestas where cliente_id = $1', [id])).rowCount,
    ).toBe(2)
  })

  it('confirmando: se borra y las propuestas quedan huérfanas, como avisó', async () => {
    const id = await altaCliente('Con propuestas confirmadas')
    await poolTest().query(
      `insert into propuestas (folio, nombre, cliente_id, tenant_id)
       values ('P-CONF-1','Propuesta confirmada',$1,$2)`,
      [id, org.id],
    )

    const r = await borrar(id, { confirmaPropuestasHuerfanas: true })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(await existe(id)).toBe(false)
    const { rows } = await poolTest().query(
      `select cliente_id from propuestas where folio = 'P-CONF-1'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].cliente_id).toBeNull()
  })

  it('confirmar NO salta el bloqueo de las facturas', async () => {
    // La confirmación es solo para las huérfanas. Si sirviera de comodín para
    // todo, sería una forma de destruir facturas con una bandera en el cuerpo.
    const id = await altaCliente('Confirmada pero con factura')
    const campana = await sembrarCampana(id, 'C-NOSALTA-1')
    await sembrarFactura(id, campana, 'F-NOSALTA-1')

    const r = await borrar(id, { confirmaPropuestasHuerfanas: true })
    expect(r.status, JSON.stringify(r.datos)).toBe(409)
    expect(await existe(id)).toBe(true)
  })
})

// ─── Aislamiento y permisos ─────────────────────────────────────────────────

describe('6 · un cliente de OTRA organización no se toca', () => {
  it('borrarlo desde otra organización es 404 y la fila sigue intacta', async () => {
    // El id existe y es válido: lo único que lo protege es el tenant. Si el
    // DELETE llevara solo `where id = $1` —como todavía hace el UPDATE de
    // `clientes-repo.ts:191`—, esto borraría datos de otra empresa.
    const ajenoId = ajena.clienteId
    const r = await borrar(ajenoId)
    expect(r.status, JSON.stringify(r.datos)).toBe(404)
    expect(await existe(ajenoId)).toBe(true)
  })

  it('y al revés: la otra organización tampoco borra el nuestro', async () => {
    const id = await altaCliente('Solo nuestro')
    const r = await ajeno.pedir(`/api/clientes/${id}/`, { metodo: 'DELETE' })
    expect(r.status).toBe(404)
    expect(await existe(id)).toBe(true)
  })
})

describe('7 · sin permiso no se borra', () => {
  it('un rol sin `comercial:crear` recibe 403 y la fila sigue ahí', async () => {
    const id = await altaCliente('Protegido por permisos')
    const r = await mirón.pedir(`/api/clientes/${id}/`, { metodo: 'DELETE' })
    expect(r.status, JSON.stringify(r.datos)).toBe(403)
    expect(await existe(id)).toBe(true)
  })

  it('sin sesión ninguna es 401/403, nunca un borrado', async () => {
    const id = await altaCliente('Protegido sin sesion')
    const anónimo = new Cliente()
    const r = await anónimo.pedir(`/api/clientes/${id}/`, { metodo: 'DELETE' })
    expect([401, 403]).toContain(r.status)
    expect(await existe(id)).toBe(true)
  })
})
