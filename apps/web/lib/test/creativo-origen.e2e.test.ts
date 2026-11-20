import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  CREA-ORIGEN (20/11) · quién subió cada creativo, guardado como DATO.
//  Decisión del dueño: «Debemos poner quién subió cada creativo aunque tengan
//  el mismo nombre; lo que importa es el contenido». Contra Postgres y Next
//  reales.
//
//   1. La migración: tres columnas, el check, los comentarios, y la FK que
//      sobrevive al borrado del usuario (el nombre congelado se queda).
//   2. Alta interna (POST /api/creatividades) → INTERNO + usuario de la SESIÓN,
//      aunque el cuerpo intente decir otra cosa.
//   3. Envío del cliente aprobado → CLIENTE, sin usuario interno.
//   4. Dos creativos con el MISMO nombre conservan cada uno su origen —justo
//      el caso que la deducción por bitácora confundía—.
//   5. Reemplazar el arte cambia el contenido → cambia quién lo subió.
//   6. Lo anterior (NULL) se ve como origen desconocido, no se adivina.
//   7. R2: la otra organización no ve los creativos ni su origen.
// ============================================================================

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>
let dueno: Cliente
let ana: Cliente
let duenoOtra: Cliente
let duenoId: string
let anaId: string
let sitioFijo: string

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

async function campana(t: typeof org, sitios: string[], nombre = 'Campaña origen'): Promise<string> {
  const r = await poolTest().query(
    `insert into campanas (nombre, cliente_id, tipo_campana, fecha_inicio, fecha_fin, estado_comercial, tenant_id)
     values ($1,$2,'OOH'::tipo_campana,$3,$4,'CONFIRMADA',$5) returning id`,
    [nombre, t.clienteId, enDias(10), enDias(60), t.id],
  )
  const id = r.rows[0].id as string
  for (const s of sitios) {
    await poolTest().query(
      `insert into reservas (campana_id, sitio_id, fecha_inicio, fecha_fin, precio, estatus, tenant_id)
       values ($1,$2,$3,$4,30000,'CONFIRMADA',$5)`,
      [id, s, enDias(10), enDias(60), t.id],
    )
  }
  return id
}

async function envioDelCliente(t: typeof org, campanaId: string, sitioId: string, nombre: string) {
  const r = await poolTest().query(
    `insert into envios_creativo_cliente (tenant_id, campana_id, sitio_id, nombre_archivo, tipo_mime, tamano_bytes, ancho_px, alto_px, contenido)
     values ($1,$2,$3,$4,'image/png',70,1,1,$5) returning id`,
    [t.id, campanaId, sitioId, nombre, PNG],
  )
  return r.rows[0].id as string
}

const fila = async (id: string) =>
  (await poolTest().query('select origen, subido_por, subido_por_nombre from creatividades where id=$1', [id])).rows[0]
const creativosDeEstado = async (c: Cliente) => ((await c.pedir('/api/estado/')).datos.creatividades ?? []) as any[]

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('origen-org')
  otra = await sembrarTenant('origen-otra')
  sitioFijo = await fijoDe(org, 'Valla Origen')
  const hash = await bcrypt.hash(PASSWORD_DEMO, 4)
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ('Ana López', 'ana@origen-org.test', 'ADMINISTRADOR'::rol_demo, $1, true, $2)`,
    [hash, org.id],
  )
  duenoId = (await poolTest().query('select id from usuarios where email=$1', [org.usuarioEmail])).rows[0].id
  anaId = (await poolTest().query(`select id from usuarios where email='ana@origen-org.test'`)).rows[0].id
  await arrancarServidor()
  dueno = new Cliente()
  await dueno.entrar(org.usuarioEmail, PASSWORD_DEMO)
  ana = new Cliente()
  await ana.entrar('ana@origen-org.test', PASSWORD_DEMO)
  duenoOtra = new Cliente()
  await duenoOtra.entrar(otra.usuarioEmail, PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

beforeEach(async () => {
  await poolTest().query('delete from envios_creativo_cliente')
  await poolTest().query('delete from campanas')
})

describe('1 · la migración', () => {
  it('origen, subido_por y subido_por_nombre existen, admiten null y llevan comentario', async () => {
    const r = await poolTest().query(
      `select column_name, data_type, is_nullable, col_description('creatividades'::regclass, ordinal_position) as comentario
         from information_schema.columns
        where table_name = 'creatividades' and column_name in ('origen','subido_por','subido_por_nombre')
        order by column_name`,
    )
    expect(r.rows.map((x) => [x.column_name, x.data_type, x.is_nullable])).toEqual([
      ['origen', 'text', 'YES'],
      ['subido_por', 'uuid', 'YES'],
      ['subido_por_nombre', 'text', 'YES'],
    ])
    for (const x of r.rows) expect(x.comentario).toMatch(/CREA-ORIGEN/)
  })

  it('el check no deja guardar un origen inventado', async () => {
    const c = await campana(org, [sitioFijo])
    await expect(
      poolTest().query(
        `insert into creatividades (campana_id, nombre, estatus_validacion, tenant_id, origen) values ($1,'x','PENDIENTE',$2,'OTRO')`,
        [c, org.id],
      ),
    ).rejects.toThrow(/creatividades_origen_ck/)
  })

  it('borrar al usuario NO borra el creativo ni su nombre congelado (FK on delete set null)', async () => {
    const c = await campana(org, [sitioFijo])
    const hash = await bcrypt.hash(PASSWORD_DEMO, 4)
    const u = (
      await poolTest().query(
        `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
         values ('Se Va', 'seva@origen-org.test', 'ADMINISTRADOR'::rol_demo, $1, true, $2) returning id`,
        [hash, org.id],
      )
    ).rows[0].id
    const k = (
      await poolTest().query(
        `insert into creatividades (campana_id, nombre, estatus_validacion, tenant_id, origen, subido_por, subido_por_nombre)
         values ($1,'de-quien-se-va.png','PENDIENTE',$2,'INTERNO',$3,'Se Va') returning id`,
        [c, org.id, u],
      )
    ).rows[0].id
    await poolTest().query('delete from usuarios where id=$1', [u])
    expect(await fila(k)).toEqual({ origen: 'INTERNO', subido_por: null, subido_por_nombre: 'Se Va' })
  })
})

describe('2 · alta interna → INTERNO + usuario de la sesión', () => {
  it('POST /api/creatividades guarda INTERNO con el id y el nombre de quien lo sube, y lo devuelve', async () => {
    const c = await campana(org, [sitioFijo])
    const alta = await ana.pedir('/api/creatividades/', { cuerpo: { campanaId: c, nombre: 'arte-ana.png', archivoUrl: PNG } })
    expect(alta.status, JSON.stringify(alta.datos)).toBe(201)
    expect(alta.datos).toMatchObject({ origen: 'INTERNO', subidoPorNombre: 'Ana López' })
    expect(await fila(alta.datos.id)).toEqual({ origen: 'INTERNO', subido_por: anaId, subido_por_nombre: 'Ana López' })
    // Y las lecturas lo traen: la lista de creativos (/api/estado).
    const enLista = (await creativosDeEstado(dueno)).find((x) => x.id === alta.datos.id)
    expect(enLista).toMatchObject({ origen: 'INTERNO', subidoPorNombre: 'Ana López' })
  })

  it('el cuerpo NO decide el origen ni el usuario: lo manda la sesión', async () => {
    const c = await campana(org, [sitioFijo])
    const alta = await dueno.pedir('/api/creatividades/', {
      cuerpo: { campanaId: c, nombre: 'trampa.png', archivoUrl: PNG, origen: 'CLIENTE', subidoPor: anaId, subidoPorNombre: 'Otro' },
    })
    expect(alta.status, JSON.stringify(alta.datos)).toBe(201)
    expect(await fila(alta.datos.id)).toEqual({ origen: 'INTERNO', subido_por: duenoId, subido_por_nombre: 'Dueño origen-org' })
  })
})

describe('3 · envío del cliente aprobado → CLIENTE', () => {
  it('aprobar el envío guarda CLIENTE, sin usuario interno (aprobar no es subir)', async () => {
    const c = await campana(org, [sitioFijo])
    const envio = await envioDelCliente(org, c, sitioFijo, 'lona-cliente.png')
    const ok = await ana.pedir(`/api/campanas/${c}/envios-cliente/${envio}/`, { cuerpo: { accion: 'aprobar' } })
    expect(ok.status, JSON.stringify(ok.datos)).toBe(200)
    expect(await fila(ok.datos.creativo.id)).toEqual({ origen: 'CLIENTE', subido_por: null, subido_por_nombre: null })
    const p = (await dueno.pedir('/api/creativos/pendientes/')).datos as any[]
    expect(p[0].creativos).toEqual([
      expect.objectContaining({ id: ok.datos.creativo.id, origen: 'CLIENTE', subidoPorNombre: null }),
    ])
  })
})

describe('4 · el MISMO nombre no confunde el origen', () => {
  it('uno del cliente y otro nuestro llamados igual, en la misma campaña y al mismo tiempo, conservan cada uno el suyo', async () => {
    const c = await campana(org, [sitioFijo])
    const envio = await envioDelCliente(org, c, sitioFijo, 'lona.png')
    const ok = await dueno.pedir(`/api/campanas/${c}/envios-cliente/${envio}/`, { cuerpo: { accion: 'aprobar' } })
    expect(ok.status, JSON.stringify(ok.datos)).toBe(200)
    // Mismo nombre, segundos después: con la deducción por bitácora (nombre +
    // 10 minutos) éste salía también «del cliente».
    const alta = await ana.pedir('/api/creatividades/', { cuerpo: { campanaId: c, nombre: 'lona.png', archivoUrl: PNG } })
    expect(alta.status).toBe(201)
    await ana.pedir(`/api/creatividades/${alta.datos.id}/`, { metodo: 'PATCH', cuerpo: { aprobar: true } })

    expect(await fila(ok.datos.creativo.id)).toMatchObject({ origen: 'CLIENTE', subido_por: null })
    expect(await fila(alta.datos.id)).toMatchObject({ origen: 'INTERNO', subido_por: anaId, subido_por_nombre: 'Ana López' })

    const imp = (await dueno.pedir('/api/impresion/pendientes/')).datos as any[]
    expect(imp).toHaveLength(1)
    const porId = Object.fromEntries(imp[0].creativos.map((x: any) => [x.id, [x.nombre, x.origen, x.subidoPorNombre]]))
    expect(porId).toEqual({
      [ok.datos.creativo.id]: ['lona.png', 'CLIENTE', null],
      [alta.datos.id]: ['lona.png', 'INTERNO', 'Ana López'],
    })
  })
})

describe('5 · reemplazar el arte cambia quién lo subió', () => {
  it('el arte del cliente reemplazado por Ana pasa a INTERNO, Ana', async () => {
    const c = await campana(org, [sitioFijo])
    const envio = await envioDelCliente(org, c, sitioFijo, 'del-cliente.png')
    const ok = await dueno.pedir(`/api/campanas/${c}/envios-cliente/${envio}/`, { cuerpo: { accion: 'aprobar' } })
    const id = ok.datos.creativo.id
    const r = await ana.pedir(`/api/creatividades/${id}/`, { metodo: 'PUT', cuerpo: { archivoUrl: PNG, formato: 'image/png' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos).toMatchObject({ origen: 'INTERNO', subidoPorNombre: 'Ana López' })
    expect(await fila(id)).toEqual({ origen: 'INTERNO', subido_por: anaId, subido_por_nombre: 'Ana López' })
  })
})

describe('6 · lo anterior al 20/11 queda como origen desconocido', () => {
  it('una fila sin origen viaja con origen null en la lista y en los pendientes (no se deduce)', async () => {
    const c = await campana(org, [sitioFijo])
    const k = (
      await poolTest().query(
        `insert into creatividades (campana_id, nombre, archivo_url, estatus_validacion, tenant_id)
         values ($1,'viejo.png',$2,'VALIDADA',$3) returning id`,
        [c, PNG, org.id],
      )
    ).rows[0].id
    // Aunque la bitácora tenga la acción de antes con su nombre: ya no se lee.
    await poolTest().query(
      `insert into acciones (accion, entidad, usuario_nombre, tenant_id) values ('Aprobó creativo enviado por el cliente','viejo.png','X',$1)`,
      [org.id],
    )
    expect((await creativosDeEstado(dueno)).find((x) => x.id === k)).toMatchObject({ origen: null, subidoPorNombre: null })
    const p = (await dueno.pedir('/api/impresion/pendientes/')).datos as any[]
    expect(p[0].creativos).toEqual([expect.objectContaining({ id: k, origen: null, subidoPorNombre: null })])
  })
})

describe('7 · aislamiento entre organizaciones', () => {
  it('la otra organización no ve mis creativos ni quién los subió', async () => {
    const c = await campana(org, [sitioFijo])
    const alta = await ana.pedir('/api/creatividades/', { cuerpo: { campanaId: c, nombre: 'mio.png', archivoUrl: PNG } })
    expect(alta.status).toBe(201)
    const ajenos = await creativosDeEstado(duenoOtra)
    expect(ajenos.find((x) => x.id === alta.datos.id)).toBeUndefined()
    expect(JSON.stringify(ajenos)).not.toContain('Ana López')
    expect(JSON.stringify((await duenoOtra.pedir('/api/creativos/pendientes/')).datos)).not.toContain('Ana López')
    // Ni puede reemplazarlo para quedarse como «quien lo subió».
    const r = await duenoOtra.pedir(`/api/creatividades/${alta.datos.id}/`, { metodo: 'PUT', cuerpo: { archivoUrl: PNG } })
    expect(r.status).toBe(404)
    expect(await fila(alta.datos.id)).toMatchObject({ origen: 'INTERNO', subido_por: anaId })
  })
})
