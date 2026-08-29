import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  Dar de baja a un propietario pide la contraseña — y ahora se comprueba.
// ----------------------------------------------------------------------------
//  `DELETE /api/arrendadores/[id]` NO TENÍA NI UNA PRUEBA. Ni unitaria ni e2e:
//  se buscó `borrarArrendador` en todo el repo y solo aparecía como `vi.fn()`
//  dentro de un mock. Un guard sin prueba se puede deshacer sin que nada avise,
//  y este archivo existe sobre todo por eso.
//
//  ─── Lo que se descubrió el 2026-08-26, y motivó el cambio ────────────────
//  La ruta usaba `exigirCambioSensible('arrendadores','aprobar')`, que SUENA a
//  «permiso más contraseña». Pero esa función llama a `exigirDesbloqueo()`, y
//  esa mira el interruptor `tenants.exigir_reautenticacion` (`cambios.ts:202`)
//  y **deja pasar sin pedir nada cuando está apagado** — que es como está por
//  defecto y como está en los cinco tenants de producción.
//
//  O sea: la reautenticación estaba escrita y no ocurría. El interruptor es
//  opt-in a propósito para la fricción de negocio —el Dueño decide si su equipo
//  teclea la contraseña al cancelar un contrato—, pero dar de baja a un
//  propietario no debería depender de esa preferencia.
//
//  Se descubrió comparando con el borrado de clientes, que es IRREVERSIBLE y sí
//  pide la contraseña siempre: el catálogo espejo pedía menos para algo
//  parecido. Se igualan por arriba.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let c: Cliente
let sinPermiso: Cliente

async function desbloquear(cl: Cliente): Promise<void> {
  const r = await cl.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
  expect(r.status, JSON.stringify(r.datos)).toBe(200)
}

/** Un propietario sin predios ni contratos: el único caso que la baja permite. */
async function sembrarArrendadorLimpio(nombre: string): Promise<string> {
  const r = await poolTest().query(
    'insert into arrendadores (nombre, tenant_id) values ($1,$2) returning id',
    [nombre, org.id],
  )
  return r.rows[0].id
}

async function sigueActivo(id: string): Promise<boolean> {
  const r = await poolTest().query('select activo from arrendadores where id = $1', [id])
  return r.rows.length > 0 && r.rows[0].activo !== false
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('bajaarr')
  // OPERACIONES no tiene `arrendadores:aprobar`: con él se comprueba que el
  // permiso se mira ANTES que la contraseña.
  await sembrarTenant('bajaarrmiron', { rol: 'OPERACIONES' })
  await arrancarServidor()

  c = new Cliente()
  await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
  await desbloquear(c)

  sinPermiso = new Cliente()
  await sinPermiso.entrar('duenio@bajaarrmiron.test', PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

describe('la baja de un propietario exige la contraseña', () => {
  it('una sesion RECIEN ABIERTA no puede darlo de baja: 403 y sigue activo', async () => {
    // ESTE es el caso que no existía, y el que impide volver atrás. Si alguien
    // devuelve la ruta a `exigirCambioSensible`, este caso se pone rojo — y sin
    // él, ese retroceso sería invisible: todos los demás casos desbloquean
    // primero y seguirían en verde.
    const id = await sembrarArrendadorLimpio('Propietario que no se da de baja')

    const recién = new Cliente()
    await recién.entrar(org.usuarioEmail, PASSWORD_DEMO)

    const r = await recién.pedir(`/api/arrendadores/${id}/`, { metodo: 'DELETE' })

    expect(r.status).toBe(403)
    expect(r.datos?.requiereDesbloqueo).toBe(true)
    expect(await sigueActivo(id)).toBe(true)
  })

  it('y con la contraseña SI: el 403 viene de ahi y no de otra cosa', async () => {
    // La otra mitad, sin la cual un 403 por permisos o por sesión inválida se
    // leería como «la reautenticación funciona».
    const id = await sembrarArrendadorLimpio('Propietario que si se da de baja')

    const r = await c.pedir(`/api/arrendadores/${id}/`, { metodo: 'DELETE' })

    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(await sigueActivo(id)).toBe(false)
  })

  it('un rol sin `arrendadores:aprobar` recibe 403 ANTES de que se le pida nada', async () => {
    // El orden importa y por eso se afirma: pedirle la contraseña a quien de
    // todas formas no puede sería enseñarle un modal para nada, y además le
    // diría que ese propietario existe.
    const id = await sembrarArrendadorLimpio('Propietario que un mirón no toca')

    const r = await sinPermiso.pedir(`/api/arrendadores/${id}/`, { metodo: 'DELETE' })

    expect(r.status).toBe(403)
    expect(r.datos?.requiereDesbloqueo).not.toBe(true)
    expect(await sigueActivo(id)).toBe(true)
  })

  it('sin sesion no se da de baja nada', async () => {
    const id = await sembrarArrendadorLimpio('Propietario a salvo de un anonimo')

    const anónimo = new Cliente()
    const r = await anónimo.pedir(`/api/arrendadores/${id}/`, { metodo: 'DELETE' })

    expect([401, 403]).toContain(r.status)
    expect(await sigueActivo(id)).toBe(true)
  })
})
