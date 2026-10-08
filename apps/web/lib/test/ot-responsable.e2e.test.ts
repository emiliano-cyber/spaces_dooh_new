import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  El responsable de una OT se VE en pantalla (08/10).
//
//  Pedido del dueño: al abrir una OT cerrada sin responsable, que aparezca
//  quien la cerró. El servidor ya lo estampaba desde la auditoría del 04/08
//  (`cerrarOT`: asignado_a = coalesce(asignado_a, quien cierra)), pero la
//  pantalla de Operaciones decía «Sin asignar» en TODAS: busca el nombre en la
//  lista de usuarios del almacén, y `/api/estado` nunca la mandaba —el almacén
//  arrancaba con `usuarios: []`—. Por lo mismo el selector «Responsable» de la
//  OT nueva salía vacío.
//
//  Ahora `/api/estado` manda una lista MÍNIMA (id, nombre, rol, activo; sin
//  correo) a quien puede ver Operaciones, y solo de su organización.
// ============================================================================

// Un PNG real de 1×1: `cerrar` valida que la evidencia sea una imagen.
const FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>
let vend: Awaited<ReturnType<typeof sembrarTenant>>
let dueno: Cliente
let vendedor: Cliente
let duenoId = ''

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('otresp')
  otra = await sembrarTenant('otrespotra')
  vend = await sembrarTenant('otrespvend', { rol: 'VENDEDOR' })
  duenoId = (await poolTest().query('select id from usuarios where email = $1', [org.usuarioEmail])).rows[0].id
  await arrancarServidor()
  dueno = new Cliente()
  await dueno.entrar(org.usuarioEmail, PASSWORD_DEMO)
  vendedor = new Cliente()
  await vendedor.entrar(vend.usuarioEmail, PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

async function otSinResponsable(): Promise<string> {
  const { rows } = await poolTest().query(
    `insert into ordenes_trabajo (folio, tipo, sitio_id, descripcion, fecha_programada, estatus, tenant_id)
     values ('OT-RESP-1', 'HERRERIA', $1, 'Herrería', now(), 'PENDIENTE', $2) returning id`,
    [org.sitioId, org.id],
  )
  return rows[0].id
}

describe('la lista de usuarios que ve Operaciones', () => {
  it('llega en /api/estado con id, nombre, rol y activo, y SIN correo', async () => {
    const r = await dueno.pedir('/api/estado/')
    expect(r.status).toBe(200)
    const yo = (r.datos.usuarios as any[]).find((u) => u.id === duenoId)
    expect(yo).toMatchObject({ id: duenoId, nombre: `Dueño otresp`, rol: 'DUENO', activo: true })
    expect(Object.keys(yo).sort()).toEqual(['activo', 'id', 'nombre', 'rol'])
  })

  it('NEGATIVO: no trae usuarios de otra organización', async () => {
    const r = await dueno.pedir('/api/estado/')
    const correoAjeno = (await poolTest().query('select id from usuarios where email = $1', [otra.usuarioEmail])).rows[0].id
    expect((r.datos.usuarios as any[]).map((u) => u.id)).not.toContain(correoAjeno)
  })

  it('NEGATIVO: quien no ve Operaciones no la recibe', async () => {
    const r = await vendedor.pedir('/api/estado/')
    expect(r.status).toBe(200)
    expect(r.datos.ordenesTrabajo).toEqual([]) // el vendedor no ve Operaciones
    expect(r.datos.usuarios).toEqual([])
  })
})

describe('cerrar una OT sin responsable', () => {
  it('deja como responsable a quien la cerró, y la pantalla puede nombrarlo', async () => {
    const id = await otSinResponsable()
    const c = await dueno.pedir(`/api/ot/${id}/cerrar/`, { cuerpo: { fotoUrl: FOTO } })
    expect(c.status).toBe(200)

    const r = await dueno.pedir('/api/estado/')
    const ot = (r.datos.ordenesTrabajo as any[]).find((o) => o.id === id)
    expect(ot.estatus).toBe('COMPLETADA')
    expect(ot.asignadoAUserId).toBe(duenoId)
    // Lo que hace la pantalla: buscar ese id en la lista de usuarios.
    const nombre = (r.datos.usuarios as any[]).find((u) => u.id === ot.asignadoAUserId)?.nombre
    expect(nombre).toBe('Dueño otresp')

    // Y al ABRIR la OT (su pantalla carga /api/ot/:id, no el estado).
    const det = await dueno.pedir(`/api/ot/${id}/`)
    expect(det.status).toBe(200)
    expect(det.datos.responsable).toBe('Dueño otresp')
  })

  it('una OT sin responsable lo dice como null, no con un nombre inventado', async () => {
    const { rows } = await poolTest().query(
      `insert into ordenes_trabajo (folio, tipo, sitio_id, descripcion, fecha_programada, estatus, tenant_id)
       values ('OT-RESP-2', 'HERRERIA', $1, 'Herrería', now(), 'PENDIENTE', $2) returning id`,
      [org.sitioId, org.id],
    )
    const det = await dueno.pedir(`/api/ot/${rows[0].id}/`)
    expect(det.datos.responsable).toBeNull()
  })
})
