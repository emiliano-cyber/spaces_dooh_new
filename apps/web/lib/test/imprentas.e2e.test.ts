import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest, poolApp, comoTenant } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  IMP-REQ (18/11) · imprentas con sus requisitos, contra Postgres y Next reales.
// ----------------------------------------------------------------------------
//  Lo que puede fallar aquí es SQL, RLS y permisos, que las unitarias no ven:
//
//   1. RLS de `imprentas`: con el rol de la APP, una organización no ve ni
//      edita las imprentas de otra; sin `app.tenant_id`, cero filas.
//   2. La FK compuesta: una orden NO puede apuntar a la imprenta de otra
//      organización, ni por la API (400) ni escribiendo directo con el rol de
//      la app (la base lo rechaza).
//   3. CRUD con permiso (imprenta.crear) y sin él (403); nombre único por
//      organización (409), y el mismo nombre SÍ en otra organización.
//   4. `PATCH /api/config { requisitosImpresion }` valida (400 con basura) y
//      guarda saneado; `GET /api/impresion` trae los requisitos de la imprenta.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>
let dueno: Cliente
let duenoOtra: Cliente
let vendedor: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('imprentas-org')
  otra = await sembrarTenant('imprentas-otra')
  // Un VENDEDOR no tiene `imprenta.crear` (catálogo de permisos sembrado).
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ('Vendedor', 'vendedor@imprentas-org.test', 'VENDEDOR'::rol_demo, $1, true, $2)`,
    [await bcrypt.hash(PASSWORD_DEMO, 4), org.id],
  )
  await arrancarServidor()
  dueno = new Cliente()
  await dueno.entrar(org.usuarioEmail, PASSWORD_DEMO)
  duenoOtra = new Cliente()
  await duenoOtra.entrar(otra.usuarioEmail, PASSWORD_DEMO)
  vendedor = new Cliente()
  await vendedor.entrar('vendedor@imprentas-org.test', PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

beforeEach(async () => {
  await poolTest().query('delete from ordenes_impresion')
  await poolTest().query('delete from imprentas')
  await poolTest().query('delete from campanas')
  await poolTest().query(`update config_negocio set requisitos_impresion = '{}'`)
})

async function campanaOOH(tenant: typeof org): Promise<string> {
  const r = await poolTest().query(
    `insert into campanas (nombre, cliente_id, tipo_campana, fecha_inicio, fecha_fin, estado_comercial, tenant_id)
     values ('Campaña lona',$1,'OOH'::tipo_campana,$2,$3,'CONFIRMADA',$4) returning id`,
    [tenant.clienteId, enDias(5), enDias(60), tenant.id],
  )
  return r.rows[0].id
}

describe('CRUD de imprentas y sus permisos', () => {
  it('con imprenta.crear: alta (requisitos saneados), lista y edición', async () => {
    const alta = await dueno.pedir('/api/imprentas/', {
      cuerpo: { nombre: 'Gráficos MX', requisitos: { dpiGranVerde: 25, dpiGranAmbar: 12, formatos: ['PDF', 'TIFF'] } },
    })
    expect(alta.status).toBe(201)
    expect(alta.datos).toMatchObject({ nombre: 'Gráficos MX', activo: true, requisitos: { dpiGranVerde: 25, dpiGranAmbar: 12, formatos: ['PDF', 'TIFF'] } })

    const lista = await dueno.pedir('/api/imprentas/')
    expect(lista.status).toBe(200)
    expect(lista.datos.map((x: any) => x.nombre)).toEqual(['Gráficos MX'])

    const ed = await dueno.pedir(`/api/imprentas/${alta.datos.id}/`, { metodo: 'PATCH', cuerpo: { activo: false, requisitos: { margenCm: 3 } } })
    expect(ed.status).toBe(200)
    expect(ed.datos).toMatchObject({ activo: false, requisitos: { margenCm: 3 } })
  })

  it('requisitos inválidos → 400 (zod), y el ámbar no puede pasar al verde', async () => {
    expect((await dueno.pedir('/api/imprentas/', { cuerpo: { nombre: 'X', requisitos: { dpiGranVerde: 0 } } })).status).toBe(400)
    expect((await dueno.pedir('/api/imprentas/', { cuerpo: { nombre: 'X', requisitos: { formatos: ['EXE'] } } })).status).toBe(400)
    expect((await dueno.pedir('/api/imprentas/', { cuerpo: { nombre: 'X', requisitos: { dpiGranVerde: 5, dpiGranAmbar: 9 } } })).status).toBe(400)
    expect((await dueno.pedir('/api/imprentas/', { cuerpo: { nombre: 'X', extra: 1 } })).status).toBe(400)
  })

  it('nombre único por organización (409), pero el mismo nombre en otra sí entra', async () => {
    expect((await dueno.pedir('/api/imprentas/', { cuerpo: { nombre: 'Lonas Norte' } })).status).toBe(201)
    expect((await dueno.pedir('/api/imprentas/', { cuerpo: { nombre: ' lonas norte ' } })).status).toBe(409)
    expect((await duenoOtra.pedir('/api/imprentas/', { cuerpo: { nombre: 'Lonas Norte' } })).status).toBe(201)
  })

  it('sin imprenta.crear (VENDEDOR): ni alta, ni edición, ni asignar a una orden → 403', async () => {
    const im = (await dueno.pedir('/api/imprentas/', { cuerpo: { nombre: 'Propia' } })).datos
    expect((await vendedor.pedir('/api/imprentas/', { cuerpo: { nombre: 'Otra' } })).status).toBe(403)
    expect((await vendedor.pedir(`/api/imprentas/${im.id}/`, { metodo: 'PATCH', cuerpo: { activo: false } })).status).toBe(403)
    const c = await campanaOOH(org)
    const oi = (await dueno.pedir('/api/impresion/', { cuerpo: { campanaId: c, material: 'Lona' } })).datos
    expect((await vendedor.pedir(`/api/impresion/${oi.id}/imprenta/`, { metodo: 'PATCH', cuerpo: { imprentaId: im.id } })).status).toBe(403)
  })
})

describe('aislamiento entre organizaciones', () => {
  it('por la API: la otra organización no ve la imprenta ni la puede editar (404)', async () => {
    const im = (await dueno.pedir('/api/imprentas/', { cuerpo: { nombre: 'Solo mía' } })).datos
    expect((await duenoOtra.pedir('/api/imprentas/')).datos).toEqual([])
    const r = await duenoOtra.pedir(`/api/imprentas/${im.id}/`, { metodo: 'PATCH', cuerpo: { nombre: 'Robada' } })
    expect(r.status).toBe(404)
    const sigue = await poolTest().query('select nombre from imprentas where id = $1', [im.id])
    expect(sigue.rows[0].nombre).toBe('Solo mía')
  })

  it('con el rol de la APP directo: RLS forzada, sin tenant cero filas, y no se inserta en otra', async () => {
    const im = (await dueno.pedir('/api/imprentas/', { cuerpo: { nombre: 'RLS' } })).datos
    expect(await comoTenant(otra.id, (q) => q('select id from imprentas'))).toEqual([])
    expect((await comoTenant(org.id, (q) => q('select id from imprentas'))).map((r) => r.id)).toEqual([im.id])
    expect((await poolApp().query('select id from imprentas')).rows).toEqual([])
    await expect(
      comoTenant(otra.id, (q) => q(`insert into imprentas (tenant_id, nombre) values ($1, 'Colada')`, [org.id])),
    ).rejects.toThrow()
    // El rol de la app no borra imprentas: la baja es lógica.
    await expect(comoTenant(org.id, (q) => q('delete from imprentas where id = $1', [im.id]))).rejects.toThrow()
  })

  it('una orden no puede apuntar a la imprenta de OTRA organización: 400 por la API y rechazo en la base', async () => {
    const ajena = (await duenoOtra.pedir('/api/imprentas/', { cuerpo: { nombre: 'Ajena' } })).datos
    const c = await campanaOOH(org)
    const oi = (await dueno.pedir('/api/impresion/', { cuerpo: { campanaId: c, material: 'Lona' } })).datos
    expect((await dueno.pedir(`/api/impresion/${oi.id}/imprenta/`, { metodo: 'PATCH', cuerpo: { imprentaId: ajena.id } })).status).toBe(400)
    expect((await dueno.pedir('/api/impresion/', { cuerpo: { campanaId: c, imprentaId: ajena.id } })).status).toBe(400)
    // Directo con el rol de la app (la RLS no deja VER la ajena, pero la FK es la
    // que impide escribirla): la FK compuesta (imprenta_id, tenant_id) falla.
    await expect(
      comoTenant(org.id, (q) => q('update ordenes_impresion set imprenta_id = $1 where id = $2', [ajena.id, oi.id])),
    ).rejects.toThrow(/ordenes_impresion_imprenta_fkey|foreign key/i)
  })

  it('una imprenta dada de baja no se puede asignar (400); la propia activa sí, y viaja con sus requisitos', async () => {
    const c = await campanaOOH(org)
    const oi = (await dueno.pedir('/api/impresion/', { cuerpo: { campanaId: c, material: 'Lona' } })).datos
    const baja = (await dueno.pedir('/api/imprentas/', { cuerpo: { nombre: 'Baja' } })).datos
    await dueno.pedir(`/api/imprentas/${baja.id}/`, { metodo: 'PATCH', cuerpo: { activo: false } })
    expect((await dueno.pedir(`/api/impresion/${oi.id}/imprenta/`, { metodo: 'PATCH', cuerpo: { imprentaId: baja.id } })).status).toBe(400)

    const buena = (await dueno.pedir('/api/imprentas/', { cuerpo: { nombre: 'Buena', requisitos: { dpiGranVerde: 22 } } })).datos
    const r = await dueno.pedir(`/api/impresion/${oi.id}/imprenta/`, { metodo: 'PATCH', cuerpo: { imprentaId: buena.id } })
    expect(r.status).toBe(200)
    expect(r.datos.imprentaId).toBe(buena.id)
    const orden = (await dueno.pedir('/api/impresion/')).datos.find((o: any) => o.id === oi.id)
    expect(orden).toMatchObject({ imprentaId: buena.id, imprentaNombre: 'Buena', imprentaRequisitos: { dpiGranVerde: 22 } })
    // Y se quita con null.
    expect((await dueno.pedir(`/api/impresion/${oi.id}/imprenta/`, { metodo: 'PATCH', cuerpo: { imprentaId: null } })).datos.imprentaId).toBeNull()
  })
})

describe('los requisitos de la empresa por PATCH /api/config', () => {
  it('se guardan saneados, viajan en la config y la otra organización no los recibe', async () => {
    const r = await dueno.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { requisitosImpresion: { dpiGranVerde: 14, margenCm: 2 } } })
    expect(r.status).toBe(200)
    expect(r.datos.requisitosImpresion).toEqual({ dpiGranVerde: 14, margenCm: 2 })
    const fila = await poolTest().query('select tenant_id, requisitos_impresion from config_negocio where tenant_id = any($1)', [[org.id, otra.id]])
    const porTenant = Object.fromEntries(fila.rows.map((x: any) => [x.tenant_id, x.requisitos_impresion]))
    expect(porTenant[org.id]).toEqual({ dpiGranVerde: 14, margenCm: 2 })
    expect(porTenant[otra.id]).toEqual({})
  })

  it('basura → 400 y no se guarda nada', async () => {
    for (const cuerpo of [{ dpiGranVerde: 'mucho' }, { margenCm: -1 }, { campoRaro: 1 }, { formatos: ['GIF'] }]) {
      const r = await dueno.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { requisitosImpresion: cuerpo } })
      expect(r.status).toBe(400)
    }
    const fila = await poolTest().query('select requisitos_impresion from config_negocio where tenant_id = $1', [org.id])
    expect(fila.rows[0].requisitos_impresion).toEqual({})
  })

  it('sin administracion.crear (VENDEDOR) → 403', async () => {
    const r = await vendedor.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { requisitosImpresion: { margenCm: 1 } } })
    expect(r.status).toBe(403)
  })
})
