import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest, poolApp, comoTenant } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  VALLAS (esqueleto, 19/11) · contra Postgres y Next reales.
// ----------------------------------------------------------------------------
//   1. CRUD de vallas, grupos y categorías de competencia, con `inventario.crear`
//      y sin él (COMERCIAL solo tiene `inventario.ver`: lee, no escribe).
//   2. Aislamiento: otra organización no ve, no edita y no borra; una valla no
//      cuelga de un sitio ajeno ni entra en un grupo ajeno (API y FK compuesta);
//      con el rol de la app y sin tenant, cero filas.
//   3. `POST /api/vallas/verificar`: Coca-Cola junto a una reserva de Pepsi en
//      la misma valla, o en su grupo «una sola imagen», da un AVISO.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>
let dueno: Cliente
let duenoOtra: Cliente
let comercial: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('vallas-org')
  otra = await sembrarTenant('vallas-otra')
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ('Comercial', 'comercial@vallas-org.test', 'COMERCIAL'::rol_demo, $1, true, $2)`,
    [await bcrypt.hash(PASSWORD_DEMO, 4), org.id],
  )
  await arrancarServidor()
  dueno = new Cliente()
  await dueno.entrar(org.usuarioEmail, PASSWORD_DEMO)
  duenoOtra = new Cliente()
  await duenoOtra.entrar(otra.usuarioEmail, PASSWORD_DEMO)
  comercial = new Cliente()
  await comercial.entrar('comercial@vallas-org.test', PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

beforeEach(async () => {
  await poolTest().query('delete from vallas')
  await poolTest().query('delete from vallas_grupos')
  await poolTest().query('delete from competencia_categorias')
  await poolTest().query('delete from reservas')
  await poolTest().query('delete from campanas')
})

const alta = (c: Cliente, cuerpo: Record<string, unknown>) => c.pedir('/api/vallas/', { cuerpo })

async function sitioValla(tenant: typeof org, nombre: string): Promise<string> {
  const r = await poolTest().query(
    `insert into sitios (nombre, tipo_medio, estatus_comercial, ancho, alto, caras, propio, tenant_id, exhibicion)
     values ($1, 'VALLA', 'DISPONIBLE', 12, 3, 2, true, $2, 'fijo') returning id`,
    [nombre, tenant.id],
  )
  return r.rows[0].id
}

async function reservaDeMarca(tenant: typeof org, sitioId: string, marca: string, ini: number, fin: number) {
  const c = await poolTest().query(
    `insert into campanas (nombre, cliente_id, marca, tipo_campana, fecha_inicio, fecha_fin, estado_comercial, tenant_id)
     values ($1,$2,$3,'OOH'::tipo_campana,$4,$5,'CONFIRMADA',$6) returning id`,
    [`Campaña ${marca}`, tenant.clienteId, marca, enDias(ini), enDias(fin), tenant.id],
  )
  await poolTest().query(
    `insert into reservas (campana_id, sitio_id, fecha_inicio, fecha_fin, precio, estatus, tenant_id)
     values ($1,$2,$3,$4,1000,'CONFIRMADA',$5)`,
    [c.rows[0].id, sitioId, enDias(ini), enDias(fin), tenant.id],
  )
  return c.rows[0].id as string
}

describe('CRUD de vallas y sus permisos', () => {
  it('alta, lista, edición y borrado con inventario.crear', async () => {
    const a = await alta(dueno, { sitioId: org.sitioId, numero: ' v-001 ', ancho: 6, alto: 3, cara: 1 })
    expect(a.status).toBe(201)
    expect(a.datos).toMatchObject({ numero: 'V-001', ancho: 6, alto: 3, cara: 1, sitioId: org.sitioId, grupoId: null })

    const l = await dueno.pedir('/api/vallas/')
    expect(l.status).toBe(200)
    expect(l.datos.vallas.map((v: any) => v.numero)).toEqual(['V-001'])
    expect(l.datos.grupos).toEqual([])

    const e = await dueno.pedir(`/api/vallas/${a.datos.id}/`, { metodo: 'PATCH', cuerpo: { ancho: 6.5, notas: 'Cara norte' } })
    expect(e.status).toBe(200)
    expect(e.datos).toMatchObject({ ancho: 6.5, notas: 'Cara norte' })

    expect((await dueno.pedir(`/api/vallas/${a.datos.id}/`, { metodo: 'DELETE' })).status).toBe(200)
    expect((await dueno.pedir('/api/vallas/')).datos.vallas).toEqual([])
  })

  it('validación (400) y número único por organización (409), sin chocar con otra organización', async () => {
    expect((await alta(dueno, { sitioId: org.sitioId, numero: 'X', ancho: 0, alto: 3 })).status).toBe(400)
    expect((await alta(dueno, { sitioId: org.sitioId, numero: '', ancho: 2, alto: 3 })).status).toBe(400)
    expect((await alta(dueno, { sitioId: org.sitioId, numero: 'X', ancho: 2, alto: 3, extra: 1 })).status).toBe(400)
    expect((await alta(dueno, { sitioId: org.sitioId, numero: 'V-7', ancho: 2, alto: 3 })).status).toBe(201)
    expect((await alta(dueno, { sitioId: org.sitioId, numero: 'v-7', ancho: 2, alto: 3 })).status).toBe(409)
    expect((await alta(duenoOtra, { sitioId: otra.sitioId, numero: 'V-7', ancho: 2, alto: 3 })).status).toBe(201)
  })

  it('COMERCIAL (solo inventario.ver) lee pero no escribe: 403', async () => {
    const a = (await alta(dueno, { sitioId: org.sitioId, numero: 'V-1', ancho: 2, alto: 3 })).datos
    expect((await comercial.pedir('/api/vallas/')).status).toBe(200)
    expect((await alta(comercial, { sitioId: org.sitioId, numero: 'V-2', ancho: 2, alto: 3 })).status).toBe(403)
    expect((await comercial.pedir(`/api/vallas/${a.id}/`, { metodo: 'PATCH', cuerpo: { ancho: 9 } })).status).toBe(403)
    expect((await comercial.pedir(`/api/vallas/${a.id}/`, { metodo: 'DELETE' })).status).toBe(403)
    expect((await comercial.pedir('/api/vallas/grupos/', { cuerpo: { numero: 'G-1', modo: 'separadas', vallaIds: [] } })).status).toBe(403)
    expect((await comercial.pedir('/api/vallas/competencia/', { cuerpo: { nombre: 'Colas', marcas: ['Pepsi'] } })).status).toBe(403)
  })
})

describe('grupos de vallas', () => {
  it('crear con sus vallas y modo, cambiarlo, y al borrarlo las vallas quedan sueltas', async () => {
    const a = (await alta(dueno, { sitioId: org.sitioId, numero: 'V-1', ancho: 4, alto: 3 })).datos
    const b = (await alta(dueno, { sitioId: org.sitioId, numero: 'V-2', ancho: 4, alto: 3 })).datos
    const g = await dueno.pedir('/api/vallas/grupos/', { cuerpo: { numero: 'G-1', modo: 'una_imagen', ancho: 8, alto: 3, vallaIds: [a.id, b.id] } })
    expect(g.status).toBe(201)
    expect(g.datos).toMatchObject({ numero: 'G-1', modo: 'una_imagen', ancho: 8, alto: 3 })

    const l = (await dueno.pedir('/api/vallas/')).datos
    expect(l.vallas.map((v: any) => [v.numero, v.grupoId, v.posicion])).toEqual([
      ['V-1', g.datos.id, 1],
      ['V-2', g.datos.id, 2],
    ])

    const e = await dueno.pedir(`/api/vallas/grupos/${g.datos.id}/`, { metodo: 'PATCH', cuerpo: { modo: 'separadas', vallaIds: [b.id] } })
    expect(e.status).toBe(200)
    expect(e.datos.modo).toBe('separadas')
    const l2 = (await dueno.pedir('/api/vallas/')).datos
    expect(l2.vallas.map((v: any) => [v.numero, v.grupoId])).toEqual([
      ['V-1', null],
      ['V-2', g.datos.id],
    ])

    expect((await dueno.pedir(`/api/vallas/grupos/${g.datos.id}/`, { metodo: 'DELETE' })).status).toBe(200)
    const l3 = (await dueno.pedir('/api/vallas/')).datos
    expect(l3.grupos).toEqual([])
    expect(l3.vallas.every((v: any) => v.grupoId === null)).toBe(true)
  })

  it('modo inválido → 400; número de grupo duplicado → 409', async () => {
    expect((await dueno.pedir('/api/vallas/grupos/', { cuerpo: { numero: 'G-1', modo: 'mosaico', vallaIds: [] } })).status).toBe(400)
    expect((await dueno.pedir('/api/vallas/grupos/', { cuerpo: { numero: 'G-1', modo: 'separadas', vallaIds: [] } })).status).toBe(201)
    expect((await dueno.pedir('/api/vallas/grupos/', { cuerpo: { numero: 'g-1', modo: 'separadas', vallaIds: [] } })).status).toBe(409)
  })
})

describe('aislamiento entre organizaciones', () => {
  it('por la API: la otra organización no ve, no edita ni borra (404)', async () => {
    const a = (await alta(dueno, { sitioId: org.sitioId, numero: 'Solo mía', ancho: 4, alto: 3 })).datos
    const g = (await dueno.pedir('/api/vallas/grupos/', { cuerpo: { numero: 'G-mío', modo: 'separadas', vallaIds: [a.id] } })).datos
    const k = (await dueno.pedir('/api/vallas/competencia/', { cuerpo: { nombre: 'Colas', marcas: ['Pepsi'] } })).datos
    expect((await duenoOtra.pedir('/api/vallas/')).datos).toEqual({ vallas: [], grupos: [] })
    expect((await duenoOtra.pedir('/api/vallas/competencia/')).datos).toEqual([])
    expect((await duenoOtra.pedir(`/api/vallas/${a.id}/`, { metodo: 'PATCH', cuerpo: { numero: 'Robada' } })).status).toBe(404)
    expect((await duenoOtra.pedir(`/api/vallas/${a.id}/`, { metodo: 'DELETE' })).status).toBe(404)
    expect((await duenoOtra.pedir(`/api/vallas/grupos/${g.id}/`, { metodo: 'DELETE' })).status).toBe(404)
    expect((await duenoOtra.pedir(`/api/vallas/competencia/${k.id}/`, { metodo: 'PATCH', cuerpo: { activo: false } })).status).toBe(404)
    const sigue = await poolTest().query('select numero from vallas where id = $1', [a.id])
    expect(sigue.rows[0].numero).toBe('SOLO MÍA')
  })

  it('una valla no cuelga de un sitio ajeno, ni un grupo junta vallas ajenas (400)', async () => {
    expect((await alta(dueno, { sitioId: otra.sitioId, numero: 'V-x', ancho: 4, alto: 3 })).status).toBe(400)
    const ajena = (await alta(duenoOtra, { sitioId: otra.sitioId, numero: 'V-ajena', ancho: 4, alto: 3 })).datos
    expect((await dueno.pedir('/api/vallas/grupos/', { cuerpo: { numero: 'G-x', modo: 'separadas', vallaIds: [ajena.id] } })).status).toBe(400)
  })

  it('con el rol de la APP directo: RLS forzada, sin tenant cero filas, y la FK compuesta corta lo ajeno', async () => {
    const a = (await alta(dueno, { sitioId: org.sitioId, numero: 'RLS', ancho: 4, alto: 3 })).datos
    const gAjeno = (await duenoOtra.pedir('/api/vallas/grupos/', { cuerpo: { numero: 'G-otra', modo: 'separadas', vallaIds: [] } })).datos
    expect(await comoTenant(otra.id, (q) => q('select id from vallas'))).toEqual([])
    expect((await comoTenant(org.id, (q) => q('select id from vallas'))).map((r) => r.id)).toEqual([a.id])
    expect((await poolApp().query('select id from vallas')).rows).toEqual([])
    expect((await poolApp().query('select id from vallas_grupos')).rows).toEqual([])
    expect((await poolApp().query('select id from competencia_categorias')).rows).toEqual([])
    // Insertar con el tenant de otro: la política lo rechaza.
    await expect(
      comoTenant(otra.id, (q) => q(`insert into vallas (tenant_id, sitio_id, numero, ancho_m, alto_m) values ($1,$2,'Colada',1,1)`, [org.id, org.sitioId])),
    ).rejects.toThrow()
    // Su propio tenant, pero el sitio de otro: la FK compuesta.
    await expect(
      comoTenant(org.id, (q) => q(`insert into vallas (tenant_id, sitio_id, numero, ancho_m, alto_m) values ($1,$2,'Colada',1,1)`, [org.id, otra.sitioId])),
    ).rejects.toThrow(/vallas_sitio_fkey|foreign key/i)
    await expect(
      comoTenant(org.id, (q) => q('update vallas set grupo_id = $1 where id = $2', [gAjeno.id, a.id])),
    ).rejects.toThrow(/vallas_grupo_fkey|foreign key/i)
    // Las categorías no se borran (baja lógica).
    const k = (await dueno.pedir('/api/vallas/competencia/', { cuerpo: { nombre: 'Colas', marcas: [] } })).datos
    await expect(comoTenant(org.id, (q) => q('delete from competencia_categorias where id = $1', [k.id]))).rejects.toThrow()
  })
})

describe('competencia de marcas', () => {
  it('categorías: alta (marcas sin repetir), edición y nombre único', async () => {
    const k = await dueno.pedir('/api/vallas/competencia/', { cuerpo: { nombre: 'Refrescos de cola', marcas: ['Coca-Cola', ' Pepsi ', 'coca cola'] } })
    expect(k.status).toBe(201)
    expect(k.datos).toMatchObject({ nombre: 'Refrescos de cola', marcas: ['Coca-Cola', 'Pepsi'], activo: true })
    expect((await dueno.pedir('/api/vallas/competencia/', { cuerpo: { nombre: 'refrescos de cola ', marcas: [] } })).status).toBe(409)
    const e = await dueno.pedir(`/api/vallas/competencia/${k.datos.id}/`, { metodo: 'PATCH', cuerpo: { marcas: ['Coca-Cola', 'Pepsi', 'RC Cola'] } })
    expect(e.datos.marcas).toEqual(['Coca-Cola', 'Pepsi', 'RC Cola'])
  })

  it('verificar: aviso en la misma valla y en el grupo «una sola imagen»; nada en otra valla suelta', async () => {
    await dueno.pedir('/api/vallas/competencia/', { cuerpo: { nombre: 'Refrescos de cola', marcas: ['Coca-Cola', 'Pepsi'] } })
    const s2 = await sitioValla(org, 'Valla Periférico')
    const a = (await alta(dueno, { sitioId: org.sitioId, numero: 'A-1', ancho: 6, alto: 3 })).datos
    const b = (await alta(dueno, { sitioId: s2, numero: 'B-1', ancho: 6, alto: 3 })).datos
    await reservaDeMarca(org, org.sitioId, 'Pepsi', 10, 40)

    const misma = await dueno.pedir('/api/vallas/verificar/', { cuerpo: { marca: 'coca cola', fechaInicio: enDias(30), fechaFin: enDias(60), vallaIds: [a.id] } })
    expect(misma.status).toBe(200)
    expect(misma.datos.bloquea).toBe(false)
    expect(misma.datos.hallazgos).toHaveLength(1)
    expect(misma.datos.hallazgos[0]).toMatchObject({ regla: 'competencia-marcas', nivel: 'aviso', datos: { marcaExistente: 'Pepsi', vallaId: a.id } })

    const suelta = await dueno.pedir('/api/vallas/verificar/', { cuerpo: { marca: 'Coca-Cola', fechaInicio: enDias(30), fechaFin: enDias(60), vallaIds: [b.id] } })
    expect(suelta.datos.hallazgos).toEqual([])

    const fuera = await dueno.pedir('/api/vallas/verificar/', { cuerpo: { marca: 'Coca-Cola', fechaInicio: enDias(41), fechaFin: enDias(60), vallaIds: [a.id] } })
    expect(fuera.datos.hallazgos).toEqual([])

    await dueno.pedir('/api/vallas/grupos/', { cuerpo: { numero: 'G-1', modo: 'una_imagen', ancho: 12, alto: 3, vallaIds: [a.id, b.id] } })
    const grupo = await dueno.pedir('/api/vallas/verificar/', { cuerpo: { marca: 'Coca-Cola', fechaInicio: enDias(30), fechaFin: enDias(60), vallaIds: [b.id] } })
    expect(grupo.datos.hallazgos).toHaveLength(1)
    expect(grupo.datos.hallazgos[0].datos).toMatchObject({ vallaId: b.id, vallaOcupada: a.id })

    // Por sitio: todas las vallas del sitio.
    const porSitio = await dueno.pedir('/api/vallas/verificar/', { cuerpo: { marca: 'Coca-Cola', fechaInicio: enDias(30), fechaFin: enDias(60), sitioIds: [org.sitioId] } })
    expect(porSitio.datos.hallazgos).toHaveLength(1)
  })

  it('verificar no ve las reservas ni las vallas de otra organización', async () => {
    await dueno.pedir('/api/vallas/competencia/', { cuerpo: { nombre: 'Colas', marcas: ['Coca-Cola', 'Pepsi'] } })
    await duenoOtra.pedir('/api/vallas/competencia/', { cuerpo: { nombre: 'Colas', marcas: ['Coca-Cola', 'Pepsi'] } })
    const ajena = (await alta(duenoOtra, { sitioId: otra.sitioId, numero: 'O-1', ancho: 6, alto: 3 })).datos
    await reservaDeMarca(otra, otra.sitioId, 'Pepsi', 10, 40)
    const r = await dueno.pedir('/api/vallas/verificar/', { cuerpo: { marca: 'Coca-Cola', fechaInicio: enDias(20), fechaFin: enDias(30), vallaIds: [ajena.id] } })
    expect(r.status).toBe(200)
    expect(r.datos.hallazgos).toEqual([])
  })
})
