import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  PLANO DE LAS VALLAS (dueño, 20/11) · `GET /api/vallas/ocupacion` contra
//  Postgres y Next reales.
// ----------------------------------------------------------------------------
//   1. El criterio es EL MISMO que el de «Verificar una marca»
//      (`reservasVivasEnSitiosConVallas`, `vallas-repo.ts`): no cancelada,
//      tentativa sin caducar, solape inclusivo, solo sitios con vallas activas.
//   2. Sin marca en la campaña, cuenta el nombre del cliente.
//   3. Aislamiento: otra organización no ve las reservas de ésta, ni aunque
//      tenga vallas propias en las mismas fechas.
//   4. Permisos: `inventario.ver` (COMERCIAL sí); sin él, 403; sin sesión, 401.
//   5. Fechas obligatorias y en orden: si no, 400.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>
let dueno: Cliente
let duenoOtra: Cliente
let comercial: Cliente
let finanzas: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('plano-org')
  otra = await sembrarTenant('plano-otra')
  for (const [rol, email] of [
    ['COMERCIAL', 'comercial@plano-org.test'],
    ['FINANZAS', 'finanzas@plano-org.test'],
  ]) {
    await poolTest().query(
      `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
       values ($1::text, $2, $1::text::rol_demo, $3, true, $4)`,
      [rol, email, await bcrypt.hash(PASSWORD_DEMO, 4), org.id],
    )
  }
  // FINANZAS sin `inventario.ver`, a propósito: es el caso del 403.
  await poolTest().query(`delete from rol_permisos where rol = 'FINANZAS' and modulo = 'inventario'`)
  await arrancarServidor()
  dueno = new Cliente()
  await dueno.entrar(org.usuarioEmail, PASSWORD_DEMO)
  duenoOtra = new Cliente()
  await duenoOtra.entrar(otra.usuarioEmail, PASSWORD_DEMO)
  comercial = new Cliente()
  await comercial.entrar('comercial@plano-org.test', PASSWORD_DEMO)
  finanzas = new Cliente()
  await finanzas.entrar('finanzas@plano-org.test', PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

beforeEach(async () => {
  await poolTest().query('delete from vallas')
  await poolTest().query('delete from vallas_grupos')
  await poolTest().query('delete from reservas')
  await poolTest().query('delete from campanas')
})

async function vallaEn(tenant: typeof org, sitioId: string, numero: string, activo = true) {
  await poolTest().query(
    `insert into vallas (tenant_id, sitio_id, numero, ancho_m, alto_m, activo) values ($1,$2,$3,6,3,$4)`,
    [tenant.id, sitioId, numero, activo],
  )
}

async function sitioNuevo(tenant: typeof org, nombre: string): Promise<string> {
  const r = await poolTest().query(
    `insert into sitios (nombre, tipo_medio, estatus_comercial, ancho, alto, caras, propio, tenant_id, exhibicion)
     values ($1, 'VALLA', 'DISPONIBLE', 12, 3, 1, true, $2, 'fijo') returning id`,
    [nombre, tenant.id],
  )
  return r.rows[0].id
}

async function reserva(
  tenant: typeof org,
  sitioId: string,
  o: { marca: string | null; ini: number; fin: number; estatus?: string; expiraEnHoras?: number | null; nombre?: string },
) {
  const c = await poolTest().query(
    `insert into campanas (nombre, cliente_id, marca, tipo_campana, fecha_inicio, fecha_fin, estado_comercial, tenant_id)
     values ($1,$2,$3,'OOH'::tipo_campana,$4,$5,'CONFIRMADA',$6) returning id`,
    [o.nombre ?? `Campaña ${o.marca ?? 'sin marca'}`, tenant.clienteId, o.marca, enDias(o.ini), enDias(o.fin), tenant.id],
  )
  await poolTest().query(
    `insert into reservas (campana_id, sitio_id, fecha_inicio, fecha_fin, precio, estatus, expira_en, tenant_id)
     values ($1,$2,$3,$4,1000,$5,
             case when $6::int is null then null else now() + make_interval(hours => $6::int) end, $7)`,
    [c.rows[0].id, sitioId, enDias(o.ini), enDias(o.fin), o.estatus ?? 'CONFIRMADA', o.expiraEnHoras ?? null, tenant.id],
  )
  return c.rows[0].id as string
}

const ocupacion = (c: Cliente, desde: string, hasta: string) =>
  c.pedir(`/api/vallas/ocupacion/?desde=${desde}&hasta=${hasta}`)

describe('GET /api/vallas/ocupacion · el criterio de las reservas', () => {
  it('una reserva viva en un sitio con vallas sale, con su marca y su campaña', async () => {
    await vallaEn(org, org.sitioId, 'V-001')
    const k = await reserva(org, org.sitioId, { marca: 'Pepsi', ini: 5, fin: 20 })
    const r = await ocupacion(dueno, enDias(0), enDias(30))
    expect(r.status).toBe(200)
    expect(r.datos).toMatchObject({ desde: enDias(0), hasta: enDias(30) })
    expect(r.datos.ocupaciones).toEqual([
      { sitioId: org.sitioId, marca: 'Pepsi', campanaId: k, campanaNombre: 'Campaña Pepsi', inicio: enDias(5), fin: enDias(20) },
    ])
  })

  it('el solape es inclusivo: tocarse un día ya ocupa; un día antes, no', async () => {
    await vallaEn(org, org.sitioId, 'V-001')
    await reserva(org, org.sitioId, { marca: 'Pepsi', ini: 10, fin: 20 })
    expect((await ocupacion(dueno, enDias(20), enDias(25))).datos.ocupaciones).toHaveLength(1)
    expect((await ocupacion(dueno, enDias(0), enDias(10))).datos.ocupaciones).toHaveLength(1)
    expect((await ocupacion(dueno, enDias(21), enDias(30))).datos.ocupaciones).toHaveLength(0)
    expect((await ocupacion(dueno, enDias(0), enDias(9))).datos.ocupaciones).toHaveLength(0)
  })

  it('cancelada y tentativa caducada no ocupan; tentativa vigente o sin caducidad, sí', async () => {
    await vallaEn(org, org.sitioId, 'V-001')
    await reserva(org, org.sitioId, { marca: 'Cancelada', ini: 0, fin: 10, estatus: 'CANCELADA' })
    await reserva(org, org.sitioId, { marca: 'Caducada', ini: 0, fin: 10, estatus: 'TENTATIVA', expiraEnHoras: -1 })
    await reserva(org, org.sitioId, { marca: 'Vigente', ini: 0, fin: 10, estatus: 'TENTATIVA', expiraEnHoras: 24 })
    await reserva(org, org.sitioId, { marca: 'Sin caducidad', ini: 0, fin: 10, estatus: 'TENTATIVA', expiraEnHoras: null })
    const marcas = (await ocupacion(dueno, enDias(0), enDias(10))).datos.ocupaciones.map((o: any) => o.marca).sort()
    expect(marcas).toEqual(['Sin caducidad', 'Vigente'])
  })

  it('un sitio sin vallas activas no sale, aunque esté reservado', async () => {
    const sinVallas = await sitioNuevo(org, 'Sin vallas')
    const deBaja = await sitioNuevo(org, 'Solo de baja')
    await vallaEn(org, deBaja, 'V-BAJA', false)
    await reserva(org, sinVallas, { marca: 'Pepsi', ini: 0, fin: 10 })
    await reserva(org, deBaja, { marca: 'Telcel', ini: 0, fin: 10 })
    expect((await ocupacion(dueno, enDias(0), enDias(10))).datos.ocupaciones).toEqual([])
  })

  it('sin marca en la campaña, cuenta el nombre del cliente', async () => {
    await vallaEn(org, org.sitioId, 'V-001')
    await reserva(org, org.sitioId, { marca: '  ', ini: 0, fin: 10 })
    const [o] = (await ocupacion(dueno, enDias(0), enDias(10))).datos.ocupaciones
    expect(o.marca).toBe('Cliente plano-org')
  })
})

describe('aislamiento entre organizaciones', () => {
  it('cada organización ve solo sus reservas, aunque las dos tengan vallas en las mismas fechas', async () => {
    await vallaEn(org, org.sitioId, 'V-001')
    await vallaEn(otra, otra.sitioId, 'V-OTRA')
    await reserva(org, org.sitioId, { marca: 'Pepsi', ini: 0, fin: 10 })
    await reserva(otra, otra.sitioId, { marca: 'Telcel', ini: 0, fin: 10 })

    const mia = (await ocupacion(dueno, enDias(0), enDias(10))).datos.ocupaciones
    const suya = (await ocupacion(duenoOtra, enDias(0), enDias(10))).datos.ocupaciones
    expect(mia.map((o: any) => [o.sitioId, o.marca])).toEqual([[org.sitioId, 'Pepsi']])
    expect(suya.map((o: any) => [o.sitioId, o.marca])).toEqual([[otra.sitioId, 'Telcel']])
  })

  it('otra organización sin vallas no ve nada de ésta', async () => {
    await vallaEn(org, org.sitioId, 'V-001')
    await reserva(org, org.sitioId, { marca: 'Pepsi', ini: 0, fin: 10 })
    expect((await ocupacion(duenoOtra, enDias(0), enDias(10))).datos.ocupaciones).toEqual([])
  })
})

describe('permisos y validación', () => {
  it('COMERCIAL (inventario.ver) lee; FINANZAS sin inventario.ver, 403; sin sesión, 401', async () => {
    expect((await ocupacion(comercial, enDias(0), enDias(10))).status).toBe(200)
    expect((await ocupacion(finanzas, enDias(0), enDias(10))).status).toBe(403)
    expect((await ocupacion(new Cliente(), enDias(0), enDias(10))).status).toBe(401)
  })

  it('sin fechas, con una fecha mal escrita o que no existe, o con el fin antes del inicio: 400', async () => {
    expect((await dueno.pedir('/api/vallas/ocupacion/')).status).toBe(400)
    expect((await ocupacion(dueno, 'manana', enDias(10))).status).toBe(400)
    // Pasa el patrón pero no existe: sin la comprobación, Postgres daría 500.
    expect((await ocupacion(dueno, '2026-13-40', enDias(10))).status).toBe(400)
    expect((await ocupacion(dueno, enDias(10), enDias(0))).status).toBe(400)
  })
})
