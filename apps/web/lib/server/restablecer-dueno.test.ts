import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  SEG-21OCT · A2 — un ADMINISTRADOR no puede restablecer la contraseña de un
//  DUEÑO, y por tanto no puede entrar como él.
// ----------------------------------------------------------------------------
//  Auditoría del 2026-10-21. `restablecerPasswordCtrl` pasaba por
//  `conGuardasDeDueno` con `{ rol: undefined, activo: undefined }`, y los
//  guardas solo miran si el Dueño PIERDE el rol. Un restablecimiento no se lo
//  quita, así que no saltaba ninguno:
//
//    1. el Administrador hace POST /api/usuarios/<Dueño>/restablecer/
//    2. recibe la temporal EN CLARO en la respuesta (está hecho así a propósito)
//    3. entra con el correo del Dueño y esa temporal, y la cambia en /api/perfil
//    4. ya es el Dueño: nombra Dueños, cambia la configuración, borra al otro
//
//  Es exactamente la salida que el ADR 0040 quiso cerrar con el guard 3
//  («un administrador no se fabrica un Dueño aliado»): aquí no se lo fabrica,
//  se convierte en él. La regla nueva: **las credenciales de un Dueño solo las
//  toca otro Dueño**. Mira el ROL y no el permiso, por la misma razón que el
//  guard 3: `administracion.crear` es un DATO que un Dueño puede conceder a
//  cualquier rol.
// ============================================================================

const { cliente, consultas } = vi.hoisted(() => {
  const consultas: { sql: string; params: unknown[] }[] = []
  const cliente = {
    // La fila del objetivo es un Dueño activo, y hay otro Dueño más: el guard 2
    // («la empresa se queda sin Dueño») NO aplica, así que si algo rechaza es
    // la regla nueva y no otra.
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      consultas.push({ sql, params })
      if (/for update/.test(sql)) {
        return {
          rows: [
            { id: 'D1', rol: 'DUENO', activo: true },
            { id: 'D2', rol: 'DUENO', activo: true },
          ],
        }
      }
      if (/^\s*update usuarios/.test(sql)) {
        return { rows: [{ id: 'D1', nombre: 'Dueña', email: 'd@x', cargo: null, rol: 'DUENO', activo: true, creado_en: new Date() }] }
      }
      return { rows: [] }
    }),
    release: vi.fn(),
  }
  return { cliente, consultas }
})

vi.mock('./db', () => ({
  pool: { connect: vi.fn(async () => cliente) },
  q: vi.fn(async () => []),
  q1: vi.fn(async () => null),
  qConTenant: vi.fn(async () => []),
  qRaw: vi.fn(async () => []),
  qRaw1: vi.fn(async () => null),
  fijarTenantExplicito: vi.fn(async () => undefined),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'T1') }))

import { rechazoDelCambio } from '@/lib/guardas-usuarios'
import { actualizarUsuario } from './usuarios-repo'

const dueno = { rol: 'DUENO', activo: true }

beforeEach(() => {
  consultas.length = 0
  cliente.query.mockClear()
})

describe('A2 · la regla: las credenciales de un Dueño solo las toca un Dueño', () => {
  it('un ADMINISTRADOR NO puede restablecerle la contraseña a un Dueño', () => {
    const r = rechazoDelCambio({
      actorRol: 'ADMINISTRADOR',
      objetivo: dueno,
      cambio: { credenciales: true },
      duenosActivos: 3,
    })
    // 403: no es cosa suya, y no lo será por muchos Dueños que haya.
    expect(r?.status).toBe(403)
    expect(r?.mensaje).toMatch(/Dueño/)
  })

  it('tampoco ningún otro rol, aunque se le haya concedido administracion.crear', () => {
    for (const actorRol of ['GERENTE', 'DIRECTOR', 'VENDEDOR', 'FINANZAS']) {
      expect(
        rechazoDelCambio({ actorRol, objetivo: dueno, cambio: { credenciales: true }, duenosActivos: 3 })?.status,
        actorRol,
      ).toBe(403)
    }
  })

  it('y le da igual que el Dueño esté desactivado', () => {
    // Reactivarlo después y entrar con la temporal es la misma toma de cuenta.
    expect(
      rechazoDelCambio({
        actorRol: 'ADMINISTRADOR',
        objetivo: { rol: 'DUENO', activo: false },
        cambio: { credenciales: true },
        duenosActivos: 1,
      })?.status,
    ).toBe(403)
  })
})

describe('A2 · lo que la regla NO cierra', () => {
  it('un Dueño SÍ puede restablecérsela a otro Dueño', () => {
    expect(
      rechazoDelCambio({ actorRol: 'DUENO', objetivo: dueno, cambio: { credenciales: true }, duenosActivos: 2 }),
    ).toBeNull()
  })

  it('un ADMINISTRADOR SÍ puede restablecérsela a quien no es Dueño', () => {
    expect(
      rechazoDelCambio({
        actorRol: 'ADMINISTRADOR',
        objetivo: { rol: 'VENDEDOR', activo: true },
        cambio: { credenciales: true },
        duenosActivos: 1,
      }),
    ).toBeNull()
  })

  it('y editarle el cargo a un Dueño sigue siendo posible (no son credenciales)', () => {
    expect(
      rechazoDelCambio({ actorRol: 'ADMINISTRADOR', objetivo: dueno, cambio: {}, duenosActivos: 1 }),
    ).toBeNull()
  })
})

describe('A2 · el repo le pasa la señal al guard', () => {
  it('escribir un passwordHash sobre un Dueño, siendo ADMINISTRADOR, se rechaza SIN escribir', async () => {
    await expect(
      actualizarUsuario('D1', { passwordHash: 'hash', debeCambiarPassword: true }, 'ADMINISTRADOR'),
    ).rejects.toMatchObject({ status: 403 })

    // Lo que importa: no llegó a haber `update`. Un guard que rechaza DESPUÉS de
    // escribir no es un guard.
    expect(consultas.some((c) => /^\s*update usuarios/.test(c.sql))).toBe(false)
    expect(consultas.some((c) => /^rollback$/.test(c.sql))).toBe(true)
  })

  it('el mismo restablecimiento hecho por un Dueño sí escribe', async () => {
    const u = await actualizarUsuario('D1', { passwordHash: 'hash', debeCambiarPassword: true }, 'DUENO')
    expect(u).not.toBeNull()
    expect(consultas.some((c) => /^\s*update usuarios/.test(c.sql))).toBe(true)
  })
})
