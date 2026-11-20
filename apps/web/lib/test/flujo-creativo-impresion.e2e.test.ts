import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'
import { priorizarImpresion, diaLocal } from '@/lib/prioridad-imprenta'

// ============================================================================
//  FLUJO-CREA (20/11) · «se cierra venta → se recibe el creativo → tarea 1: se
//  manda a impresión o se programa → la impresión va a la cola con prioridad».
//  Contra Postgres y Next reales.
//
//   1. El pendiente APARECE al aprobar un creativo —el del cliente por la liga
//      y el nuestro—, con su origen, y nadie crea nada solo.
//   2. «Mandar a impresión» (POST /api/impresion con el sitio) crea la orden y
//      el pendiente DESAPARECE. Con fecha especial, la orden la lleva.
//   3. Un digital queda «Programar» y desaparece al enviar al dominio.
//   4. Permisos: sin `imprenta.ver`/`imprenta.crear` → 403; el aviso a la
//      bandeja solo lo ve quien tiene Imprenta.
//   5. R2: la otra organización no ve los pendientes ni toca la fecha especial.
//   6. La fecha especial CAMBIA el orden de la cola, y se puede quitar.
//   7. La migración quedó aplicada (columna `date` con su comentario).
// ============================================================================

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>
let dueno: Cliente
let duenoOtra: Cliente
let vendedor: Cliente
let imprenta: Cliente
let sitioFijo: string
let sitioFijoOtra: string

async function fijoDe(t: typeof org, nombre: string): Promise<string> {
  const p = await poolTest().query('select predio_id from sitios where id=$1', [t.sitioId])
  const r = await poolTest().query(
    `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                         alcaldia, ciudad, tarifa_publicada, tarifa_mensual, predio_id, tenant_id,
                         exhibicion, ancho, alto)
     values ($1,$2,$3,'ESPECTACULAR','DISPONIBLE','Cuauhtémoc','CDMX',30000,30000,$4,$5,'fijo',12.9,7.2)
     returning id`,
    [nombre, `${nombre}-CI`, `${nombre}-CP`, p.rows[0].predio_id, t.id],
  )
  return r.rows[0].id
}

async function campana(
  t: typeof org,
  opts: { tipo: string; sitios: string[]; inicio?: string; nombre?: string; propuestaId?: string },
): Promise<string> {
  const r = await poolTest().query(
    `insert into campanas (nombre, cliente_id, tipo_campana, fecha_inicio, fecha_fin, estado_comercial, propuesta_id, tenant_id)
     values ($1,$2,$3::tipo_campana,$4,$5,'CONFIRMADA',$6,$7) returning id`,
    [opts.nombre ?? 'Campaña flujo', t.clienteId, opts.tipo, opts.inicio ?? enDias(10), enDias(60), opts.propuestaId ?? null, t.id],
  )
  const id = r.rows[0].id as string
  for (const s of opts.sitios) {
    await poolTest().query(
      `insert into reservas (campana_id, sitio_id, fecha_inicio, fecha_fin, precio, estatus,
                             spots_reservados, spots_por_dia, tenant_id)
       values ($1,$2,$3,$4,30000,'CONFIRMADA',6,6,$5)`,
      [id, s, opts.inicio ?? enDias(10), enDias(60), t.id],
    )
  }
  return id
}

async function creativoAprobado(c: Cliente, campanaId: string, nombre = 'arte-nuestro.png'): Promise<string> {
  const alta = await c.pedir('/api/creatividades/', { cuerpo: { campanaId, nombre, archivoUrl: PNG } })
  expect(alta.status, JSON.stringify(alta.datos)).toBe(201)
  const ok = await c.pedir(`/api/creatividades/${alta.datos.id}/`, { metodo: 'PATCH', cuerpo: { aprobar: true } })
  expect(ok.status, JSON.stringify(ok.datos)).toBe(200)
  return alta.datos.id
}

async function envioDelCliente(t: typeof org, campanaId: string, sitioId: string, nombre = 'lona-cliente.png') {
  const r = await poolTest().query(
    `insert into envios_creativo_cliente (tenant_id, campana_id, sitio_id, nombre_archivo, tipo_mime, tamano_bytes, ancho_px, alto_px, contenido)
     values ($1,$2,$3,$4,'image/png',70,1,1,$5) returning id`,
    [t.id, campanaId, sitioId, nombre, PNG],
  )
  return r.rows[0].id as string
}

const pendientesImpresion = async (c: Cliente) => (await c.pedir('/api/impresion/pendientes/')).datos as any[]
const pendientesCreativos = async (c: Cliente) => (await c.pedir('/api/creativos/pendientes/')).datos as any[]

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('flujo-org')
  otra = await sembrarTenant('flujo-otra')
  sitioFijo = await fijoDe(org, 'Valla Reforma')
  sitioFijoOtra = await fijoDe(otra, 'Valla Ajena')
  const hash = await bcrypt.hash(PASSWORD_DEMO, 4)
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id) values
       ('Vendedor', 'vendedor@flujo-org.test', 'VENDEDOR'::rol_demo, $1, true, $2),
       ('Imprenta', 'imprenta@flujo-org.test', 'IMPRENTA'::rol_demo, $1, true, $2)`,
    [hash, org.id],
  )
  await arrancarServidor()
  dueno = new Cliente()
  await dueno.entrar(org.usuarioEmail, PASSWORD_DEMO)
  duenoOtra = new Cliente()
  await duenoOtra.entrar(otra.usuarioEmail, PASSWORD_DEMO)
  vendedor = new Cliente()
  await vendedor.entrar('vendedor@flujo-org.test', PASSWORD_DEMO)
  imprenta = new Cliente()
  await imprenta.entrar('imprenta@flujo-org.test', PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

beforeEach(async () => {
  await poolTest().query('delete from ordenes_impresion')
  await poolTest().query('delete from envios_creativo_cliente')
  await poolTest().query('delete from campanas')
})

describe('7 · la migración', () => {
  it('ordenes_impresion.fecha_especial existe, es date, admite null y lleva comentario', async () => {
    const r = await poolTest().query(
      `select data_type, is_nullable, col_description('ordenes_impresion'::regclass, ordinal_position) as comentario
         from information_schema.columns where table_name = 'ordenes_impresion' and column_name = 'fecha_especial'`,
    )
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]).toMatchObject({ data_type: 'date', is_nullable: 'YES' })
    expect(r.rows[0].comentario).toMatch(/fecha_inicio/)
  })
})

describe('1 · el pendiente aparece al aprobar, y nada se crea solo', () => {
  it('sin creativo aprobado no hay pendiente de impresión', async () => {
    await campana(org, { tipo: 'OOH', sitios: [sitioFijo] })
    expect(await pendientesImpresion(dueno)).toEqual([])
  })

  it('al aprobar un creativo NUESTRO: «Mandar a impresión» con origen INTERNO y la medida del sitio; ninguna orden creada', async () => {
    const c = await campana(org, { tipo: 'OOH', sitios: [sitioFijo], nombre: 'Lona propia' })
    const kid = await creativoAprobado(dueno, c)
    const p = await pendientesImpresion(dueno)
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({
      accion: 'IMPRIMIR',
      campanaId: c,
      sitioId: sitioFijo,
      sitioNombre: 'Valla Reforma',
      sitioAncho: 12.9,
      sitioAlto: 7.2,
      creativos: [{ id: kid, origen: 'INTERNO', estatus: 'VALIDADA' }],
    })
    expect(Number((await poolTest().query('select count(*) n from ordenes_impresion')).rows[0].n)).toBe(0)
  })

  it('el del CLIENTE por la liga: «por aprobar» con origen CLIENTE y, al aprobarlo, pendiente de impresión con origen CLIENTE', async () => {
    const c = await campana(org, { tipo: 'OOH', sitios: [sitioFijo], nombre: 'Lona del cliente' })
    const envio = await envioDelCliente(org, c, sitioFijo)

    const antes = await pendientesCreativos(dueno)
    expect(antes).toEqual([
      expect.objectContaining({
        accion: 'POR_APROBAR',
        campanaId: c,
        sitioId: sitioFijo,
        creativos: [{ id: null, nombre: 'lona-cliente.png', estatus: 'PENDIENTE', origen: 'CLIENTE' }],
      }),
    ])
    // Por aprobar NO es trabajo de Imprenta todavía.
    expect(await pendientesImpresion(dueno)).toEqual([])

    const ok = await dueno.pedir(`/api/campanas/${c}/envios-cliente/${envio}/`, { cuerpo: { accion: 'aprobar' } })
    expect(ok.status, JSON.stringify(ok.datos)).toBe(200)

    const p = await pendientesImpresion(dueno)
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({ accion: 'IMPRIMIR', sitioId: sitioFijo })
    expect(p[0].creativos).toEqual([expect.objectContaining({ nombre: 'lona-cliente.png', origen: 'CLIENTE', estatus: 'VALIDADA' })])
    // Y en Creativos se ve igual, ya sin el «por aprobar».
    expect((await pendientesCreativos(dueno)).map((x: any) => x.accion)).toEqual(['IMPRIMIR'])
  })

  it('un creativo nuestro sin aprobar se ve «por aprobar» con origen INTERNO, no como pendiente de impresión', async () => {
    const c = await campana(org, { tipo: 'OOH', sitios: [sitioFijo] })
    const alta = await dueno.pedir('/api/creatividades/', { cuerpo: { campanaId: c, nombre: 'borrador.png', archivoUrl: PNG } })
    expect(alta.status).toBe(201)
    const p = await pendientesCreativos(dueno)
    expect(p).toEqual([expect.objectContaining({ accion: 'POR_APROBAR', creativos: [expect.objectContaining({ id: alta.datos.id, origen: 'INTERNO' })] })])
    expect(await pendientesImpresion(dueno)).toEqual([])
  })

  it('aviso en la bandeja: lo ve quien tiene Imprenta, no un VENDEDOR', async () => {
    const desde = new Date(Date.now() - 5_000).toISOString()
    const c = await campana(org, { tipo: 'OOH', sitios: [sitioFijo], nombre: 'Aviso imprenta' })
    await creativoAprobado(dueno, c)
    const titulos = async (cl: Cliente) =>
      ((await cl.pedir(`/api/notificaciones/nuevas/?desde=${encodeURIComponent(desde)}`)).datos.notificaciones as any[])
        .filter((n) => n.titulo === 'Por mandar a impresión' && String(n.detalle).includes('Aviso imprenta'))
    const vistas = await titulos(imprenta)
    expect(vistas).toHaveLength(1)
    expect(vistas[0]).toMatchObject({ tipo: 'IMPRESION', link: '/imprenta' })
    expect(vistas[0].detalle).toContain('Aviso imprenta')
    expect(await titulos(vendedor)).toEqual([])
    expect(await titulos(duenoOtra)).toEqual([])
  })
})

describe('2 · «Mandar a impresión» crea la orden y quita el pendiente', () => {
  it('con medida, material y fecha especial: 201, la orden los lleva y el pendiente desaparece', async () => {
    const c = await campana(org, { tipo: 'OOH', sitios: [sitioFijo] })
    await creativoAprobado(dueno, c)
    const r = await imprenta.pedir('/api/impresion/', {
      cuerpo: { campanaId: c, sitioId: sitioFijo, material: 'Lona front', ancho: 12.9, alto: 7.2, fechaEspecial: enDias(3) },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(r.datos).toMatchObject({ campanaId: c, sitioId: sitioFijo, material: 'Lona front', ancho: 12.9, alto: 7.2, fechaEspecial: enDias(3) })
    expect(await pendientesImpresion(imprenta)).toEqual([])
    expect(await pendientesCreativos(dueno)).toEqual([])
  })

  it('una fecha especial que no existe → 400 y no se crea nada', async () => {
    const c = await campana(org, { tipo: 'OOH', sitios: [sitioFijo] })
    const r = await dueno.pedir('/api/impresion/', { cuerpo: { campanaId: c, sitioId: sitioFijo, fechaEspecial: '2026-02-30' } })
    expect(r.status).toBe(400)
    expect(Number((await poolTest().query('select count(*) n from ordenes_impresion')).rows[0].n)).toBe(0)
  })
})

describe('3 · digital: «Programar» hasta que se envía al dominio', () => {
  it('pendiente PROGRAMAR al aprobar; enviar al dominio lo quita; nunca sale en Imprenta', async () => {
    const c = await campana(org, { tipo: 'DOOH', sitios: [org.sitioId] })
    await creativoAprobado(dueno, c)
    const p = await pendientesCreativos(dueno)
    expect(p).toEqual([expect.objectContaining({ accion: 'PROGRAMAR', sitioId: org.sitioId })])
    expect(await pendientesImpresion(dueno)).toEqual([])
    const env = await dueno.pedir(`/api/campanas/${c}/enviar-dominio/`, { cuerpo: {} })
    expect(env.status, JSON.stringify(env.datos)).toBe(200)
    expect(await pendientesCreativos(dueno)).toEqual([])
  })
})

describe('4 · permisos', () => {
  it('sin imprenta.ver ni .crear (VENDEDOR): pendientes de Imprenta, crear la orden y la fecha especial → 403', async () => {
    const c = await campana(org, { tipo: 'OOH', sitios: [sitioFijo] })
    await creativoAprobado(dueno, c)
    expect((await vendedor.pedir('/api/impresion/pendientes/')).status).toBe(403)
    expect((await vendedor.pedir('/api/impresion/', { cuerpo: { campanaId: c, sitioId: sitioFijo } })).status).toBe(403)
    const oi = (await dueno.pedir('/api/impresion/', { cuerpo: { campanaId: c, sitioId: sitioFijo } })).datos
    const r = await vendedor.pedir(`/api/impresion/${oi.id}/fecha-especial/`, { metodo: 'PATCH', cuerpo: { fechaEspecial: enDias(2) } })
    expect(r.status).toBe(403)
    const fila = await poolTest().query('select fecha_especial from ordenes_impresion where id=$1', [oi.id])
    expect(fila.rows[0].fecha_especial).toBeNull()
  })

  it('los pendientes de Creativos exigen Comercial: el rol IMPRENTA recibe 403', async () => {
    expect((await imprenta.pedir('/api/creativos/pendientes/')).status).toBe(403)
  })
})

describe('5 · aislamiento entre organizaciones', () => {
  it('la otra organización no ve los pendientes ni toca la fecha especial (404), ni crea orden con mi campaña', async () => {
    const c = await campana(org, { tipo: 'OOH', sitios: [sitioFijo] })
    await creativoAprobado(dueno, c)
    const cOtra = await campana(otra, { tipo: 'OOH', sitios: [sitioFijoOtra], nombre: 'Ajena' })
    await creativoAprobado(duenoOtra, cOtra, 'ajeno.png')

    expect((await pendientesImpresion(dueno)).map((x: any) => x.campanaId)).toEqual([c])
    expect((await pendientesImpresion(duenoOtra)).map((x: any) => x.campanaId)).toEqual([cOtra])
    expect((await pendientesCreativos(duenoOtra)).map((x: any) => x.campanaId)).toEqual([cOtra])

    const oi = (await dueno.pedir('/api/impresion/', { cuerpo: { campanaId: c, sitioId: sitioFijo } })).datos
    const r = await duenoOtra.pedir(`/api/impresion/${oi.id}/fecha-especial/`, { metodo: 'PATCH', cuerpo: { fechaEspecial: enDias(1) } })
    expect(r.status).toBe(404)
    const fila = await poolTest().query('select fecha_especial from ordenes_impresion where id=$1', [oi.id])
    expect(fila.rows[0].fecha_especial).toBeNull()
    // Crear una orden con la campaña ajena tampoco: la RLS no la deja ver (409),
    // y con mi sitio, el sitio ya no es suyo (400). Ninguna orden nueva.
    expect((await duenoOtra.pedir('/api/impresion/', { cuerpo: { campanaId: c } })).status).toBe(409)
    expect((await duenoOtra.pedir('/api/impresion/', { cuerpo: { campanaId: c, sitioId: sitioFijo } })).status).toBe(400)
    expect(Number((await poolTest().query('select count(*) n from ordenes_impresion')).rows[0].n)).toBe(1)
    // Ni con MI campaña y el sitio de la otra: el sitio tiene que ser de esta organización.
    expect((await dueno.pedir('/api/impresion/', { cuerpo: { campanaId: c, sitioId: sitioFijoOtra } })).status).toBe(400)
  })
})

describe('6 · la fecha especial cambia el orden de la cola', () => {
  it('PATCH la pone (y la quita con null); GET la trae; la que tiene la fecha más próxima pasa delante', async () => {
    const tarde = await campana(org, { tipo: 'OOH', sitios: [sitioFijo], inicio: enDias(90), nombre: 'Arranca tarde' })
    const pronto = await campana(org, { tipo: 'OOH', sitios: [sitioFijo], inicio: enDias(5), nombre: 'Arranca pronto' })
    const oiTarde = (await dueno.pedir('/api/impresion/', { cuerpo: { campanaId: tarde, sitioId: sitioFijo } })).datos
    await dueno.pedir('/api/impresion/', { cuerpo: { campanaId: pronto, sitioId: sitioFijo } })

    const cola = async () => {
      const lista = (await dueno.pedir('/api/impresion/')).datos as any[]
      return priorizarImpresion(
        lista.map((o) => ({ ...o, inicioCampana: o.campanaInicio })),
        diaLocal(new Date()),
      )
    }
    expect((await cola()).map((x) => x.orden.campanaNombre)).toEqual(['Arranca pronto', 'Arranca tarde'])

    const r = await imprenta.pedir(`/api/impresion/${oiTarde.id}/fecha-especial/`, { metodo: 'PATCH', cuerpo: { fechaEspecial: enDias(2) } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.fechaEspecial).toBe(enDias(2))
    const ahora = await cola()
    expect(ahora.map((x) => x.orden.campanaNombre)).toEqual(['Arranca tarde', 'Arranca pronto'])
    expect(ahora[0]).toMatchObject({ base: 'ESPECIAL', lugar: 1 })
    expect(ahora[1]).toMatchObject({ base: 'INICIO', lugar: 2 })

    expect((await dueno.pedir(`/api/impresion/${oiTarde.id}/fecha-especial/`, { metodo: 'PATCH', cuerpo: { fechaEspecial: null } })).status).toBe(200)
    expect((await cola()).map((x) => x.orden.campanaNombre)).toEqual(['Arranca pronto', 'Arranca tarde'])
  })

  it('basura → 400; id que no es uuid o que no existe → 404', async () => {
    const c = await campana(org, { tipo: 'OOH', sitios: [sitioFijo] })
    const oi = (await dueno.pedir('/api/impresion/', { cuerpo: { campanaId: c, sitioId: sitioFijo } })).datos
    for (const fechaEspecial of ['mañana', '2026-13-01', '2026-02-30', 20261120]) {
      expect((await dueno.pedir(`/api/impresion/${oi.id}/fecha-especial/`, { metodo: 'PATCH', cuerpo: { fechaEspecial } })).status).toBe(400)
    }
    expect((await dueno.pedir('/api/impresion/no-es-uuid/fecha-especial/', { metodo: 'PATCH', cuerpo: { fechaEspecial: null } })).status).toBe(404)
    expect(
      (await dueno.pedir('/api/impresion/00000000-0000-4000-8000-000000000000/fecha-especial/', { metodo: 'PATCH', cuerpo: { fechaEspecial: null } })).status,
    ).toBe(404)
  })
})
