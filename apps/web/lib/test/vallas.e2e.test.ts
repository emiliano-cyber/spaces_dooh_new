import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
//      el MISMO SITIO (cualquier valla) da un AVISO, nunca un bloqueo.
//   4. Decisiones del dueño del 19/11: las categorías de competencia las edita
//      SOLO el Dueño (el Administrador, con `inventario.crear`, recibe 403), y
//      la migración `20261119_vallas_sembrar_competencia_por_omision.sql` las siembra a
//      las organizaciones que ya existían, sin duplicar al repetirse.
//   5. Vallas también en Comercial (dueño, 19/11): los TRES roles de venta,
//      con la matriz que deja la migración (sin filas a mano), leen vallas y
//      grupos y usan «Verificar una marca»; no dan de alta ni editan vallas ni
//      grupos, y las categorías siguen siendo solo del Dueño.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>
let dueno: Cliente
let duenoOtra: Cliente
let comercial: Cliente
let admin: Cliente
let vendedor: Cliente
let director: Cliente
let gerente: Cliente

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
  // ADMINISTRADOR y VENDEDOR con la rejilla REAL de la matriz de roles
  // (`20260929_roles_de_venta_matriz.sql`): el Administrador SÍ tiene
  // `inventario.crear`, y por eso es el caso que muestra que la puerta de las
  // categorías es el ROL y no el permiso.
  await poolTest().query(
    `insert into rol_permisos (rol, modulo, accion) values
       ('ADMINISTRADOR','inventario','ver'),('ADMINISTRADOR','inventario','crear'),
       ('VENDEDOR','inventario','ver')
     on conflict do nothing`,
  )
  // DIRECTOR_COMERCIAL y GERENTE_VENTAS van SIN filas a mano: lo que miden es
  // la matriz que siembra `20260929_roles_de_venta_matriz.sql`, la de verdad.
  for (const [rol, email] of [
    ['ADMINISTRADOR', 'admin@vallas-org.test'],
    ['VENDEDOR', 'vendedor@vallas-org.test'],
    ['DIRECTOR_COMERCIAL', 'director@vallas-org.test'],
    ['GERENTE_VENTAS', 'gerente@vallas-org.test'],
  ]) {
    await poolTest().query(
      `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
       values ($1::text, $2, $1::text::rol_demo, $3, true, $4)`,
      [rol, email, await bcrypt.hash(PASSWORD_DEMO, 4), org.id],
    )
  }
  await arrancarServidor()
  admin = new Cliente()
  await admin.entrar('admin@vallas-org.test', PASSWORD_DEMO)
  vendedor = new Cliente()
  await vendedor.entrar('vendedor@vallas-org.test', PASSWORD_DEMO)
  dueno = new Cliente()
  await dueno.entrar(org.usuarioEmail, PASSWORD_DEMO)
  duenoOtra = new Cliente()
  await duenoOtra.entrar(otra.usuarioEmail, PASSWORD_DEMO)
  comercial = new Cliente()
  await comercial.entrar('comercial@vallas-org.test', PASSWORD_DEMO)
  director = new Cliente()
  await director.entrar('director@vallas-org.test', PASSWORD_DEMO)
  gerente = new Cliente()
  await gerente.entrar('gerente@vallas-org.test', PASSWORD_DEMO)
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

  it('SOLO el Dueño crea, edita y da de baja categorías: Administrador y Vendedor reciben 403, y todos las ven', async () => {
    const k = await dueno.pedir('/api/vallas/competencia/', { cuerpo: { nombre: 'Refrescos de cola', marcas: ['Coca-Cola', 'Pepsi'] } })
    expect(k.status).toBe(201)

    for (const c of [admin, vendedor, comercial]) {
      expect((await c.pedir('/api/vallas/competencia/')).status).toBe(200)
      const r = await c.pedir('/api/vallas/competencia/', { cuerpo: { nombre: 'Cerveza', marcas: ['Corona', 'Tecate'] } })
      expect(r.status).toBe(403)
      expect((await c.pedir(`/api/vallas/competencia/${k.datos.id}/`, { metodo: 'PATCH', cuerpo: { marcas: ['Pepsi'] } })).status).toBe(403)
      expect((await c.pedir(`/api/vallas/competencia/${k.datos.id}/`, { metodo: 'PATCH', cuerpo: { activo: false } })).status).toBe(403)
    }
    expect((await admin.pedir('/api/vallas/competencia/', { cuerpo: { nombre: 'Cerveza', marcas: [] } })).datos.error).toBe(
      'Solo el Dueño puede editar las marcas que compiten',
    )
    // Nada cambió por los intentos de los demás.
    const filas = await poolTest().query('select nombre, marcas, activo from competencia_categorias where tenant_id = $1', [org.id])
    expect(filas.rows).toEqual([{ nombre: 'Refrescos de cola', marcas: ['Coca-Cola', 'Pepsi'], activo: true }])

    // El Administrador SÍ sigue dando de alta vallas (la puerta es solo de las categorías).
    expect((await alta(admin, { sitioId: org.sitioId, numero: 'ADM-1', ancho: 4, alto: 3 })).status).toBe(201)

    // Y el Dueño da de baja (y de vuelta de alta).
    expect((await dueno.pedir(`/api/vallas/competencia/${k.datos.id}/`, { metodo: 'PATCH', cuerpo: { activo: false } })).datos.activo).toBe(false)
    expect((await dueno.pedir(`/api/vallas/competencia/${k.datos.id}/`, { metodo: 'PATCH', cuerpo: { activo: true } })).datos.activo).toBe(true)
  })

  it('la migración de las categorías por omisión siembra a TODAS las organizaciones existentes, y repetirla no duplica', async () => {
    const sql = readFileSync(join(process.cwd(), '..', '..', 'db', 'migrations', '20261119_vallas_sembrar_competencia_por_omision.sql'), 'utf8')
    // Una categoría propia con el MISMO nombre que una de las de omisión: se respeta.
    await dueno.pedir('/api/vallas/competencia/', { cuerpo: { nombre: 'refrescos de cola', marcas: ['Jarritos', 'Boing'] } })
    await poolTest().query(sql)
    await poolTest().query(sql)
    const porTenant = await poolTest().query(
      `select t.slug, count(k.id)::int as n
         from tenants t left join competencia_categorias k on k.tenant_id = t.id
        group by t.slug order by t.slug`,
    )
    expect(porTenant.rows.length).toBeGreaterThanOrEqual(2)
    for (const r of porTenant.rows) expect(r.n, r.slug).toBe(12)
    const colas = await poolTest().query(
      `select nombre, marcas from competencia_categorias where tenant_id = $1 and lower(nombre) = 'refrescos de cola'`,
      [org.id],
    )
    expect(colas.rows).toEqual([{ nombre: 'refrescos de cola', marcas: ['Jarritos', 'Boing'] }])
    const bancos = await poolTest().query(`select marcas from competencia_categorias where tenant_id = $1 and nombre = 'Bancos'`, [otra.id])
    expect(bancos.rows[0].marcas).toEqual(['BBVA', 'Banorte', 'Santander', 'Citibanamex', 'HSBC'])
    // Y el Dueño ve las doce por la API.
    expect((await dueno.pedir('/api/vallas/competencia/')).datos).toHaveLength(12)
  })

  it('verificar: aviso en cualquier valla del MISMO sitio y en su grupo; nada en otro sitio', async () => {
    await dueno.pedir('/api/vallas/competencia/', { cuerpo: { nombre: 'Refrescos de cola', marcas: ['Coca-Cola', 'Pepsi'] } })
    const s2 = await sitioValla(org, 'Valla Periférico')
    const a = (await alta(dueno, { sitioId: org.sitioId, numero: 'A-1', ancho: 6, alto: 3 })).datos
    const b = (await alta(dueno, { sitioId: s2, numero: 'B-1', ancho: 6, alto: 3 })).datos
    await reservaDeMarca(org, org.sitioId, 'Pepsi', 10, 40)

    // Otra valla del MISMO sitio (alcance por omisión: el sitio entero).
    const vecina = (await alta(dueno, { sitioId: org.sitioId, numero: 'A-2', ancho: 6, alto: 3 })).datos
    const enVecina = await dueno.pedir('/api/vallas/verificar/', { cuerpo: { marca: 'Coca-Cola', fechaInicio: enDias(30), fechaFin: enDias(60), vallaIds: [vecina.id] } })
    expect(enVecina.datos.bloquea).toBe(false)
    expect(enVecina.datos.hallazgos).toHaveLength(1)
    expect(enVecina.datos.hallazgos[0]).toMatchObject({ nivel: 'aviso', datos: { vallaId: vecina.id, marcaExistente: 'Pepsi' } })

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

// Pedido del dueño del 19/11: «Vallas va igual en Comercial». El menú la pone
// también en el grupo Comercial (`nav.ts`, entrada espejo) y la compuerta deja
// entrar a /vallas a los tres roles de venta. Esto comprueba que el SERVIDOR
// cuadra con esa puerta: leer y verificar sí; escribir, no. Sin tocar ni una
// ruta: los tres tienen `inventario.ver` y ninguno `inventario.crear`.
describe('Vallas en Comercial · los tres roles de venta', () => {
  it('la matriz de la migración les da inventario.ver y NO inventario.crear', async () => {
    const r = await poolTest().query(
      `select rol::text, accion from rol_permisos
        where modulo = 'inventario' and rol::text in ('DIRECTOR_COMERCIAL','GERENTE_VENTAS','VENDEDOR')
        order by 1, 2`,
    )
    expect(r.rows).toEqual([
      { rol: 'DIRECTOR_COMERCIAL', accion: 'ver' },
      { rol: 'GERENTE_VENTAS', accion: 'ver' },
      { rol: 'VENDEDOR', accion: 'ver' },
    ])
  })

  it('leen vallas, grupos y categorías y usan «Verificar una marca»', async () => {
    await dueno.pedir('/api/vallas/competencia/', { cuerpo: { nombre: 'Refrescos de cola', marcas: ['Coca-Cola', 'Pepsi'] } })
    const a = (await alta(dueno, { sitioId: org.sitioId, numero: 'C-1', ancho: 6, alto: 3 })).datos
    await dueno.pedir('/api/vallas/grupos/', { cuerpo: { numero: 'G-C', modo: 'separadas', vallaIds: [a.id] } })
    await reservaDeMarca(org, org.sitioId, 'Pepsi', 10, 40)

    for (const [nombre, c] of [['vendedor', vendedor], ['gerente', gerente], ['director', director]] as const) {
      const l = await c.pedir('/api/vallas/')
      expect(l.status, nombre).toBe(200)
      // Solo las del sitio de esta prueba: desde el 24/11 el GET completa los
      // sitios VALLA sin cuadros, y «Valla Periférico» (competencia, arriba)
      // sigue en la base porque el beforeEach borra vallas, no sitios.
      expect(l.datos.vallas.filter((v: any) => v.sitioId === org.sitioId).map((v: any) => v.numero), nombre).toEqual(['C-1'])
      expect(l.datos.grupos.map((g: any) => g.numero), nombre).toEqual(['G-C'])
      expect((await c.pedir('/api/vallas/competencia/')).status, nombre).toBe(200)

      const v = await c.pedir('/api/vallas/verificar/', { cuerpo: { marca: 'Coca-Cola', fechaInicio: enDias(30), fechaFin: enDias(60), vallaIds: [a.id] } })
      expect(v.status, nombre).toBe(200)
      expect(v.datos.bloquea, nombre).toBe(false)
      expect(v.datos.hallazgos[0], nombre).toMatchObject({ regla: 'competencia-marcas', nivel: 'aviso', datos: { marcaExistente: 'Pepsi' } })
    }
  })

  it('pero reciben 403 al dar de alta, editar o borrar vallas y grupos, y al tocar categorías', async () => {
    const k = await dueno.pedir('/api/vallas/competencia/', { cuerpo: { nombre: 'Refrescos de cola', marcas: ['Coca-Cola', 'Pepsi'] } })
    const a = (await alta(dueno, { sitioId: org.sitioId, numero: 'C-2', ancho: 6, alto: 3 })).datos
    const g = (await dueno.pedir('/api/vallas/grupos/', { cuerpo: { numero: 'G-D', modo: 'separadas', vallaIds: [] } })).datos

    for (const [nombre, c] of [['vendedor', vendedor], ['gerente', gerente], ['director', director]] as const) {
      expect((await alta(c, { sitioId: org.sitioId, numero: 'X-1', ancho: 2, alto: 3 })).status, nombre).toBe(403)
      expect((await c.pedir(`/api/vallas/${a.id}/`, { metodo: 'PATCH', cuerpo: { ancho: 9 } })).status, nombre).toBe(403)
      expect((await c.pedir(`/api/vallas/${a.id}/`, { metodo: 'DELETE' })).status, nombre).toBe(403)
      expect((await c.pedir('/api/vallas/grupos/', { cuerpo: { numero: 'G-X', modo: 'separadas', vallaIds: [] } })).status, nombre).toBe(403)
      expect((await c.pedir(`/api/vallas/grupos/${g.id}/`, { metodo: 'PATCH', cuerpo: { numero: 'G-Y' } })).status, nombre).toBe(403)
      expect((await c.pedir(`/api/vallas/grupos/${g.id}/`, { metodo: 'DELETE' })).status, nombre).toBe(403)
      expect((await c.pedir('/api/vallas/competencia/', { cuerpo: { nombre: 'Cerveza', marcas: ['Corona'] } })).status, nombre).toBe(403)
      expect((await c.pedir(`/api/vallas/competencia/${k.datos.id}/`, { metodo: 'PATCH', cuerpo: { marcas: ['Pepsi'] } })).status, nombre).toBe(403)
    }
    // Nada cambió por los intentos.
    const vallas = await poolTest().query('select numero, ancho_m::float8 as ancho from vallas where tenant_id = $1', [org.id])
    expect(vallas.rows).toEqual([{ numero: 'C-2', ancho: 6 }])
    const grupos = await poolTest().query('select numero from vallas_grupos where tenant_id = $1', [org.id])
    expect(grupos.rows).toEqual([{ numero: 'G-D' }])
    const cats = await poolTest().query('select nombre, marcas from competencia_categorias where tenant_id = $1', [org.id])
    expect(cats.rows).toEqual([{ nombre: 'Refrescos de cola', marcas: ['Coca-Cola', 'Pepsi'] }])
  })
})

// 24/11: «del inventario se tiene que ver como el resto». Al listar, un sitio
// VALLA sin cuadros recibe uno por cara (`completarCuadrosDeSitiosValla`).
// Escribe dentro del GET y bajo RLS, así que se prueba contra Postgres real:
// las unitarias de `cuadros-de-sitio.ts` no ven tenant ni índices. Va al final
// del archivo porque los sitios que crea se quedan (el beforeEach no borra
// sitios) y cualquier GET posterior los completaría.
describe('del inventario al módulo: los cuadros salen solos', () => {
  it('un sitio VALLA sin cuadros sale con uno por cara, una sola vez y solo en su organización', async () => {
    const mio = await sitioValla(org, 'Valla Autopista (auto)')
    const ajeno = await sitioValla(otra, 'Valla ajena (auto)')
    const baja = await sitioValla(org, 'Valla dada de baja (auto)')
    await poolTest().query(`update sitios set estatus_comercial = 'BAJA' where id = $1`, [baja])
    const delSitio = (l: any, s: string) => l.datos.vallas.filter((v: any) => v.sitioId === s)

    const l1 = await dueno.pedir('/api/vallas/')
    expect(l1.status).toBe(200)
    const cuadros = delSitio(l1, mio)
    expect(cuadros.map((v: any) => [v.cara, v.ancho, v.alto, v.notas])).toEqual([
      [1, 12, 3, null],
      [2, 12, 3, null],
    ])
    expect(cuadros.every((v: any) => /^V-\d{3}$/.test(v.numero))).toBe(true)
    // De baja no se completa, y el GET de una organización no escribe en la otra.
    expect(delSitio(l1, baja)).toEqual([])
    expect(delSitio(l1, ajeno)).toEqual([])
    const enAjeno = await poolTest().query('select count(*)::int as n from vallas where sitio_id = $1', [ajeno])
    expect(enAjeno.rows[0].n).toBe(0)

    // Otra vuelta no duplica.
    expect(delSitio(await dueno.pedir('/api/vallas/'), mio)).toHaveLength(2)

    // La otra organización completa lo suyo y no ve lo de esta.
    const lo = await duenoOtra.pedir('/api/vallas/')
    expect(delSitio(lo, ajeno)).toHaveLength(2)
    expect(delSitio(lo, mio)).toEqual([])

    // Con un cuadro que quede, ya decidió una persona: no se rellena.
    expect((await dueno.pedir(`/api/vallas/${cuadros[1].id}/`, { metodo: 'DELETE' })).status).toBe(200)
    expect(delSitio(await dueno.pedir('/api/vallas/'), mio).map((v: any) => v.cara)).toEqual([1])
  })
})
