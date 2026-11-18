import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  Una propuesta aprobada SIN cliente se queda atascada (13/10).
// ----------------------------------------------------------------------------
//  Se puede aprobar sin cliente, pero `generarCampanaDesdePropuesta` no genera
//  campaña sin él, y aprobada ya no se edita. Se encontró en g500 preparando
//  la primera prueba real de DOOHmain. Ahora el cliente se elige al generar la
//  campaña, con tres candados que esta suite fija uno por uno: solo si falta,
//  solo un anunciante de ESTA organización, y solo con el mismo IVA con el que
//  se congeló el snapshot — si no, la campaña cobraría otro total.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let ajena: Awaited<ReturnType<typeof sembrarTenant>>
let c: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('sin-cliente')
  ajena = await sembrarTenant('sin-cliente-ajena')
  await arrancarServidor()
  c = new Cliente()
  await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

// Cada caso usa su propia pantalla: una campaña generada ocupa la sembrada en
// esas fechas, y el siguiente caso rebotaría por cupo y no por lo que mide.
let n = 0
async function pantallaNueva(): Promise<string> {
  n++
  const r = await poolTest().query(
    `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                         alcaldia, ciudad, total_spots, tarifa_publicada, tarifa_mensual,
                         predio_id, tenant_id, exhibicion)
     select 'Pantalla SC ' || $2::text, 'SC-' || $2::text, 'SC-PROV-' || $2::text,
            'PANTALLA_DIGITAL','DISPONIBLE','Cuauhtémoc','CDMX',12,45000,45000,predio_id,tenant_id,'digital'
       from sitios where id=$1 returning id`,
    [org.sitioId, String(n)],
  )
  return r.rows[0].id
}

async function aprobadaSinCliente(estatus: 'APROBADA' | 'BORRADOR' = 'APROBADA'): Promise<string> {
  const prop = await c.pedir('/api/propuestas/', {
    cuerpo: {
      nombre: `Sin cliente ${n}`,
      fechaInicio: enDias(7),
      fechaFin: enDias(37),
      items: [{
        sitioId: await pantallaNueva(), precio: 45000, unidad: 'mensual', tarifaUnitaria: 45000, cantidad: 1,
        rentaMonto: 20000, rentaPeriodicidad: 'MENSUAL', rentaInicio: enDias(0),
      }],
    },
  })
  expect(prop.status, JSON.stringify(prop.datos)).toBe(201)
  if (estatus === 'APROBADA') {
    const ap = await c.pedir(`/api/propuestas/${prop.datos.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'APROBADA' } })
    expect(ap.status, JSON.stringify(ap.datos)).toBe(200)
  }
  return prop.datos.id
}

async function clienteDe(propuestaId: string): Promise<string | null> {
  const r = await poolTest().query('select cliente_id from propuestas where id=$1', [propuestaId])
  return r.rows[0].cliente_id
}

async function clienteNuevo(opts: { tipo?: string; iva?: number; tenant?: string } = {}): Promise<string> {
  const r = await poolTest().query(
    `insert into clientes (nombre, tipo, iva_pct, tenant_id) values ($1,$2,$3,$4) returning id`,
    [`Cliente SC ${++n}`, opts.tipo ?? 'DIRECTO', opts.iva ?? 16, opts.tenant ?? org.id],
  )
  return r.rows[0].id
}

const generar = (id: string, cuerpo: Record<string, unknown> = {}, cli = c) =>
  cli.pedir(`/api/propuestas/${id}/generar-campana/`, { cuerpo })

describe('propuesta aprobada sin cliente', () => {
  it('sin cliente sigue sin generar, y el error dice por qué', async () => {
    const id = await aprobadaSinCliente()
    const r = await generar(id)
    expect(r.status).toBe(409)
    expect(r.datos.error).toContain('no tiene cliente')
  })

  it('eligiéndolo al generar: queda en la propuesta y la campaña nace a su nombre', async () => {
    const id = await aprobadaSinCliente()
    const r = await generar(id, { clienteId: org.clienteId })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(await clienteDe(id)).toBe(org.clienteId)
    const camp = await poolTest().query('select cliente_id from campanas where id=$1', [r.datos.id])
    expect(camp.rows[0].cliente_id).toBe(org.clienteId)
  })

  it('el que ya tiene cliente no se cambia: va como adenda', async () => {
    const id = await aprobadaSinCliente()
    expect((await generar(id, { clienteId: org.clienteId })).status).toBe(201)
    const otro = await clienteNuevo()
    const r = await generar(id, { clienteId: otro })
    expect(r.status).toBe(409)
    expect(r.datos.error).toContain('adenda')
    expect(await clienteDe(id)).toBe(org.clienteId)
  })

  it('una agencia no es el anunciante', async () => {
    const id = await aprobadaSinCliente()
    const r = await generar(id, { clienteId: await clienteNuevo({ tipo: 'AGENCIA' }) })
    expect(r.status).toBe(409)
    expect(r.datos.error).toContain('agencia')
    expect(await clienteDe(id)).toBeNull()
  })

  it('con otro IVA del aprobado no se pone: el total cambiaría', async () => {
    const id = await aprobadaSinCliente()
    const r = await generar(id, { clienteId: await clienteNuevo({ iva: 8 }) })
    expect(r.status).toBe(409)
    expect(r.datos.error).toContain('IVA de 8 %')
    expect(r.datos.error).toContain('16 %')
    expect(await clienteDe(id)).toBeNull()
    const camps = await poolTest().query('select count(*)::int n from campanas where propuesta_id=$1', [id])
    expect(camps.rows[0].n).toBe(0)
  })

  it('un cliente de otra organización no existe aquí', async () => {
    const id = await aprobadaSinCliente()
    const r = await generar(id, { clienteId: ajena.clienteId })
    expect(r.status).toBe(409)
    expect(r.datos.error).toContain('no encontrado')
    expect(await clienteDe(id)).toBeNull()
  })

  it('una propuesta sin aprobar no se toca por aquí', async () => {
    const id = await aprobadaSinCliente('BORRADOR')
    const r = await generar(id, { clienteId: org.clienteId })
    expect(r.status).toBe(409)
    expect(await clienteDe(id)).toBeNull()
  })

  it('un id que no es UUID es 400, no un 500 de la base', async () => {
    const id = await aprobadaSinCliente()
    expect((await generar(id, { clienteId: 'no-es-uuid' })).status).toBe(400)
  })

  it('la propuesta de otra organización no se toca', async () => {
    const id = await aprobadaSinCliente()
    const ca = new Cliente()
    await ca.entrar(ajena.usuarioEmail, PASSWORD_DEMO)
    const r = await generar(id, { clienteId: ajena.clienteId }, ca)
    expect(r.status).toBe(409)
    expect(await clienteDe(id)).toBeNull()
  })

  it('sin permiso de comercial, 403', async () => {
    const id = await aprobadaSinCliente()
    const imprenta = await sembrarTenant('sin-cliente-imprenta', { rol: 'IMPRENTA' })
    const ci = new Cliente()
    await ci.entrar(imprenta.usuarioEmail, PASSWORD_DEMO)
    expect((await generar(id, { clienteId: org.clienteId }, ci)).status).toBe(403)
    expect(await clienteDe(id)).toBeNull()
  })
})
