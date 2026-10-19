import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente, BASE } from './servidor-e2e'

// ============================================================================
//  El comprobante de un pago de cliente, contra Postgres real (COB-COMP).
//
//  Pedido del dueño el 19/10: al registrar un pago en Cobranza no había dónde
//  subir el recibo o la transferencia, y en los pagos de renta sí. El
//  comprobante va en el ABONO (`cobranza_abonos`), uno por pago, porque cada
//  abono es un dinero distinto que entró en un día distinto.
//
//  Lo que las unitarias no pueden ver:
//    · que el archivo quede en el renglón del abono, bajo la RLS;
//    · que un archivo inválido no deje un pago a medias (ni abono ni saldo);
//    · que subirlo DESPUÉS no toque el importe, la fecha ni el saldo;
//    · que la lista de pagos no arrastre el archivo (pesa MB: el 12/10 los
//      listados de pantallas se volvieron lentos justo por eso);
//    · que otra organización no lo vea ni lo cambie, ni adivinando ids.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>
let vendedor: Awaited<ReturnType<typeof sembrarTenant>>
let c: Cliente
let cOtra: Cliente
let cVendedor: Cliente

// Bytes reales: `validarUpload` compara la firma del archivo con el tipo
// declarado, así que un PDF de mentira no pasaría.
const PDF = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n%%EOF\n').toString('base64')
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const TEXTO = 'data:text/plain;base64,' + Buffer.from('no soy un recibo').toString('base64')

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('compcob')
  otra = await sembrarTenant('compotra')
  vendedor = await sembrarTenant('compvend', { rol: 'VENDEDOR' })
  await arrancarServidor()
  c = new Cliente()
  await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
  // Pagar es un cambio sensible: hay que desbloquear una vez.
  await c.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
  cOtra = new Cliente()
  await cOtra.entrar(otra.usuarioEmail, PASSWORD_DEMO)
  await cOtra.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
  cVendedor = new Cliente()
  await cVendedor.entrar(vendedor.usuarioEmail, PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

let n = 0
async function cobranza(tenant: { id: string; clienteId: string }, monto: number): Promise<string> {
  n++
  const camp = await poolTest().query(
    `insert into campanas (nombre, cliente_id, fecha_inicio, fecha_fin, tenant_id)
     values ($1, $2, '2026-09-01', '2026-10-01', $3) returning id`,
    [`Campaña ${n}`, tenant.clienteId, tenant.id],
  )
  const f = await poolTest().query(
    `insert into facturas (folio, campana_id, cliente_id, subtotal, igv, monto, fecha_emision, estatus, tenant_id)
     values ($1, $2, $3, $4, 0, $4, '2026-09-01', 'EMITIDA'::est_factura, $5) returning id`,
    [`CC-${String(n).padStart(3, '0')}`, camp.rows[0].id, tenant.clienteId, monto, tenant.id],
  )
  const cob = await poolTest().query(
    `insert into cobranzas (factura_id, fecha_vencimiento, tenant_id) values ($1, '2026-10-01', $2) returning id`,
    [f.rows[0].id, tenant.id],
  )
  return cob.rows[0].id
}

async function abonos(cob: string) {
  return (
    await poolTest().query(
      `select id, monto::float as monto, to_char(fecha, 'YYYY-MM-DD') as fecha, comprobante_url
         from cobranza_abonos where cobranza_id = $1 order by creado_en`,
      [cob],
    )
  ).rows
}
async function pagado(cob: string): Promise<number> {
  return Number((await poolTest().query('select monto_pagado from cobranzas where id = $1', [cob])).rows[0].monto_pagado)
}
async function bajar(cliente: Cliente, ruta: string) {
  // `Cliente.pedir` lee el cuerpo como texto, y un PNG no sobrevive a eso: el
  // comprobante se pide aparte, con la sesión y la IP del mismo cliente.
  const interno = cliente as unknown as { cookies: Map<string, string>; ip: string }
  const cookie = [...interno.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
  const r = await fetch(`${BASE}${ruta}`, { headers: { cookie, 'x-forwarded-for': interno.ip }, redirect: 'manual' })
  return { status: r.status, tipo: r.headers.get('content-type'), bytes: Buffer.from(await r.arrayBuffer()) }
}

describe('1 · al registrar el pago', () => {
  it('con comprobante: queda en SU abono, y el pago se registra igual', async () => {
    const cob = await cobranza(org, 1000)
    const r = await c.pedir(`/api/cobranzas/${cob}/pagar/`, {
      cuerpo: { monto: 400, fecha: '2026-09-20', comprobanteUrl: PDF },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const a = await abonos(cob)
    expect(a).toHaveLength(1)
    expect(a[0]).toMatchObject({ monto: 400, fecha: '2026-09-20', comprobante_url: PDF })
    expect(await pagado(cob)).toBe(400)
  })

  it('sin comprobante sigue funcionando como siempre', async () => {
    const cob = await cobranza(org, 500)
    const r = await c.pedir(`/api/cobranzas/${cob}/pagar/`, { cuerpo: { monto: 100 } })
    expect(r.status).toBe(200)
    expect((await abonos(cob))[0].comprobante_url).toBeNull()
  })

  it('un archivo de tipo no permitido es 422 y NO deja pago a medias', async () => {
    const cob = await cobranza(org, 500)
    const r = await c.pedir(`/api/cobranzas/${cob}/pagar/`, { cuerpo: { monto: 100, comprobanteUrl: TEXTO } })
    expect(r.status).toBe(422)
    expect(await abonos(cob)).toHaveLength(0)
    expect(await pagado(cob)).toBe(0)
  })
})

describe('2 · la lista de pagos y el archivo', () => {
  it('la lista dice si hay comprobante pero NO trae el archivo', async () => {
    const cob = await cobranza(org, 1000)
    await c.pedir(`/api/cobranzas/${cob}/pagar/`, { cuerpo: { monto: 300, comprobanteUrl: PDF } })
    await c.pedir(`/api/cobranzas/${cob}/pagar/`, { cuerpo: { monto: 200 } })
    const r = await c.pedir(`/api/cobranzas/${cob}/abonos/`)
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.map((x: any) => [x.monto, x.tieneComprobante])).toEqual([[300, true], [200, false]])
    expect(JSON.stringify(r.datos)).not.toContain('data:')
  })

  it('el comprobante se sirve con su tipo y sus bytes; sin comprobante es 404', async () => {
    const cob = await cobranza(org, 1000)
    await c.pedir(`/api/cobranzas/${cob}/pagar/`, { cuerpo: { monto: 300, comprobanteUrl: PDF } })
    await c.pedir(`/api/cobranzas/${cob}/pagar/`, { cuerpo: { monto: 200 } })
    const [con, sin] = await abonos(cob)
    const r = await bajar(c, `/api/cobranzas/${cob}/abonos/${con.id}/comprobante/`)
    expect(r.status).toBe(200)
    expect(r.tipo).toBe('application/pdf')
    expect(r.bytes.toString()).toBe('%PDF-1.4\n%%EOF\n')
    expect((await bajar(c, `/api/cobranzas/${cob}/abonos/${sin.id}/comprobante/`)).status).toBe(404)
  })
})

describe('3 · subirlo después', () => {
  it('se adjunta a un pago ya registrado sin tocar importe, fecha ni saldo', async () => {
    const cob = await cobranza(org, 1000)
    await c.pedir(`/api/cobranzas/${cob}/pagar/`, { cuerpo: { monto: 250, fecha: '2026-09-15' } })
    const [antes] = await abonos(cob)
    const r = await c.pedir(`/api/cobranzas/${cob}/abonos/${antes.id}/`, {
      metodo: 'PATCH',
      cuerpo: { comprobanteUrl: PDF },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const [despues] = await abonos(cob)
    expect(despues).toMatchObject({ monto: 250, fecha: '2026-09-15', comprobante_url: PDF })
    expect(await pagado(cob)).toBe(250)
    const bit = await poolTest().query(
      `select count(*)::int as n from acciones where tenant_id = $1 and accion = 'Adjuntó comprobante de pago'`,
      [org.id],
    )
    expect(bit.rows[0].n).toBeGreaterThan(0)
  })

  it('reemplazarlo deja el nuevo', async () => {
    const cob = await cobranza(org, 1000)
    await c.pedir(`/api/cobranzas/${cob}/pagar/`, { cuerpo: { monto: 250, comprobanteUrl: PDF } })
    const [a] = await abonos(cob)
    await c.pedir(`/api/cobranzas/${cob}/abonos/${a.id}/`, { metodo: 'PATCH', cuerpo: { comprobanteUrl: PNG } })
    expect((await bajar(c, `/api/cobranzas/${cob}/abonos/${a.id}/comprobante/`)).tipo).toBe('image/png')
  })

  it('sin archivo, o con uno inválido, no cambia nada', async () => {
    const cob = await cobranza(org, 1000)
    await c.pedir(`/api/cobranzas/${cob}/pagar/`, { cuerpo: { monto: 250, comprobanteUrl: PDF } })
    const [a] = await abonos(cob)
    const vacio = await c.pedir(`/api/cobranzas/${cob}/abonos/${a.id}/`, { metodo: 'PATCH', cuerpo: {} })
    expect(vacio.status).toBe(400)
    const malo = await c.pedir(`/api/cobranzas/${cob}/abonos/${a.id}/`, { metodo: 'PATCH', cuerpo: { comprobanteUrl: TEXTO } })
    expect(malo.status).toBe(422)
    expect((await abonos(cob))[0].comprobante_url).toBe(PDF)
  })

  it('el abono tiene que ser de ESA cobranza', async () => {
    const cobA = await cobranza(org, 1000)
    const cobB = await cobranza(org, 1000)
    await c.pedir(`/api/cobranzas/${cobA}/pagar/`, { cuerpo: { monto: 100 } })
    const [a] = await abonos(cobA)
    const r = await c.pedir(`/api/cobranzas/${cobB}/abonos/${a.id}/`, { metodo: 'PATCH', cuerpo: { comprobanteUrl: PDF } })
    expect(r.status).toBe(404)
    expect((await abonos(cobA))[0].comprobante_url).toBeNull()
  })
})

describe('4 · lo que otros NO pueden', () => {
  it('otra organización no ve la lista, ni el archivo, ni puede cambiarlo', async () => {
    const cob = await cobranza(org, 1000)
    await c.pedir(`/api/cobranzas/${cob}/pagar/`, { cuerpo: { monto: 300, comprobanteUrl: PDF } })
    const [a] = await abonos(cob)
    expect((await cOtra.pedir(`/api/cobranzas/${cob}/abonos/`)).status).toBe(404)
    expect((await bajar(cOtra, `/api/cobranzas/${cob}/abonos/${a.id}/comprobante/`)).status).toBe(404)
    const r = await cOtra.pedir(`/api/cobranzas/${cob}/abonos/${a.id}/`, { metodo: 'PATCH', cuerpo: { comprobanteUrl: PNG } })
    expect(r.status).toBe(404)
    expect((await abonos(cob))[0].comprobante_url).toBe(PDF)
  })

  it('sin permiso de registrar pagos (VENDEDOR) no se adjunta', async () => {
    const r = await cVendedor.pedir(`/api/cobranzas/00000000-0000-0000-0000-000000000000/abonos/00000000-0000-0000-0000-000000000000/`, {
      metodo: 'PATCH',
      cuerpo: { comprobanteUrl: PDF },
    })
    expect(r.status).toBe(403)
  })
})
