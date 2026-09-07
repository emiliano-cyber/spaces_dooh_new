import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest, poolApp, comoTenant, URL_APP } from './db-e2e'
import { sembrarTenant, asegurarPermisos } from './semillas-e2e'
import { hashDeCodigo } from '../server/codigos-recuperacion'

// El repo se carga TARDE, y no es un capricho: `lib/server/db.ts` construye su
// pool AL CARGARSE, leyendo `DATABASE_URL` una sola vez. Importado arriba se
// conectaria a la base de desarrollo (`spaces`) en vez de a la de integracion
// (`spaces_e2e`), y las pruebas medirian otra base -- que es como se pasan
// verdes sin haber probado nada.
//
// Y se apunta a URL_APP, el rol de la aplicacion, NO al administrador: con el
// administrador la RLS no se aplica y un `qRaw` mal puesto pasaria inadvertido.
// Eso es justo el fallo que estas pruebas existen para cazar.
type Repo = typeof import('../server/codigos-recuperacion-repo')
let generarLote: Repo['generarLote']
let usarCodigo: Repo['usarCodigo']
let cuantosQuedan: Repo['cuantosQuedan']

// ============================================================================
//  Los códigos de recuperación del Dueño, contra Postgres de verdad.
//  (B1 · ADR 0028)
// ----------------------------------------------------------------------------
//  Estas pruebas existen porque las unitarias NO PUEDEN ver lo que aquí importa:
//  simulan la base, así que un fallo de RLS les pasa por delante sin enterarse.
//  Y esta tabla lleva `tenant_id`, o sea que su modo de fallo es el de R2 —
//  cero filas EN SILENCIO, sin un solo error en el log.
//
//  Lo que se vigila:
//
//   · que un código sirva UNA vez y solo una, incluso con dos peticiones a la
//     vez, que es cuando la comprobación previa no basta;
//   · que la tabla NO contenga ningún código legible;
//   · y que con el rol real de la app, sin contexto de tenant o con el de otro,
//     no se vea ni una fila.
//
//  No hay servidor HTTP aquí a propósito: todavía no existe la ruta (eso es B2
//  y B3). Lo que se prueba es la pieza que ya está.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>
let orgUsuario: string
let otraUsuario: string

/** `sembrarTenant` devuelve el correo del Dueño, no su id. */
async function usuarioDe(email: string): Promise<string> {
  const r = await poolTest().query(`select id from usuarios where lower(email) = lower($1)`, [email])
  return r.rows[0].id
}

beforeAll(async () => {
  process.env.DATABASE_URL = URL_APP
  ;({ generarLote, usarCodigo, cuantosQuedan } = await import('../server/codigos-recuperacion-repo'))

  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('codigos')
  otra = await sembrarTenant('codigos-otra')
  orgUsuario = await usuarioDe(org.usuarioEmail)
  otraUsuario = await usuarioDe(otra.usuarioEmail)
}, 120_000)

afterAll(async () => {
  await cerrarPool()
})

describe('generar un lote', () => {
  it('escribe una fila por código, y ninguna trae el código en claro', async () => {
    const codigos = await generarLote(orgUsuario, org.id)
    expect(codigos).toHaveLength(10)

    const filas = await poolTest().query(
      `select codigo_hash, usado_en from codigos_recuperacion where usuario_id = $1`,
      [orgUsuario],
    )
    expect(filas.rows).toHaveLength(10)

    // Lo que impide que un volcado de la base revele los códigos de todos los
    // Dueños de la flota. Es la única afirmación de este archivo que no se
    // puede comprobar mirando el código.
    const todo = JSON.stringify(filas.rows)
    for (const c of codigos) {
      expect(todo).not.toContain(c)
      expect(todo).not.toContain(c.replace(/-/g, ''))
    }

    // Y sí está el hash, o sea que se guardó lo que tocaba.
    expect(filas.rows.map((r) => r.codigo_hash)).toContain(hashDeCodigo(codigos[0]))
  })

  it('generar otro lote invalida los anteriores', async () => {
    const viejos = await generarLote(orgUsuario, org.id)
    const nuevos = await generarLote(orgUsuario, org.id)

    expect(await usarCodigo(viejos[0])).toEqual({ ok: false, motivo: 'no-existe' })
    const r = await usarCodigo(nuevos[0])
    expect(r.ok).toBe(true)
  })
})

describe('usar un código', () => {
  it('uno válido entra, y quedan nueve', async () => {
    const codigos = await generarLote(orgUsuario, org.id)
    const r = await usarCodigo(codigos[0])
    expect(r).toMatchObject({ ok: true, usuarioId: orgUsuario, tenantId: org.id, quedan: 9 })
  })

  it('el MISMO no vale una segunda vez', async () => {
    const codigos = await generarLote(orgUsuario, org.id)
    expect((await usarCodigo(codigos[0])).ok).toBe(true)
    expect(await usarCodigo(codigos[0])).toEqual({ ok: false, motivo: 'ya-usado' })
  })

  it('uno inventado no existe, y no se confunde con uno gastado', async () => {
    // La diferencia importa: un código GASTADO significa que alguien tiene una
    // lista vieja del Dueño, y eso merece anotarse. Uno inventado, no.
    expect(await usarCodigo('ABCDE-FGHJK-MNPQR')).toEqual({ ok: false, motivo: 'no-existe' })
  })

  it('uno vacío o basura tampoco entra', async () => {
    expect(await usarCodigo('')).toEqual({ ok: false, motivo: 'no-existe' })
    expect(await usarCodigo('   ')).toEqual({ ok: false, motivo: 'no-existe' })
    expect(await usarCodigo('!!!!')).toEqual({ ok: false, motivo: 'no-existe' })
  })

  it('usar uno NO invalida los demás: el Dueño no se queda con una sola vida', async () => {
    const codigos = await generarLote(orgUsuario, org.id)
    await usarCodigo(codigos[0])
    expect((await usarCodigo(codigos[1])).ok).toBe(true)
    expect(await cuantosQuedan(orgUsuario, org.id)).toBe(8)
  })

  it('DOS peticiones a la vez con el mismo código: solo una entra', async () => {
    // El caso que la comprobación previa NO cubre: entre leer y escribir cabe
    // otra petición. Lo que lo decide es el `and usado_en is null` del UPDATE.
    const codigos = await generarLote(orgUsuario, org.id)
    const [a, b] = await Promise.all([usarCodigo(codigos[0]), usarCodigo(codigos[0])])
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
    expect([a, b].find((r) => !r.ok)).toEqual({ ok: false, motivo: 'ya-usado' })
  })
})

describe('el aislamiento, con el rol REAL de la aplicación', () => {
  it('sin contexto de tenant no se ve ni una fila', async () => {
    // Fail-closed. Si esto devolviera filas, un fallo futuro que consultara la
    // tabla sin fijar `app.tenant_id` podría enumerar los códigos de TODAS las
    // organizaciones.
    await generarLote(orgUsuario, org.id)
    const r = await poolApp().query(`select * from codigos_recuperacion`)
    expect(r.rows).toHaveLength(0)
  })

  it('con el tenant de OTRA organización tampoco', async () => {
    await generarLote(orgUsuario, org.id)
    const filas = await comoTenant(otra.id, (q) => q(`select * from codigos_recuperacion`))
    expect(filas).toHaveLength(0)
  })

  it('y con el suyo sí, que es lo que prueba que la política no está de adorno', async () => {
    // Sin esta, las dos de arriba pasarían con una tabla vacía.
    await generarLote(orgUsuario, org.id)
    const filas = await comoTenant(org.id, (q) => q(`select * from codigos_recuperacion`))
    expect(filas.length).toBe(10)
  })

  it('un código de OTRO tenant no abre esta cuenta', async () => {
    // La resolución es pre-sesión y va por SECURITY DEFINER, así que encuentra
    // la fila venga de donde venga. Lo que NO puede pasar es que devuelva el
    // usuario equivocado: quien llame usa el `usuarioId` y el `tenantId` que
    // salen de aquí para abrir la sesión.
    const suyos = await generarLote(otraUsuario, otra.id)
    const r = await usarCodigo(suyos[0])
    expect(r).toMatchObject({ ok: true, usuarioId: otraUsuario, tenantId: otra.id })
    expect((r as { usuarioId: string }).usuarioId).not.toBe(orgUsuario)
  })
})
