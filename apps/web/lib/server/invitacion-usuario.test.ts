import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  Invitación al dar de alta un usuario (INV-01, ADR 0044).
// ----------------------------------------------------------------------------
//  Lo que se defiende: con `invitar`, el administrador NO conoce la contraseña
//  de la persona. La cuenta nace con un secreto que nadie ve, y la persona elige
//  la suya con un enlace de 72 h. Si hay correo, el enlace se manda y NO vuelve
//  al administrador; si no lo hay —o el envío falla—, vuelve para que lo pase él.
//
//  Y los casos negativos, que son los que importan: una invitación no se mezcla
//  con una contraseña ni con Google, y el alta de siempre no emite enlaces.
// ============================================================================

const crearUsuario = vi.fn()
const emailExiste = vi.fn(async () => false)
vi.mock('./usuarios-repo', () => ({
  listarUsuarios: vi.fn(),
  crearUsuario: (...a: unknown[]) => crearUsuario(...a),
  actualizarUsuario: vi.fn(),
  borrarUsuario: vi.fn(),
  emailExiste: (...a: unknown[]) => emailExiste(...(a as [])),
  cerrarSesionesDeUsuario: vi.fn(),
  CambioDeUsuarioProhibido: class extends Error {},
}))

const crearInvitacion = vi.fn()
vi.mock('./password-reset-repo', () => ({
  crearInvitacion: (...a: unknown[]) => crearInvitacion(...a),
}))

let correoConfigurado = false
const enviarEmail = vi.fn()
vi.mock('./email', async (original) => {
  const real = await original<typeof import('./email')>()
  return {
    ...real,
    emailHabilitado: () => correoConfigurado,
    enviarEmail: (...a: unknown[]) => enviarEmail(...a),
  }
})

vi.mock('./google-oauth', () => ({ googleHabilitado: () => true }))

const { crearUsuarioCtrl } = await import('./usuarios-controller')
const { validarPassword } = await import('@/lib/password')
const { htmlCorreoInvitacion } = await import('./email')

const DUENO = { id: 'u-dueno', rol: 'DUENO' }
const BASE = 'https://inventario.ejemplo.com'
const ALTA = { nombre: 'Ana López', email: 'ana@empresa.com', rol: 'VENDEDOR' }

beforeEach(() => {
  vi.clearAllMocks()
  correoConfigurado = false
  crearUsuario.mockImplementation(async (i: { nombre: string; email: string }) => ({
    id: 'u-nuevo', nombre: i.nombre, email: i.email, rol: 'VENDEDOR', activo: true,
  }))
  crearInvitacion.mockResolvedValue({ token: 'tok123', usuarioId: 'u-nuevo', nombre: 'Ana López', email: 'ana@empresa.com' })
  enviarEmail.mockResolvedValue(undefined)
})

describe('1 · la cuenta nace con una contraseña que nadie conoce', () => {
  it('crea el usuario con un secreto válido que no viene del cuerpo', async () => {
    await crearUsuarioCtrl({ ...ALTA, invitar: true }, DUENO, { baseUrl: BASE })
    const pw = crearUsuario.mock.calls[0][0].password
    expect(typeof pw).toBe('string')
    expect(validarPassword(pw)).toBeNull()
  })

  it('emite la invitación para el usuario recién creado', async () => {
    await crearUsuarioCtrl({ ...ALTA, invitar: true }, DUENO, { baseUrl: BASE })
    expect(crearInvitacion).toHaveBeenCalledWith('u-nuevo')
  })
})

describe('2 · sin correo configurado, el enlace vuelve al administrador', () => {
  it('devuelve el enlace a la página de elegir contraseña, en modo bienvenida', async () => {
    const r = await crearUsuarioCtrl({ ...ALTA, invitar: true }, DUENO, { baseUrl: BASE })
    expect(r.invitacion).toEqual({
      enviada: false,
      enlace: `${BASE}/spaces-dooh/recuperar/tok123?bienvenida=1`,
    })
    expect(enviarEmail).not.toHaveBeenCalled()
  })
})

describe('3 · con correo configurado, el enlace se manda y NO vuelve', () => {
  it('manda el correo a la persona con el enlace dentro', async () => {
    correoConfigurado = true
    const r = await crearUsuarioCtrl({ ...ALTA, invitar: true }, DUENO, { baseUrl: BASE })
    expect(enviarEmail).toHaveBeenCalledTimes(1)
    const correo = enviarEmail.mock.calls[0][0]
    expect(correo.to).toBe('ana@empresa.com')
    expect(correo.html).toContain(`${BASE}/spaces-dooh/recuperar/tok123?bienvenida=1`)
    // El administrador no recibe el enlace: solo la persona puede elegir.
    expect(r.invitacion).toEqual({ enviada: true })
  })

  it('si el envío falla, el usuario existe igual y el enlace vuelve con el aviso', async () => {
    correoConfigurado = true
    enviarEmail.mockRejectedValueOnce(new Error('Resend 422: dominio no verificado'))
    const r = await crearUsuarioCtrl({ ...ALTA, invitar: true }, DUENO, { baseUrl: BASE })
    expect(r.id).toBe('u-nuevo')
    expect(r.invitacion).toEqual({
      enviada: false,
      enlace: `${BASE}/spaces-dooh/recuperar/tok123?bienvenida=1`,
      fallo: true,
    })
  })
})

describe('4 · una sola forma de acceso por alta', () => {
  it('invitar + contraseña es un 400 y no crea nada', async () => {
    await expect(
      crearUsuarioCtrl({ ...ALTA, invitar: true, password: 'Prueba1234' }, DUENO, { baseUrl: BASE }),
    ).rejects.toMatchObject({ status: 400 })
    expect(crearUsuario).not.toHaveBeenCalled()
  })

  it('invitar + Google es un 400 y no crea nada', async () => {
    await expect(
      crearUsuarioCtrl({ ...ALTA, invitar: true, entraConGoogle: true }, DUENO, { baseUrl: BASE }),
    ).rejects.toMatchObject({ status: 400 })
    expect(crearUsuario).not.toHaveBeenCalled()
  })

  it('el alta con contraseña de siempre NO emite invitación', async () => {
    const r = await crearUsuarioCtrl({ ...ALTA, password: 'Prueba1234' }, DUENO, { baseUrl: BASE })
    expect(crearUsuario.mock.calls[0][0].password).toBe('Prueba1234')
    expect(crearInvitacion).not.toHaveBeenCalled()
    expect(r).not.toHaveProperty('invitacion')
  })

  it('con el correo ya registrado no crea usuario ni invitación', async () => {
    emailExiste.mockResolvedValueOnce(true)
    await expect(
      crearUsuarioCtrl({ ...ALTA, invitar: true }, DUENO, { baseUrl: BASE }),
    ).rejects.toMatchObject({ status: 409 })
    expect(crearInvitacion).not.toHaveBeenCalled()
  })
})

describe('5 · el correo de invitación', () => {
  it('escapa el nombre: lo escribe una persona', () => {
    const html = htmlCorreoInvitacion('<img src=x onerror=alert(1)>', 'https://x/recuperar/t?bienvenida=1')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })

  it('dice que el enlace vence en 72 horas', () => {
    expect(htmlCorreoInvitacion('Ana', 'https://x')).toContain('72 horas')
  })
})
