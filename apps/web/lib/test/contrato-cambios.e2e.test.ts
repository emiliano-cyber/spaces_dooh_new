import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  CONTRATO-CAMBIOS (07/10) · cambiar un contrato antes de firmarlo, con quién
//  lo propuso y su historial.
// ----------------------------------------------------------------------------
//  Va por HTTP contra Postgres real por tres cosas que un mock no ve: que el
//  renglón del historial se escribe en la MISMA transacción que la edición,
//  que anular un envío a firma deja muerto el enlace público del arrendador
//  (otra ruta, sin sesión), y que el historial de una organización no se ve
//  desde otra (RLS + `tenant_id` en la consulta).
// ============================================================================

let a: Awaited<ReturnType<typeof sembrarTenant>>
let b: Awaited<ReturnType<typeof sembrarTenant>>
let ca: Cliente
let cb: Cliente
let contratoId: string

const TOKEN = 'a'.repeat(64)

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  a = await sembrarTenant('cambiosa')
  b = await sembrarTenant('cambiosb')
  await arrancarServidor()
  ca = new Cliente()
  await ca.entrar(a.usuarioEmail, PASSWORD_DEMO)
  cb = new Cliente()
  await cb.entrar(b.usuarioEmail, PASSWORD_DEMO)
  // Editar un contrato es un cambio de dinero: con el control de cambios
  // encendido pide la contraseña otra vez (ADR 0009). Se desbloquean las dos
  // sesiones para que lo que se mida sea el historial, no el candado.
  for (const cl of [ca, cb]) {
    const r = await cl.pedir("/api/cambios/desbloquear/", { cuerpo: { password: PASSWORD_DEMO } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
  }
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

beforeEach(async () => {
  const p = poolTest()
  const r = await p.query('select id from contratos_arrendamiento where sitio_id = $1', [a.sitioId])
  contratoId = r.rows[0].id
  await p.query('delete from contrato_cambios')
  await p.query('delete from contrato_firmas')
  await p.query(
    `update contratos_arrendamiento
        set monto_renta = 20000, documento_url = null,
            documento_congelado = null, documento_hash = null, congelado_en = null
      where id = $1`,
    [contratoId],
  )
})

const editar = (cuerpo: Record<string, unknown>, cli = ca) =>
  cli.pedir(`/api/contratos/${contratoId}/`, { metodo: 'PATCH', cuerpo })
const historial = (cli = ca) => cli.pedir(`/api/contratos/${contratoId}/cambios/`)

// Deja el contrato como si se hubiera enviado a firma: texto congelado y las
// dos firmas pendientes, con el enlace del arrendador. Se hace por SQL porque
// `enviarAFirma` exige el expediente completo (RFC, domicilio, representante)
// y eso no es lo que se prueba aquí.
async function enviadoAFirma(firmadaInterna = false) {
  const p = poolTest()
  await p.query(
    `update contratos_arrendamiento
        set documento_congelado = 'texto de antes', documento_hash = 'h-antes', congelado_en = now()
      where id = $1`,
    [contratoId],
  )
  await p.query(
    `insert into contrato_firmas (tenant_id, contrato_id, parte, token, token_expira_en)
     values ($1, $2, 'ARRENDADOR', $3, now() + interval '30 days')`,
    [a.id, contratoId, TOKEN],
  )
  await p.query(
    `insert into contrato_firmas (tenant_id, contrato_id, parte, estatus, firmado_en, nombre_firmante, documento_hash)
     values ($1, $2, 'ARRENDATARIO', $3, $4, $5, $6)`,
    firmadaInterna
      ? [a.id, contratoId, 'FIRMADA', new Date(), 'Dueño', 'h-antes']
      : [a.id, contratoId, 'PENDIENTE', null, null, null],
  )
}

describe('1 · cada cambio deja quién lo propuso, quién lo capturó y qué cambió', () => {
  it('anota la parte, el motivo, el usuario de la sesión y el antes y después', async () => {
    const r = await editar({ montoRenta: 18000, propuestoPor: 'ARRENDADOR', motivo: 'Pidió bajar la renta' })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)

    const h = await historial()
    expect(h.status).toBe(200)
    expect(h.datos).toHaveLength(1)
    expect(h.datos[0]).toMatchObject({
      propuestoPor: 'ARRENDADOR',
      motivo: 'Pidió bajar la renta',
      usuarioNombre: 'Dueño cambiosa',
      envioAnulado: false,
      cambios: [{ campo: 'montoRenta', etiqueta: 'Renta', antes: '20000.00', despues: '18000.00' }],
    })
  })

  it('QUIÉN capturó sale de la sesión: un nombre en el cuerpo se rechaza', async () => {
    // El esquema es estricto: si el navegador pudiera mandar el autor, el
    // historial diría lo que el navegador quisiera.
    const r = await editar({ montoRenta: 18000, usuarioNombre: 'Otra persona' })
    expect(r.status).toBe(400)
    expect((await historial()).datos).toHaveLength(0)
  })

  it('guardar sin cambiar nada no deja renglón', async () => {
    const r = await editar({ montoRenta: 20000, propuestoPor: 'ARRENDATARIO' })
    expect(r.status).toBe(200)
    expect((await historial()).datos).toHaveLength(0)
  })

  it('el más nuevo va primero', async () => {
    await editar({ montoRenta: 18000, propuestoPor: 'ARRENDADOR' })
    await editar({ montoRenta: 19000, propuestoPor: 'ARRENDATARIO' })
    const h = (await historial()).datos
    expect(h.map((x: any) => x.propuestoPor)).toEqual(['ARRENDATARIO', 'ARRENDADOR'])
  })

  it('una parte que no existe es un 400 y no toca el contrato', async () => {
    const r = await editar({ montoRenta: 18000, propuestoPor: 'NADIE' })
    expect(r.status).toBe(400)
    const m = await poolTest().query('select monto_renta from contratos_arrendamiento where id=$1', [contratoId])
    expect(Number(m.rows[0].monto_renta)).toBe(20000)
  })
})

describe('2 · cambiar un contrato ya enviado a firma anula el envío', () => {
  it('borra las firmas pendientes, descongela el texto y lo anota', async () => {
    await enviadoAFirma()
    const r = await editar({ montoRenta: 18000, propuestoPor: 'ARRENDADOR' })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)

    const p = poolTest()
    const c = await p.query('select documento_hash, congelado_en from contratos_arrendamiento where id=$1', [contratoId])
    expect(c.rows[0]).toEqual({ documento_hash: null, congelado_en: null })
    const f = await p.query('select count(*)::int n from contrato_firmas where contrato_id=$1', [contratoId])
    expect(f.rows[0].n).toBe(0)
    expect((await historial()).datos[0].envioAnulado).toBe(true)
  })

  it('el enlace que tenía el arrendador deja de servir: no puede firmar el texto viejo', async () => {
    await enviadoAFirma()
    const sinSesion = new Cliente()
    expect((await sinSesion.pedir(`/api/firma/${TOKEN}/`)).status).toBe(200)
    await editar({ montoRenta: 18000, propuestoPor: 'ARRENDATARIO' })
    expect((await sinSesion.pedir(`/api/firma/${TOKEN}/`)).status).toBe(404)
  })

  it('si ya firmó alguien, no se cambia y no queda nada anotado', async () => {
    await enviadoAFirma(true)
    const r = await editar({ montoRenta: 18000, propuestoPor: 'ARRENDADOR' })
    expect(r.status).toBe(409)
    expect((await historial()).datos).toHaveLength(0)
    const f = await poolTest().query('select count(*)::int n from contrato_firmas where contrato_id=$1', [contratoId])
    expect(f.rows[0].n).toBe(2)
  })
})

describe('3 · el historial es de cada organización', () => {
  it('otra organización no ve el historial ajeno ni puede escribir en él', async () => {
    await editar({ montoRenta: 18000, propuestoPor: 'ARRENDADOR' })
    const h = await historial(cb)
    expect(h.datos).toEqual([])
    const r = await editar({ montoRenta: 1, propuestoPor: 'ARRENDADOR' }, cb)
    expect(r.status).toBe(404)
    const n = await poolTest().query('select count(*)::int n from contrato_cambios')
    expect(n.rows[0].n).toBe(1)
  })
})

describe('4 · adjuntar el PDF no es cambiar los términos', () => {
  it('se anota en el historial, pero NO anula el envío a firma', async () => {
    // El PDF no forma parte del texto que se firma (`documentoATexto` no lo
    // recita): anular el enlace del arrendador por subirlo lo obligaría a
    // volver a firmar exactamente lo mismo.
    await enviadoAFirma()
    const pdf = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n%%EOF\n').toString('base64')
    const r = await editar({ documentoUrl: pdf })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const f = await poolTest().query('select count(*)::int n from contrato_firmas where contrato_id=$1', [contratoId])
    expect(f.rows[0].n).toBe(2)
    const h = (await historial()).datos
    expect(h[0]).toMatchObject({ envioAnulado: false, cambios: [{ campo: 'documentoUrl', despues: 'PDF nuevo' }] })
  })
})
