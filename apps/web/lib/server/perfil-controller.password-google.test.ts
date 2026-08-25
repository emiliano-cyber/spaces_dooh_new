import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  ADR 0018 — Establecer la contraseña tras entrar con Google, sin la anterior.
//
//  El punto muerto que esto cierra, medido en el PADRE el 2026-08-25: el Dueño
//  se crea con `debe_cambiar_password = true` y una temporal que se imprime UNA
//  vez. Entra con Google, y el formulario le pide la contraseña anterior — que
//  nadie tiene. No hay salida por correo: el despliegue no tiene envío.
//
//  La excepción vale SOLO con las cuatro condiciones a la vez. Las pruebas que
//  importan son las NEGATIVAS: cada una quita una condición y exige el 401.
//  Una excepción de autenticación se demuestra por lo que RECHAZA.
// ============================================================================

// `vi.hoisted` y no un `const` suelto: `vi.mock` se iza por encima de los
// imports, asi que su fabrica se evalua ANTES de que exista cualquier variable
// del cuerpo del archivo. Sin esto el error es «Cannot access 'auth' before
// initialization», que parece un fallo de la prueba y no lo es.
const { repo, auth } = vi.hoisted(() => ({
  repo: {
    passwordHashDe: vi.fn(async () => '$2a$10$hashviejoquenadieconoce'),
    emailExiste: vi.fn(async () => false),
    actualizarPerfil: vi.fn(async () => true),
    tieneIdentidadVinculada: vi.fn(async () => true),
  },
  auth: {
    hashPassword: vi.fn(async (p: string) => `hash:${p}`),
    // Devuelve SIEMPRE false: ninguna prueba de este archivo conoce la
    // anterior. Si un caso pasara verificando credenciales, el mock lo delata.
    verifyPassword: vi.fn(async () => false),
    validarPassword: vi.fn(() => null),
  },
}))
vi.mock('./usuarios-repo', () => repo)
vi.mock('./auth', () => auth)

import { actualizarPerfilCtrl } from './perfil-controller'

const NUEVA = 'UnaContrasenaLarga123'

/** Dueño recién creado que entró con Google: cumple las cuatro condiciones. */
function contextoGoogle(extra: Record<string, unknown> = {}) {
  return {
    id: 'U1',
    email: 'duena@ejemplo.com',
    debeCambiarPassword: true,
    metodoSesion: 'google' as const,
    ...extra,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  repo.passwordHashDe.mockResolvedValue('$2a$10$hashviejoquenadieconoce')
  repo.emailExiste.mockResolvedValue(false)
  repo.actualizarPerfil.mockResolvedValue(true)
  repo.tieneIdentidadVinculada.mockResolvedValue(true)
  auth.verifyPassword.mockResolvedValue(false)
})

describe('ADR 0018 · fijar contraseña sin la anterior', () => {
  it('la DEJA cuando se cumplen las cuatro condiciones', async () => {
    const res = await actualizarPerfilCtrl(contextoGoogle(), { password: NUEVA })

    expect(res).toEqual({ ok: true })
    expect(repo.actualizarPerfil).toHaveBeenCalledWith('U1', {
      passwordHash: `hash:${NUEVA}`,
    })
    // Y no por haber verificado nada: el mock de verifyPassword da false.
    expect(auth.verifyPassword).not.toHaveBeenCalled()
  })

  it('NO consulta el hash anterior cuando aplica la excepción', async () => {
    await actualizarPerfilCtrl(contextoGoogle(), { password: NUEVA })
    // Sacar el hash de la base sin necesitarlo es superficie que no hace falta.
    expect(repo.passwordHashDe).not.toHaveBeenCalled()
  })
})

describe('ADR 0018 · lo que la excepción NO permite', () => {
  it('la RECHAZA si la sesión se abrió con contraseña, no con Google', async () => {
    await expect(
      actualizarPerfilCtrl(contextoGoogle({ metodoSesion: 'password' }), { password: NUEVA }),
    ).rejects.toMatchObject({ status: 401 })
    expect(repo.actualizarPerfil).not.toHaveBeenCalled()
  })

  it('la RECHAZA si el usuario YA tiene contraseña propia', async () => {
    // `debe_cambiar_password = false` significa que ya la puso alguna vez. La
    // excepción es de un solo uso: aquí ya no aplica, y este es el caso que la
    // mantiene estrecha en el tiempo.
    await expect(
      actualizarPerfilCtrl(contextoGoogle({ debeCambiarPassword: false }), { password: NUEVA }),
    ).rejects.toMatchObject({ status: 401 })
    expect(repo.actualizarPerfil).not.toHaveBeenCalled()
  })

  it('la RECHAZA si no hay identidad de Google vinculada', async () => {
    repo.tieneIdentidadVinculada.mockResolvedValue(false)
    await expect(
      actualizarPerfilCtrl(contextoGoogle(), { password: NUEVA }),
    ).rejects.toMatchObject({ status: 401 })
    expect(repo.actualizarPerfil).not.toHaveBeenCalled()
  })

  it('la RECHAZA si además se intenta cambiar el CORREO', async () => {
    // La excepción existe para poner una contraseña, no para apropiarse de la
    // cuenta. Cambiar el correo con una sesión robada sería justo el ataque que
    // la puerta de reautenticación cierra.
    await expect(
      actualizarPerfilCtrl(contextoGoogle(), { password: NUEVA, email: 'otro@ejemplo.com' }),
    ).rejects.toMatchObject({ status: 401 })
    expect(repo.actualizarPerfil).not.toHaveBeenCalled()
  })

  it('sigue exigiendo la anterior para cambiar SOLO el correo', async () => {
    await expect(
      actualizarPerfilCtrl(contextoGoogle(), { email: 'otro@ejemplo.com' }),
    ).rejects.toMatchObject({ status: 401 })
    expect(repo.actualizarPerfil).not.toHaveBeenCalled()
  })
})

describe('ADR 0018 · el camino normal no cambia', () => {
  it('con la contraseña anterior CORRECTA, deja cambiarla igual que antes', async () => {
    auth.verifyPassword.mockResolvedValue(true)
    const res = await actualizarPerfilCtrl(
      contextoGoogle({ debeCambiarPassword: false, metodoSesion: 'password' }),
      { password: NUEVA, passwordActual: 'la-vieja' },
    )
    expect(res).toEqual({ ok: true })
    expect(auth.verifyPassword).toHaveBeenCalled()
  })

  it('con la contraseña anterior INCORRECTA, sigue devolviendo 401', async () => {
    auth.verifyPassword.mockResolvedValue(false)
    await expect(
      actualizarPerfilCtrl(
        contextoGoogle({ debeCambiarPassword: false, metodoSesion: 'password' }),
        { password: NUEVA, passwordActual: 'equivocada' },
      ),
    ).rejects.toMatchObject({ status: 401 })
  })
})
