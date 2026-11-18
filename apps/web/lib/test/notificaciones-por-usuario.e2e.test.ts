import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  NOTIF-USUARIO (21/10) — la bandeja de notificaciones es de CADA PERSONA.
// ----------------------------------------------------------------------------
//  Pedido del dueño: borrar las notificaciones una por una o todas de un botón,
//  y que las leídas se queden en la bandeja. Al revisarlo apareció lo que de
//  verdad faltaba decidir: `leida` y `archivada_en` vivían en `notificaciones`,
//  que es UNA fila por empresa, así que cuando un vendedor marcaba o borraba
//  un aviso se lo marcaba o borraba también al Dueño. Decidido el 21/10: por
//  persona, con la tabla `notificaciones_usuario`.
//
//  Por qué e2e y no solo unitarias: lo que se defiende es AISLAMIENTO —entre
//  dos personas de la misma empresa y entre dos empresas— y las unitarias
//  simulan la base. Los dos peores fallos de aislamiento del proyecto pasaron
//  las unitarias sin despeinarse. Aquí la RLS es la de verdad y el rol es
//  `spaces_app` (NOSUPERUSER NOBYPASSRLS).
//
//  Las pruebas que importan son las NEGATIVAS: lo que hace Ana NO le cambia
//  nada a Beto, y nadie toca el aviso de otra empresa.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>
let ana: Cliente
let beto: Cliente
let deOtra: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('notifusuario')
  otra = await sembrarTenant('notifotra')
  // Beto: segunda persona de la MISMA empresa. Las notificaciones solo piden
  // sesión, así que el rol da igual; ADMINISTRADOR para que no sea otro Dueño.
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ('Beto', 'beto@notifusuario.test', 'ADMINISTRADOR'::rol_demo, $1, true, $2)`,
    [await bcrypt.hash(PASSWORD_DEMO, 4), org.id],
  )
  await arrancarServidor()
  ana = new Cliente()
  await ana.entrar(org.usuarioEmail, PASSWORD_DEMO)
  beto = new Cliente()
  await beto.entrar('beto@notifusuario.test', PASSWORD_DEMO)
  deOtra = new Cliente()
  await deOtra.entrar(otra.usuarioEmail, PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

async function aviso(tenantId: string, titulo: string, extra: { leida?: boolean; archivada?: boolean } = {}) {
  const r = await poolTest().query(
    `insert into notificaciones (tipo, nivel, titulo, tenant_id, leida, archivada_en)
     values ('prueba', 'info', $1, $2, $3, case when $4 then now() end) returning id`,
    [titulo, tenantId, extra.leida ?? false, extra.archivada ?? false],
  )
  return r.rows[0].id as string
}

type Notif = { id: string; titulo: string; leida: boolean }
async function bandeja(c: Cliente): Promise<Notif[]> {
  const r = await c.pedir('/api/estado/')
  expect(r.status).toBe(200)
  return r.datos.notificaciones as Notif[]
}
const titulos = async (c: Cliente) => (await bandeja(c)).map((n) => n.titulo)
const leida = async (c: Cliente, titulo: string) => (await bandeja(c)).find((n) => n.titulo === titulo)?.leida

describe('borrar UNA notificación', () => {
  it('Ana la borra y deja de verla; Beto, de la misma empresa, la sigue viendo', async () => {
    const id = await aviso(org.id, 'Borrable una')
    expect(await titulos(ana)).toContain('Borrable una')

    const r = await ana.pedir(`/api/notificaciones/${id}/`, { metodo: 'DELETE' })
    expect(r.status).toBe(200)

    expect(await titulos(ana)).not.toContain('Borrable una')
    expect(await titulos(beto)).toContain('Borrable una')
  })

  it('no se destruye: la fila sigue en la base', async () => {
    const id = await aviso(org.id, 'Sigue en la base')
    await ana.pedir(`/api/notificaciones/${id}/`, { metodo: 'DELETE' })
    const r = await poolTest().query('select count(*)::int n from notificaciones where id = $1', [id])
    expect(r.rows[0].n).toBe(1)
  })

  it('borrarla dos veces no falla', async () => {
    const id = await aviso(org.id, 'Dos veces')
    expect((await ana.pedir(`/api/notificaciones/${id}/`, { metodo: 'DELETE' })).status).toBe(200)
    expect((await ana.pedir(`/api/notificaciones/${id}/`, { metodo: 'DELETE' })).status).toBe(200)
  })

  it('el sondeo de avisos emergentes tampoco se la devuelve a Ana', async () => {
    const desde = new Date(Date.now() - 60_000).toISOString()
    const id = await aviso(org.id, 'No revive')
    await ana.pedir(`/api/notificaciones/${id}/`, { metodo: 'DELETE' })
    const r = await ana.pedir(`/api/notificaciones/nuevas/?desde=${encodeURIComponent(desde)}`)
    expect((r.datos.notificaciones as Notif[]).map((n) => n.titulo)).not.toContain('No revive')
    const rb = await beto.pedir(`/api/notificaciones/nuevas/?desde=${encodeURIComponent(desde)}`)
    expect((rb.datos.notificaciones as Notif[]).map((n) => n.titulo)).toContain('No revive')
  })
})

describe('marcar como leída', () => {
  it('es de Ana: a Beto le sigue saliendo sin leer', async () => {
    const id = await aviso(org.id, 'Leer una')
    expect((await ana.pedir(`/api/notificaciones/${id}/leer/`, { metodo: 'POST' })).status).toBe(200)
    expect(await leida(ana, 'Leer una')).toBe(true)
    expect(await leida(beto, 'Leer una')).toBe(false)
  })

  it('la leída se QUEDA en la bandeja, atenuada', async () => {
    const id = await aviso(org.id, 'Leída se queda')
    await ana.pedir(`/api/notificaciones/${id}/leer/`, { metodo: 'POST' })
    expect(await titulos(ana)).toContain('Leída se queda')
  })
})

describe('«Borrar todas»', () => {
  it('vacía la bandeja de Ana y deja intacta la de Beto', async () => {
    await aviso(org.id, 'Todas A')
    await aviso(org.id, 'Todas B')
    const r = await ana.pedir('/api/notificaciones/archivar-todas/', { metodo: 'POST' })
    expect(r.status).toBe(200)
    expect(await titulos(ana)).toEqual([])
    expect(await titulos(beto)).toEqual(expect.arrayContaining(['Todas A', 'Todas B']))
  })

  it('lo que llega DESPUÉS sí le sale a Ana', async () => {
    await aviso(org.id, 'Llega después')
    expect(await titulos(ana)).toContain('Llega después')
  })
})

describe('NEGATIVO · nadie toca el aviso de otra empresa', () => {
  it('borrar un aviso de otra empresa da 404 y no le cambia nada a esa empresa', async () => {
    const id = await aviso(otra.id, 'De la otra')
    const r = await ana.pedir(`/api/notificaciones/${id}/`, { metodo: 'DELETE' })
    // 404 y no 403: un 403 confirmaría que ese id existe en otra organización.
    expect(r.status).toBe(404)
    expect(await titulos(deOtra)).toContain('De la otra')
    const n = await poolTest().query('select count(*)::int n from notificaciones_usuario where notificacion_id = $1', [id])
    expect(n.rows[0].n).toBe(0)
  })

  it('marcar como leído un aviso de otra empresa también da 404', async () => {
    const id = await aviso(otra.id, 'De la otra, leer')
    expect((await ana.pedir(`/api/notificaciones/${id}/leer/`, { metodo: 'POST' })).status).toBe(404)
    expect(await leida(deOtra, 'De la otra, leer')).toBe(false)
  })

  it('«Borrar todas» de Ana no toca la bandeja de la otra empresa', async () => {
    await aviso(otra.id, 'Otra intacta')
    await ana.pedir('/api/notificaciones/archivar-todas/', { metodo: 'POST' })
    expect(await titulos(deOtra)).toContain('Otra intacta')
  })

  it('un id que no es uuid da 404, no un 500', async () => {
    expect((await ana.pedir('/api/notificaciones/no-es-un-id/', { metodo: 'DELETE' })).status).toBe(404)
    expect((await ana.pedir('/api/notificaciones/no-es-un-id/leer/', { metodo: 'POST' })).status).toBe(404)
  })

  it('sin sesión no se borra nada', async () => {
    const id = await aviso(org.id, 'Sin sesión')
    const anonimo = new Cliente()
    expect((await anonimo.pedir(`/api/notificaciones/${id}/`, { metodo: 'DELETE' })).status).toBe(401)
    expect(await titulos(ana)).toContain('Sin sesión')
  })
})

describe('lo que ya estaba antes de la tabla nueva', () => {
  it('un aviso archivado para TODOS con el «Borrar todas» de antes sigue oculto para todos', async () => {
    await aviso(org.id, 'Archivado viejo', { archivada: true })
    expect(await titulos(ana)).not.toContain('Archivado viejo')
    expect(await titulos(beto)).not.toContain('Archivado viejo')
  })

  it('un aviso marcado leído con la columna vieja sigue leído para todos', async () => {
    await aviso(org.id, 'Leído viejo', { leida: true })
    expect(await leida(ana, 'Leído viejo')).toBe(true)
    expect(await leida(beto, 'Leído viejo')).toBe(true)
  })
})

describe('la tabla nueva, aislada como las demás', () => {
  it('tiene RLS forzada', async () => {
    const r = await poolTest().query(
      `select relrowsecurity, relforcerowsecurity from pg_class where relname = 'notificaciones_usuario'`,
    )
    expect(r.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true })
  })

  it('una fila no puede colgar del aviso de OTRA empresa (FK compuesta)', async () => {
    const idOtra = await aviso(otra.id, 'FK compuesta')
    const u = await poolTest().query(`select id from usuarios where email = $1`, [org.usuarioEmail])
    await expect(
      poolTest().query(
        `insert into notificaciones_usuario (tenant_id, notificacion_id, usuario_id, borrada_en)
         values ($1, $2, $3, now())`,
        [org.id, idOtra, u.rows[0].id],
      ),
    ).rejects.toThrow(/foreign key|violates/i)
  })
})
