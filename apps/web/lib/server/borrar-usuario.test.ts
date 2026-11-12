import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  Quién puede ELIMINAR un usuario — decidido por el dueño el 2026-11-11:
//  «el dueño y administrador son los únicos que pueden eliminar perfiles».
// ----------------------------------------------------------------------------
//  Hasta hoy la puerta era solo `administracion.crear`. Hoy ese permiso lo
//  tienen solo Dueño y Administrador (lo fijan las migraciones; la pantalla de
//  Permisos no lo edita), así que el comportamiento de hoy no cambia: esto lo
//  blinda para cuando la matriz conceda ese permiso a otro rol. El rol se
//  comprueba en el código, aparte de la matriz.
//
//  El caso que importa es el negativo: un rol con el permiso concedido por la
//  matriz, y aun así rechazado ANTES de tocar la base.
// ============================================================================

const borrarUsuario = vi.fn(async () => 'Ana')
vi.mock('./usuarios-repo', () => ({
  listarUsuarios: vi.fn(),
  crearUsuario: vi.fn(),
  actualizarUsuario: vi.fn(),
  borrarUsuario: (...a: unknown[]) => borrarUsuario(...(a as [])),
  emailExiste: vi.fn(),
  cerrarSesionesDeUsuario: vi.fn(),
  CambioDeUsuarioProhibido: class extends Error {},
}))
vi.mock('./password-reset-repo', () => ({ crearInvitacion: vi.fn() }))
vi.mock('./idioma-instancia', () => ({ idiomaDeLaInstancia: async () => 'es' }))
vi.mock('./google-oauth', () => ({ googleHabilitado: () => true }))

const { borrarUsuarioCtrl } = await import('./usuarios-controller')
const { puedeEliminarUsuarios } = await import('@/lib/roles')

beforeEach(() => borrarUsuario.mockClear())

describe('eliminar usuarios: solo Dueño y Administrador', () => {
  it.each(['DUENO', 'ADMINISTRADOR'] as const)('%s puede eliminar', async (rol) => {
    await expect(borrarUsuarioCtrl('u-2', { id: 'u-1', rol })).resolves.toEqual({ nombre: 'Ana' })
    expect(borrarUsuario).toHaveBeenCalledTimes(1)
  })

  it.each(['DIRECTOR_COMERCIAL', 'GERENTE_VENTAS', 'VENDEDOR', 'OPERACIONES', 'IMPRENTA', 'FINANZAS'] as const)(
    '%s NO puede, aunque la matriz le dé administracion.crear, y no toca la base',
    async (rol) => {
      await expect(borrarUsuarioCtrl('u-2', { id: 'u-1', rol })).rejects.toMatchObject({ status: 403 })
      expect(borrarUsuario).not.toHaveBeenCalled()
    },
  )

  it('un rol desconocido o vacío cae del lado seguro', () => {
    expect(puedeEliminarUsuarios(undefined)).toBe(false)
    expect(puedeEliminarUsuarios(null)).toBe(false)
    expect(puedeEliminarUsuarios('COMERCIAL' as never)).toBe(false)
  })
})
