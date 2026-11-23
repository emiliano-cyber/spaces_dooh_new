import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias, type TenantSembrado } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  Aprobar desde la ficha de campaña es SOLO de Dueño y Administrador
//  (pedido del dueño, 18/11, junto con «Actualizar campaña»).
// ----------------------------------------------------------------------------
//  La única aprobación que vive solo en la ficha es la de la PUBLICACIÓN
//  (`POST /api/campanas/:id/validar`), y ahí está la puerta de verdad. La de
//  los creativos se esconde en la ficha, pero `PATCH /api/creatividades/:id`
//  se queda como estaba —«los demás perfiles se deben de quedar igual»—: la
//  pantalla Creativos sigue dejando aprobar a quien tiene `comercial.crear`.
//  El último caso lo comprueba para que nadie «complete» la regla por error.
//
//  Los usuarios van en la MISMA organización: con uno de otra, el 403 se
//  confundiría con el aislamiento.
// ============================================================================

let org: TenantSembrado
const clientes: Record<string, Cliente> = {}

async function usuario(rol: string): Promise<Cliente> {
  const email = `${rol.toLowerCase()}@aprobar.test`
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ($1,$2,$3::rol_demo,$4,true,$5)`,
    [`Usuario ${rol}`, email, rol, await bcrypt.hash(PASSWORD_DEMO, 4), org.id],
  )
  const c = new Cliente()
  await c.entrar(email, PASSWORD_DEMO)
  return c
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  // Los tres tienen `comercial.crear`, que es lo que hasta hoy bastaba para
  // aprobar: así el 403 sale de la regla nueva y no de la matriz.
  await poolTest().query(
    `insert into rol_permisos (rol, modulo, accion) values
       ('ADMINISTRADOR','comercial','ver'),('ADMINISTRADOR','comercial','crear'),
       ('VENDEDOR','comercial','ver'),('VENDEDOR','comercial','crear'),
       ('GERENTE_VENTAS','comercial','ver'),('GERENTE_VENTAS','comercial','crear')
     on conflict do nothing`,
  )
  org = await sembrarTenant('aprobar')
  await arrancarServidor()
  clientes.DUENO = new Cliente()
  await clientes.DUENO.entrar(org.usuarioEmail, PASSWORD_DEMO)
  for (const rol of ['ADMINISTRADOR', 'VENDEDOR', 'GERENTE_VENTAS']) clientes[rol] = await usuario(rol)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

// Una OOH enviada al dominio: aprobarla no pasa por la asignación de creativos
// ni por DOOHmain, así que lo único que se mide aquí es QUIÉN aprueba.
async function enviadaAlDominio(): Promise<string> {
  const r = await poolTest().query(
    `insert into campanas (nombre, cliente_id, tipo_campana, fecha_inicio, fecha_fin, estado_comercial,
                           enviada_dominio, validacion_estatus, tenant_id)
     values ('Por aprobar',$1,'OOH',$2,$3,'CONFIRMADA',true,'PENDIENTE',$4) returning id`,
    [org.clienteId, enDias(-1), enDias(30), org.id],
  )
  return r.rows[0].id
}

const validar = (rol: string, id: string, aprobar: boolean) =>
  clientes[rol].pedir(`/api/campanas/${id}/validar/`, { cuerpo: aprobar ? { aprobar } : { aprobar, motivo: 'no' } })

const estatus = async (id: string) =>
  (await poolTest().query('select validacion_estatus from campanas where id=$1', [id])).rows[0].validacion_estatus

describe('aprobar o rechazar la publicación', () => {
  it('un Vendedor no puede, aunque tenga comercial.crear, y la campaña no cambia', async () => {
    const id = await enviadaAlDominio()
    const r = await validar('VENDEDOR', id, true)
    expect(r.status).toBe(403)
    expect(r.datos.error).toMatch(/Dueño o un Administrador/)
    expect((await validar('VENDEDOR', id, false)).status).toBe(403)
    expect(await estatus(id)).toBe('PENDIENTE')
  })

  it('un Gerente de ventas tampoco', async () => {
    const id = await enviadaAlDominio()
    expect((await validar('GERENTE_VENTAS', id, true)).status).toBe(403)
    expect(await estatus(id)).toBe('PENDIENTE')
  })

  it('el Administrador aprueba', async () => {
    const id = await enviadaAlDominio()
    expect((await validar('ADMINISTRADOR', id, true)).status).toBe(200)
    expect(await estatus(id)).toBe('APROBADA')
  })

  it('el Dueño rechaza', async () => {
    const id = await enviadaAlDominio()
    expect((await validar('DUENO', id, false)).status).toBe(200)
    expect(await estatus(id)).toBe('RECHAZADA')
  })
})

describe('aprobar un creativo fuera de la ficha se queda como estaba', () => {
  it('un Vendedor sigue aprobando creativos (pantalla Creativos)', async () => {
    const camp = await poolTest().query(
      `insert into campanas (nombre, cliente_id, tipo_campana, fecha_inicio, fecha_fin, estado_comercial, tenant_id)
       values ('Con creativo',$1,'DOOH',$2,$3,'CONFIRMADA',$4) returning id`,
      [org.clienteId, enDias(-1), enDias(30), org.id],
    )
    const cr = await poolTest().query(
      `insert into creatividades (campana_id, nombre, archivo_url, formato, estatus_validacion, tenant_id)
       values ($1,'Pieza','data:image/png;base64,iVBORw0KGgo=','png','PENDIENTE',$2) returning id`,
      [camp.rows[0].id, org.id],
    )
    const r = await clientes.VENDEDOR.pedir(`/api/creatividades/${cr.rows[0].id}/`, {
      metodo: 'PATCH',
      cuerpo: { aprobar: true },
    })
    expect(r.status).toBe(200)
    expect(r.datos.estatusValidacion).toBe('VALIDADA')
  })
})
