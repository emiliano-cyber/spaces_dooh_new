import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  PERMISOS-EDITABLES (11/11) · el Dueño cambia la matriz desde Administración.
//
//  Es e2e porque toca QUIÉN PUEDE QUÉ: la prueba de verdad es que un vendedor
//  que no podía abrir Administración pueda en cuanto el Dueño se lo concede, y
//  deje de poder en cuanto se lo quita — sin reiniciar nada.
//
//  Los negativos: sin contraseña no cambia; el Administrador no cambia; la
//  columna del Dueño no se toca; y con dos organizaciones en el servidor, no.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let cDueno: Cliente
let cVendedor: Cliente
let cAdmin: Cliente

async function sembrarUsuario(rol: string, email: string, tenantId: string) {
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ($1, $2, $3::rol_demo, $4, true, $5)`,
    [email, email, rol, await bcrypt.hash(PASSWORD_DEMO, 4), tenantId],
  )
}
const fila = async (rol: string, modulo: string, accion: string) =>
  (await poolTest().query('select 1 from rol_permisos where rol = $1 and modulo = $2 and accion = $3', [rol, modulo, accion]))
    .rowCount === 1

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  // La semilla de desarrollo deja la organización `rgb`. Una instancia
  // soberana nace con UNA sola (la del bootstrap), que es el caso que se
  // prueba: se retira para que alfa sea la única. El 409 con dos se prueba
  // al final, sembrando otra.
  await poolTest().query("delete from tenants where slug = 'rgb'")
  alfa = await sembrarTenant('permisos-alfa')
  await sembrarUsuario('VENDEDOR', 'vende@permisos.test', alfa.id)
  await sembrarUsuario('ADMINISTRADOR', 'admin@permisos.test', alfa.id)
  await arrancarServidor()
  cDueno = new Cliente()
  await cDueno.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  cVendedor = new Cliente()
  await cVendedor.entrar('vende@permisos.test', PASSWORD_DEMO)
  cAdmin = new Cliente()
  await cAdmin.entrar('admin@permisos.test', PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

const CAMBIO = { rol: 'VENDEDOR', modulo: 'administracion', accion: 'ver' }

describe('cambiar la matriz de permisos', () => {
  it('0 · de partida el vendedor NO abre la matriz', async () => {
    expect(await fila('VENDEDOR', 'administracion', 'ver')).toBe(false)
    expect((await cVendedor.pedir('/api/admin/permisos-matriz/')).status).toBe(403)
  })

  it('1 · sin reautenticarse NO cambia, aunque sea el Dueño', async () => {
    const r = await cDueno.pedir('/api/admin/permisos-matriz/', { metodo: 'PUT', cuerpo: { ...CAMBIO, permitido: true } })
    expect(r.status, JSON.stringify(r.datos)).toBe(403)
    expect(r.datos.requiereDesbloqueo).toBe(true)
    expect(await fila('VENDEDOR', 'administracion', 'ver')).toBe(false)
  })

  it('2 · el Dueño concede y el vendedor entra AL MOMENTO; lo quita y deja de entrar', async () => {
    const des = await cDueno.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
    expect(des.status, JSON.stringify(des.datos)).toBe(200)

    const si = await cDueno.pedir('/api/admin/permisos-matriz/', { metodo: 'PUT', cuerpo: { ...CAMBIO, permitido: true } })
    expect(si.status, JSON.stringify(si.datos)).toBe(200)
    expect(si.datos.filas).toContainEqual({ rol: 'VENDEDOR', modulo: 'administracion', accion: 'ver' })
    expect((await cVendedor.pedir('/api/admin/permisos-matriz/')).status).toBe(200)

    const no = await cDueno.pedir('/api/admin/permisos-matriz/', { metodo: 'PUT', cuerpo: { ...CAMBIO, permitido: false } })
    expect(no.status, JSON.stringify(no.datos)).toBe(200)
    expect((await cVendedor.pedir('/api/admin/permisos-matriz/')).status).toBe(403)

    const acc = await poolTest().query(
      `select accion, entidad from acciones where accion in ('Concedió permiso', 'Quitó permiso') order by timestamp`,
    )
    expect(acc.rows.map((r) => r.accion)).toEqual(['Concedió permiso', 'Quitó permiso'])
    expect(acc.rows[0].entidad).toBe('VENDEDOR · administracion · ver')
  })

  it('3 · NEGATIVO · la columna del Dueño no se toca', async () => {
    await cDueno.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
    const r = await cDueno.pedir('/api/admin/permisos-matriz/', {
      metodo: 'PUT',
      cuerpo: { rol: 'DUENO', modulo: 'administracion', accion: 'ver', permitido: false },
    })
    expect(r.status).toBe(400)
    expect(await fila('DUENO', 'administracion', 'ver')).toBe(true)
  })

  it('4 · NEGATIVO · el Administrador no cambia permisos, ni reautenticado', async () => {
    await cAdmin.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
    const r = await cAdmin.pedir('/api/admin/permisos-matriz/', { metodo: 'PUT', cuerpo: { ...CAMBIO, permitido: true } })
    expect(r.status).toBe(403)
    expect(await fila('VENDEDOR', 'administracion', 'ver')).toBe(false)
  })

  it('5 · NEGATIVO · con dos organizaciones en el servidor se rechaza (409)', async () => {
    await sembrarTenant('permisos-beta')
    await cDueno.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
    const r = await cDueno.pedir('/api/admin/permisos-matriz/', { metodo: 'PUT', cuerpo: { ...CAMBIO, permitido: true } })
    expect(r.status, JSON.stringify(r.datos)).toBe(409)
    expect(await fila('VENDEDOR', 'administracion', 'ver')).toBe(false)
  })
})
