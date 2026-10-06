import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  Invitación de un usuario nuevo, de punta a punta (INV-01, ADR 0044).
//
//  Por HTTP y contra Postgres real con el rol de la app, porque lo que puede
//  romperse aquí es lo que las unitarias no ven: que el INSERT de la invitación
//  pase la RLS de `password_resets` (fail-closed + FORCE) con el tenant de la
//  sesión, y que el enlace que recibe el administrador abra de verdad la puerta
//  a la persona invitada — y a nadie más.
//
//  El servidor de pruebas no tiene RESEND_API_KEY, así que el enlace vuelve en
//  la respuesta: es el camino de las instancias de hoy, que no tienen correo.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>
const INVITADA = 'invitada@inv.test'

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('inv')
  otra = await sembrarTenant('invotra')
  await arrancarServidor()
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

let enlace = ''
const tokenDe = (url: string) => new URL(url).pathname.split('/').pop() as string

describe('1 · el administrador invita y recibe el enlace', () => {
  it('el alta con `invitar` responde 201 con el enlace de bienvenida', async () => {
    const c = new Cliente()
    await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir('/api/usuarios/', {
      cuerpo: { nombre: 'Persona Invitada', email: INVITADA, rol: 'VENDEDOR', invitar: true },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(r.datos.invitacion.enviada).toBe(false)
    enlace = r.datos.invitacion.enlace
    expect(enlace).toMatch(/\/spaces-dooh\/recuperar\/[0-9a-f]{64}\?bienvenida=1$/)
  })

  it('la fila se escribió bajo la RLS, en su organización y con 72 h de vigencia', async () => {
    const r = await poolTest().query(
      `select pr.tenant_id, extract(epoch from (pr.expira_en - pr.creado_en))::int as seg
         from password_resets pr where pr.token = $1`,
      [tokenDe(enlace)],
    )
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].tenant_id).toBe(org.id)
    expect(r.rows[0].seg).toBeGreaterThan(72 * 3600 - 60)
    expect(r.rows[0].seg).toBeLessThanOrEqual(72 * 3600 + 60)
  })

  it('la contraseña con la que nace la cuenta no es ninguna que alguien haya escrito', async () => {
    const c = new Cliente()
    const r = await c.pedir('/api/auth/login/', { cuerpo: { email: INVITADA, password: PASSWORD_DEMO } })
    expect(r.status).not.toBe(200)
  })
})

describe('2 · la persona invitada elige su contraseña y entra', () => {
  it('el enlace se reconoce como válido', async () => {
    const r = await new Cliente().pedir(`/api/auth/reset/?token=${tokenDe(enlace)}`)
    expect(r.status).toBe(200)
    expect(r.datos?.valido).toBe(true)
  })

  it('elegir la contraseña funciona, y con ella entra', async () => {
    const r = await new Cliente().pedir('/api/auth/reset/', {
      cuerpo: { token: tokenDe(enlace), password: 'ElegidaPorElla9' },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)

    const login = await new Cliente().pedir('/api/auth/login/', {
      cuerpo: { email: INVITADA, password: 'ElegidaPorElla9' },
    })
    expect(login.status).toBe(200)
  })

  it('el enlace no sirve una segunda vez', async () => {
    const r = await new Cliente().pedir('/api/auth/reset/', {
      cuerpo: { token: tokenDe(enlace), password: 'OtraDistinta9' },
    })
    expect(r.status).toBe(400)
  })
})

describe('3 · lo que la invitación NO permite', () => {
  it('sin sesión no se puede invitar', async () => {
    const r = await new Cliente().pedir('/api/usuarios/', {
      cuerpo: { nombre: 'Intrusa', email: 'intrusa@inv.test', invitar: true },
    })
    // 401 de `exigir` o 403 del anti-CSRF del middleware, según quién llegue
    // primero: lo que importa es que no es un 201 y que la cuenta no existe.
    expect([401, 403]).toContain(r.status)
    const fila = await poolTest().query(`select 1 from usuarios where email = 'intrusa@inv.test'`)
    expect(fila.rows).toHaveLength(0)
  })

  it('invitar y fijar contraseña a la vez es un 400 y no crea la cuenta', async () => {
    const c = new Cliente()
    await c.entrar(otra.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir('/api/usuarios/', {
      cuerpo: { nombre: 'Doble', email: 'doble@inv.test', invitar: true, password: 'Prueba1234' },
    })
    expect(r.status).toBe(400)
    const fila = await poolTest().query(`select 1 from usuarios where email = 'doble@inv.test'`)
    expect(fila.rows).toHaveLength(0)
  })

  it('la invitación hecha desde otra organización queda en ESA organización', async () => {
    const c = new Cliente()
    await c.entrar(otra.usuarioEmail, PASSWORD_DEMO)
    const r = await c.pedir('/api/usuarios/', {
      cuerpo: { nombre: 'De la otra', email: 'delaotra@inv.test', invitar: true },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    const fila = await poolTest().query(
      `select pr.tenant_id, u.tenant_id as tenant_usuario
         from password_resets pr join usuarios u on u.id = pr.usuario_id
        where pr.token = $1`,
      [tokenDe(r.datos.invitacion.enlace)],
    )
    expect(fila.rows[0]).toEqual({ tenant_id: otra.id, tenant_usuario: otra.id })
  })
})
