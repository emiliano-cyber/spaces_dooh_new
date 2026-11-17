import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'
import { imagenAHtml } from '../creativo-html'

// ============================================================================
//  IMP-CREA / IMP-PRIO (17/11) · el arte en Imprenta, contra Postgres y Next reales.
// ----------------------------------------------------------------------------
//  Lo que cambió y se mide aquí, porque lo que puede fallar es SQL y permisos,
//  que las unitarias no ven:
//
//   1. Una campaña FIJA (OOH) ya recibe arte (antes: 409 «su producción es
//      por imprenta»).
//   2. `GET /api/impresion` trae, por orden, la fecha de inicio de la campaña
//      (para la prioridad), la medida del sitio y el arte de la campaña — sin
//      los retirados ni el arte de otras campañas.
//   3. Un rol que solo tiene Imprenta (IMPRENTA: imprenta.ver/crear, nada de
//      Comercial) ve el arte de una campaña CON orden de impresión, y NO el de
//      una campaña sin orden. Ese segundo caso es el que impide que abrir el
//      arte a la imprenta lo abra a toda la empresa.
//   4. El arte de otra organización no se sirve ni con Comercial (RLS + tenant).
// ============================================================================

// PNG de 1 × 1, real (la subida valida el tipo por sus bytes mágicos).
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>
let dueno: Cliente
let imprenta: Cliente
let duenoOtra: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('imprenta-arte')
  otra = await sembrarTenant('imprenta-otra')
  // El rol IMPRENTA lo siembra la migración `20260820_catalogo_permisos_completo`
  // con imprenta.ver y imprenta.crear, y nada de Comercial.
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ('Imprenta', 'imprenta@imprenta-arte.test', 'IMPRENTA'::rol_demo, $1, true, $2)`,
    [await bcrypt.hash(PASSWORD_DEMO, 4), org.id],
  )
  // El sitio con medida: 12 × 4 m (3:1), la proporción que se pinta.
  await poolTest().query('update sitios set ancho = 12, alto = 4 where id = $1', [org.sitioId])
  await arrancarServidor()
  dueno = new Cliente()
  await dueno.entrar(org.usuarioEmail, PASSWORD_DEMO)
  imprenta = new Cliente()
  await imprenta.entrar('imprenta@imprenta-arte.test', PASSWORD_DEMO)
  duenoOtra = new Cliente()
  await duenoOtra.entrar(otra.usuarioEmail, PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

beforeEach(async () => {
  await poolTest().query('delete from ordenes_impresion')
  await poolTest().query('delete from creatividades')
  await poolTest().query('delete from campanas')
})

async function campana(tenant: typeof org, tipo: 'OOH' | 'HIBRIDA' | 'DOOH', inicio: string): Promise<string> {
  const r = await poolTest().query(
    `insert into campanas (nombre, cliente_id, tipo_campana, fecha_inicio, fecha_fin, estado_comercial, tenant_id)
     values ('Campaña imprenta',$1,$2::tipo_campana,$3,$4,'CONFIRMADA',$5) returning id`,
    [tenant.clienteId, tipo, inicio, enDias(60), tenant.id],
  )
  return r.rows[0].id
}

async function subirArte(cli: Cliente, campanaId: string, nombre = 'lona.png') {
  return cli.pedir('/api/creatividades/', {
    cuerpo: { campanaId, nombre, codigo: imagenAHtml(PNG, nombre), formato: 'text/html' },
  })
}

describe('una campaña fija recibe arte', () => {
  it('POST /api/creatividades a una campaña OOH responde 201 y queda por aprobar', async () => {
    const c = await campana(org, 'OOH', enDias(5))
    const r = await subirArte(dueno, c)
    expect(r.status).toBe(201)
    expect(r.datos.estatusValidacion).toBe('PENDIENTE')
  })

  it('aprobarlo no falla aunque la campaña no tenga pantallas digitales', async () => {
    const c = await campana(org, 'OOH', enDias(5))
    const { datos } = await subirArte(dueno, c)
    const r = await dueno.pedir(`/api/creatividades/${datos.id}/`, { metodo: 'PATCH', cuerpo: { aprobar: true } })
    expect(r.status).toBe(200)
  })
})

describe('GET /api/impresion trae lo que Imprenta necesita', () => {
  it('fecha de inicio como texto, medida del sitio y el arte de SU campaña, sin retirados', async () => {
    const inicio = enDias(5)
    const c = await campana(org, 'OOH', inicio)
    const otraCampana = await campana(org, 'HIBRIDA', enDias(40))
    const bueno = (await subirArte(dueno, c, 'bueno.png')).datos
    const retirado = (await subirArte(dueno, c, 'retirado.png')).datos
    await poolTest().query('update creatividades set retirado_en = now() where id = $1', [retirado.id])
    await subirArte(dueno, otraCampana, 'de-otra.png')
    const oi = await dueno.pedir('/api/impresion/', {
      cuerpo: { campanaId: c, sitioId: org.sitioId, material: 'Lona front', ancho: 0, alto: 0 },
    })
    expect(oi.status).toBe(201)

    const r = await dueno.pedir('/api/impresion/')
    expect(r.status).toBe(200)
    const orden = r.datos.find((o: any) => o.id === oi.datos.id)
    expect(orden.campanaInicio).toBe(inicio)
    expect(orden.tipoCampana).toBe('OOH')
    expect(orden.sitioAncho).toBe(12)
    expect(orden.sitioAlto).toBe(4)
    expect(orden.creativos.map((x: any) => x.nombre)).toEqual(['bueno.png'])
    expect(orden.creativos[0]).toMatchObject({
      id: bueno.id,
      esImagen: true,
      estatusValidacion: 'PENDIENTE',
      archivoUrl: `/spaces-dooh/api/creativos/${bueno.id}/arte/`,
    })
  })

  it('una orden sin creativos trae la lista vacía, no undefined', async () => {
    const c = await campana(org, 'OOH', enDias(5))
    await dueno.pedir('/api/impresion/', { cuerpo: { campanaId: c, material: 'Vinil' } })
    const r = await dueno.pedir('/api/impresion/')
    expect(r.datos[0].creativos).toEqual([])
    expect(r.datos[0].sitioAncho).toBeNull()
  })
})

describe('quién ve el arte', () => {
  it('IMPRENTA (sin Comercial) ve el arte de una campaña con orden de impresión', async () => {
    const c = await campana(org, 'OOH', enDias(5))
    const { datos } = await subirArte(dueno, c)
    await dueno.pedir('/api/impresion/', { cuerpo: { campanaId: c, material: 'Lona' } })
    const r = await imprenta.pedir(`/api/creativos/${datos.id}/arte/`)
    expect(r.status).toBe(200)
  })

  it('IMPRENTA NO ve el arte de una campaña sin orden de impresión', async () => {
    const c = await campana(org, 'HIBRIDA', enDias(5))
    const { datos } = await subirArte(dueno, c)
    const r = await imprenta.pedir(`/api/creativos/${datos.id}/arte/`)
    expect(r.status).toBe(403)
  })

  it('IMPRENTA sigue sin poder subir arte (eso es de Comercial)', async () => {
    const c = await campana(org, 'OOH', enDias(5))
    const r = await subirArte(imprenta, c)
    expect(r.status).toBe(403)
  })

  it('el arte de otra organización no se sirve, aunque tenga orden de impresión', async () => {
    const c = await campana(org, 'OOH', enDias(5))
    const { datos } = await subirArte(dueno, c)
    await dueno.pedir('/api/impresion/', { cuerpo: { campanaId: c, material: 'Lona' } })
    const r = await duenoOtra.pedir(`/api/creativos/${datos.id}/arte/`)
    expect(r.status).toBe(404)
    const lista = await duenoOtra.pedir('/api/impresion/')
    expect(lista.datos).toEqual([])
  })
})
