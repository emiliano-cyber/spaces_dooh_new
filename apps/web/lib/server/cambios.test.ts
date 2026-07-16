import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  Control de cambios con desbloqueo.
//  Lo que estas pruebas protegen: que el candado se decida en el SERVIDOR.
//  El desbloqueo vive contra el token de sesión, no en el navegador, así que la
//  UI no puede fabricárselo. Y el Dueño nunca queda encerrado.
// ============================================================================

let sesionRow: { e: string | null } | null = { e: null }
let tenantRow: { h: string | null } | null = { h: null }
let usuario: { id: string; rol: string; tenantId: string | null } | null = null
const consultas: string[] = []

vi.mock('./db', () => ({
  qRaw: vi.fn(async (sql: string) => { consultas.push(sql); return [] }),
  qRaw1: vi.fn(async (sql: string) => {
    consultas.push(sql)
    if (sql.includes('from tenants')) return tenantRow
    if (sql.includes('from sesiones')) return sesionRow
    return null
  }),
}))
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => ({ value: 'token-de-sesion' }) }) }))
vi.mock('./auth', async () => {
  const bcrypt = (await import('bcryptjs')).default
  return {
    SESSION_COOKIE: 'spaces_sesion',
    usuarioActual: vi.fn(async () => usuario),
    exigir: vi.fn(async () => ({ ok: true, usuario })),
    hashPassword: (p: string) => bcrypt.hash(p, 4),
    verifyPassword: (p: string, h: string | null) => (h ? bcrypt.compare(p, h) : Promise.resolve(false)),
    validarPassword: (p: string) => (p.length < 8 ? 'La contraseña debe tener al menos 8 caracteres' : null),
  }
})

const { exigirDesbloqueo, desbloquear, estadoControlCambios, fijarPasswordCambios } =
  await import('./cambios')

const EN_15_MIN = () => new Date(Date.now() + 15 * 60_000).toISOString()
const HACE_1_MIN = () => new Date(Date.now() - 60_000).toISOString()

beforeEach(() => {
  consultas.length = 0
  sesionRow = { e: null }
  tenantRow = { h: null }
  usuario = { id: 'u1', rol: 'COMERCIAL', tenantId: 't1' }
})

describe('exigirDesbloqueo — el candado', () => {
  it('sin sesión: no pasa', async () => {
    usuario = null
    const r = await exigirDesbloqueo()
    expect(r.ok).toBe(false)
  })

  it('el DUEÑO nunca necesita desbloquear, ni con el control activo', async () => {
    tenantRow = { h: 'un-hash' }
    usuario = { id: 'u1', rol: 'DUENO', tenantId: 't1' }
    expect((await exigirDesbloqueo()).ok).toBe(true)
  })

  it('control APAGADO (sin contraseña): todo pasa como antes, sin sorpresas', async () => {
    tenantRow = { h: null }
    expect((await exigirDesbloqueo()).ok).toBe(true)
  })

  it('control activo y sesión SIN desbloquear: 403 con la marca para la UI', async () => {
    tenantRow = { h: 'un-hash' }
    sesionRow = { e: null }
    const r: any = await exigirDesbloqueo()
    expect(r.ok).toBe(false)
    expect(r.status).toBe(403)
    expect(r.requiereDesbloqueo).toBe(true)
  })

  it('sesión desbloqueada y vigente: pasa', async () => {
    tenantRow = { h: 'un-hash' }
    sesionRow = { e: EN_15_MIN() }
    expect((await exigirDesbloqueo()).ok).toBe(true)
  })

  it('desbloqueo EXPIRADO: vuelve a pedir contraseña', async () => {
    tenantRow = { h: 'un-hash' }
    sesionRow = { e: HACE_1_MIN() }
    const r: any = await exigirDesbloqueo()
    expect(r.ok).toBe(false)
    expect(r.requiereDesbloqueo).toBe(true)
  })

  it('el desbloqueo se lee de la SESIÓN en la BD, no de nada del cliente', async () => {
    tenantRow = { h: 'un-hash' }
    sesionRow = { e: EN_15_MIN() }
    await exigirDesbloqueo()
    // Si esto dejara de consultar `sesiones`, el candado sería falsificable.
    expect(consultas.some((s) => s.includes('from sesiones'))).toBe(true)
  })
})

describe('desbloquear — verificación de la contraseña', () => {
  it('rechaza la contraseña incorrecta', async () => {
    const bcrypt = (await import('bcryptjs')).default
    tenantRow = { h: await bcrypt.hash('LaBuena123', 4) }
    const r: any = await desbloquear('LaMala123')
    expect(r.error).toMatch(/incorrecta/i)
    expect(r.status).toBe(403)
  })

  it('acepta la correcta y devuelve hasta cuándo', async () => {
    const bcrypt = (await import('bcryptjs')).default
    tenantRow = { h: await bcrypt.hash('LaBuena123', 4) }
    const r: any = await desbloquear('LaBuena123')
    expect(r.ok).toBe(true)
    expect(new Date(r.hasta).getTime()).toBeGreaterThan(Date.now())
  })

  it('no se puede desbloquear si el control está apagado', async () => {
    tenantRow = { h: null }
    const r: any = await desbloquear('loquesea')
    expect(r.status).toBe(400)
  })
})

describe('estadoControlCambios — lo que ve la UI', () => {
  it('NUNCA expone la contraseña ni su hash', async () => {
    tenantRow = { h: 'hash-super-secreto' }
    sesionRow = { e: EN_15_MIN() }
    const e = await estadoControlCambios()
    expect(JSON.stringify(e)).not.toContain('hash-super-secreto')
    expect(e).toEqual({
      activo: true, requiere: true, desbloqueadoHasta: expect.any(String), minutos: 15,
    })
  })

  it('al Dueño le dice que no requiere candado', async () => {
    tenantRow = { h: 'un-hash' }
    usuario = { id: 'u1', rol: 'DUENO', tenantId: 't1' }
    const e = await estadoControlCambios()
    expect(e.activo).toBe(true)
    expect(e.requiere).toBe(false)
  })
})

describe('fijarPasswordCambios — la llave del Dueño', () => {
  it('exige una contraseña decente', async () => {
    const r: any = await fijarPasswordCambios('t1', 'corta')
    expect(r.error).toMatch(/8 caracteres/)
  })

  it('la guarda hasheada, nunca en claro', async () => {
    await fijarPasswordCambios('t1', 'ClaveBuena123')
    const update = consultas.find((s) => s.includes('update tenants'))
    expect(update).toBeTruthy()
    // El valor va parametrizado; lo que importa es que NO se arme SQL con el texto.
    expect(update).not.toContain('ClaveBuena123')
  })

  it('al cambiarla, cierra los desbloqueos vivos del tenant', async () => {
    await fijarPasswordCambios('t1', 'ClaveBuena123')
    expect(consultas.some((s) => s.includes('update sesiones') && s.includes('desbloqueo_expira_en = null'))).toBe(true)
  })

  it('null la quita (control apagado)', async () => {
    const r: any = await fijarPasswordCambios('t1', null)
    expect(r.ok).toBe(true)
    expect(r.activo).toBe(false)
  })
})
