import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  Eliminar un usuario desde Administración (2026-11-09)
//
//  El dueño decidió que se puede borrar a CUALQUIERA, tenga o no historial. El
//  `DELETE /api/usuarios/:id` existía desde agosto, pero sin botón y sin pedir
//  la contraseña: una sesión de Dueño olvidada abierta bastaba para vaciar el
//  equipo. Lo que estas pruebas fijan, y que las unitarias no pueden ver porque
//  simulan la base:
//
//   1. sin reautenticarse, NO borra (403 con `requiereDesbloqueo`);
//   2. reautenticado, borra de verdad, le corta las sesiones al borrado, y la
//      bitácora dice su NOMBRE (antes guardaba el id);
//   3. su historial NO lo impide, y la bitácora (append-only) no se toca;
//   4. ni a sí mismo ni a alguien de otra organización (404, no 403).
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let cDueno: Cliente
let duenoId: string

async function sembrarUsuario(nombre: string, email: string): Promise<string> {
  const r = await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ($1, $2, 'VENDEDOR', $3, true, $4) returning id`,
    [nombre, email, await bcrypt.hash(PASSWORD_DEMO, 4), alfa.id],
  )
  return r.rows[0].id as string
}

async function existe(id: string): Promise<boolean> {
  return (await poolTest().query('select 1 from usuarios where id = $1', [id])).rowCount === 1
}

beforeAll(async () => {
  await recrearEsquema()
  alfa = await sembrarTenant('borrar-alfa')
  beta = await sembrarTenant('borrar-beta')
  duenoId = (
    await poolTest().query('select id from usuarios where lower(email) = lower($1)', [alfa.usuarioEmail])
  ).rows[0].id
  await arrancarServidor()
  cDueno = new Cliente()
  await cDueno.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

describe('borrar un usuario', () => {
  it('1 · sin reautenticarse NO borra, aunque sea Dueño', async () => {
    const id = await sembrarUsuario('Sin reautenticar', 'sinreaut@borrar.test')
    const r = await cDueno.pedir(`/api/usuarios/${id}/`, { metodo: 'DELETE' })
    expect(r.status, JSON.stringify(r.datos)).toBe(403)
    expect(r.datos.requiereDesbloqueo).toBe(true)
    expect(await existe(id)).toBe(true)
  })

  it('2 · reautenticado borra, corta sus sesiones y la bitácora dice su nombre', async () => {
    const id = await sembrarUsuario('Ana Borrable', 'ana@borrar.test')
    const cAna = new Cliente()
    await cAna.entrar('ana@borrar.test', PASSWORD_DEMO)
    expect((await cAna.pedir('/api/estado/')).status).toBe(200)

    const des = await cDueno.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
    expect(des.status, JSON.stringify(des.datos)).toBe(200)

    const r = await cDueno.pedir(`/api/usuarios/${id}/`, { metodo: 'DELETE' })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(await existe(id)).toBe(false)

    // Sus sesiones se fueron en cascada: la que tenía abierta ya no sirve.
    expect((await cAna.pedir('/api/estado/')).status).toBe(401)

    const acc = await poolTest().query(
      `select entidad from acciones where accion = 'Eliminó usuario' order by timestamp desc limit 1`,
    )
    expect(acc.rows[0]?.entidad).toBe('Ana Borrable')
  })

  // Esta es la que encontró el fallo: hasta `20261109_acciones_sin_fk_usuario.sql`
  // daba 500, porque el `on delete set null` de la bitácora chocaba con su
  // trigger append-only. Ahora la bitácora NI SE TOCA: conserva id y nombre.
  it('3 · con historial también se borra, y su fila de bitácora queda intacta', async () => {
    const id = await sembrarUsuario('Beto Con Historial', 'beto@borrar.test')
    await poolTest().query(
      `insert into acciones (accion, entidad, usuario_id, usuario_nombre, tenant_id)
       values ('Creó propuesta', 'P-0001', $1, 'Beto Con Historial', $2)`,
      [id, alfa.id],
    )

    await cDueno.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
    const r = await cDueno.pedir(`/api/usuarios/${id}/`, { metodo: 'DELETE' })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(await existe(id)).toBe(false)

    const h = await poolTest().query(
      `select usuario_id, usuario_nombre from acciones where entidad = 'P-0001' and accion = 'Creó propuesta'`,
    )
    expect(h.rows[0]).toEqual({ usuario_id: id, usuario_nombre: 'Beto Con Historial' })
  })

  it('4 · a sí mismo no (400) y a alguien de otra organización tampoco (404, no 403)', async () => {
    await cDueno.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })

    const yo = await cDueno.pedir(`/api/usuarios/${duenoId}/`, { metodo: 'DELETE' })
    expect(yo.status).toBe(400)
    expect(await existe(duenoId)).toBe(true)

    const ajenoId = (
      await poolTest().query('select id from usuarios where lower(email) = lower($1)', [beta.usuarioEmail])
    ).rows[0].id
    const ajeno = await cDueno.pedir(`/api/usuarios/${ajenoId}/`, { metodo: 'DELETE' })
    expect(ajeno.status).toBe(404)
    expect(await existe(ajenoId)).toBe(true)
  })
})
