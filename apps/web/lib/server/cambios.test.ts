import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  Control de cambios con reautenticación INDIVIDUAL (ADR 0009).
//
//  Lo que estas pruebas protegen:
//   · que el candado se decida en el SERVIDOR — el desbloqueo vive contra el
//     token de sesión, no en el navegador, así que la UI no puede fabricárselo;
//   · que la contraseña que se verifica sea la DEL USUARIO y no un secreto de
//     tenant, que es el corazón del hallazgo A7;
//   · que NO haya exención por rol. Antes el Dueño pasaba sin teclear nada; esa
//     exención se retiró y hay pruebas explícitas para que no vuelva por
//     descuido.
// ============================================================================

let sesionRow: { e: string | null } | null = { e: null }
let tenantRow: { e: boolean } | null = { e: false }
let usuarioRow: { h: string | null } | null = { h: null }
let usuario: { id: string; rol: string; tenantId: string | null } | null = null
const consultas: string[] = []

vi.mock('./db', () => ({
  qConTenant: vi.fn(async (_t: string, sql: string) => { consultas.push(`CON_TENANT ${sql}`); return [] }),
  qRaw: vi.fn(async (sql: string) => { consultas.push(sql); return [] }),
  qRaw1: vi.fn(async (sql: string) => {
    consultas.push(sql)
    if (sql.includes('from tenants')) return tenantRow
    if (sql.includes('from sesiones')) return sesionRow
    if (sql.includes('from usuarios')) return usuarioRow
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
    verifyPassword: (p: string, h: string | null) => (h ? bcrypt.compare(p, h) : Promise.resolve(false)),
  }
})

const {
  exigirDesbloqueo, desbloquear, estadoControlCambios,
  fijarExigirReautenticacion, exigirReautenticacionSiempre,
} = await import('./cambios')

const EN_15_MIN = () => new Date(Date.now() + 15 * 60_000).toISOString()
const HACE_1_MIN = () => new Date(Date.now() - 60_000).toISOString()
const conPassword = async (p: string) => {
  const bcrypt = (await import('bcryptjs')).default
  usuarioRow = { h: await bcrypt.hash(p, 4) }
}

beforeEach(() => {
  consultas.length = 0
  sesionRow = { e: null }
  tenantRow = { e: false }
  usuarioRow = { h: null }
  usuario = { id: 'u1', rol: 'COMERCIAL', tenantId: 't1' }
})

describe('exigirDesbloqueo — el candado', () => {
  it('sin sesión: no pasa', async () => {
    usuario = null
    expect((await exigirDesbloqueo()).ok).toBe(false)
  })

  it('control APAGADO: todo pasa como antes, sin sorpresas', async () => {
    tenantRow = { e: false }
    expect((await exigirDesbloqueo()).ok).toBe(true)
  })

  it('control activo y sesión SIN desbloquear: 403 con la marca para la UI', async () => {
    tenantRow = { e: true }
    sesionRow = { e: null }
    const r: any = await exigirDesbloqueo()
    expect(r.ok).toBe(false)
    expect(r.status).toBe(403)
    expect(r.requiereDesbloqueo).toBe(true)
  })

  it('sesión desbloqueada y vigente: pasa', async () => {
    tenantRow = { e: true }
    sesionRow = { e: EN_15_MIN() }
    expect((await exigirDesbloqueo()).ok).toBe(true)
  })

  it('desbloqueo EXPIRADO: vuelve a pedir contraseña', async () => {
    tenantRow = { e: true }
    sesionRow = { e: HACE_1_MIN() }
    const r: any = await exigirDesbloqueo()
    expect(r.ok).toBe(false)
    expect(r.requiereDesbloqueo).toBe(true)
  })

  // ── Lo que cambió con el ADR 0009 ─────────────────────────────────────────
  it('al DUEÑO también le exige desbloquear: ya no hay exención por rol', async () => {
    // Esta es LA prueba del hallazgo A7. Antes el Dueño pasaba sin teclear nada,
    // y en el tenant auditado los tres usuarios eran Dueño: el candado existía
    // pero no tocaba a nadie.
    tenantRow = { e: true }
    sesionRow = { e: null }
    usuario = { id: 'u1', rol: 'DUENO', tenantId: 't1' }
    const r: any = await exigirDesbloqueo()
    expect(r.ok).toBe(false)
    expect(r.requiereDesbloqueo).toBe(true)
  })

  it('el Dueño con la sesión ya desbloqueada pasa, como cualquiera', async () => {
    tenantRow = { e: true }
    sesionRow = { e: EN_15_MIN() }
    usuario = { id: 'u1', rol: 'DUENO', tenantId: 't1' }
    expect((await exigirDesbloqueo()).ok).toBe(true)
  })

  it('el desbloqueo se lee de la SESIÓN en la BD, no de nada del cliente', async () => {
    tenantRow = { e: true }
    sesionRow = { e: EN_15_MIN() }
    await exigirDesbloqueo()
    // Si esto dejara de consultar `sesiones`, el candado sería falsificable.
    expect(consultas.some((s) => s.includes('from sesiones'))).toBe(true)
  })
})

describe('desbloquear — verifica la contraseña PROPIA', () => {
  beforeEach(() => { tenantRow = { e: true } })

  it('rechaza la contraseña incorrecta', async () => {
    await conPassword('LaBuena123')
    const r: any = await desbloquear('LaMala123')
    expect(r.error).toMatch(/incorrecta/i)
    expect(r.status).toBe(403)
  })

  it('acepta la correcta y devuelve hasta cuándo', async () => {
    await conPassword('LaBuena123')
    const r: any = await desbloquear('LaBuena123')
    expect(r.ok).toBe(true)
    expect(new Date(r.hasta).getTime()).toBeGreaterThan(Date.now())
  })

  it('compara contra el hash del USUARIO, no contra ninguno del tenant', async () => {
    // El corazón de A7: si esto volviera a leer un hash de `tenants`, la
    // contraseña sería otra vez un secreto de equipo y la bitácora dejaría de
    // probar quién actuó.
    await conPassword('LaBuena123')
    await desbloquear('LaBuena123')
    expect(consultas.some((s) => s.includes('password_hash') && s.includes('from usuarios'))).toBe(true)
    expect(consultas.some((s) => s.includes('password_hash') && s.includes('from tenants'))).toBe(false)
  })

  it('un usuario sin contraseña no desbloquea, y se le dice por qué', async () => {
    usuarioRow = { h: null }
    const r: any = await desbloquear('loquesea')
    expect(r.status).toBe(400)
    // «Incorrecta» lo mandaría a probar contraseñas que no existen.
    expect(r.error).not.toMatch(/incorrecta/i)
  })

  it('se puede desbloquear aunque el tenant tenga el candado apagado', async () => {
    // `exigirReautenticacionSiempre` pide contraseña con el candado apagado; si
    // este endpoint la rechazara, esas operaciones se quedarían sin salida:
    // piden la contraseña y el sitio donde darla contesta que no hace falta.
    tenantRow = { e: false }
    await conPassword('LaBuena123')
    const r: any = await desbloquear('LaBuena123')
    expect(r.ok).toBe(true)
  })
})

describe('estadoControlCambios — lo que ve la UI', () => {
  it('con el control activo, a cualquier rol le dice que requiere', async () => {
    tenantRow = { e: true }
    sesionRow = { e: EN_15_MIN() }
    usuario = { id: 'u1', rol: 'DUENO', tenantId: 't1' }
    const e = await estadoControlCambios()
    expect(e).toEqual({
      activo: true, requiere: true, desbloqueadoHasta: expect.any(String), minutos: 15,
    })
  })

  it('con el control apagado no requiere nada', async () => {
    tenantRow = { e: false }
    const e = await estadoControlCambios()
    expect(e.activo).toBe(false)
    expect(e.requiere).toBe(false)
  })
})

describe('fijarExigirReautenticacion — el interruptor del Dueño', () => {
  it('ya no recibe ninguna contraseña: no hay secreto que guardar', async () => {
    await fijarExigirReautenticacion('t1', true)
    const update = consultas.find((s) => s.includes('update tenants'))
    expect(update).toBeTruthy()
    expect(update).toContain('exigir_reautenticacion')
    expect(update).not.toContain('cambios_password_hash')
  })

  it('al ENCENDERLO cierra los desbloqueos vivos CON contexto de tenant', async () => {
    // Nadie debe heredar un desbloqueo de cuando el candado no existía. La
    // consulta DEBE ir por qConTenant: la subconsulta lee `usuarios`, que es
    // fail-closed + FORCE, así que por qRaw devolvería cero filas y el update
    // quedaría en un no-op silencioso — el candado se encendía y quien ya
    // estaba desbloqueado seguía operando hasta 15 minutos.
    await fijarExigirReautenticacion('t1', true)
    const cierre = consultas.find((s) => s.includes('update sesiones') && s.includes('desbloqueo_expira_en = null'))
    expect(cierre).toBeTruthy()
    expect(cierre).toContain('CON_TENANT')
  })

  it('al APAGARLO no toca las sesiones: no hay nada que revocar', async () => {
    await fijarExigirReautenticacion('t1', false)
    expect(consultas.some((s) => s.includes('update sesiones'))).toBe(false)
  })
})

describe('exigirReautenticacionSiempre — no depende del interruptor', () => {
  it('exige contraseña aunque el tenant tenga el candado APAGADO', async () => {
    // El caso real: los cinco tenants de producción lo tienen apagado. Si esto
    // mirara `exigir_reautenticacion`, restablecer la contraseña de un tercero
    // no pediría nada y A7 seguiría abierto.
    tenantRow = { e: false }
    sesionRow = { e: null }
    const r: any = await exigirReautenticacionSiempre()
    expect(r.ok).toBe(false)
    expect(r.status).toBe(403)
    expect(r.requiereDesbloqueo).toBe(true)
  })

  it('pasa si la sesión ya está desbloqueada', async () => {
    tenantRow = { e: false }
    sesionRow = { e: EN_15_MIN() }
    expect((await exigirReautenticacionSiempre()).ok).toBe(true)
  })

  it('sin sesión no pasa', async () => {
    usuario = null
    expect((await exigirReautenticacionSiempre()).ok).toBe(false)
  })
})
