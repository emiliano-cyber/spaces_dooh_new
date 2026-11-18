import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  SEG-21OCT — cambiar la propia contraseña (o el correo) cierra las DEMÁS
//  sesiones de esa persona, y conserva la que hizo el cambio.
// ----------------------------------------------------------------------------
//  Auditoría del 2026-10-21. `actualizarPerfil` reescribía `password_hash` y no
//  tocaba `sesiones`. El caso que lo hace importante es justo el más común:
//  alguien sospecha que le robaron la cuenta y CAMBIA SU CONTRASEÑA. La cookie
//  robada seguía entrando hasta 30 días, y la persona se quedaba tranquila
//  creyendo que lo había resuelto.
//
//  Los otros dos caminos ya lo hacían: el restablecimiento por administrador
//  (`cerrarSesionesDeUsuario`, ADR 0009) y el enlace de recuperación
//  (`password-reset-repo.ts`). Éste era el tercero y el único que no.
//
//  Se conserva la sesión ACTUAL a propósito: cerrar también ésa echaría a la
//  persona en el mismo clic en que acaba de demostrar quién es.
// ============================================================================

const { repo, auth } = vi.hoisted(() => ({
  repo: {
    passwordHashDe: vi.fn(async () => '$2a$10$hash'),
    emailExiste: vi.fn(async () => false),
    actualizarPerfil: vi.fn(async () => true),
    tieneIdentidadVinculada: vi.fn(async () => false),
    cerrarOtrasSesionesDeUsuario: vi.fn(async () => 2),
  },
  auth: {
    hashPassword: vi.fn(async (p: string) => `hash:${p}`),
    verifyPassword: vi.fn(async () => true),
    validarPassword: vi.fn(() => null),
  },
}))
vi.mock('./usuarios-repo', () => repo)
vi.mock('./auth', () => auth)

import { actualizarPerfilCtrl } from './perfil-controller'

function usuario(extra: Record<string, unknown> = {}) {
  return {
    id: 'U1',
    email: 'ana@ejemplo.com',
    debeCambiarPassword: false,
    metodoSesion: 'password' as const,
    tokenSesion: 'TOKEN-ACTUAL',
    ...extra,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  repo.actualizarPerfil.mockResolvedValue(true)
  repo.emailExiste.mockResolvedValue(false)
  auth.verifyPassword.mockResolvedValue(true)
})

describe('cambiar las credenciales propias cierra las demás sesiones', () => {
  it('al cambiar la CONTRASEÑA, cierra las otras y conserva la actual', async () => {
    await actualizarPerfilCtrl(usuario(), { password: 'NuevaClave123', passwordActual: 'vieja' })
    expect(repo.cerrarOtrasSesionesDeUsuario).toHaveBeenCalledWith('U1', 'TOKEN-ACTUAL')
  })

  it('al cambiar el CORREO, también: el correo es con lo que se recupera la cuenta', async () => {
    await actualizarPerfilCtrl(usuario(), { email: 'nuevo@ejemplo.com', passwordActual: 'vieja' })
    expect(repo.cerrarOtrasSesionesDeUsuario).toHaveBeenCalledWith('U1', 'TOKEN-ACTUAL')
  })

  it('las cierra DESPUÉS de guardar, no antes', async () => {
    // Si se cerraran antes y el guardado fallara, la persona perdería sus
    // sesiones sin haber cambiado nada.
    const orden: string[] = []
    repo.actualizarPerfil.mockImplementation(async () => { orden.push('guardar'); return true })
    repo.cerrarOtrasSesionesDeUsuario.mockImplementation(async () => { orden.push('cerrar'); return 0 })
    await actualizarPerfilCtrl(usuario(), { password: 'NuevaClave123', passwordActual: 'vieja' })
    expect(orden).toEqual(['guardar', 'cerrar'])
  })
})

describe('lo que NO cierra sesiones', () => {
  it('con la contraseña actual INCORRECTA no cierra nada', async () => {
    auth.verifyPassword.mockResolvedValue(false)
    await expect(
      actualizarPerfilCtrl(usuario(), { password: 'NuevaClave123', passwordActual: 'mal' }),
    ).rejects.toMatchObject({ status: 401 })
    expect(repo.cerrarOtrasSesionesDeUsuario).not.toHaveBeenCalled()
  })

  it('si no se guardó nada, tampoco', async () => {
    repo.actualizarPerfil.mockResolvedValue(false)
    await expect(
      actualizarPerfilCtrl(usuario(), { password: 'NuevaClave123', passwordActual: 'vieja' }),
    ).rejects.toMatchObject({ status: 400 })
    expect(repo.cerrarOtrasSesionesDeUsuario).not.toHaveBeenCalled()
  })
})
