import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente, BASE } from './servidor-e2e'

// ============================================================================
//  El candado de los códigos de recuperación.  (ADR 0028 · B2)
// ----------------------------------------------------------------------------
//  Los códigos son la única puerta del Dueño el día que pierda su cuenta de
//  Google. Pero solo le sirven si los TIENE: dejarle usar la aplicación antes de
//  habérselos enseñado es tener la puerta y perder la llave.
//
//  Lo que se vigila aquí, y son casi todos negativos:
//
//   · que quien entró con Google y no los ha visto **no pueda usar la
//     aplicación** — que no se pueda saltar;
//   · que **sí pueda llegar a la pantalla que se los da**, o el candado
//     encerraría en vez de proteger;
//   · que quien entró con **contraseña NO se vea afectado**, que es lo que hace
//     este cambio seguro de desplegar hoy;
//   · y que confirmar **dos veces no mueva la fecha**: la primera es la que
//     vale.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('codvistos')
  await arrancarServidor()
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

/** Un cliente ya dentro. */
async function dentro(): Promise<Cliente> {
  const c = new Cliente()
  await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
  return c
}

/**
 * Deja la sesión abierta como si se hubiera entrado con Google.
 *
 * En producción eso lo pone `crearSesion()` (migración 73, `sesiones.metodo`).
 * Aquí se fuerza en la base porque montar el flujo entero de Google no aportaría
 * nada a lo que estas pruebas vigilan, que es el GUARD.
 */
async function sesionComoGoogle(): Promise<void> {
  await poolTest().query(
    `update sesiones set metodo = 'google'
      where usuario_id = (select id from usuarios where lower(email) = lower($1))`,
    [org.usuarioEmail],
  )
}

async function codigosVistosEn(): Promise<string | null> {
  const r = await poolTest().query(
    `select codigos_vistos_en from usuarios where lower(email) = lower($1)`,
    [org.usuarioEmail],
  )
  return r.rows[0]?.codigos_vistos_en ?? null
}

async function limpiarEstado(): Promise<void> {
  await poolTest().query(
    `update usuarios set codigos_vistos_en = null where lower(email) = lower($1)`,
    [org.usuarioEmail],
  )
  await poolTest().query('delete from codigos_recuperacion')
}

describe('quien entró con Google y no tiene códigos', () => {
  it('NO puede usar la aplicación: el guard corta con 403', async () => {
    // Es el caso entero. Si esto pasara, el Dueño andaría por la aplicación
    // creyendo que tiene una segunda puerta que nadie le ha dado.
    await limpiarEstado()
    const c = await dentro()
    await sesionComoGoogle()

    const r = await c.pedir('/api/estado/')
    expect(r.status).toBe(403)
    expect(JSON.stringify(r.datos).toLowerCase()).toContain('recuperación')
  })

  it('pero SÍ puede pedir sus códigos: el candado no puede encerrar', async () => {
    // Si esta ruta pasara por `exigir()`, el usuario quedaría cortado por no
    // tener códigos y sin forma de conseguirlos. Es la misma salida que
    // `/api/perfil` para la contraseña temporal.
    await limpiarEstado()
    const c = await dentro()
    await sesionComoGoogle()

    const r = await c.pedir('/api/perfil/codigos-recuperacion/', { cuerpo: {} })
    expect(r.status).toBe(201)
    expect(Array.isArray(r.datos.codigos)).toBe(true)
    expect(r.datos.codigos).toHaveLength(10)
  })

  it('y generarlos NO basta: hasta que confirma, sigue cortado', async () => {
    // Si confirmar fuera automático, bastaría con que se cerrara la pestaña para
    // que quedara dentro y sin códigos, creyendo que los tiene.
    await limpiarEstado()
    const c = await dentro()
    await sesionComoGoogle()

    await c.pedir('/api/perfil/codigos-recuperacion/', { cuerpo: {} })
    expect((await c.pedir('/api/estado/')).status).toBe(403)
    expect(await codigosVistosEn()).toBeNull()
  })

  it('al confirmar, se abre', async () => {
    await limpiarEstado()
    const c = await dentro()
    await sesionComoGoogle()

    await c.pedir('/api/perfil/codigos-recuperacion/', { cuerpo: {} })
    const conf = await c.pedir('/api/perfil/codigos-recuperacion/?ya=1', { cuerpo: {} })
    expect(conf.status).toBe(200)
    expect(conf.datos.quedan).toBe(10)

    expect((await c.pedir('/api/estado/')).status).toBe(200)
    expect(await codigosVistosEn()).not.toBeNull()
  })

  it('confirmar dos veces NO mueve la fecha: la primera es la que vale', async () => {
    // Es lo que permite responder «¿desde cuándo tiene sus códigos?» el día que
    // haya una disputa sobre quién pudo entrar a esa instancia.
    await limpiarEstado()
    const c = await dentro()
    await sesionComoGoogle()

    await c.pedir('/api/perfil/codigos-recuperacion/', { cuerpo: {} })
    await c.pedir('/api/perfil/codigos-recuperacion/?ya=1', { cuerpo: {} })
    const primera = await codigosVistosEn()

    await c.pedir('/api/perfil/codigos-recuperacion/?ya=1', { cuerpo: {} })
    expect(await codigosVistosEn()).toEqual(primera)
  })
})

describe('quien entró con CONTRASEÑA no se ve afectado', () => {
  it('usa la aplicación con normalidad aunque no tenga códigos', async () => {
    // Es lo que hace este cambio seguro de desplegar HOY: en producción todavía
    // nadie entra con Google, así que el candado no encierra a nadie. Quien
    // entra con contraseña ya tiene con qué volver, y cortarle sería molestarle
    // sin darle nada.
    await limpiarEstado()
    const c = await dentro()

    const r = await c.pedir('/api/estado/')
    expect(r.status).toBe(200)
    expect(await codigosVistosEn()).toBeNull()
  })
})

describe('sin sesión', () => {
  it('la ruta de los códigos NO los reparte a cualquiera', async () => {
    const r = await fetch(`${BASE}/api/perfil/codigos-recuperacion/`, {
      method: 'POST',
      redirect: 'manual',
    })
    expect(r.status).toBe(401)
  })
})

describe('lo que la interfaz necesita para llevarle a la pantalla', () => {
  it('`/api/auth/me` dice que le faltan, o la pantalla no se enseña nunca', async () => {
    // El servidor ya CORTA con 403, pero un 403 sin explicación deja al usuario
    // dando reintentos. Este booleano es lo que hace que `AuthGate` lo lleve a
    // la pantalla — y va DERIVADO del servidor, con la misma regla que corta.
    await limpiarEstado()
    const c = await dentro()
    await sesionComoGoogle()

    const yo = await c.pedir('/api/auth/me/')
    expect(yo.status).toBe(200)
    expect(yo.datos.usuario.debeGuardarCodigos).toBe(true)
  })

  it('y deja de decirlo en cuanto confirma', async () => {
    await limpiarEstado()
    const c = await dentro()
    await sesionComoGoogle()

    await c.pedir('/api/perfil/codigos-recuperacion/', { cuerpo: {} })
    await c.pedir('/api/perfil/codigos-recuperacion/?ya=1', { cuerpo: {} })

    const yo = await c.pedir('/api/auth/me/')
    expect(yo.datos.usuario.debeGuardarCodigos).toBe(false)
  })

  it('quien entro con contrasena NO recibe ese aviso', async () => {
    // Si lo recibiera, la interfaz lo mandaria a una pantalla que no le hace
    // falta y de la que el servidor no le esta cortando.
    await limpiarEstado()
    const c = await dentro()

    const yo = await c.pedir('/api/auth/me/')
    expect(yo.datos.usuario.debeGuardarCodigos).toBe(false)
  })
})
