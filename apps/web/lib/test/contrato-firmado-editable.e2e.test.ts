import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  CONTRATO-FIRMADO-EDITABLE (23/10) · un contrato firmado por las dos partes
//  se puede cambiar; la versión firmada se ARCHIVA y se vuelve a firmar con los
//  datos actuales, que se revisan antes de congelarse.
// ----------------------------------------------------------------------------
//  Va por HTTP y con firmas DE VERDAD —la interna con la sesión, la del
//  arrendador por su enlace público sin sesión—, no sembradas por SQL, porque
//  lo que se prueba es justo la cadena entera: congelar → firmar → editar →
//  archivar → reenviar → firmar otra vez. Un mock no ve que el texto archivado
//  sea el que se firmó, ni que la RLS deje fuera a otra organización.
// ============================================================================

let a: Awaited<ReturnType<typeof sembrarTenant>>
let b: Awaited<ReturnType<typeof sembrarTenant>>
let ca: Cliente
let cb: Cliente
let contratoId: string

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  a = await sembrarTenant('firmadoa')
  b = await sembrarTenant('firmadob')
  await arrancarServidor()
  ca = new Cliente()
  await ca.entrar(a.usuarioEmail, PASSWORD_DEMO)
  cb = new Cliente()
  await cb.entrar(b.usuarioEmail, PASSWORD_DEMO)
  for (const cl of [ca, cb]) {
    const r = await cl.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
  }
  contratoId = (await poolTest().query('select id from contratos_arrendamiento where sitio_id = $1', [a.sitioId])).rows[0].id
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

// El expediente completo: sin RFC, domicilios y representante no se puede
// enviar a firma (`enviarAFirma` lo rechaza con los faltantes).
beforeEach(async () => {
  const p = poolTest()
  await p.query('delete from contrato_versiones_firmadas')
  await p.query('delete from contrato_cambios')
  await p.query('delete from contrato_firmas')
  await p.query(
    `update tenants set rfc = 'OFA010101AAA', domicilio_fiscal = 'Av. Reforma 1, CDMX',
                        representante_legal = 'Ana Directora'
      where id = $1`,
    [a.id],
  )
  await p.query(
    `update arrendadores set rfc = 'ARR010101BBB', direccion = 'Calle del Dueño 5, CDMX'
      where tenant_id = $1`,
    [a.id],
  )
  await p.query(`update predios set direccion = 'Insurgentes 100, CDMX' where tenant_id = $1`, [a.id])
  await p.query(
    `update contratos_arrendamiento
        set monto_renta = 20000, documento_url = null,
            documento_congelado = null, documento_hash = null, congelado_en = null
      where id = $1`,
    [contratoId],
  )
})

const estadoFirma = (cli = ca) => cli.pedir(`/api/contratos/${contratoId}/firma/`)
const editar = (cuerpo: Record<string, unknown>, cli = ca) =>
  cli.pedir(`/api/contratos/${contratoId}/`, { metodo: 'PATCH', cuerpo })
const versiones = (cli = ca) => cli.pedir(`/api/contratos/${contratoId}/versiones/`)

async function enviar(huella?: string | null) {
  const h = huella === undefined ? (await estadoFirma()).datos.huellaDatos : huella
  return ca.pedir(`/api/contratos/${contratoId}/firma/`, { cuerpo: { accion: 'enviar', huellaRevisada: h } })
}

// Las dos firmas reales: la interna con la sesión y la del arrendador por su
// enlace público, sin sesión, con el nombre que el contrato espera.
async function firmarAmbas() {
  const e = await enviar()
  expect(e.status, JSON.stringify(e.datos)).toBe(200)
  const fi = await ca.pedir(`/api/contratos/${contratoId}/firma/`, { cuerpo: { accion: 'firmar' } })
  expect(fi.status, JSON.stringify(fi.datos)).toBe(200)
  const sinSesion = new Cliente()
  const info = await sinSesion.pedir(`/api/firma/${e.datos.token}/`)
  expect(info.status, JSON.stringify(info.datos)).toBe(200)
  const fa = await sinSesion.pedir(`/api/firma/${e.datos.token}/`, {
    cuerpo: { nombre: info.datos.nombreEsperado ?? 'Arrendador Firmante' },
  })
  expect(fa.status, JSON.stringify(fa.datos)).toBe(200)
  const firmadas = await poolTest().query(
    `select count(*)::int n from contrato_firmas where contrato_id = $1 and estatus = 'FIRMADA'`,
    [contratoId],
  )
  expect(firmadas.rows[0].n).toBe(2)
  const c = await poolTest().query('select documento_congelado, documento_hash from contratos_arrendamiento where id = $1', [contratoId])
  return c.rows[0] as { documento_congelado: string; documento_hash: string }
}

describe('1 · antes de congelar se revisan los datos actuales', () => {
  it('enviar sin la huella de la revisión es 400 y no congela nada', async () => {
    const r = await enviar(null)
    expect(r.status).toBe(400)
    const c = await poolTest().query('select congelado_en from contratos_arrendamiento where id = $1', [contratoId])
    expect(c.rows[0].congelado_en).toBeNull()
  })

  it('si los datos de la empresa cambian mientras se revisaban, 409 y no congela', async () => {
    const vista = (await estadoFirma()).datos.huellaDatos
    await poolTest().query(`update tenants set domicilio_fiscal = 'Otro domicilio 9' where id = $1`, [a.id])
    const r = await enviar(vista)
    expect(r.status).toBe(409)
    expect(r.datos.error).toMatch(/cambiaron mientras los revisabas/)
    const c = await poolTest().query('select congelado_en from contratos_arrendamiento where id = $1', [contratoId])
    expect(c.rows[0].congelado_en).toBeNull()
  })

  it('con la huella de lo revisado, congela con esos datos', async () => {
    const r = await enviar()
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const c = await poolTest().query('select documento_congelado from contratos_arrendamiento where id = $1', [contratoId])
    expect(c.rows[0].documento_congelado).toContain('Av. Reforma 1, CDMX')
  })
})

describe('2 · editar un contrato firmado por las DOS partes', () => {
  it('sin motivo es 400 y no toca nada: firmas, texto ni historial', async () => {
    await firmarAmbas()
    const r = await editar({ montoRenta: 18000, propuestoPor: 'ARRENDADOR' })
    expect(r.status).toBe(400)
    expect(r.datos.error).toMatch(/motivo/)
    const f = await poolTest().query(`select count(*)::int n from contrato_firmas where contrato_id = $1 and estatus = 'FIRMADA'`, [contratoId])
    expect(f.rows[0].n).toBe(2)
    expect((await versiones()).datos).toEqual([])
    const m = await poolTest().query('select monto_renta from contratos_arrendamiento where id = $1', [contratoId])
    expect(Number(m.rows[0].monto_renta)).toBe(20000)
  })

  it('con motivo se cambia, y la versión firmada queda archivada entera', async () => {
    const firmado = await firmarAmbas()
    const r = await editar({ montoRenta: 18000, propuestoPor: 'ARRENDADOR', motivo: 'Renegociamos la renta' })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)

    // El contrato cambió y quedó sin firmas ni texto congelado: hay que firmar otra vez.
    const p = poolTest()
    const c = await p.query(
      'select monto_renta, documento_hash, congelado_en from contratos_arrendamiento where id = $1',
      [contratoId],
    )
    expect(Number(c.rows[0].monto_renta)).toBe(18000)
    expect(c.rows[0].documento_hash).toBeNull()
    expect(c.rows[0].congelado_en).toBeNull()
    const f = await p.query('select count(*)::int n from contrato_firmas where contrato_id = $1', [contratoId])
    expect(f.rows[0].n).toBe(0)

    // Lo que se firmó NO se perdió: el texto exacto, su sello y las dos firmas.
    const v = (await versiones()).datos
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ version: 1, documentoHash: firmado.documento_hash, motivo: 'Renegociamos la renta' })
    expect(v[0].firmas.map((x: any) => x.parte).sort()).toEqual(['ARRENDADOR', 'ARRENDATARIO'])
    for (const x of v[0].firmas) expect(x.documentoHash).toBe(firmado.documento_hash)
    const una = await ca.pedir(`/api/contratos/${contratoId}/versiones/?version=1`)
    expect(una.status).toBe(200)
    expect(una.datos.documento).toBe(firmado.documento_congelado)

    // Y el historial dice que ese cambio archivó la versión 1.
    const h = (await ca.pedir(`/api/contratos/${contratoId}/cambios/`)).datos
    expect(h[0]).toMatchObject({ versionFirmada: 1, envioAnulado: true, motivo: 'Renegociamos la renta' })
  })

  it('se vuelve a firmar con los datos ACTUALES de la empresa, y la versión vieja sigue intacta', async () => {
    const v1 = await firmarAmbas()
    await editar({ montoRenta: 18000, propuestoPor: 'ARRENDATARIO', motivo: 'Cambio de domicilio y renta' })
    await poolTest().query(`update tenants set domicilio_fiscal = 'Nuevo domicilio 77, CDMX' where id = $1`, [a.id])

    const v2 = await firmarAmbas()
    expect(v2.documento_hash).not.toBe(v1.documento_hash)
    expect(v2.documento_congelado).toContain('Nuevo domicilio 77, CDMX')
    expect(v1.documento_congelado).toContain('Av. Reforma 1, CDMX')

    const una = await ca.pedir(`/api/contratos/${contratoId}/versiones/?version=1`)
    expect(una.datos.documento).toBe(v1.documento_congelado)

    // Un segundo cambio archiva la versión 2, y la lista va de la nueva a la vieja.
    const r = await editar({ montoRenta: 17000, propuestoPor: 'ARRENDADOR', motivo: 'Otra vez' })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect((await versiones()).datos.map((x: any) => x.version)).toEqual([2, 1])
  })

  it('adjuntar el PDF firmado no pide motivo ni anula las firmas', async () => {
    await firmarAmbas()
    const pdf = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n%%EOF\n').toString('base64')
    const r = await editar({ documentoUrl: pdf })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const f = await poolTest().query(`select count(*)::int n from contrato_firmas where contrato_id = $1 and estatus = 'FIRMADA'`, [contratoId])
    expect(f.rows[0].n).toBe(2)
    expect((await versiones()).datos).toEqual([])
  })
})

describe('3 · volver a enviar a firma ya no borra la evidencia', () => {
  it('reenviar un firmado archiva su versión antes de reiniciar las firmas', async () => {
    const firmado = await firmarAmbas()
    const r = await enviar()
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const v = (await versiones()).datos
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ version: 1, documentoHash: firmado.documento_hash, motivo: 'Reenviado a firma' })
    expect(v[0].usuarioNombre).toBe('Dueño firmadoa')
  })

  it('reenviar uno sin firmas no archiva nada: un borrador no es una versión firmada', async () => {
    expect((await enviar()).status).toBe(200)
    expect((await enviar()).status).toBe(200)
    expect((await versiones()).datos).toEqual([])
  })
})

describe('4 · las versiones firmadas son de cada organización y solo se agregan', () => {
  it('otra organización no ve las versiones ajenas', async () => {
    await firmarAmbas()
    await editar({ montoRenta: 18000, propuestoPor: 'ARRENDADOR', motivo: 'Para el archivo' })
    expect((await versiones()).datos).toHaveLength(1)
    expect((await versiones(cb)).datos).toEqual([])
    expect((await cb.pedir(`/api/contratos/${contratoId}/versiones/?version=1`)).status).toBe(404)
  })

  it('el rol de la aplicación puede leer e insertar, y NO actualizar ni borrar', async () => {
    const priv = async (p: string) =>
      (await poolTest().query(`select has_table_privilege('spaces_app', 'contrato_versiones_firmadas', $1) as si`, [p]))
        .rows[0].si
    expect(await priv('SELECT')).toBe(true)
    expect(await priv('INSERT')).toBe(true)
    expect(await priv('UPDATE')).toBe(false)
    expect(await priv('DELETE')).toBe(false)
    expect(await priv('TRUNCATE')).toBe(false)
  })
})
